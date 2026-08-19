"""
Engine B — API Router Module
==============================
FastAPI router providing the explain_decision endpoint.

Endpoint:
    GET /api/v1/explain_decision/{node_id}

Returns a JSON explanation combining GNNExplainer + TreeSHAP
for the given node's credit decision.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from engines.engine_b.explainer import explain_node


router = APIRouter(prefix="/api/v1", tags=["explainability"])


# Reference to engine results — set by main.py at startup
_engine_results: dict = {}
_current_df = None


def set_engine_state(engine_results: dict, df):
    """
    Called by main.py after engine training to inject state.

    Args:
        engine_results: Dict with keys 'a', 'b', 'c' holding engine outputs.
        df: Current DataFrame.
    """
    global _engine_results, _current_df
    _engine_results = engine_results
    _current_df = df


@router.get("/explain_decision/{node_id}")
async def explain_decision(node_id: int):
    """
    Explain the credit decision for a specific borrower node.

    Returns:
        JSON with risk_score, classification, top_edges (GNNExplainer),
        neighbor_contributions, top_features (TreeSHAP), and subgraph data.
    """
    result_b = _engine_results.get("b")
    if result_b is None:
        raise HTTPException(status_code=503, detail="Engine B not initialized yet.")

    if _current_df is None:
        raise HTTPException(status_code=503, detail="No dataset loaded.")

    n_nodes = len(_current_df)
    if node_id < 0 or node_id >= n_nodes:
        raise HTTPException(
            status_code=400,
            detail=f"node_id must be between 0 and {n_nodes - 1}."
        )

    # Extract internal objects from Engine B results
    gat_model = result_b.get("_gat_model")
    xgb_model = result_b.get("_model")
    hetero_data = result_b.get("_hetero_data")
    G = result_b.get("_graph")
    gnn_embeddings = result_b.get("_gnn_embeddings")
    X_combined = result_b.get("_X_combined")
    all_feature_names = result_b.get("_all_feature_names")
    full_probs = result_b.get("_full_probs", [])
    full_preds = result_b.get("_full_preds", [])

    if gat_model is None or xgb_model is None:
        raise HTTPException(
            status_code=503,
            detail="Engine B models not available. Re-run training."
        )

    try:
        explanation = explain_node(
            node_id=node_id,
            gat_model=gat_model,
            xgb_model=xgb_model,
            hetero_data=hetero_data,
            G=G,
            gnn_embeddings=gnn_embeddings,
            X_combined=X_combined,
            all_feature_names=all_feature_names,
            df=_current_df,
            full_probs=full_probs,
            full_preds=full_preds,
        )

        if "error" in explanation:
            raise HTTPException(status_code=400, detail=explanation["error"])

        return explanation

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")
