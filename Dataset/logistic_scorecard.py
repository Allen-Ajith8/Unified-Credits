import pandas as pd
import numpy as np
import networkx as nx
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (roc_auc_score, roc_curve, confusion_matrix, 
                             classification_report, accuracy_score, 
                             precision_score, recall_score, f1_score)
import warnings
warnings.filterwarnings('ignore')

SAVE_PATH = r"Y:\programs folder\PBL - DS\Dataset"

# ============================================
# PHASE 1: LOAD AND PREPARE DATA
# ============================================
print("=" * 60)
print("PHASE 1: LOADING CLEANED DATASET")
print("=" * 60)

df = pd.read_csv(f"{SAVE_PATH}\\synthetic_credit_data_cleaned.csv")
print(f"  Rows: {df.shape[0]}, Columns: {df.shape[1]}")

# ============================================
# PHASE 2: BUILD GRAPH & EXTRACT NETWORK FEATURES
# ============================================
print("\n" + "=" * 60)
print("PHASE 2: BUILDING MULTI-VIEW GRAPH & EXTRACTING FEATURES")
print("=" * 60)

G = nx.Graph()

# Add all customers as nodes
for idx, row in df.iterrows():
    G.add_node(row['customer_id'])

# VIEW 1: Digital (shared device_id)
device_groups = df.groupby('device_id')['customer_id'].apply(list)
for device, customers in device_groups.items():
    if len(customers) > 1:
        for i in range(len(customers)):
            for j in range(i + 1, len(customers)):
                G.add_edge(customers[i], customers[j])

# VIEW 2: Geospatial (shared ip_address)
ip_groups = df.groupby('ip_address')['customer_id'].apply(list)
for ip, customers in ip_groups.items():
    if len(customers) > 1:
        for i in range(len(customers)):
            for j in range(i + 1, len(customers)):
                if not G.has_edge(customers[i], customers[j]):
                    G.add_edge(customers[i], customers[j])

# VIEW 3: Socio-Economic (shared employer_id)
emp_groups = df.groupby('employer_id')['customer_id'].apply(list)
for emp, customers in emp_groups.items():
    if len(customers) > 1:
        for i in range(len(customers)):
            for j in range(i + 1, len(customers)):
                if not G.has_edge(customers[i], customers[j]):
                    G.add_edge(customers[i], customers[j])

print(f"  Graph Nodes: {G.number_of_nodes()}")
print(f"  Graph Edges: {G.number_of_edges()}")

# Extract Graph Features for every node
print("\n  Calculating Degree Centrality...")
degree_centrality = nx.degree_centrality(G)

print("  Calculating PageRank...")
pagerank = nx.pagerank(G, alpha=0.85)

print("  Calculating Clustering Coefficient...")
clustering_coeff = nx.clustering(G)

print("  Calculating Connected Components...")
components = list(nx.connected_components(G))
component_map = {}
for comp_id, comp in enumerate(components):
    for node in comp:
        component_map[node] = len(comp)  # Size of the cluster this node belongs to

# Map features back to dataframe
df['degree_centrality'] = df['customer_id'].map(degree_centrality)
df['pagerank'] = df['customer_id'].map(pagerank)
df['clustering_coefficient'] = df['customer_id'].map(clustering_coeff)
df['cluster_size'] = df['customer_id'].map(component_map)

# Is this node connected to anyone?
df['is_in_cluster'] = (df['cluster_size'] > 1).astype(int)

print(f"\n  New Graph Features Added: degree_centrality, pagerank, clustering_coefficient, cluster_size, is_in_cluster")

# ============================================
# PHASE 3: PREPARE FEATURES FOR LOGISTIC REGRESSION
# ============================================
print("\n" + "=" * 60)
print("PHASE 3: PREPARING FEATURES FOR LOGISTIC REGRESSION")
print("=" * 60)

# Standard tabular features (what traditional banks use)
tabular_features = [
    'age', 'num_dependents', 'annual_income', 'monthly_income',
    'monthly_expenses', 'monthly_debt_payments', 'debt_to_income_ratio',
    'total_existing_debt', 'savings_balance', 'num_bank_accounts',
    'num_open_loans', 'num_credit_cards', 'credit_utilization_pct',
    'credit_score', 'credit_history_months', 'num_past_defaults',
    'num_late_payments_30d', 'num_late_payments_60d', 'num_late_payments_90d',
    'num_credit_inquiries_6m', 'loan_amount', 'loan_term_months',
    'interest_rate', 'avg_monthly_transactions', 'avg_transaction_amount',
    'salary_deposit_regularity', 'emi_bounce_count', 'account_age_months'
]

# Our new graph features
graph_features = [
    'degree_centrality', 'pagerank', 'clustering_coefficient',
    'cluster_size', 'is_in_cluster'
]

# Combined features (tabular + graph)
all_features = tabular_features + graph_features

print(f"  Tabular Features: {len(tabular_features)}")
print(f"  Graph Features: {len(graph_features)}")
print(f"  Combined Features: {len(all_features)}")

# Target variable
y = df['default']

# Encode any categorical if needed, fill NaN
X_tabular = df[tabular_features].fillna(0)
X_combined = df[all_features].fillna(0)

# Scale features
scaler_tab = StandardScaler()
scaler_comb = StandardScaler()

X_tabular_scaled = scaler_tab.fit_transform(X_tabular)
X_combined_scaled = scaler_comb.fit_transform(X_combined)

# Train-Test Split (80-20)
X_tab_train, X_tab_test, y_train, y_test = train_test_split(
    X_tabular_scaled, y, test_size=0.2, random_state=42, stratify=y)

X_comb_train, X_comb_test, _, _ = train_test_split(
    X_combined_scaled, y, test_size=0.2, random_state=42, stratify=y)

print(f"  Training Set: {len(X_tab_train)} rows")
print(f"  Testing Set: {len(X_tab_test)} rows")

# ============================================
# PHASE 4: TRAIN TWO LOGISTIC REGRESSION MODELS
# ============================================
print("\n" + "=" * 60)
print("PHASE 4: TRAINING LOGISTIC REGRESSION MODELS")
print("=" * 60)

# MODEL A: Tabular Only (Baseline - What traditional banks do)
print("\n  Training Model A (Tabular Only - Baseline)...")
model_A = LogisticRegression(max_iter=1000, random_state=42, penalty='l2', C=1.0)
model_A.fit(X_tab_train, y_train)
y_pred_A = model_A.predict(X_tab_test)
y_prob_A = model_A.predict_proba(X_tab_test)[:, 1]

# MODEL B: Tabular + Graph Features (Our Approach)
print("  Training Model B (Tabular + Graph Features - Our Approach)...")
model_B = LogisticRegression(max_iter=1000, random_state=42, penalty='l2', C=1.0)
model_B.fit(X_comb_train, y_train)
y_pred_B = model_B.predict(X_comb_test)
y_prob_B = model_B.predict_proba(X_comb_test)[:, 1]

# ============================================
# PHASE 5: COMPARE RESULTS
# ============================================
print("\n" + "=" * 60)
print("PHASE 5: MODEL COMPARISON RESULTS")
print("=" * 60)

# Model A Metrics
acc_A = accuracy_score(y_test, y_pred_A)
prec_A = precision_score(y_test, y_pred_A)
rec_A = recall_score(y_test, y_pred_A)
f1_A = f1_score(y_test, y_pred_A)
auc_A = roc_auc_score(y_test, y_prob_A)

# Model B Metrics
acc_B = accuracy_score(y_test, y_pred_B)
prec_B = precision_score(y_test, y_pred_B)
rec_B = recall_score(y_test, y_pred_B)
f1_B = f1_score(y_test, y_pred_B)
auc_B = roc_auc_score(y_test, y_prob_B)

print(f"\n  {'Metric':<20} {'Model A (Tabular)':<22} {'Model B (Tab+Graph)':<22} {'Improvement'}")
print(f"  {'-'*80}")
print(f"  {'Accuracy':<20} {acc_A:<22.4f} {acc_B:<22.4f} {'+' if acc_B > acc_A else ''}{((acc_B - acc_A) * 100):.2f}%")
print(f"  {'Precision':<20} {prec_A:<22.4f} {prec_B:<22.4f} {'+' if prec_B > prec_A else ''}{((prec_B - prec_A) * 100):.2f}%")
print(f"  {'Recall':<20} {rec_A:<22.4f} {rec_B:<22.4f} {'+' if rec_B > rec_A else ''}{((rec_B - rec_A) * 100):.2f}%")
print(f"  {'F1-Score':<20} {f1_A:<22.4f} {f1_B:<22.4f} {'+' if f1_B > f1_A else ''}{((f1_B - f1_A) * 100):.2f}%")
print(f"  {'ROC-AUC':<20} {auc_A:<22.4f} {auc_B:<22.4f} {'+' if auc_B > auc_A else ''}{((auc_B - auc_A) * 100):.2f}%")

# ============================================
# VISUAL 1: ROC-AUC CURVE (Both Models)
# ============================================
print("\n  Generating ROC-AUC Curve...")

fpr_A, tpr_A, _ = roc_curve(y_test, y_prob_A)
fpr_B, tpr_B, _ = roc_curve(y_test, y_prob_B)

fig, ax = plt.subplots(figsize=(10, 8))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#16213e')

ax.plot(fpr_A, tpr_A, color='#e74c3c', linewidth=2.5, 
        label=f'Model A: Tabular Only (AUC = {auc_A:.4f})')
ax.plot(fpr_B, tpr_B, color='#4ecdc4', linewidth=2.5, 
        label=f'Model B: Tabular + Graph (AUC = {auc_B:.4f})')
ax.plot([0, 1], [0, 1], color='#666', linewidth=1, linestyle='--', label='Random Guess (AUC = 0.5)')

ax.set_xlabel('False Positive Rate', fontsize=13, color='white')
ax.set_ylabel('True Positive Rate', fontsize=13, color='white')
ax.set_title('ROC-AUC Curve: Tabular vs Graph-Enhanced Model',
             fontsize=16, fontweight='bold', color='white', pad=15)
ax.legend(fontsize=12, facecolor='#1a1a2e', edgecolor='white', labelcolor='white', loc='lower right')
ax.tick_params(colors='white')
for spine in ax.spines.values():
    spine.set_color('#333')

plt.tight_layout()
plt.savefig(f"{SAVE_PATH}\\model_roc_auc_curve.png", dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: model_roc_auc_curve.png")

# ============================================
# VISUAL 2: CONFUSION MATRICES (Side by Side)
# ============================================
print("  Generating Confusion Matrices...")

fig, axes = plt.subplots(1, 2, figsize=(16, 7))
fig.patch.set_facecolor('#0a0a1a')
fig.suptitle('Confusion Matrix Comparison', fontsize=18, fontweight='bold', color='white')

for ax, y_pred, title in zip(axes, [y_pred_A, y_pred_B], 
                              ['Model A: Tabular Only', 'Model B: Tabular + Graph']):
    cm = confusion_matrix(y_test, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='RdYlGn_r', ax=ax,
                xticklabels=['Safe (0)', 'Default (1)'],
                yticklabels=['Safe (0)', 'Default (1)'],
                annot_kws={'size': 16, 'fontweight': 'bold'},
                linewidths=2, linecolor='#0a0a1a')
    ax.set_title(title, fontsize=14, fontweight='bold', color='white')
    ax.set_xlabel('Predicted', fontsize=12, color='white')
    ax.set_ylabel('Actual', fontsize=12, color='white')
    ax.tick_params(colors='white')

plt.tight_layout(rect=[0, 0, 1, 0.93])
plt.savefig(f"{SAVE_PATH}\\model_confusion_matrix.png", dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: model_confusion_matrix.png")

# ============================================
# VISUAL 3: COEFFICIENT ANALYSIS (Model B)
# ============================================
print("  Generating Coefficient Analysis...")

coef_df = pd.DataFrame({
    'Feature': all_features,
    'Coefficient': model_B.coef_[0]
})
coef_df['Abs_Coeff'] = coef_df['Coefficient'].abs()
coef_df = coef_df.sort_values('Abs_Coeff', ascending=True)

# Highlight graph features
coef_df['Is_Graph'] = coef_df['Feature'].isin(graph_features)

fig, ax = plt.subplots(figsize=(14, 12))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#16213e')

colors_bar = []
for _, row in coef_df.iterrows():
    if row['Is_Graph']:
        colors_bar.append('#f39c12')  # Gold for graph features
    elif row['Coefficient'] > 0:
        colors_bar.append('#e74c3c')  # Red for positive (increases default risk)
    else:
        colors_bar.append('#4ecdc4')  # Blue for negative (decreases default risk)

bars = ax.barh(range(len(coef_df)), coef_df['Coefficient'].values, 
               color=colors_bar, edgecolor='white', linewidth=0.3, height=0.7)

ax.set_yticks(range(len(coef_df)))
ax.set_yticklabels(coef_df['Feature'].values, fontsize=10, color='white')
ax.set_xlabel('Logistic Regression Coefficient (Weight)', fontsize=13, color='white')
ax.set_title('Feature Coefficient Analysis (Logistic Regression Scorecard)\nGold = Graph Features  |  Red = Increases Risk  |  Blue = Decreases Risk',
             fontsize=14, fontweight='bold', color='white', pad=15)
ax.tick_params(colors='white')
ax.axvline(x=0, color='white', linewidth=0.8, linestyle='--', alpha=0.5)

for spine in ax.spines.values():
    spine.set_color('#333')

# Add value labels
for i, val in enumerate(coef_df['Coefficient'].values):
    ax.text(val + (0.01 if val > 0 else -0.01), i, f'{val:.3f}', 
            va='center', ha='left' if val > 0 else 'right',
            color='white', fontsize=8, fontweight='bold')

plt.tight_layout()
plt.savefig(f"{SAVE_PATH}\\model_coefficient_analysis.png", dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: model_coefficient_analysis.png")

# ============================================
# VISUAL 4: MODEL COMPARISON BAR CHART
# ============================================
print("  Generating Model Comparison Chart...")

fig, ax = plt.subplots(figsize=(12, 7))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#16213e')

metrics = ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC']
model_a_scores = [acc_A, prec_A, rec_A, f1_A, auc_A]
model_b_scores = [acc_B, prec_B, rec_B, f1_B, auc_B]

x = np.arange(len(metrics))
width = 0.35

bars1 = ax.bar(x - width/2, model_a_scores, width, label='Model A: Tabular Only', 
               color='#e74c3c', edgecolor='white', linewidth=0.5)
bars2 = ax.bar(x + width/2, model_b_scores, width, label='Model B: Tabular + Graph', 
               color='#4ecdc4', edgecolor='white', linewidth=0.5)

ax.set_ylabel('Score', fontsize=13, color='white')
ax.set_title('Model Performance Comparison\nTabular Only vs Graph-Enhanced',
             fontsize=16, fontweight='bold', color='white', pad=15)
ax.set_xticks(x)
ax.set_xticklabels(metrics, fontsize=12, color='white')
ax.legend(fontsize=12, facecolor='#1a1a2e', edgecolor='white', labelcolor='white')
ax.set_ylim(0, 1.1)
ax.tick_params(colors='white')

# Add value labels on bars
for bar in bars1:
    ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.02,
            f'{bar.get_height():.3f}', ha='center', va='bottom', color='#e74c3c', fontsize=9, fontweight='bold')
for bar in bars2:
    ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.02,
            f'{bar.get_height():.3f}', ha='center', va='bottom', color='#4ecdc4', fontsize=9, fontweight='bold')

for spine in ax.spines.values():
    spine.set_color('#333')

plt.tight_layout()
plt.savefig(f"{SAVE_PATH}\\model_comparison_chart.png", dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: model_comparison_chart.png")

# ============================================
# FINAL SUMMARY
# ============================================
print("\n" + "=" * 60)
print("FINAL SUMMARY")
print("=" * 60)
print(f"\n  Model A (Tabular Only):     ROC-AUC = {auc_A:.4f}")
print(f"  Model B (Tabular + Graph):  ROC-AUC = {auc_B:.4f}")
print(f"  Improvement:                {((auc_B - auc_A) * 100):.2f}%")
print(f"\n  Graph features that matter most (by coefficient weight):")

graph_coefs = coef_df[coef_df['Is_Graph']].sort_values('Abs_Coeff', ascending=False)
for _, row in graph_coefs.iterrows():
    direction = "INCREASES default risk" if row['Coefficient'] > 0 else "DECREASES default risk"
    print(f"    {row['Feature']}: {row['Coefficient']:.4f} ({direction})")

print(f"\n  Files saved to: {SAVE_PATH}")
print(f"    1. model_roc_auc_curve.png")
print(f"    2. model_confusion_matrix.png")
print(f"    3. model_coefficient_analysis.png")
print(f"    4. model_comparison_chart.png")
print(f"\nLOGISTIC REGRESSION SCORECARD COMPLETE!")
