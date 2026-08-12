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

# ============================================================
# Configuration
# ============================================================
DATASET_PATH = Path(__file__).parent.parent.parent / "Dataset" / "synthetic_credit_data_cleaned.csv"

# Global state
engine_results = {
    "a": None,
    "b": None, 
    "c": None,
}
current_df = None
connected_clients = set()


# ============================================================
# Startup: Load data and run all engines
# ============================================================
def run_all_engines(df: pd.DataFrame):
    """Run all 3 engines on the given dataframe."""
    global engine_results
    
    print("\n" + "=" * 60)
    print("RUNNING ALL 3 INFERENCE ENGINES")
    print("=" * 60 + "\n")
    
    # Engine C internally runs both A and B, so we get all 3 at once
    result_c = engine_c.run(df)
    
    engine_results["a"] = result_c["engineA"]
    engine_results["b"] = result_c["engineB"]
    engine_results["c"] = result_c
    
    print("=" * 60)
    print("ALL ENGINES COMPLETE")
    print(f"  Engine A ROC-AUC: {engine_results['a']['metrics']['rocAuc']:.4f}")
    print(f"  Engine B ROC-AUC: {engine_results['b']['metrics']['rocAuc']:.4f}")
    print(f"  Delta:            {engine_results['c']['metrics']['rocAucLift']:+.4f}")
    print("=" * 60 + "\n")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load dataset and run engines on startup."""
    global current_df
    
    print(f"\nLoading dataset from: {DATASET_PATH}")
    if DATASET_PATH.exists():
        current_df = pd.read_csv(str(DATASET_PATH))
        print(f"Loaded {len(current_df)} rows, {len(current_df.columns)} columns")
        run_all_engines(current_df)
    else:
        print(f"WARNING: Dataset not found at {DATASET_PATH}")
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
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    
    if mode == "a" and result_a:
        # Tabular: just nodes scattered randomly, colored by credit score
        probs = result_a.get("_full_probs", [])
        for i in range(len(current_df)):
            nodes.append({
                "id": i,
                "credit_score": int(current_df.iloc[i].get("credit_score", 500)),
                "is_default": int(current_df.iloc[i].get("default", 0)),
                "prob": float(probs[i]) if i < len(probs) else 0.5,
                "size": 1.5,
            })
    
    elif mode == "b" and result_b:
        # GNN: full graph with edges
        probs = result_b.get("_full_probs", [])
        G = result_b.get("_graph")
        
        for i in range(len(current_df)):
            nodes.append({
                "id": i,
                "credit_score": int(current_df.iloc[i].get("credit_score", 500)),
                "is_default": int(current_df.iloc[i].get("default", 0)),
                "prob": float(probs[i]) if i < len(probs) else 0.5,
                "size": 2.0 if current_df.iloc[i].get("default", 0) == 1 else 1.5,
            })
        
        if G is not None:
            # Sample edges for visualization (limit to 2000 for performance)
            all_edges = list(G.edges(data=True))
            sample_size = min(2000, len(all_edges))
            sampled = random.sample(all_edges, sample_size) if len(all_edges) > sample_size else all_edges
            
            for u, v, data in sampled:
                links.append({
                    "source": u,
                    "target": v,
                    "type": data.get("type", "unknown"),
                })
    
    elif mode == "c" and result_a and result_b:
        # Comparative: color by delta
        probs_a = result_a.get("_full_probs", [])
        probs_b = result_b.get("_full_probs", [])
        
        for i in range(len(current_df)):
            pa = float(probs_a[i]) if i < len(probs_a) else 0.5
            pb = float(probs_b[i]) if i < len(probs_b) else 0.5
            delta = pb - pa
            
            nodes.append({
                "id": i,
                "credit_score": int(current_df.iloc[i].get("credit_score", 500)),
                "is_default": int(current_df.iloc[i].get("default", 0)),
                "prob": pb,
                "delta": round(delta, 4),
                "size": 1.5 + abs(delta) * 5,  # Bigger nodes = bigger change
            })
    
    return {"nodes": nodes, "links": links}


@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Upload a new CSV dataset. Re-runs all 3 engines without server restart.
    """
    global current_df
    
    if not file.filename.endswith('.csv'):
        return JSONResponse(status_code=400, content={"error": "Only CSV files are supported."})
    
    try:
        contents = await file.read()
        new_df = pd.read_csv(pd.io.common.BytesIO(contents))
        
        print(f"\nUploaded: {file.filename} ({len(new_df)} rows, {len(new_df.columns)} columns)")
        
        # Validate required columns
        required = ['default'] + engine_a.TABULAR_FEATURES[:5]  # Check a few
        missing = [c for c in required if c not in new_df.columns]
        if missing:
            return JSONResponse(status_code=400, content={
                "error": f"Missing required columns: {missing}",
                "required": required,
            })
        
        # Append to existing data or replace
        if current_df is not None:
            current_df = pd.concat([current_df, new_df], ignore_index=True)
            print(f"Appended. Total rows: {len(current_df)}")
        else:
            current_df = new_df
        
        # Re-run all engines
        run_all_engines(current_df)
        
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
                "running_default_rate": engine_results["a"]["metrics"]["defaultRate"],
                "running_roc_auc": engine_results["b"]["metrics"]["rocAuc"],
                "fraud_alerts": engine_results["c"]["metrics"]["falseNegativesCaught"],
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
                        "running_default_rate": engine_results["a"]["metrics"]["defaultRate"],
                        "running_roc_auc": engine_results["b"]["metrics"]["rocAuc"],
                        "fraud_alerts": engine_results["c"]["metrics"]["falseNegativesCaught"],
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
