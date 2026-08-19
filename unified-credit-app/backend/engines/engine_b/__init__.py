"""
Engine B — Heterogeneous GNN + XGBoost Engine
==============================================
Package exports for the refactored Engine B.

Submodules:
    dataset   — HeteroData graph construction + NeighborLoader
    model     — HeteroGAT (HGTConv) architecture
    trainer   — Full training pipeline (HeteroGAT → XGBoost)
    explainer — GNNExplainer + TreeSHAP per-node explanations
    api       — FastAPI router for /api/v1/explain_decision/{node_id}
"""

from engines.engine_b.trainer import train
from engines.engine_b.explainer import explain_node
from engines.engine_b.api import router as explain_router, set_engine_state
from engines.engine_b.dataset import build_hetero_data, get_neighbor_loader
from engines.engine_b.model import HeteroGAT

# Alias train as run for backwards compatibility with main.py and engine_c.py
run = train

__all__ = [
    'train',
    'run',
    'explain_node',
    'explain_router',
    'set_engine_state',
    'build_hetero_data',
    'get_neighbor_loader',
    'HeteroGAT',
]
