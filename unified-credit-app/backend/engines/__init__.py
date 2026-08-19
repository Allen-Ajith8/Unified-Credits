# Engines package
"""
Engines Package
===============
Contains the 3 inference engines:
    engine_a  — Legacy Tabular XGBoost (28 features)
    engine_b  — Hybrid Heterogeneous GNN + XGBoost (65 features)
    engine_c  — Comparative Delta Analysis (A vs B)
    copilot   — Cognee GraphRAG AI Copilot

Engine B subpackage:
    engine_b/dataset.py   — HeteroData graph construction + NeighborLoader
    engine_b/model.py     — HeteroGAT (HGTConv) architecture
    engine_b/trainer.py   — Training pipeline with XGBoost fusion
    engine_b/explainer.py — GNNExplainer + TreeSHAP per-node explanations
    engine_b/api.py       — FastAPI router for /api/v1/explain_decision/{node_id}
"""

from engines import engine_a, engine_b, engine_c

__all__ = ['engine_a', 'engine_b', 'engine_c']
