"""
Engine B — Trainer Module
==========================
Full training pipeline:
  1. Train HeteroGAT via NeighborLoader mini-batches
  2. Extract 32-dim node embeddings
  3. Compute classical graph features (degree, PageRank, clustering, etc.)
  4. Fuse tabular (28) + graph (5) + GNN (32) = 65 features
  5. Train XGBoost on fused representation
  6. Compute metrics, SHAP, ROC curve, cluster analysis
"""

import numpy as np
import pandas as pd
import networkx as nx
import torch
import torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score,
    accuracy_score, confusion_matrix, roc_curve
)
import xgboost as xgb
import shap
import warnings
warnings.filterwarnings("ignore")

from torch_geometric.data import HeteroData

from engines.engine_a import TABULAR_FEATURES
from engines.engine_b.model import HeteroGAT, EMBEDDING_DIM
from engines.engine_b.dataset import (
    build_hetero_data, get_neighbor_loader,
    RELATION_DEFS, EDGE_TYPE_LABELS,
)

# Training hyperparameters
GAT_EPOCHS = 10
GAT_LR = 0.005
BATCH_SIZE = 256
PATIENCE = 5


# ============================================================
# Classical graph features from the heterogeneous edges
# ============================================================
def _build_nx_graph(data: HeteroData, n_nodes: int) -> nx.Graph:
    """Build a NetworkX graph from all edge types in the HeteroData."""
    G = nx.Graph()
    G.add_nodes_from(range(n_nodes))

    for edge_type in data.edge_types:
        rel_name = edge_type[1]
        label = EDGE_TYPE_LABELS.get(rel_name, rel_name)
        ei = data[edge_type].edge_index.cpu().numpy()
        for k in range(ei.shape[1]):
            s, d = int(ei[0, k]), int(ei[1, k])
            if s < d:  # avoid duplicate undirected edges
                G.add_edge(s, d, type=label)

    return G


def _compute_graph_features(G: nx.Graph, n_nodes: int) -> tuple[np.ndarray, list[str]]:
    """
    Compute 5 classical graph features per node:
      degree_centrality, pagerank, clustering_coefficient,
      cluster_size, is_in_cluster
    """
    dc = nx.degree_centrality(G)

    try:
        pr = nx.pagerank(G, max_iter=100, tol=1e-4)
    except Exception:
        pr = {i: 1.0 / n_nodes for i in range(n_nodes)}

    cc = nx.clustering(G)

    components = list(nx.connected_components(G))
    node_cluster_size = {}
    node_in_cluster = {}
    for comp in components:
        size = len(comp)
        for node in comp:
            node_cluster_size[node] = size
            node_in_cluster[node] = 1 if size > 2 else 0

    features = np.zeros((n_nodes, 5), dtype=np.float32)
    for i in range(n_nodes):
        features[i, 0] = dc.get(i, 0)
        features[i, 1] = pr.get(i, 1.0 / n_nodes)
        features[i, 2] = cc.get(i, 0)
        features[i, 3] = node_cluster_size.get(i, 1)
        features[i, 4] = node_in_cluster.get(i, 0)

    names = [
        'degree_centrality', 'pagerank', 'clustering_coefficient',
        'cluster_size', 'is_in_cluster'
    ]
    return features, names


# ============================================================
# Mini-batch HeteroGAT training
# ============================================================
def _train_hetero_gat(
    data: HeteroData,
    train_mask: np.ndarray,
    device: torch.device,
) -> tuple[HeteroGAT, np.ndarray]:
    """
    Train HeteroGAT using NeighborLoader mini-batches.

    Returns:
        (model, embeddings)  — embeddings shape (N, EMBEDDING_DIM) on CPU
    """
    n_nodes = data['customer'].num_nodes
    in_channels = data['customer'].x.shape[1]
    metadata = data.metadata()

    model = HeteroGAT(
        metadata=metadata,
        in_channels=in_channels,
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=GAT_LR, weight_decay=5e-4)

    # Class weights for imbalanced data
    y_all = data['customer'].y.cpu().numpy()
    n_pos = y_all[train_mask].sum()
    n_neg = train_mask.sum() - n_pos
    weight = torch.tensor([1.0, n_neg / max(n_pos, 1)], dtype=torch.float32).to(device)
    
    train_mask_t = torch.tensor(train_mask, dtype=torch.bool).to(device)

    # NeighborLoader for training nodes
    train_indices = torch.where(train_mask_t)[0]
    train_loader = get_neighbor_loader(
        data, input_nodes=('customer', train_indices),
        batch_size=BATCH_SIZE, shuffle=True,
    )

    # Check if NeighborLoader is supported (requires pyg-lib or torch-sparse)
    try:
        next(iter(train_loader))
        use_loader = True
    except ImportError:
        print("  [Warning] pyg-lib or torch-sparse not installed. Falling back to full-batch training.")
        use_loader = False

    best_loss = float('inf')
    patience_counter = 0

    model.train()
    for epoch in range(GAT_EPOCHS):
        total_loss = 0.0
        n_batches = 0

        if use_loader:
            for batch in train_loader:
                batch = batch.to(device)
                optimizer.zero_grad()

                x_dict = {'customer': batch['customer'].x}
                ei_dict = {et: batch[et].edge_index for et in batch.edge_types}

                _, logits = model.predict(x_dict, ei_dict)
                seed_mask = batch['customer'].input_id if hasattr(batch['customer'], 'input_id') else slice(None)
                loss = F.cross_entropy(logits[:batch['customer'].batch_size], batch['customer'].y[:batch['customer'].batch_size], weight=weight)

                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                n_batches += 1
        else:
            # Full-batch fallback
            optimizer.zero_grad()
            x_dict = {'customer': data['customer'].x.to(device)}
            ei_dict = {et: data[et].edge_index.to(device) for et in data.edge_types}
            
            _, logits = model.predict(x_dict, ei_dict)
            loss = F.cross_entropy(logits[train_mask_t], data['customer'].y.to(device)[train_mask_t], weight=weight)
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            n_batches = 1

        avg_loss = total_loss / max(n_batches, 1)

        if avg_loss < best_loss:
            best_loss = avg_loss
            patience_counter = 0
        else:
            patience_counter += 1

        if patience_counter >= PATIENCE:
            print(f"  HeteroGAT early stop at epoch {epoch + 1}, loss: {best_loss:.4f}")
            break

        if (epoch + 1) % 25 == 0:
            print(f"  HeteroGAT Epoch {epoch + 1}/{GAT_EPOCHS}, Loss: {avg_loss:.4f}")

    # Extract full embeddings (full batch inference)
    model.eval()
    with torch.no_grad():
        x_dict = {'customer': data['customer'].x}
        ei_dict = {et: data[et].edge_index for et in data.edge_types}
        emb_dict = model(x_dict, ei_dict)
        embeddings = emb_dict['customer'].cpu().numpy()

    print(f"  HeteroGAT embeddings: {embeddings.shape}")
    return model, embeddings


# ============================================================
# Full training pipeline
# ============================================================
def train(financial_df: pd.DataFrame, fraud_df: pd.DataFrame) -> dict:
    """
    Full Engine B training pipeline.

    Args:
        financial_df: Financial dataset DataFrame.
        fraud_df: Fraud network edges DataFrame.

    Returns:
        Result dict with metrics, feature_weights, roc_curve, predictions,
        graph info, and internal objects for Engine C / explainability.
    """
    print("[Engine B] Starting Heterogeneous GNN + XGBoost Engine...")

    # Detect GPU
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"  Using device: {device}")
    if device.type == 'cuda':
        print(f"  GPU: {torch.cuda.get_device_name(0)}")
        mem_gb = torch.cuda.get_device_properties(0).total_mem / 1e9
        print(f"  GPU Memory: {mem_gb:.1f} GB")

    df = pd.merge(financial_df, fraud_df, on='Customer_ID', how='inner')

    # Step 1: Build heterogeneous graph
    print("  Step 1: Building heterogeneous multi-view graph...")
    hetero_data, tab_scaler, edge_counts = build_hetero_data(financial_df, fraud_df, device)

    # Step 2: Build NetworkX for classical features
    print("  Step 2: Computing classical graph features...")
    n_nodes = len(df)
    G = _build_nx_graph(hetero_data, n_nodes)
    graph_feats, graph_feat_names = _compute_graph_features(G, n_nodes)

    # Pre-compute 3D layout
    print("  Pre-computing 3D layout coordinates...")
    pos_3d = nx.spring_layout(G, dim=3, k=1.0/np.sqrt(len(G.nodes())), iterations=50, seed=42)
    node_positions = {int(node): {'x': float(coords[0]) * 500, 'y': float(coords[1]) * 500, 'z': float(coords[2]) * 500} for node, coords in pos_3d.items()}

    # Step 3: Train/test split
    y = df['Target_Default'].values
    indices = np.arange(n_nodes)
    train_idx, test_idx = train_test_split(
        indices, test_size=0.2, random_state=42, stratify=y
    )
    train_mask = np.zeros(n_nodes, dtype=bool)
    train_mask[train_idx] = True

    # Step 4: Train HeteroGAT
    print("  Step 3: Training HeteroGAT on GPU...")
    gat_model, gnn_embeddings = _train_hetero_gat(hetero_data, train_mask, device)

    # Step 5: Combine features
    print("  Step 4: Combining tabular + graph + GNN embeddings...")
    X_tab = tab_scaler.transform(df[TABULAR_FEATURES].fillna(0).values)

    scaler_gnn = StandardScaler()
    gnn_scaled = scaler_gnn.fit_transform(gnn_embeddings)

    scaler_graph = StandardScaler()
    graph_scaled = scaler_graph.fit_transform(graph_feats)

    X_combined = np.hstack([X_tab, graph_scaled, gnn_scaled])

    all_feature_names = (
        TABULAR_FEATURES
        + graph_feat_names
        + [f'gnn_embedding_{i}' for i in range(EMBEDDING_DIM)]
    )

    print(f"  Combined features: {X_combined.shape[1]} "
          f"({len(TABULAR_FEATURES)} tab + {len(graph_feat_names)} graph + {EMBEDDING_DIM} GNN)")

    # Step 6: XGBoost on combined features
    print("  Step 5: Training XGBoost on combined features...")
    X_train = X_combined[train_idx]
    X_test = X_combined[test_idx]
    y_train = y[train_idx]
    y_test = y[test_idx]

    xgb_model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=1.0,
        reg_alpha=0.1,
        scale_pos_weight=len(y_train[y_train == 0]) / max(len(y_train[y_train == 1]), 1),
        random_state=42,
        eval_metric='logloss',
        use_label_encoder=False,
    )

    xgb_model.fit(X_train, y_train, verbose=False)

    # Predictions
    y_pred = xgb_model.predict(X_test)
    y_prob = xgb_model.predict_proba(X_test)[:, 1]

    full_probs = xgb_model.predict_proba(X_combined)[:, 1]
    full_preds = xgb_model.predict(X_combined)

    # Metrics
    roc_auc = roc_auc_score(y_test, y_prob)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    accuracy = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    print(f"  ROC-AUC: {roc_auc:.4f}")
    print(f"  Precision: {precision:.4f} | Recall: {recall:.4f} | F1: {f1:.4f}")

    # ROC curve
    fpr_vals, tpr_vals, _ = roc_curve(y_test, y_prob)
    indices_roc = np.linspace(0, len(fpr_vals) - 1, min(20, len(fpr_vals)), dtype=int)
    roc_points = [
        {"fpr": round(float(fpr_vals[i]), 4), "tpr": round(float(tpr_vals[i]), 4)}
        for i in indices_roc
    ]

    # SHAP
    print("  Step 6: Computing SHAP values...")
    explainer_shap = shap.TreeExplainer(xgb_model)
    shap_values = explainer_shap.shap_values(X_test)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)

    feature_weights = []
    for i, fname in enumerate(all_feature_names):
        mean_shap_signed = shap_values[:, i].mean()
        feature_weights.append({
            "name": fname,
            "weight": round(float(mean_shap_signed), 4),
            "importance": round(float(mean_abs_shap[i]), 4),
        })

    feature_weights.sort(key=lambda x: abs(x["importance"]), reverse=True)

    # Cluster analysis
    components = list(nx.connected_components(G))
    cluster_nodes = set()
    for comp in components:
        if len(comp) > 2:
            cluster_nodes.update(comp)

    in_cluster_defaults = sum(1 for n in cluster_nodes if y[n] == 1) / max(len(cluster_nodes), 1) * 100
    out_cluster_nodes = set(range(n_nodes)) - cluster_nodes
    out_cluster_defaults = sum(1 for n in out_cluster_nodes if y[n] == 1) / max(len(out_cluster_nodes), 1) * 100

    default_rate = float(y.mean() * 100)

    # Graph view data for 3D visualization
    graph_view_data = []
    for col, rel_name in RELATION_DEFS.items():
        label = EDGE_TYPE_LABELS[rel_name]
        if col in df.columns:
            groups = df.groupby(col).groups
            edge_count = sum(1 for v in groups.values() if len(v) >= 2)
            pct = edge_count / max(len(groups), 1) * 100
            graph_view_data.append({
                "view": label,
                "edges": edge_count,
                "pct": round(pct, 1),
                "desc": f"Customers sharing {col.replace('_', ' ')}"
            })

    result = {
        "name": "Hybrid GNN Engine",
        "subtitle": f"HeteroGAT + XGBoost on {len(all_feature_names)} Features",
        "accentColor": "#4A2C76",
        "metrics": {
            "rocAuc": round(float(roc_auc), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4),
            "accuracy": round(float(accuracy), 4),
            "totalProcessed": int(n_nodes),
            "defaultRate": round(default_rate, 2),
            "confusionMatrix": cm.tolist(),
            "inClusterDefaultRate": round(in_cluster_defaults, 2),
            "outClusterDefaultRate": round(out_cluster_defaults, 2),
        },
        "featureWeights": feature_weights[:15],
        "rocCurve": roc_points,
        "graphInfo": {
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
            "edgeCounts": dict(edge_counts),
            "views": graph_view_data,
            "clusters": len([c for c in components if len(c) > 2]),
        },
        "methodology": {
            "title": "Heterogeneous Graph Neural Network Engine",
            "description": (
                "Multi-view heterogeneous graph construction with 6 relation types. "
                "2-layer HGTConv (Heterogeneous Graph Transformer) with type-aware attention "
                f"produces {EMBEDDING_DIM}-dim trust embeddings per borrower. "
                "NeighborLoader mini-batch sampling for bounded GPU memory. "
                "Combined with tabular features for XGBoost decision engine. "
                "SHAP + GNNExplainer explainability on all features."
            ),
            "steps": [
                "Heterogeneous Multi-View Graph (6 relation types)",
                f"2-Layer HGTConv on {device} ({GAT_EPOCHS} epochs, NeighborLoader)",
                f"{EMBEDDING_DIM}-dim Node Embedding Extraction",
                f"XGBoost on {len(all_feature_names)} Combined Features",
                "SHAP TreeExplainer + GNNExplainer",
            ],
        },
        # Internal state
        "_full_probs": full_probs.tolist(),
        "_full_preds": full_preds.tolist(),
        "_y_test": y_test.tolist(),
        "_y_prob": y_prob.tolist(),
        "_y_pred": y_pred.tolist(),
        "_graph": G,
        "_model": xgb_model,
        "_gat_model": gat_model,
        "_hetero_data": hetero_data,
        "_gnn_embeddings": gnn_embeddings,
        "_X_combined": X_combined,
        "_all_feature_names": all_feature_names,
        "_train_idx": train_idx.tolist(),
        "_test_idx": test_idx.tolist(),
        "_node_positions": node_positions,
        "_full_names": df['Customer_ID'].tolist(),
    }

    print("[Engine B] Complete.\n")
    return result
