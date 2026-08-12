import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

# Load the cleaned dataset
df = pd.read_csv(r"Y:\programs folder\PBL - DS\Dataset\synthetic_credit_data_cleaned.csv")
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")

# ============================================
# 1. CORRELATION HEATMAP
# ============================================
print("\n[1/5] Generating Correlation Heatmap...")

corr_columns = [
    'age', 'num_dependents', 'annual_income', 'monthly_debt_payments',
    'debt_to_income_ratio', 'total_existing_debt', 'savings_balance',
    'credit_score', 'credit_history_months', 'num_past_defaults',
    'num_late_payments_30d', 'num_late_payments_60d', 'num_late_payments_90d',
    'num_credit_inquiries_6m', 'credit_utilization_pct', 'loan_amount',
    'interest_rate', 'emi_bounce_count', 'salary_deposit_regularity',
    'default'
]

corr_matrix = df[corr_columns].corr()

fig, ax = plt.subplots(figsize=(20, 16))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#0a0a1a')

mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
cmap = sns.diverging_palette(220, 10, as_cmap=True)

sns.heatmap(corr_matrix, mask=mask, cmap=cmap, center=0,
            annot=True, fmt='.2f', annot_kws={'size': 8, 'color': 'white'},
            square=True, linewidths=0.5, linecolor='#1a1a2e',
            cbar_kws={'shrink': 0.8, 'label': 'Correlation Coefficient'},
            ax=ax)

ax.set_title('Correlation Heatmap: Financial Features vs Default',
             fontsize=18, fontweight='bold', color='white', pad=20)
ax.tick_params(colors='white', labelsize=9)
plt.setp(ax.get_xticklabels(), rotation=45, ha='right', color='white')
plt.setp(ax.get_yticklabels(), color='white')

# Fix colorbar text color
cbar = ax.collections[0].colorbar
cbar.ax.yaxis.set_tick_params(color='white')
plt.setp(cbar.ax.yaxis.get_ticklabels(), color='white')
cbar.set_label('Correlation Coefficient', color='white')

plt.tight_layout()
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\eda_correlation_heatmap.png",
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: eda_correlation_heatmap.png")

# ============================================
# 2. DISTRIBUTION PLOTS (Defaulters vs Safe)
# ============================================
print("\n[2/5] Generating Distribution Plots...")

dist_columns = ['annual_income', 'debt_to_income_ratio', 'credit_score', 'total_existing_debt']
dist_labels = ['Annual Income (₹)', 'Debt-to-Income Ratio', 'Credit Score', 'Total Existing Debt (₹)']

fig, axes = plt.subplots(2, 2, figsize=(18, 12))
fig.patch.set_facecolor('#0a0a1a')
fig.suptitle('Distribution Analysis: Defaulters (Red) vs Safe (Blue)',
             fontsize=18, fontweight='bold', color='white')

for idx, (col, label) in enumerate(zip(dist_columns, dist_labels)):
    ax = axes[idx // 2][idx % 2]
    ax.set_facecolor('#16213e')
    
    # Plot distributions
    safe_data = df[df['default'] == 0][col].dropna()
    default_data = df[df['default'] == 1][col].dropna()
    
    ax.hist(safe_data, bins=40, alpha=0.6, color='#4ecdc4', label='Safe (0)', density=True, edgecolor='none')
    ax.hist(default_data, bins=40, alpha=0.6, color='#e74c3c', label='Default (1)', density=True, edgecolor='none')
    
    ax.set_title(label, fontsize=14, fontweight='bold', color='white')
    ax.set_xlabel(label, color='#aaa', fontsize=10)
    ax.set_ylabel('Density', color='#aaa', fontsize=10)
    ax.tick_params(colors='white')
    ax.legend(fontsize=10, facecolor='#1a1a2e', edgecolor='white', labelcolor='white')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\eda_distribution_plots.png",
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: eda_distribution_plots.png")

# ============================================
# 3. CLASS IMBALANCE PIE CHART
# ============================================
print("\n[3/5] Generating Class Imbalance Chart...")

default_counts = df['default'].value_counts()
safe_count = default_counts[0]
default_count = default_counts[1]
default_pct = round((default_count / len(df)) * 100, 1)
safe_pct = round((safe_count / len(df)) * 100, 1)

fig, ax = plt.subplots(figsize=(10, 8))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#0a0a1a')

labels = [f'Safe (0)\n{safe_count} records\n({safe_pct}%)', 
          f'Default (1)\n{default_count} records\n({default_pct}%)']
sizes = [safe_count, default_count]
colors = ['#4ecdc4', '#e74c3c']
explode = (0, 0.08)

wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, colors=colors,
                                   autopct='%1.1f%%', startangle=140, 
                                   textprops={'color': 'white', 'fontsize': 13},
                                   wedgeprops={'edgecolor': 'white', 'linewidth': 1.5})
for autotext in autotexts:
    autotext.set_fontsize(14)
    autotext.set_fontweight('bold')

ax.set_title('Target Variable Distribution (Class Imbalance Check)',
             fontsize=16, fontweight='bold', color='white', pad=20)

plt.tight_layout()
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\eda_class_imbalance.png",
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: eda_class_imbalance.png")

# ============================================
# 4. VIOLIN PLOTS (Key Features by Default)
# ============================================
print("\n[4/5] Generating Violin Plots...")

violin_cols = ['credit_score', 'debt_to_income_ratio', 'annual_income', 'emi_bounce_count']
violin_labels = ['Credit Score', 'Debt-to-Income Ratio', 'Annual Income (₹)', 'EMI Bounce Count']

fig, axes = plt.subplots(2, 2, figsize=(18, 12))
fig.patch.set_facecolor('#0a0a1a')
fig.suptitle('Violin Plots: Feature Spread by Default Status',
             fontsize=18, fontweight='bold', color='white')

df['default_str'] = df['default'].astype(str)
palette = {'0': '#4ecdc4', '1': '#e74c3c'}

for idx, (col, label) in enumerate(zip(violin_cols, violin_labels)):
    ax = axes[idx // 2][idx % 2]
    ax.set_facecolor('#16213e')
    
    sns.violinplot(x='default_str', y=col, data=df, ax=ax, palette=palette,
                   inner='quartile', linewidth=1.2)
    
    ax.set_title(label, fontsize=14, fontweight='bold', color='white')
    ax.set_xlabel('Default Status (0=Safe, 1=Default)', color='#aaa', fontsize=10)
    ax.set_ylabel(label, color='#aaa', fontsize=10)
    ax.tick_params(colors='white')
    for spine in ax.spines.values():
        spine.set_color('#333')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\eda_violin_plots.png",
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: eda_violin_plots.png")

# ============================================
# 5. TOP CORRELATIONS WITH DEFAULT (Bar Chart)
# ============================================
print("\n[5/5] Generating Top Correlations Bar Chart...")

default_corr = corr_matrix['default'].drop('default').sort_values(key=abs, ascending=False)

fig, ax = plt.subplots(figsize=(14, 10))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#16213e')

colors_bar = ['#e74c3c' if v > 0 else '#4ecdc4' for v in default_corr.values]

bars = ax.barh(range(len(default_corr)), default_corr.values, color=colors_bar, 
               edgecolor='white', linewidth=0.5, height=0.7)

ax.set_yticks(range(len(default_corr)))
ax.set_yticklabels(default_corr.index, fontsize=11, color='white')
ax.set_xlabel('Correlation with Default', fontsize=13, color='white')
ax.set_title('Feature Correlation with Loan Default\n(Red = Positive / Blue = Negative)',
             fontsize=16, fontweight='bold', color='white', pad=15)
ax.tick_params(colors='white')
ax.axvline(x=0, color='white', linewidth=0.8, linestyle='--', alpha=0.5)

for spine in ax.spines.values():
    spine.set_color('#333')

# Add value labels
for i, (val, bar) in enumerate(zip(default_corr.values, bars)):
    ax.text(val + (0.005 if val > 0 else -0.005), i, f'{val:.3f}', 
            va='center', ha='left' if val > 0 else 'right',
            color='white', fontsize=9, fontweight='bold')

plt.tight_layout()
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\eda_top_correlations.png",
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("  Saved: eda_top_correlations.png")

print(f"\n{'='*60}")
print("ALL EDA VISUALS GENERATED SUCCESSFULLY!")
print(f"{'='*60}")
print(f"\nFiles saved to: Y:\\programs folder\\PBL - DS\\Dataset\\")
print(f"  1. eda_correlation_heatmap.png")
print(f"  2. eda_distribution_plots.png")
print(f"  3. eda_class_imbalance.png")
print(f"  4. eda_violin_plots.png")
print(f"  5. eda_top_correlations.png")
