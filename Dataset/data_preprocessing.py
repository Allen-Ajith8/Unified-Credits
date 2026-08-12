import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import warnings
warnings.filterwarnings('ignore')

# Load Dataset
df = pd.read_csv(r"Y:\programs folder\PBL - DS\Dataset\synthetic_credit_data.csv")
print(f"Dataset Shape: {df.shape}")
print(f"Total Rows: {df.shape[0]}, Total Columns: {df.shape[1]}")
print()

# Define the continuous financial columns where outliers matter
outlier_columns = [
    'annual_income', 'monthly_income', 'monthly_expenses',
    'monthly_debt_payments', 'debt_to_income_ratio', 'total_existing_debt',
    'savings_balance', 'credit_utilization_pct', 'loan_amount',
    'avg_transaction_amount', 'interest_rate'
]

# ============================================
# STEP 1: DETECT OUTLIERS USING IQR METHOD
# ============================================
print("=" * 60)
print("STEP 1: OUTLIER DETECTION (IQR Method)")
print("=" * 60)
print()

outlier_summary = {}
for col in outlier_columns:
    Q1 = df[col].quantile(0.25)
    Q3 = df[col].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
    outlier_count = len(outliers)
    outlier_pct = round((outlier_count / len(df)) * 100, 2)
    
    outlier_summary[col] = {
        'count': outlier_count,
        'percentage': outlier_pct,
        'lower_bound': round(lower_bound, 2),
        'upper_bound': round(upper_bound, 2),
        'min_val': round(df[col].min(), 2),
        'max_val': round(df[col].max(), 2)
    }
    
    if outlier_count > 0:
        print(f"  Column: {col}")
        print(f"    Outliers Found: {outlier_count} ({outlier_pct}%)")
        print(f"    IQR Bounds: [{round(lower_bound, 2)}, {round(upper_bound, 2)}]")
        print(f"    Data Range: [{round(df[col].min(), 2)}, {round(df[col].max(), 2)}]")
        print()

total_outlier_rows = 0
for col in outlier_columns:
    total_outlier_rows += outlier_summary[col]['count']
print(f"  TOTAL OUTLIER INSTANCES ACROSS ALL COLUMNS: {total_outlier_rows}")
print()

# ============================================
# STEP 2: GENERATE "BEFORE" BOXPLOTS
# ============================================
print("=" * 60)
print("STEP 2: GENERATING 'BEFORE' BOXPLOTS")
print("=" * 60)

# Select top 6 columns with most outliers for visual clarity
top_outlier_cols = sorted(outlier_summary.keys(), key=lambda x: outlier_summary[x]['count'], reverse=True)[:6]

fig, axes = plt.subplots(2, 3, figsize=(18, 10))
fig.suptitle('BEFORE Preprocessing: Outliers Detected (IQR Method)', fontsize=16, fontweight='bold', color='#CC0000')
fig.patch.set_facecolor('#1a1a2e')

for idx, col in enumerate(top_outlier_cols):
    ax = axes[idx // 3][idx % 3]
    bp = ax.boxplot(df[col].dropna(), patch_artist=True, 
                    boxprops=dict(facecolor='#e74c3c', color='white'),
                    whiskerprops=dict(color='white'),
                    capprops=dict(color='white'),
                    medianprops=dict(color='#f1c40f', linewidth=2),
                    flierprops=dict(marker='o', markerfacecolor='#e74c3c', markersize=4, alpha=0.5))
    ax.set_title(col, color='white', fontsize=12, fontweight='bold')
    ax.set_facecolor('#16213e')
    ax.tick_params(colors='white')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\BEFORE_outliers_boxplot.png", dpi=150, bbox_inches='tight', facecolor='#1a1a2e')
plt.close()
print("  Saved: BEFORE_outliers_boxplot.png")

# ============================================
# STEP 3: APPLY WINSORIZATION (CAPPING)
# ============================================
print()
print("=" * 60)
print("STEP 3: APPLYING WINSORIZATION (Capping at 5th & 95th Percentile)")
print("=" * 60)
print()

df_cleaned = df.copy()

for col in outlier_columns:
    lower_cap = df_cleaned[col].quantile(0.05)
    upper_cap = df_cleaned[col].quantile(0.95)
    
    before_min = df_cleaned[col].min()
    before_max = df_cleaned[col].max()
    
    df_cleaned[col] = df_cleaned[col].clip(lower=lower_cap, upper=upper_cap)
    
    after_min = df_cleaned[col].min()
    after_max = df_cleaned[col].max()
    
    print(f"  {col}:")
    print(f"    Before: [{round(before_min, 2)}, {round(before_max, 2)}]")
    print(f"    After:  [{round(after_min, 2)}, {round(after_max, 2)}]")
    print()

# ============================================
# STEP 4: GENERATE "AFTER" BOXPLOTS
# ============================================
print("=" * 60)
print("STEP 4: GENERATING 'AFTER' BOXPLOTS")
print("=" * 60)

fig, axes = plt.subplots(2, 3, figsize=(18, 10))
fig.suptitle('AFTER Preprocessing: Outliers Handled (Winsorization)', fontsize=16, fontweight='bold', color='#27ae60')
fig.patch.set_facecolor('#1a1a2e')

for idx, col in enumerate(top_outlier_cols):
    ax = axes[idx // 3][idx % 3]
    bp = ax.boxplot(df_cleaned[col].dropna(), patch_artist=True, 
                    boxprops=dict(facecolor='#27ae60', color='white'),
                    whiskerprops=dict(color='white'),
                    capprops=dict(color='white'),
                    medianprops=dict(color='#f1c40f', linewidth=2),
                    flierprops=dict(marker='o', markerfacecolor='#27ae60', markersize=4, alpha=0.5))
    ax.set_title(col, color='white', fontsize=12, fontweight='bold')
    ax.set_facecolor('#16213e')
    ax.tick_params(colors='white')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\AFTER_outliers_boxplot.png", dpi=150, bbox_inches='tight', facecolor='#1a1a2e')
plt.close()
print("  Saved: AFTER_outliers_boxplot.png")

# ============================================
# STEP 5: SAVE CLEANED DATASET
# ============================================
print()
print("=" * 60)
print("STEP 5: SAVING CLEANED DATASET")
print("=" * 60)
df_cleaned.to_csv(r"Y:\programs folder\PBL - DS\Dataset\synthetic_credit_data_cleaned.csv", index=False)
print(f"  Saved: synthetic_credit_data_cleaned.csv")
print(f"  Rows: {df_cleaned.shape[0]}, Columns: {df_cleaned.shape[1]}")
print()
print("PREPROCESSING COMPLETE!")
