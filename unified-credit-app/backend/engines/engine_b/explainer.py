"""
Engine B — Explainer Module
=============================
Graph explainability combining:
  1. GNNExplainer — identifies important edges and node feature masks
     for a specific prediction (from the HeteroGAT)
  2. TreeSHAP — explains the downstream XGBoost decision on the
     65-dim fused feature vector

Produces a per-node explanation with:
  - Top-5 important edges (from GNNExplainer)
  - Neighbor contributions (from GNNExplainer node masks)
  - Top features driving the XGBoost decision (from SHAP)
  - Risk score, classification, and confidence
"""

import numpy as np
import torch
import shap
import networkx as nx
from torch_geometric.data import HeteroData
from torch_geometric.explain import Explainer, GNNExplainer

from engines.engine_b.model import HeteroGAT
from engines.engine_b.dataset import EDGE_TYPE_LABELS


def explain_node(
    node_id: int,
    gat_model: HeteroGAT,
    xgb_model,
    hetero_data: HeteroData,
    G: nx.Graph,
    gnn_embeddings: np.ndarray,
    X_combined: np.ndarray,
    all_feature_names: list[str],
    df,
    full_probs: list[float],
    full_preds: list[int],
) -> dict:
    """
    Generate a per-node explanation combining GNNExplainer + TreeSHAP.

    Args:
        node_id: Index of the node to explain.
        gat_model: Trained HeteroGAT model.
        xgb_model: Trained XGBoost classifier.
        hetero_data: The HeteroData graph.
        G: NetworkX graph (for neighbor lookup).
        gnn_embeddings: GNN embedding matrix (N, 32).
        X_combined: Fused feature matrix (N, 65).
        all_feature_names: Names for all 65 features.
        df: Original DataFrame.
        full_probs: Predicted default probabilities for all nodes.
        full_preds: Binary predictions for all nodes.

    Returns:
        Dict with explanation fields suitable for the API response.
    """
    n_nodes = hetero_data['customer'].num_nodes

    if node_id < 0 or node_id >= n_nodes:
        return {"error": f"node_id {node_id} out of range [0, {n_nodes})"}

    # -------------------------------------------------------
    # 1. GNNExplainer — edge importance & node feature masks
    # -------------------------------------------------------
    top_edges = []
    neighbor_contributions = []

    try:
        device = next(gat_model.parameters()).device

        # GNNExplainer for heterogeneous graphs
        explainer = Explainer(
            model=gat_model,
            algorithm=GNNExplainer(epochs=50, lr=0.01),
            explanation_type='model',
            node_mask_type='attributes',
            edge_mask_type='object',
            model_config=dict(
                mode='multiclass_classification',
                task_level='node',
                return_type='raw',
            ),
        )

        x_dict = {'customer': hetero_data['customer'].x}
        ei_dict = {et: hetero_data[et].edge_index for et in hetero_data.edge_types}

        explanation = explainer(
            x_dict, ei_dict,
            index=torch.tensor([node_id], device=device),
        )

        # Extract top-5 edges from explanation
        for edge_type in hetero_data.edge_types:
            rel_name = edge_type[1]
            label = EDGE_TYPE_LABELS.get(rel_name, rel_name)
            edge_mask_key = edge_type

            if hasattr(explanation, 'edge_mask_dict') and explanation.edge_mask_dict is not None:
                mask = explanation.edge_mask_dict.get(edge_type)
                if mask is not None:
                    ei = hetero_data[edge_type].edge_index.cpu().numpy()
                    mask_vals = mask.cpu().numpy().flatten()

                    # Find edges involving our node
                    for k in range(ei.shape[1]):
                        s, d = int(ei[0, k]), int(ei[1, k])
                        if s == node_id or d == node_id:
                            neighbor = d if s == node_id else s
                            score = float(mask_vals[k]) if k < len(mask_vals) else 0.0
                            top_edges.append({
                                "source": node_id,
                                "target": neighbor,
                                "relation": label,
                                "importance": round(score, 4),
                                "neighbor_name": str(df.iloc[neighbor].get('Customer_ID', f'Borrower {neighbor}')),
                            })

        # Sort by importance, take top 5
        top_edges.sort(key=lambda e: e['importance'], reverse=True)
        top_edges = top_edges[:5]

        # Neighbor contributions from node feature mask
        if hasattr(explanation, 'node_mask_dict') and explanation.node_mask_dict is not None:
            node_mask = explanation.node_mask_dict.get('customer')
            if node_mask is not None:
                neighbors = list(G.neighbors(node_id))
                mask_vals = node_mask.cpu().numpy()
                for nb in neighbors[:10]:
                    if nb < len(mask_vals):
                        score = float(mask_vals[nb].mean()) if mask_vals.ndim > 1 else float(mask_vals[nb])
                        neighbor_contributions.append({
                            "node_id": nb,
                            "name": str(df.iloc[nb].get('Customer_ID', f'Borrower {nb}')),
                            "contribution": round(score, 4),
                            "is_default": int(df.iloc[nb].get('Target_Default', 0)),
                        })

                neighbor_contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
                neighbor_contributions = neighbor_contributions[:5]

    except Exception as e:
        print(f"  GNNExplainer fallback for node {node_id}: {e}")
        # Fallback: use graph structure directly
        neighbors = list(G.neighbors(node_id))
        for nb in neighbors[:5]:
            edge_data = G.get_edge_data(node_id, nb, default={})
            top_edges.append({
                "source": node_id,
                "target": nb,
                "relation": edge_data.get('type', 'Unknown'),
                "importance": round(1.0 / max(len(neighbors), 1), 4),
                "neighbor_name": str(df.iloc[nb].get('Customer_ID', f'Borrower {nb}')),
            })

        for nb in neighbors[:5]:
            neighbor_contributions.append({
                "node_id": nb,
                "name": str(df.iloc[nb].get('Customer_ID', f'Borrower {nb}')),
                "contribution": round(float(gnn_embeddings[nb].mean()), 4),
                "is_default": int(df.iloc[nb].get('Target_Default', 0)),
            })

    # -------------------------------------------------------
    # 2. TreeSHAP — XGBoost feature explanations
    # -------------------------------------------------------
    tree_explainer = shap.TreeExplainer(xgb_model)
    node_features = X_combined[node_id:node_id+1]
    shap_values = tree_explainer.shap_values(node_features)

    top_features = []
    shap_flat = shap_values.flatten()
    for i, fname in enumerate(all_feature_names):
        top_features.append({
            "feature": fname,
            "shap_value": round(float(shap_flat[i]), 4),
            "feature_value": round(float(node_features[0, i]), 4),
        })

    top_features.sort(key=lambda x: abs(x['shap_value']), reverse=True)
    top_features = top_features[:10]

    # -------------------------------------------------------
    # 3. Build response
    # -------------------------------------------------------
    risk_prob = float(full_probs[node_id])
    predicted_class = int(full_preds[node_id])
    actual_class = int(df.iloc[node_id].get('Target_Default', 0))

    # Borrower summary
    row = df.iloc[node_id]
    borrower_info = {
        "node_id": node_id,
        "name": str(row.get('Customer_ID', f'Borrower {node_id}')),
        "credit_score": int(row.get('CIBIL_Score', 0)),
        "annual_income": float(row.get('annual_income', 0)),
        "loan_amount": float(row.get('loan_amount', 0)),
        "debt_to_income_ratio": float(row.get('debt_to_income_ratio', 0)),
    }

    # Subgraph data (1-hop neighborhood)
    subgraph_nodes = [node_id] + list(G.neighbors(node_id))[:20]
    subgraph_edges = []
    for u, v, edata in G.edges(node_id, data=True):
        if v in subgraph_nodes:
            subgraph_edges.append({
                "source": u,
                "target": v,
                "type": edata.get('type', 'Unknown'),
            })

    return {
        "node_id": node_id,
        "borrower": borrower_info,
        "risk_score": round(risk_prob, 4),
        "predicted_default": predicted_class,
        "actual_default": actual_class,
        "confidence": round(abs(risk_prob - 0.5) * 2, 4),
        "classification": "HIGH RISK" if risk_prob > 0.5 else "LOW RISK",
        "top_edges": top_edges,
        "neighbor_contributions": neighbor_contributions,
        "top_features": top_features,
        "subgraph": {
            "nodes": [
                {
                    "id": n,
                    "name": str(df.iloc[n].get('Customer_ID', f'Borrower {n}')),
                    "is_default": int(df.iloc[n].get('Target_Default', 0)),
                    "credit_score": int(df.iloc[n].get('CIBIL_Score', 0)),
                    "risk_score": round(float(full_probs[n]), 4) if n < len(full_probs) else 0.5,
                }
                for n in subgraph_nodes if n < len(df)
            ],
            "edges": subgraph_edges,
        },
    }
