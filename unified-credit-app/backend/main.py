import asyncio
import io
import random
import math
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import pandas as pd
import networkx as nx

app = FastAPI(title="Unified Credit Engine API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory State ───
graph_state = {
    "nodes": [],
    "edges": [],
    "ready": False
}

def generate_default_graph():
    """Generate a default starfield of 500 ambient nodes."""
    nodes = []
    for i in range(500):
        theta = random.uniform(0, 2 * math.pi)
        phi = random.uniform(0, math.pi)
        r = random.gauss(200, 80)
        nodes.append({
            "id": str(i),
            "x": r * math.sin(phi) * math.cos(theta),
            "y": r * math.sin(phi) * math.sin(theta),
            "z": r * math.cos(phi),
            "credit_score": random.randint(300, 850),
            "is_default": int(random.random() < 0.25),
            "cluster_id": random.randint(0, 30),
            "size": random.uniform(1, 3),
        })
    edges = []
    for _ in range(300):
        s, t = random.sample(range(500), 2)
        edges.append({"source": str(s), "target": str(t)})
    return nodes, edges

# Pre-generate on startup
default_nodes, default_edges = generate_default_graph()
graph_state["nodes"] = default_nodes
graph_state["edges"] = default_edges
graph_state["ready"] = True


@app.get("/api/overview")
async def get_overview():
    return {
        "total_records": 3340,
        "default_rate": 25.9,
        "defaulters": 865,
        "safe": 2475,
        "total_features": 56,
        "total_edges": 1673,
        "total_clusters": 63,
        "roc_auc_baseline": 0.6909,
        "roc_auc_unified": 0.7277,
        "recall_baseline": 18.50,
        "recall_unified": 22.54,
        "cluster_default_rate_inside": 45.29,
        "cluster_default_rate_outside": 23.70,
        "top_feature_weight": {"name": "clustering_coefficient", "weight": 0.6076}
    }


@app.get("/api/graph")
async def get_graph():
    """Return the current graph state for the 3D background."""
    return {
        "nodes": graph_state["nodes"],
        "links": graph_state["edges"],
    }


@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Accept a CSV dataset, build the multi-view graph, extract network features,
    compute credit scores, and update the live 3D graph state.
    """
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))

    # ── Build Graph ──
    G = nx.Graph()
    customer_ids = df['customer_id'].tolist()
    for cid in customer_ids:
        G.add_node(cid)

    # Digital view (shared device_id)
    if 'device_id' in df.columns:
        for _, group in df.groupby('device_id')['customer_id']:
            custs = group.tolist()
            if len(custs) > 1:
                for i in range(len(custs)):
                    for j in range(i + 1, len(custs)):
                        G.add_edge(custs[i], custs[j])

    # Geospatial view (shared ip_address)
    if 'ip_address' in df.columns:
        for _, group in df.groupby('ip_address')['customer_id']:
            custs = group.tolist()
            if len(custs) > 1:
                for i in range(len(custs)):
                    for j in range(i + 1, len(custs)):
                        if not G.has_edge(custs[i], custs[j]):
                            G.add_edge(custs[i], custs[j])

    # Socio-Economic view (shared employer_id)
    if 'employer_id' in df.columns:
        for _, group in df.groupby('employer_id')['customer_id']:
            custs = group.tolist()
            if len(custs) > 1:
                for i in range(len(custs)):
                    for j in range(i + 1, len(custs)):
                        if not G.has_edge(custs[i], custs[j]):
                            G.add_edge(custs[i], custs[j])

    # ── Extract Network Features ──
    degree_centrality = nx.degree_centrality(G)
    try:
        pagerank = nx.pagerank(G, alpha=0.85, max_iter=100)
    except:
        pagerank = {n: 1.0 / G.number_of_nodes() for n in G.nodes()}
    clustering_coeff = nx.clustering(G)
    components = list(nx.connected_components(G))
    component_map = {}
    cluster_id_map = {}
    for comp_id, comp in enumerate(components):
        for node in comp:
            component_map[node] = len(comp)
            cluster_id_map[node] = comp_id

    # ── Compute Simple Credit Score (0-850 scale) ──
    # Score = weighted combination of available features
    scores = {}
    for _, row in df.iterrows():
        cid = row['customer_id']
        score = 500  # base
        if 'credit_score' in df.columns:
            score = row.get('credit_score', 500)
        # Adjust by network risk
        dc = degree_centrality.get(cid, 0)
        cc = clustering_coeff.get(cid, 0)
        cs = component_map.get(cid, 1)
        # Higher centrality + clustering = riskier
        network_penalty = (dc * 50 + cc * 80 + min(cs / 10, 30))
        score = max(300, min(850, score - network_penalty))
        scores[cid] = round(score)

    # ── Build 3D Coordinates (Spherical Galaxy Layout) ──
    nodes_out = []
    n = len(customer_ids)
    for idx, cid in enumerate(customer_ids):
        # Spiral galaxy layout
        golden = (1 + math.sqrt(5)) / 2
        theta = 2 * math.pi * idx / golden
        phi = math.acos(1 - 2 * (idx + 0.5) / n)
        cluster = cluster_id_map.get(cid, 0)
        r = 150 + (cluster % 10) * 20 + random.gauss(0, 15)
        
        x = r * math.sin(phi) * math.cos(theta)
        y = r * math.sin(phi) * math.sin(theta)
        z = r * math.cos(phi)

        is_default = int(row.get('default', 0)) if 'default' in df.columns else (0 if scores.get(cid, 500) > 550 else 1)

        nodes_out.append({
            "id": str(cid),
            "x": x, "y": y, "z": z,
            "credit_score": scores.get(cid, 500),
            "is_default": is_default,
            "cluster_id": cluster_id_map.get(cid, 0),
            "size": 1 + degree_centrality.get(cid, 0) * 10,
        })

    # ── Build edges for frontend ──
    edges_out = []
    for u, v in list(G.edges())[:2000]:  # Cap at 2000 for perf
        edges_out.append({"source": str(u), "target": str(v)})

    # Update global graph state
    graph_state["nodes"] = nodes_out
    graph_state["edges"] = edges_out
    graph_state["ready"] = True

    return {
        "status": "success",
        "total_nodes": len(nodes_out),
        "total_edges": len(edges_out),
        "total_clusters": len(components),
        "avg_credit_score": round(np.mean(list(scores.values())), 1),
        "default_rate": round(sum(1 for n in nodes_out if n["is_default"]) / len(nodes_out) * 100, 2),
    }


@app.get("/api/network-data")
async def get_network_data():
    return {
        "nodes": graph_state["nodes"][:200],
        "edges": graph_state["edges"][:400]
    }


@app.get("/api/roc-data")
async def get_roc_data():
    def generate_roc_curve(auc_target):
        alpha = 1 / auc_target - 1
        x = np.linspace(0, 1, 50)
        y = x ** alpha
        return [{"fpr": float(xv), "tpr": float(yv)} for xv, yv in zip(x, y)]
    return {
        "model_a": {"auc": 0.6909, "curve": generate_roc_curve(0.6909)},
        "model_b": {"auc": 0.7277, "curve": generate_roc_curve(0.7277)},
    }


@app.get("/api/feature-weights")
async def get_feature_weights():
    return [
        {"name": "clustering_coefficient", "weight": 0.6076},
        {"name": "credit_score", "weight": -0.5200},
        {"name": "credit_utilization_pct", "weight": 0.4500},
        {"name": "savings_balance", "weight": -0.4100},
        {"name": "num_past_defaults", "weight": 0.3800},
        {"name": "salary_deposit_regularity", "weight": -0.3500},
        {"name": "emi_bounce_count", "weight": 0.3200},
        {"name": "months_on_book", "weight": -0.2800},
        {"name": "recent_inquiries", "weight": 0.2500},
        {"name": "degree_centrality", "weight": 0.2200},
        {"name": "transaction_velocity", "weight": 0.1800},
        {"name": "age_of_oldest_account", "weight": -0.1500},
        {"name": "avg_monthly_spending", "weight": 0.1200},
        {"name": "page_rank", "weight": -0.0900},
        {"name": "cash_flow_stability", "weight": -0.0500},
    ]


@app.websocket("/ws/live-metrics")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    total_processed = 3340
    try:
        while True:
            await asyncio.sleep(2)
            new_processed = random.randint(1, 5)
            total_processed += new_processed
            payload = {
                "timestamp": datetime.now().isoformat(),
                "new_applications_processed": new_processed,
                "running_default_rate": round(random.gauss(25.9, 1.0), 2),
                "running_roc_auc": round(random.gauss(0.7277, 0.005), 4),
                "latest_cash_flow_score": random.randint(300, 850),
                "latest_network_risk": round(random.uniform(0.0, 1.0), 4),
                "total_processed": total_processed,
                "fraud_alerts": random.randint(0, 2),
                "cluster_contagion_events": random.randint(0, 1),
            }
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        print("Client disconnected")


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
