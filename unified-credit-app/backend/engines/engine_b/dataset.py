"""
Engine B — Dataset Module
==========================
Constructs a PyTorch Geometric HeteroData object from a credit CSV.
Each borrower is a 'customer' node with tabular features.
Six edge types model relational links:
    ('customer', 'shared_device',  'customer')
    ('customer', 'shared_ip',      'customer')
    ('customer', 'shared_employer','customer')
    ('customer', 'shared_zip',     'customer')
    ('customer', 'shared_company', 'customer')
    ('customer', 'co_applicant',   'customer')

Includes NeighborLoader for scalable mini-batch GNN training.
"""

import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import HeteroData
from torch_geometric.loader import NeighborLoader
import warnings
warnings.filterwarnings("ignore")

from engines.engine_a import TABULAR_FEATURES

# ============================================================
# Relation type definitions
# ============================================================
RELATION_DEFS = {
    'Device_ID': 'shared_device',
    'IP_Address': 'shared_ip',
    'UPI_VPA': 'shared_upi',
}

EDGE_TYPE_LABELS = {
    'shared_device': 'Shared Device',
    'shared_ip': 'Shared IP',
    'shared_upi': 'Shared UPI',
}


# ============================================================
# Build HeteroData from DataFrame
# ============================================================
def build_hetero_data(
    financial_df: pd.DataFrame,
    fraud_df: pd.DataFrame,
    device: torch.device = torch.device('cpu'),
) -> tuple[HeteroData, StandardScaler, dict[str, int]]:
    """
    Build a PyG HeteroData graph from financial and fraud DataFrames.

    Args:
        financial_df: Financial tabular features + 'Target_Default'.
        fraud_df: Fraud network edge columns.
        device: Target device (cpu / cuda).

    Returns:
        (hetero_data, scaler, edge_counts)
        - hetero_data: HeteroData on `device`
        - scaler: Fitted StandardScaler (for later inverse transforms)
        - edge_counts: Dict mapping relation label → edge count
    """
    # Merge datasets on Customer_ID
    df = pd.merge(financial_df, fraud_df, on='Customer_ID', how='inner')
    n = len(df)

    # --- Node features ---
    X = df[TABULAR_FEATURES].fillna(0).values.astype(np.float32)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X).astype(np.float32)

    y = df['Target_Default'].values.astype(np.int64)

    data = HeteroData()
    data['customer'].x = torch.tensor(X_scaled, dtype=torch.float32)
    data['customer'].y = torch.tensor(y, dtype=torch.long)
    data['customer'].num_nodes = n

    edge_counts: dict[str, int] = {}

    # --- Grouped-attribute edges ---
    for col, rel_name in RELATION_DEFS.items():
        if col not in df.columns:
            continue

        src_list, dst_list = [], []
        groups = df.groupby(col).groups

        for val, indices in groups.items():
            if pd.isna(val) or len(indices) < 2:
                continue
            idx_list = indices.tolist()
            # Connect pairs within group, cap fan-out to avoid combinatorial explosion
            for i in range(len(idx_list)):
                for j in range(i + 1, min(i + 10, len(idx_list))):
                    src_list.append(idx_list[i])
                    dst_list.append(idx_list[j])

        if src_list:
            src_t = torch.tensor(src_list, dtype=torch.long)
            dst_t = torch.tensor(dst_list, dtype=torch.long)
            # Store undirected: add both directions
            edge_key = ('customer', rel_name, 'customer')
            data[edge_key].edge_index = torch.stack(
                [torch.cat([src_t, dst_t]), torch.cat([dst_t, src_t])], dim=0
            )
            edge_counts[EDGE_TYPE_LABELS[rel_name]] = len(src_list)
        else:
            edge_key = ('customer', rel_name, 'customer')
            data[edge_key].edge_index = torch.zeros((2, 0), dtype=torch.long)
            edge_counts[EDGE_TYPE_LABELS[rel_name]] = 0

    # --- Direct co-applicant links ---


    # Move to device
    data = data.to(device)

    total_edges = sum(edge_counts.values())
    print(f"  HeteroData: {n} nodes, {total_edges} edges ({len(RELATION_DEFS)} relation types)")
    for label, cnt in edge_counts.items():
        print(f"    {label}: {cnt} edges")

    return data, scaler, edge_counts


# ============================================================
# NeighborLoader for mini-batch training
# ============================================================
def get_neighbor_loader(
    data: HeteroData,
    input_nodes: tuple | None = None,
    batch_size: int = 256,
    num_neighbors: list[int] | None = None,
    shuffle: bool = True,
) -> NeighborLoader:
    """
    Create a NeighborLoader for scalable mini-batch GNN training.

    Args:
        data: The HeteroData graph.
        input_nodes: Tuple of (node_type, mask_tensor). Defaults to all 'customer' nodes.
        batch_size: Number of seed nodes per batch.
        num_neighbors: List of neighbor sample counts per hop (default: [15, 10]).
        shuffle: Whether to shuffle seed nodes.

    Returns:
        NeighborLoader iterator.
    """
    if num_neighbors is None:
        num_neighbors = [15, 10]  # 2-hop: 15 neighbors at hop-1, 10 at hop-2

    if input_nodes is None:
        input_nodes = ('customer', torch.arange(data['customer'].num_nodes))

    loader = NeighborLoader(
        data,
        num_neighbors={key: num_neighbors for key in data.edge_types},
        batch_size=batch_size,
        input_nodes=input_nodes,
        shuffle=shuffle,
    )

    return loader
