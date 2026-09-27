"""
Engine C: Comparative Delta Engine
===================================
Runs both Engine A and Engine B, then computes head-to-head deltas.
Shows exactly how much the GNN approach improves over tabular baseline.
"""

import numpy as np
from engines import engine_a, engine_b


def run(financial_df, fraud_df) -> dict:
    """
    Run both engines and compute comparative deltas.
    
    Args:
        financial_df: Financial features DataFrame
        fraud_df: Fraud network DataFrame
        
    Returns:
        dict with results_a, results_b, and delta metrics
    """
    print("[Engine C] Starting Comparative Delta Analysis...")
    print("=" * 60)
    
    # Run both engines. Note that engine A uses only financial features.
    results_a = engine_a.run(financial_df)
    results_b = engine_b.run(financial_df, fraud_df)
    
    # Compute metric deltas
    metrics_a = results_a["metrics"]
    metrics_b = results_b["metrics"]
    
    roc_lift = metrics_b["rocAuc"] - metrics_a["rocAuc"]
    precision_lift = metrics_b["precision"] - metrics_a["precision"]
    recall_lift = metrics_b["recall"] - metrics_a["recall"]
    f1_lift = metrics_b["f1"] - metrics_a["f1"]
    accuracy_lift = metrics_b["accuracy"] - metrics_a["accuracy"]
    
    # Per-node comparison
    probs_a = np.array(results_a["_full_probs"])
    probs_b = np.array(results_b["_full_probs"])
    preds_a = np.array(results_a["_full_preds"])
    preds_b = np.array(results_b["_full_preds"])
    
    y_true = financial_df['Target_Default'].values
    
    # Reclassification analysis
    changed = preds_a != preds_b
    reclassified_count = int(changed.sum())
    
    # Nodes where Engine B correctly catches defaults that Engine A missed
    false_negatives_a = (preds_a == 0) & (y_true == 1)  # A missed these
    caught_by_b = false_negatives_a & (preds_b == 1)     # B caught them
    false_negatives_caught = int(caught_by_b.sum())
    
    # Nodes where Engine B correctly rejects false positives from A
    false_positives_a = (preds_a == 1) & (y_true == 0)   # A wrong on these
    fixed_by_b = false_positives_a & (preds_b == 0)       # B got them right
    false_positives_reduced = int(fixed_by_b.sum())
    
    # Score delta distribution
    score_deltas = probs_b - probs_a
    improved = int((score_deltas > 0.05).sum())   # Significantly higher risk detected
    worsened = int((score_deltas < -0.05).sum())  # Lower risk detected (could be good or bad)
    unchanged = int(len(score_deltas) - improved - worsened)
    
    # Cluster comparison
    cluster_comparison = [
        {
            "name": "Inside Default Cluster",
            "engineA": round(metrics_a.get("defaultRate", 0), 2),
            "engineB": round(metrics_b.get("inClusterDefaultRate", 0), 2),
        },
        {
            "name": "Outside Default Cluster",
            "engineA": round(metrics_a.get("defaultRate", 0), 2),
            "engineB": round(metrics_b.get("outClusterDefaultRate", 0), 2),
        },
    ]
    
    delta_result = {
        "name": "Comparative Analysis",
        "subtitle": "Head-to-Head Delta",
        "accentColor": "#D4AF37",
        "metrics": {
            "rocAucLift": round(float(roc_lift), 4),
            "precisionLift": round(float(precision_lift), 4),
            "recallLift": round(float(recall_lift), 4),
            "f1Lift": round(float(f1_lift), 4),
            "accuracyLift": round(float(accuracy_lift), 4),
            "reclassifiedNodes": reclassified_count,
            "falseNegativesCaught": false_negatives_caught,
            "falsePositivesReduced": false_positives_reduced,
            "nodesImproved": improved,
            "nodesWorsened": worsened,
            "nodesUnchanged": unchanged,
        },
        "clusterComparison": cluster_comparison,
        "engineA": results_a,
        "engineB": results_b,
    }
    
    print("\n" + "=" * 60)
    print("[Engine C] COMPARATIVE RESULTS:")
    print(f"  ROC-AUC Lift:      {roc_lift:+.4f}")
    print(f"  Precision Lift:    {precision_lift:+.4f}")
    print(f"  Recall Lift:       {recall_lift:+.4f}")
    print(f"  F1 Lift:           {f1_lift:+.4f}")
    print(f"  Reclassified:      {reclassified_count} nodes")
    print(f"  FN Caught by GNN:  {false_negatives_caught}")
    print(f"  FP Reduced by GNN: {false_positives_reduced}")
    print("[Engine C] Complete.\n")
    
    return delta_result
