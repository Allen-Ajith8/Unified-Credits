"""
Engine B: Hybrid GNN + XGBoost Engine
======================================
Multi-view graph construction from shared devices, IPs, employers.
2-layer GAT (Graph Attention Network) produces 32-dim trust embeddings.
Combined with tabular features for XGBoost decision engine.
Uses PyTorch Geometric on CUDA (RTX 4060).
"""

import pandas as pd
import numpy as np
import networkx as nx
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score,
    accuracy_score, confusion_matrix, roc_curve
)
import xgboost as xgb
import shap
import torch
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import GATConv
import warnings
warnings.filterwarnings("ignore")

from engines.engine_a import TABULAR_FEATURES

# Graph link columns for multi-view construction
LINK_COLUMNS = {
    'device_id': 'Shared Device',
    'ip_address': 'Shared IP',
    'employer_id': 'Shared Employer',
}

EMBEDDING_DIM = 32
HIDDEN_DIM = 64
GAT_EPOCHS = 100
GAT_LR = 0.005


# ============================================================
# GAT Model Definition
# ============================================================
class CreditGAT(torch.nn.Module):
    """
    2-layer Graph Attention Network for credit risk embedding.
    Input: tabular node features
    Output: 32-dim embedding per node
    """
    def __init__(self, in_channels, hidden_channels=HIDDEN_DIM, out_channels=EMBEDDING_DIM, heads=4):
        super().__init__()
        self.conv1 = GATConv(in_channels, hidden_channels, heads=heads, dropout=0.3)
        self.conv2 = GATConv(hidden_channels * heads, out_channels, heads=1, concat=False, dropout=0.3)
        self.classifier = torch.nn.Linear(out_channels, 2)  # For training signal
    
    def forward(self, x, edge_index):
        # Layer 1: Multi-head attention
        x = self.conv1(x, edge_index)
        x = F.elu(x)
        x = F.dropout(x, p=0.3, training=self.training)
        
        # Layer 2: Single-head attention → embedding
        x = self.conv2(x, edge_index)
        return x
    
    def predict(self, x, edge_index):
        """Get embeddings + classification logits"""
        embeddings = self.forward(x, edge_index)
        logits = self.classifier(embeddings)
        return embeddings, logits


# ============================================================
# Graph Construction
# ============================================================
def build_multi_view_graph(df: pd.DataFrame) -> tuple:
    """
    Build multi-view graph from shared attributes.
    Returns NetworkX graph and edge type info.
    """
    G = nx.Graph()
    
    # Add all nodes
    for idx in range(len(df)):
        G.add_node(idx, customer_id=df.iloc[idx]['customer_id'])
    
    edge_counts = {}
    
    for col, label in LINK_COLUMNS.items():
        if col not in df.columns:
            continue
        
        # Group customers by shared attribute
        groups = df.groupby(col).groups
        count = 0
        for val, indices in groups.items():
            if pd.isna(val) or len(indices) < 2:
                continue
            idx_list = indices.tolist()
            # Connect all pairs within group (limit to avoid explosion)
            for i in range(len(idx_list)):
                for j in range(i + 1, min(i + 10, len(idx_list))):
                    G.add_edge(idx_list[i], idx_list[j], type=label)
                    count += 1
        
        edge_counts[label] = count
    
    # Add co_applicant and guarantor direct edges
    direct_count = 0
    if 'co_applicant_id' in df.columns:
        for idx, row in df.iterrows():
            if pd.notna(row.get('co_applicant_id')):
                # Find the co-applicant node
                matches = df[df['customer_id'] == row['co_applicant_id']].index.tolist()
                for m in matches:
                    G.add_edge(idx, m, type='Co-Applicant')
                    direct_count += 1
    
    edge_counts['Direct Links'] = direct_count
    
    print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    for k, v in edge_counts.items():
        print(f"    {k}: {v} edges")
    
    return G, edge_counts


def compute_graph_features(G: nx.Graph, n_nodes: int) -> np.ndarray:
    """
    Compute classical graph features for each node.
    Returns array of shape (n_nodes, 5): degree_centrality, pagerank, 
    clustering_coefficient, cluster_size, is_in_cluster
    """
    # Degree centrality
    dc = nx.degree_centrality(G)
    
    # PageRank
    try:
        pr = nx.pagerank(G, max_iter=100, tol=1e-4)
    except:
        pr = {i: 1.0 / n_nodes for i in range(n_nodes)}
    
    # Clustering coefficient
    cc = nx.clustering(G)
    
    # Connected components (clusters)
    components = list(nx.connected_components(G))
    node_cluster_size = {}
    node_in_cluster = {}
    for comp in components:
        size = len(comp)
        for node in comp:
            node_cluster_size[node] = size
            node_in_cluster[node] = 1 if size > 2 else 0
    
    features = np.zeros((n_nodes, 5))
    for i in range(n_nodes):
        features[i, 0] = dc.get(i, 0)
        features[i, 1] = pr.get(i, 1.0 / n_nodes)
        features[i, 2] = cc.get(i, 0)
        features[i, 3] = node_cluster_size.get(i, 1)
        features[i, 4] = node_in_cluster.get(i, 0)
    
    return features


# ============================================================
# PyTorch Geometric Data Conversion
# ============================================================
def graph_to_pyg_data(G: nx.Graph, node_features: np.ndarray, labels: np.ndarray, device: torch.device) -> Data:
    """Convert NetworkX graph + features to PyG Data object on GPU."""
    
    # Edge index
    if G.number_of_edges() > 0:
        edges = list(G.edges())
        edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
        # Make undirected (add reverse edges)
        edge_index = torch.cat([edge_index, edge_index.flip(0)], dim=1)
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)
    
    # Node features and labels
    x = torch.tensor(node_features, dtype=torch.float32)
    y = torch.tensor(labels, dtype=torch.long)
    
    data = Data(x=x, edge_index=edge_index, y=y)
    data = data.to(device)
    
    return data


# ============================================================
# Train GAT
# ============================================================
def train_gat(data: Data, in_channels: int, device: torch.device, 
              train_mask: np.ndarray) -> tuple:
    """
    Train the GAT model for node classification.
    Returns trained model and extracted embeddings.
    """
    model = CreditGAT(in_channels=in_channels).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=GAT_LR, weight_decay=5e-4)
    
    # Create train/test masks
    train_mask_t = torch.tensor(train_mask, dtype=torch.bool).to(device)
    test_mask_t = ~train_mask_t
    
    # Class weights for imbalanced data
    n_pos = data.y[train_mask_t].sum().item()
    n_neg = train_mask_t.sum().item() - n_pos
    weight = torch.tensor([1.0, n_neg / max(n_pos, 1)], dtype=torch.float32).to(device)
    
    model.train()
    best_loss = float('inf')
    patience = 15
    patience_counter = 0
    
    for epoch in range(GAT_EPOCHS):
        optimizer.zero_grad()
        embeddings, logits = model.predict(data.x, data.edge_index)
        
        loss = F.cross_entropy(logits[train_mask_t], data.y[train_mask_t], weight=weight)
        loss.backward()
        optimizer.step()
        
        current_loss = loss.item()
        if current_loss < best_loss:
            best_loss = current_loss
            patience_counter = 0
        else:
            patience_counter += 1
        
        if patience_counter >= patience:
            print(f"  GAT early stop at epoch {epoch + 1}, loss: {best_loss:.4f}")
            break
        
        if (epoch + 1) % 25 == 0:
            print(f"  GAT Epoch {epoch + 1}/{GAT_EPOCHS}, Loss: {current_loss:.4f}")
    
    # Extract embeddings
    model.eval()
    with torch.no_grad():
        embeddings = model(data.x, data.edge_index)
    
    return model, embeddings.cpu().numpy()


# ============================================================
# Main Engine B Runner
# ============================================================
def run(df: pd.DataFrame) -> dict:
    """
    Run Engine B: Build graph, train GAT, combine embeddings with tabular → XGBoost.
    
    Args:
        df: Full dataset DataFrame
        
    Returns:
        dict with metrics, feature_weights, roc_curve, predictions, graph info
    """
    print("[Engine B] Starting Hybrid GNN + XGBoost Engine...")
    
    # Detect GPU
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"  Using device: {device}")
    if device.type == 'cuda':
        print(f"  GPU: {torch.cuda.get_device_name(0)}")
    
    # Step 1: Build multi-view graph
    print("  Step 1: Building multi-view graph...")
    G, edge_counts = build_multi_view_graph(df)
    
    # Step 2: Compute classical graph features
    print("  Step 2: Computing graph features...")
    graph_feats = compute_graph_features(G, len(df))
    graph_feature_names = [
        'degree_centrality', 'pagerank', 'clustering_coefficient',
        'cluster_size', 'is_in_cluster'
    ]
    
    # Step 3: Prepare tabular features
    X_tab = df[TABULAR_FEATURES].fillna(0).values
    scaler_tab = StandardScaler()
    X_tab_scaled = scaler_tab.fit_transform(X_tab)
    
    y = df['default'].values
    
    # Step 4: Train GAT on GPU
    print("  Step 3: Training GAT on GPU...")
    # Node features for GAT = scaled tabular features
    node_features = X_tab_scaled.copy()
    
    # Create train/test split indices
    indices = np.arange(len(df))
    train_idx, test_idx = train_test_split(
        indices, test_size=0.2, random_state=42, stratify=y
    )
    train_mask = np.zeros(len(df), dtype=bool)
    train_mask[train_idx] = True
    
    # Convert to PyG format
    pyg_data = graph_to_pyg_data(G, node_features, y, device)
    
    # Train GAT
    gat_model, gnn_embeddings = train_gat(
        pyg_data, in_channels=node_features.shape[1], 
        device=device, train_mask=train_mask
    )
    
    print(f"  GNN Embeddings shape: {gnn_embeddings.shape}")
    
    # Step 5: Combine features
    print("  Step 4: Combining tabular + graph + GNN embeddings...")
    # Scale GNN embeddings
    scaler_gnn = StandardScaler()
    gnn_scaled = scaler_gnn.fit_transform(gnn_embeddings)
    
    # Scale graph features
    scaler_graph = StandardScaler()
    graph_scaled = scaler_graph.fit_transform(graph_feats)
    
    # Combined: tabular (28) + graph (5) + GNN embeddings (32) = 65 features
    X_combined = np.hstack([X_tab_scaled, graph_scaled, gnn_scaled])
    
    all_feature_names = (
        TABULAR_FEATURES + 
        graph_feature_names + 
        [f'gnn_embedding_{i}' for i in range(EMBEDDING_DIM)]
    )
    
    print(f"  Combined features: {X_combined.shape[1]} ({len(TABULAR_FEATURES)} tab + "
          f"{len(graph_feature_names)} graph + {EMBEDDING_DIM} GNN)")
    
    # Step 6: XGBoost on combined features
    print("  Step 5: Training XGBoost on combined features...")
    X_train = X_combined[train_idx]
    X_test = X_combined[test_idx]
    y_train = y[train_idx]
    y_test = y[test_idx]
    
    model = xgb.XGBClassifier(
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
    
    model.fit(X_train, y_train, verbose=False)
    
    # Predictions
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    # Full dataset predictions
    full_probs = model.predict_proba(X_combined)[:, 1]
    full_preds = model.predict(X_combined)
    
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
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
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
    out_cluster_nodes = set(range(len(df))) - cluster_nodes
    out_cluster_defaults = sum(1 for n in out_cluster_nodes if y[n] == 1) / max(len(out_cluster_nodes), 1) * 100
    
    default_rate = float(y.mean() * 100)
    
    # Graph data for 3D visualization
    graph_view_data = []
    for col, label in LINK_COLUMNS.items():
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
        "subtitle": f"GAT + XGBoost on {len(all_feature_names)} Features",
        "accentColor": "#4A2C76",
        "metrics": {
            "rocAuc": round(float(roc_auc), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4),
            "accuracy": round(float(accuracy), 4),
            "totalProcessed": int(len(df)),
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
            "edgeCounts": {k: v for k, v in edge_counts.items()},
            "views": graph_view_data,
            "clusters": len([c for c in components if len(c) > 2]),
        },
        "methodology": {
            "title": "Hybrid Graph Neural Network Engine",
            "description": (
                "Multi-view graph construction from shared devices, IPs, and employers. "
                "2-layer GAT (Graph Attention Network) produces 32-dim trust embeddings per borrower. "
                "Combined with tabular features for XGBoost decision engine. "
                "SHAP explainability on all 65 features."
            ),
            "steps": [
                "Multi-View Graph Construction (3 views + direct links)",
                f"2-Layer GAT on {device} ({GAT_EPOCHS} epochs)",
                f"{EMBEDDING_DIM}-dim Node Embedding Extraction",
                f"XGBoost on {len(all_feature_names)} Combined Features",
                "SHAP TreeExplainer on All Features",
            ],
        },
        # Internal
        "_full_probs": full_probs.tolist(),
        "_full_preds": full_preds.tolist(),
        "_y_test": y_test.tolist(),
        "_y_prob": y_prob.tolist(),
        "_y_pred": y_pred.tolist(),
        "_graph": G,
        "_model": model,
        "_gat_model": gat_model,
    }
    
    print("[Engine B] Complete.\n")
    return result
