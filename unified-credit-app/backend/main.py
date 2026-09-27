"""
Unified Credit Engine — FastAPI Backend
=========================================
Serves 3 inference engines:
  Engine A: Legacy Tabular XGBoost (28 features)
  Engine B: Hybrid GNN + XGBoost (65 features, GPU-accelerated)
  Engine C: Comparative Delta (A vs B head-to-head)

On startup: loads real dataset, runs all 3 engines.
On upload: accepts new CSV, re-runs all engines without restart.
"""

import os
import sys
import json
import asyncio
import io
import random
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Add parent to path for engines package
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engines import engine_a, engine_b, engine_c
from engines.engine_b import explain_router, set_engine_state
from engines.copilot import ingest_credit_data, ask_copilot, get_copilot_status

# ============================================================
# Configuration (env-based with sensible defaults)
# ============================================================
DATASET_DIR = Path(os.environ.get(
    "DATASET_DIR",
    str(Path(__file__).parent.parent.parent / "Dataset")
))
FINANCIAL_CSV = DATASET_DIR / "financial_underwriting_data.csv"
FRAUD_CSV = DATASET_DIR / "fraud_network_edges.csv"

BACKEND_HOST = os.environ.get("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8000"))
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

# Global state
engine_results = {
    "a": None,
    "b": None, 
    "c": None,
}
current_financial_df = None
current_fraud_df = None
current_df = None
connected_clients = set()


# ============================================================
# Startup: Load data and run all engines
# ============================================================
def run_all_engines(financial_df: pd.DataFrame, fraud_df: pd.DataFrame):
    """Run all 3 engines on the given dataframe."""
    global engine_results
    
    print("\n" + "=" * 60)
    print("RUNNING ALL 3 INFERENCE ENGINES")
    print("=" * 60 + "\n")
    
    df = pd.merge(financial_df, fraud_df, on='Customer_ID', how='inner')
    # Engine C internally runs both A and B, so we get all 3 at once
    result_c = engine_c.run(financial_df, fraud_df)
    
    engine_results["a"] = result_c["engineA"]
    engine_results["b"] = result_c["engineB"]
    engine_results["c"] = result_c
    
    # Provide engine results to the explain API
    set_engine_state(engine_results, df)
    
    print("=" * 60)
    print("ALL ENGINES COMPLETE")
    print(f"  Engine A ROC-AUC: {engine_results['a']['metrics']['rocAuc']:.4f}")
    print(f"  Engine B ROC-AUC: {engine_results['b']['metrics']['rocAuc']:.4f}")
    print(f"  Delta:            {engine_results['c']['metrics']['rocAucLift']:+.4f}")
    print("=" * 60 + "\n")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load dataset and run engines on startup."""
    global current_financial_df, current_fraud_df, current_df
    
    print(f"\nLoading datasets from: {FINANCIAL_CSV.parent}")
    if FINANCIAL_CSV.exists() and FRAUD_CSV.exists():
        current_financial_df = pd.read_csv(str(FINANCIAL_CSV))
        current_fraud_df = pd.read_csv(str(FRAUD_CSV))
        current_df = pd.merge(current_financial_df, current_fraud_df, on='Customer_ID', how='inner')
        print(f"Loaded {len(current_df)} rows")
        run_all_engines(current_financial_df, current_fraud_df)
    else:
        print(f"WARNING: Datasets not found")
        print("Upload a CSV via POST /api/upload to get started")
    
    yield

    print("Shutting down...")


# ============================================================
# FastAPI App
# ============================================================
app = FastAPI(
    title="Unified Credit Engine API",
    description="3-Engine Credit Scoring: Tabular XGBoost, Hybrid GNN, Comparative Delta",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(explain_router)


# ============================================================
# Helper: Clean result for JSON serialization
# ============================================================
def clean_result(result: dict) -> dict:
    """Remove internal keys (prefixed with _) for API response."""
    if result is None:
        return {"error": "Engine not yet initialized. Upload a dataset first."}
    
    cleaned = {}
    for k, v in result.items():
        if k.startswith("_"):
            continue
        if isinstance(v, dict):
            cleaned[k] = clean_result(v)
        else:
            cleaned[k] = v
    return cleaned


# ============================================================
# API Endpoints
# ============================================================

@app.get("/")
async def root():
    return {
        "name": "Unified Credit Engine API",
        "version": "2.0.0",
        "engines": ["a (Tabular XGBoost)", "b (GNN + XGBoost)", "c (Comparative)"],
        "status": "ready" if engine_results["a"] is not None else "awaiting_data",
    }


@app.get("/api/engine/{mode}/metrics")
async def get_engine_metrics(mode: str):
    """Get metrics for engine A, B, or C."""
    if mode not in engine_results:
        return JSONResponse(status_code=400, content={"error": f"Invalid mode: {mode}. Use a, b, or c."})
    
    result = engine_results[mode]
    if result is None:
        return JSONResponse(status_code=503, content={"error": "Engine not initialized yet."})
    
    return clean_result(result)


@app.get("/api/engine/{mode}/features")
async def get_engine_features(mode: str):
    """Get feature importance/weights for engine A or B."""
    if mode not in ("a", "b"):
        return JSONResponse(status_code=400, content={"error": "Feature weights only available for mode a or b."})
    
    result = engine_results[mode]
    if result is None:
        return JSONResponse(status_code=503, content={"error": "Engine not initialized yet."})
    
    return {
        "engine": result["name"],
        "featureWeights": result["featureWeights"],
    }


@app.get("/api/engine/{mode}/roc")
async def get_engine_roc(mode: str):
    """Get ROC curve data points for engine A or B."""
    if mode not in ("a", "b"):
        return JSONResponse(status_code=400, content={"error": "ROC data only available for mode a or b."})
    
    result = engine_results[mode]
    if result is None:
        return JSONResponse(status_code=503, content={"error": "Engine not initialized yet."})
    
    return {
        "engine": result["name"],
        "rocAuc": result["metrics"]["rocAuc"],
        "rocCurve": result["rocCurve"],
    }


@app.get("/api/graph")
async def get_graph_data(mode: str = "b"):
    """
    Get 3D node data for the network background visualization.
    Mode A: nodes only (scattered, no edges)
    Mode B: full graph with edges
    Mode C: nodes colored by delta
    """
    global current_df
    
    if current_df is None:
        return {"nodes": [], "links": []}
    
    result_a = engine_results.get("a")
    result_b = engine_results.get("b")
    
    nodes = []
    links = []
    
    positions = result_b.get("_node_positions", {}) if result_b else {}
    
    def get_node_dict(i, prob=0.5, delta=None, size_multiplier=1.0):
        row = current_df.iloc[i]
        pos = positions.get(i, {'x': random.uniform(-500, 500), 'y': random.uniform(-500, 500), 'z': random.uniform(-500, 500)})
        node_data = {
            "id": i,
            "name": str(row.get("Customer_ID", f"Borrower {i}")),
            "credit_score": int(row.get("CIBIL_Score", 500)),
            "is_default": int(row.get("Target_Default", 0)),
            "prob": float(prob),
            "size": (2.0 if int(row.get("Target_Default", 0)) == 1 else 1.5) * size_multiplier,
            "x": pos['x'],
            "y": pos['y'],
            "z": pos['z'],
        }
        if delta is not None:
            node_data["delta"] = delta
            node_data["size"] = 1.5 + abs(delta) * 5
        return node_data
    
    if mode == "a" and result_a:
        probs = result_a.get("_full_probs", [])
        for i in range(len(current_df)):
            nodes.append(get_node_dict(i, prob=probs[i] if i < len(probs) else 0.5))
            
    elif mode == "b" and result_b:
        probs = result_b.get("_full_probs", [])
        G = result_b.get("_graph")
        
        for i in range(len(current_df)):
            nodes.append(get_node_dict(i, prob=probs[i] if i < len(probs) else 0.5))
            
        if G is not None:
            # Cap visualization edges at 2000 for rendering performance.
            # Prioritize fraud-signal edges (Device, IP, UPI), sample bulk.
            # GNN training uses ALL edges — this only affects the frontend viz.
            MAX_VIZ_EDGES = 2000
            priority_edges = []
            bulk_edges = []
            
            for u, v, data in G.edges(data=True):
                edge_type = data.get("type", "unknown")
                edge = {"source": u, "target": v, "type": edge_type}
                if edge_type in ("Shared Device", "Shared IP", "Shared UPI"):
                    priority_edges.append(edge)
                else:
                    bulk_edges.append(edge)
            
            remaining = MAX_VIZ_EDGES - len(priority_edges)
            if remaining > 0 and bulk_edges:
                import random as _rand
                sampled = _rand.sample(bulk_edges, min(remaining, len(bulk_edges)))
                links = priority_edges + sampled
            else:
                links = priority_edges[:MAX_VIZ_EDGES]
                
    elif mode == "c" and result_a and result_b:
        probs_a = result_a.get("_full_probs", [])
        probs_b = result_b.get("_full_probs", [])
        
        for i in range(len(current_df)):
            pa = float(probs_a[i]) if i < len(probs_a) else 0.5
            pb = float(probs_b[i]) if i < len(probs_b) else 0.5
            delta = round(pb - pa, 4)
            nodes.append(get_node_dict(i, prob=pb, delta=delta))
            
    return {"nodes": nodes, "links": links}


@app.post("/api/chat")
async def chat(payload: dict):
    """
    AI Copilot: Ask a natural language question about the credit graph.
    Body: { "query": "Why is borrower 120 risky?", "node_id": 120 (optional) }
    """
    query = payload.get("query", "")
    node_id = payload.get("node_id", None)

    if not query.strip():
        return {"answer": "Please ask a question.", "status": "error"}

    result = await ask_copilot(
        query=query,
        node_id=node_id,
        df=current_df,
    )
    return result


@app.get("/api/copilot/status")
async def copilot_status():
    """Check the current status of the Cognee AI Copilot."""
    return get_copilot_status()

@app.post("/api/upload")
async def upload_dataset(
    financial_file: Optional[UploadFile] = File(None),
    fraud_file: Optional[UploadFile] = File(None),
    merged_file: Optional[UploadFile] = File(None)
):
    """
    Upload new CSV dataset(s). Re-runs all 3 engines without server restart.
    Accepts either (financial_file AND fraud_file) OR merged_file.
    """
    global current_financial_df, current_fraud_df, current_df
    
    try:
        if merged_file is not None:
            contents = await merged_file.read()
            new_df = pd.read_csv(io.BytesIO(contents))
            # Assume it has all required columns. We split it back conceptually or just use it.
            # But run_all_engines takes financial_df and fraud_df. 
            # If we upload a merged one, we can pass it as both and merge will be a no-op / just columns overlap.
            current_financial_df = new_df
            current_fraud_df = new_df
            current_df = new_df
            
        elif financial_file is not None and fraud_file is not None:
            fin_contents = await financial_file.read()
            fraud_contents = await fraud_file.read()
            current_financial_df = pd.read_csv(io.BytesIO(fin_contents))
            current_fraud_df = pd.read_csv(io.BytesIO(fraud_contents))
            current_df = pd.merge(current_financial_df, current_fraud_df, on='Customer_ID', how='inner')
        else:
            return JSONResponse(status_code=400, content={"error": "Provide either both financial_file and fraud_file, or a merged_file."})
            
        print(f"\nUploaded new data ({len(current_df)} rows)")
        
        # Validate required columns (comprehensive schema check)
        REQUIRED_FINANCIAL = ['Customer_ID', 'Target_Default'] + engine_a.TABULAR_FEATURES
        REQUIRED_FRAUD = ['Customer_ID', 'Device_ID', 'IP_Address']
        
        if len(current_df) == 0:
            return JSONResponse(status_code=400, content={
                "error": "Uploaded CSV is empty (0 rows after merge)."
            })
        
        missing_fin = [c for c in REQUIRED_FINANCIAL if c not in current_df.columns]
        missing_fraud = [c for c in REQUIRED_FRAUD if c not in current_df.columns]
        missing = missing_fin + missing_fraud
        if missing:
            return JSONResponse(status_code=400, content={
                "error": f"Missing required columns: {missing}",
                "required_financial": REQUIRED_FINANCIAL,
                "required_fraud": REQUIRED_FRAUD,
                "received_columns": list(current_df.columns),
            })
        
        # Validate Target_Default is binary
        unique_targets = current_df['Target_Default'].dropna().unique()
        if not set(unique_targets).issubset({0, 1}):
            return JSONResponse(status_code=400, content={
                "error": f"Target_Default must be binary (0/1). Found: {sorted(unique_targets.tolist())}",
            })
            
        # Re-run all engines
        run_all_engines(current_financial_df, current_fraud_df)
        
        # Notify WebSocket clients
        for ws in connected_clients.copy():
            try:
                await ws.send_json({
                    "type": "engines_updated",
                    "total_rows": len(current_df),
                    "rocAuc_a": engine_results["a"]["metrics"]["rocAuc"],
                    "rocAuc_b": engine_results["b"]["metrics"]["rocAuc"],
                    "lift": engine_results["c"]["metrics"]["rocAucLift"],
                })
            except:
                connected_clients.discard(ws)
        
        return {
            "status": "success",
            "total_nodes": len(current_df),
            "engines": {
                "a": {"rocAuc": engine_results["a"]["metrics"]["rocAuc"]},
                "b": {"rocAuc": engine_results["b"]["metrics"]["rocAuc"]},
                "c": {"rocAucLift": engine_results["c"]["metrics"]["rocAucLift"]},
            }
        }
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/overview")
async def get_overview():
    """Get high-level overview of all engines."""
    if engine_results["a"] is None:
        return JSONResponse(status_code=503, content={"error": "No data loaded yet."})
    
    return {
        "datasetSize": len(current_df) if current_df is not None else 0,
        "engines": {
            "a": {
                "name": engine_results["a"]["name"],
                "rocAuc": engine_results["a"]["metrics"]["rocAuc"],
                "f1": engine_results["a"]["metrics"]["f1"],
            },
            "b": {
                "name": engine_results["b"]["name"],
                "rocAuc": engine_results["b"]["metrics"]["rocAuc"],
                "f1": engine_results["b"]["metrics"]["f1"],
            },
            "c": {
                "rocAucLift": engine_results["c"]["metrics"]["rocAucLift"],
                "reclassified": engine_results["c"]["metrics"]["reclassifiedNodes"],
            },
        }
    }


# ============================================================
# WebSocket for live updates
# ============================================================
@app.websocket("/ws/live-metrics")
async def websocket_live_metrics(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    print(f"WebSocket client connected. Total: {len(connected_clients)}")
    
    try:
        # Send current state immediately
        if engine_results["a"] is not None:
            await ws.send_json({
                "type": "initial",
                "total_processed": len(current_df) if current_df is not None else 0,
                "running_default_rate": engine_results["a"]["metrics"]["defaultRate"] if engine_results["a"] else 0,
                "running_roc_auc": engine_results["b"]["metrics"]["rocAuc"] if engine_results["b"] else (engine_results["a"]["metrics"]["rocAuc"] if engine_results["a"] else 0),
                "fraud_alerts": engine_results["c"]["metrics"]["falseNegativesCaught"] if engine_results["c"] else 0,
            })
        
        # Keep connection alive, push updates when they happen
        while True:
            # Wait for messages from client (e.g., ping)
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                # Send heartbeat
                if engine_results["a"] is not None:
                    await ws.send_json({
                        "type": "heartbeat",
                        "total_processed": len(current_df) if current_df is not None else 0,
                        "running_default_rate": engine_results["a"]["metrics"]["defaultRate"] if engine_results["a"] else 0,
                        "running_roc_auc": engine_results["b"]["metrics"]["rocAuc"] if engine_results["b"] else (engine_results["a"]["metrics"]["rocAuc"] if engine_results["a"] else 0),
                        "fraud_alerts": engine_results["c"]["metrics"]["falseNegativesCaught"] if engine_results["c"] else 0,
                    })
    
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)
        print(f"WebSocket client disconnected. Total: {len(connected_clients)}")


# ============================================================
# Run
# ============================================================
if __name__ == "__main__":
    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT)
