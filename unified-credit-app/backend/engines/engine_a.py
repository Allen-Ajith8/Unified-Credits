"""
Engine A: Legacy Tabular XGBoost Baseline
=========================================
Standard credit scoring using only 28 tabular financial features.
No network/relationship data is considered.
This represents what traditional banks currently use.
"""

import pandas as pd
import numpy as np
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

# The standard tabular features
TABULAR_FEATURES = [
    'Age', 'Verified_Monthly_Income', 'Debt_to_Income_Ratio',
    'Loan_Amount', 'Loan_Term_Months', 'Num_Past_Defaults',
    'Num_Active_Loans', 'Credit_History_Months', 'Savings_Balance',
    'EMI_Bounce_Count', 'Credit_Utilization_Pct'
]


def run(df: pd.DataFrame) -> dict:
    """
    Run Engine A: Train XGBoost on tabular features only.
    
    Args:
        df: Full dataset DataFrame with all columns
        
    Returns:
        dict with metrics, feature_weights, roc_curve, predictions, model, scaler
    """
    print("[Engine A] Starting Legacy Tabular XGBoost...")
    
    # Prepare features and target
    X = df[TABULAR_FEATURES].copy()
    feature_medians = X.median()
    X = X.fillna(feature_medians)
    y = df['Target_Default'].values
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 80/20 stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"  Train: {len(X_train)} | Test: {len(X_test)}")
    
    # XGBoost classifier
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=5.0,       # L2 regularization
        reg_alpha=0.5,        # L1 regularization
        min_child_weight=5,
        gamma=0.3,
        scale_pos_weight=len(y_train[y_train == 0]) / max(len(y_train[y_train == 1]), 1),
        random_state=42,
        eval_metric='logloss',
    )
    
    model.fit(X_train, y_train, verbose=False)
    
    # Predictions
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    # Full dataset predictions (for per-node comparison)
    X_full_scaled = scaler.transform(df[TABULAR_FEATURES].fillna(feature_medians))
    full_probs = model.predict_proba(X_full_scaled)[:, 1]
    full_preds = model.predict(X_full_scaled)
    
    # Metrics
    roc_auc = roc_auc_score(y_test, y_prob)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    accuracy = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)
    
    print(f"  ROC-AUC: {roc_auc:.4f}")
    print(f"  Precision: {precision:.4f} | Recall: {recall:.4f} | F1: {f1:.4f}")
    
    # ROC curve points
    fpr_vals, tpr_vals, _ = roc_curve(y_test, y_prob)
    # Downsample to ~20 points for frontend
    indices = np.linspace(0, len(fpr_vals) - 1, min(20, len(fpr_vals)), dtype=int)
    roc_points = [
        {"fpr": round(float(fpr_vals[i]), 4), "tpr": round(float(tpr_vals[i]), 4)}
        for i in indices
    ]
    
    # SHAP feature importance
    print("  Computing SHAP values...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    
    feature_weights = []
    for i, fname in enumerate(TABULAR_FEATURES):
        # Use mean SHAP value (signed) for direction
        mean_shap_signed = shap_values[:, i].mean()
        feature_weights.append({
            "name": fname,
            "weight": round(float(mean_shap_signed), 4),
            "importance": round(float(mean_abs_shap[i]), 4),
        })
    
    # Sort by absolute importance
    feature_weights.sort(key=lambda x: abs(x["importance"]), reverse=True)
    
    default_rate = float(y.mean() * 100)
    
    result = {
        "name": "Legacy Tabular",
        "subtitle": f"XGBoost on {len(TABULAR_FEATURES)} Features",
        "accentColor": "#0F2350",
        "metrics": {
            "rocAuc": round(float(roc_auc), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4),
            "accuracy": round(float(accuracy), 4),
            "totalProcessed": int(len(df)),
            "defaultRate": round(default_rate, 2),
            "confusionMatrix": cm.tolist(),
        },
        "featureWeights": feature_weights[:15],  # Top 15
        "rocCurve": roc_points,
        "methodology": {
            "title": "Traditional Tabular Scoring",
            "description": (
                "Standard feature engineering on 28 financial attributes. "
                "XGBoost gradient boosting with L2 regularization. "
                "No network or relationship data considered."
            ),
            "steps": [
                f"Feature Selection ({len(TABULAR_FEATURES)} variables)",
                "StandardScaler Normalization",
                "XGBoost Classifier (max_depth=6, n_estimators=200)",
                "SHAP TreeExplainer Feature Importance",
            ],
        },
        # Internal: for Engine C comparison
        "_full_probs": full_probs.tolist(),
        "_full_preds": full_preds.tolist(),
        "_y_test": y_test.tolist(),
        "_y_prob": y_prob.tolist(),
        "_y_pred": y_pred.tolist(),
        "_model": model,
        "_scaler": scaler,
    }
    
    print("[Engine A] Complete.\n")
    return result
