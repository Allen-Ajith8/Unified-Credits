# The Unified Credit Engine: Integrating Cash Flow Analytics & Network Contagion Mapping
## Complete Project Extract & Master Reference Document

---

## 📋 Executive Summary & Project Title

### Selected Project Title
> **"The Unified Credit Engine: Integrating Cash Flow Analytics and Network-Based Contagion Mapping for Holistic Risk Assessment"**

### Project Abstract
Traditional lending models rely heavily on external credit bureau scores (e.g., CIBIL) and operate in a vacuum, failing to account for real-time liquidity, income stability, and relational risks like financial contagion. This traditional approach excludes "new-to-credit" customers and misses hidden fraud rings.

This data science project introduces a **Hybrid, Dynamic Credit Scoring Framework** built on two core pillars:
1. **The Unified Cash Flow Engine:** Merging historical external credit data (payment streaks, bureau scores) with real-time internal banking behavior (Average Monthly Balance, salary consistency, fixed obligations). 
2. **The Multi-View Relational Network:** Treating customers as interconnected nodes (sharing IPs, devices, employers) to map hidden financial contagion and fraud rings using Graph Theory algorithms (PageRank, Centrality).

By synthesizing dual data streams (simulating Account Aggregator frameworks) with Network Analytics, these features are evaluated via a strictly transparent and regulatory-compliant **L2-Regularized Logistic Regression Scorecard Model**. This eliminates the "thin-file" penalty and transitions banking from reactive debt assessment to proactive, capacity-based lending.

---

## 🛠️ Project File Architecture (`Y:\programs folder\PBL - DS\Dataset\`)

| Script / File | Purpose | Output Generated |
|---|---|---|
| `generate_dataset.py` | Synthesizes custom credit dataset (Internal + External features & clusters) | `synthetic_credit_data.csv` (3,340 rows, 56 columns) |
| `data_preprocessing.py` | Detects outliers via IQR and applies Winsorization | `BEFORE_outliers_boxplot.png`, `AFTER_outliers_boxplot.png`, `synthetic_credit_data_cleaned.csv` |
| `generate_eda.py` | Runs Exploratory Data Analysis & statistical correlations | `eda_correlation_heatmap.png`, `eda_distribution_plots.png`, `eda_class_imbalance.png`, `eda_violin_plots.png`, `eda_top_correlations.png` |
| `generate_visuals.py` | Constructs Multi-View Network Graph & maps contagion | `contagion_network_graph.png`, `cluster_analysis_chart.png` |
| `logistic_scorecard.py` | Trains baseline & graph-enhanced Logistic Scorecards | `model_roc_auc_curve.png`, `model_confusion_matrix.png`, `model_coefficient_analysis.png`, `model_comparison_chart.png` |

---

## 📊 Dataset Specifications (56 Features)

- **Total Records:** 3,340 rows
- **Base Default Rate:** 25.9% (865 Defaulters, 2,475 Safe)
- **Key Feature Categories (The Dual Data Streams):**
  1. *External Bureau Data:* `credit_score`, `credit_history_months`, `num_past_defaults`, `num_late_payments`, `credit_utilization_pct`
  2. *Internal Behavioral Data (Cash Flow):* `monthly_income`, `monthly_expenses`, `savings_balance`, `avg_monthly_transactions`, `salary_deposit_regularity`, `emi_bounce_count`
  3. *Relational Network Data (Edge Builders):* `device_id`, `ip_address`, `employer_id`
  4. *Target Variable:* `default` (0 = Safe, 1 = Default)

---

## 🧹 Data Preprocessing & Outlier Management

### Outlier Detection (IQR Method)
- **Method:** Interquartile Range ($IQR = Q3 - Q1$).
- **Total Outlier Instances Found:** 795 across continuous financial columns.

### Outlier Mitigation (Winsorization)
- **Method:** Capped extreme values at the 5th and 95th percentiles.
- **Why Winsorization instead of Deletion?** Deleting outlier rows deletes *Nodes*, which destroys connected *Edges* and breaks the network graph topology.

---

## 🕸️ Multi-View Graph Construction & Contagion Insights

### Network Construction (NetworkX)
- **Total Edges:** 1,673
- **Views Implemented:**
  1. *Digital View:* matching `device_id` (458 edges) -> Fraud Rings.
  2. *Geospatial View:* matching `ip_address` (162 edges) -> Household Contagion.
  3. *Socio-Economic View:* matching `employer_id` (1,053 edges) -> Workplace Layoffs.

### Empirical Proof of Financial Contagion
- **Total Clusters Found:** 63 
- **Default Rate INSIDE Clusters:** **45.29%**
- **Default Rate OUTSIDE Clusters:** **23.70%**

---

## 📈 Statistical Modeling: L2-Regularized Logistic Scorecard

### Experimental Setup
- **Model A (Baseline):** 28 Tabular Features (External Bureau + Internal Cash Flow).
- **Model B (Unified Approach):** 28 Tabular Features + 5 Graph Network Features (`degree_centrality`, `pagerank`, `clustering_coefficient`, `cluster_size`, `is_in_cluster`).

### Empirical Results (Model A vs Model B)

| Metric | Model A (Baseline) | Model B (Unified) | Absolute Improvement |
|---|---|---|---|
| **ROC-AUC** | 0.6909 | **0.7277** | **+3.68%** |
| **Recall** | 18.50% | **22.54%** | **+4.05%** |

### Key Feature Weights
- `clustering_coefficient`: **+0.6076** (Strongest network indicator of default).
- Cash flow stability indicators (`savings_balance`, `salary_deposit_regularity`) heavily offset low external bureau scores for thin-file customers.

---

## 🎓 Presentation Slide Content (PBL Template Breakdown)

- **Slide 2: Project Progress Overview** (Current Progress: 65%, Milestones completed, Remaining work, Timeline).
- **Slide 3: Data Collection & Analysis** (Dataset screenshot instructions, 3,340 samples, 56 custom columns description).
- **Slide 4: Methodology & Design** (Workflow: External + Internal Data Ingestion -> Multi-View Graph -> Extraction -> Scorecarding).
- **Slide 5: System Architecture & Module Design** (Architectural diagram flow, Local internal pipeline API design).
- **Slide 6: Implementation Environment** (VS Code, Libraries used, Python 3.12).
- **Slide 7: Implementation Progress** (Sample output screenshots, Working Prototype description).
- **Slide 8: Challenges & Future Direction** (Tech challenges, Model Optimization, Testing plans).

---

## ❓ Master Defense Q&A Cheatsheet

1. **Q: How does this help unbanked or "thin-file" customers?**
   *A:* By utilizing real-time internal cash flow data (like salary regularity and savings balance), we can accurately score customers who have no historical external credit score (CIBIL), removing the thin-file penalty.
2. **Q: Why didn't you use Deep Learning or Graph Neural Networks (GCNs)?**
   *A:* Banking regulations mandate that credit decisions must be 100% explainable. Our Logistic Scorecard allows exact point-deduction explanations.
3. **Q: Why Winsorization instead of dropping outliers?**
   *A:* Dropping outlier rows deletes nodes and breaks connecting edges in the graph topology.

---

## 🔮 Future Scope & Deliverable
- **Interactive Underwriting Dashboard (Streamlit + Plotly 3D):** A web app rendering a 3D "Galaxy / Constellation" graph of all 3,340 nodes in space, allowing underwriters to search any customer and view their unified internal/external score and network risk penalty.
- **Account Aggregator API Integration:** A microservice capable of dynamically ingesting real-time banking data feeds for automated, capacity-based lending.
