import pandas as pd
import numpy as np
import networkx as nx
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import warnings
warnings.filterwarnings('ignore')

# Load Dataset
df = pd.read_csv(r"Y:\programs folder\PBL - DS\Dataset\synthetic_credit_data.csv")
print(f"Loaded {len(df)} rows")

# ============================================
# BUILD THE MULTI-VIEW NETWORK GRAPH
# ============================================
G = nx.Graph()

# Add all customers as nodes
for idx, row in df.iterrows():
    G.add_node(row['customer_id'], 
               default=row['default'],
               income=row['annual_income'],
               credit_score=row['credit_score'])

print(f"Nodes added: {G.number_of_nodes()}")

# ----- VIEW 1: DIGITAL VIEW (Shared Device ID) -----
print("Building Digital View edges (shared device_id)...")
device_groups = df.groupby('device_id')['customer_id'].apply(list)
digital_edges = 0
for device, customers in device_groups.items():
    if len(customers) > 1:
        for i in range(len(customers)):
            for j in range(i + 1, len(customers)):
                G.add_edge(customers[i], customers[j], view='digital')
                digital_edges += 1
print(f"  Digital edges (shared devices): {digital_edges}")

# ----- VIEW 2: GEOSPATIAL VIEW (Shared IP Address) -----
print("Building Geospatial View edges (shared ip_address)...")
ip_groups = df.groupby('ip_address')['customer_id'].apply(list)
geo_edges = 0
for ip, customers in ip_groups.items():
    if len(customers) > 1:
        for i in range(len(customers)):
            for j in range(i + 1, len(customers)):
                if not G.has_edge(customers[i], customers[j]):
                    G.add_edge(customers[i], customers[j], view='geospatial')
                    geo_edges += 1
print(f"  Geospatial edges (shared IPs): {geo_edges}")

# ----- VIEW 3: SOCIO-ECONOMIC VIEW (Shared Employer ID) -----
print("Building Socio-Economic View edges (shared employer_id)...")
emp_groups = df.groupby('employer_id')['customer_id'].apply(list)
socio_edges = 0
for emp, customers in emp_groups.items():
    if len(customers) > 1:
        for i in range(len(customers)):
            for j in range(i + 1, len(customers)):
                if not G.has_edge(customers[i], customers[j]):
                    G.add_edge(customers[i], customers[j], view='socioeconomic')
                    socio_edges += 1
print(f"  Socio-Economic edges (shared employers): {socio_edges}")

print(f"\nTotal Edges: {G.number_of_edges()}")

# ============================================
# EXTRACT ONLY CONNECTED NODES (THE CLUSTERS)
# ============================================
connected_nodes = [n for n in G.nodes() if G.degree(n) > 0]
G_sub = G.subgraph(connected_nodes).copy()
print(f"Connected Nodes (in clusters): {G_sub.number_of_nodes()}")
print(f"Edges in subgraph: {G_sub.number_of_edges()}")

# ============================================
# GENERATE THE CONTAGION NETWORK VISUALIZATION
# ============================================
print("\nGenerating Network Visualization...")

fig, ax = plt.subplots(1, 1, figsize=(20, 14))
fig.patch.set_facecolor('#0a0a1a')
ax.set_facecolor('#0a0a1a')

# Layout
pos = nx.spring_layout(G_sub, k=0.8, iterations=50, seed=42)

# Color nodes: Red = Default, Blue = Safe
node_colors = []
for node in G_sub.nodes():
    if G_sub.nodes[node]['default'] == 1:
        node_colors.append('#ff4444')
    else:
        node_colors.append('#4ecdc4')

# Size nodes by degree (more connections = bigger node)
node_sizes = [max(G_sub.degree(n) * 40, 30) for n in G_sub.nodes()]

# Draw edges first (subtle)
nx.draw_networkx_edges(G_sub, pos, ax=ax, 
                       edge_color='#ffffff', alpha=0.08, width=0.5)

# Draw nodes
nx.draw_networkx_nodes(G_sub, pos, ax=ax,
                       node_color=node_colors, 
                       node_size=node_sizes,
                       alpha=0.85, 
                       edgecolors='white', linewidths=0.3)

# Title
ax.set_title('Multi-View Financial Contagion Network\nRed = Defaulter  |  Blue = Safe  |  Size = Connection Density',
             fontsize=18, fontweight='bold', color='white', pad=20)

# Legend
legend_elements = [
    mpatches.Patch(facecolor='#ff4444', edgecolor='white', label='Defaulter (1)'),
    mpatches.Patch(facecolor='#4ecdc4', edgecolor='white', label='Safe (0)'),
    mpatches.Patch(facecolor='#333333', edgecolor='white', label=f'Total Connected Nodes: {G_sub.number_of_nodes()}'),
    mpatches.Patch(facecolor='#333333', edgecolor='white', label=f'Total Edges: {G_sub.number_of_edges()}'),
]
legend = ax.legend(handles=legend_elements, loc='lower left', fontsize=12,
                   facecolor='#1a1a2e', edgecolor='white', labelcolor='white')

ax.axis('off')
plt.tight_layout()
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\contagion_network_graph.png", 
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("Saved: contagion_network_graph.png")

# ============================================
# GENERATE CLUSTER BREAKDOWN PIE CHART
# ============================================
print("\nGenerating Cluster Breakdown...")

components = list(nx.connected_components(G_sub))
cluster_sizes = [len(c) for c in components]

# Classify clusters
fraud_clusters = 0
household_clusters = 0
workplace_clusters = 0
for comp in components:
    size = len(comp)
    if size >= 15:
        workplace_clusters += 1
    elif size >= 5:
        fraud_clusters += 1
    else:
        household_clusters += 1

fig, axes = plt.subplots(1, 2, figsize=(18, 8))
fig.patch.set_facecolor('#0a0a1a')
fig.suptitle('Contagion Cluster Analysis', fontsize=18, fontweight='bold', color='white')

# Pie 1: Cluster Type Distribution
labels1 = ['Fraud Rings\n(5-14 members)', 'Household Groups\n(2-4 members)', 'Workplace Clusters\n(15+ members)']
sizes1 = [fraud_clusters, household_clusters, workplace_clusters]
colors1 = ['#e74c3c', '#3498db', '#f39c12']
explode1 = (0.05, 0.05, 0.05)

axes[0].pie(sizes1, explode=explode1, labels=labels1, colors=colors1,
            autopct='%1.1f%%', startangle=140, textprops={'color': 'white', 'fontsize': 11})
axes[0].set_title('Cluster Type Distribution', color='white', fontsize=14, fontweight='bold')
axes[0].set_facecolor('#0a0a1a')

# Pie 2: Default Rate inside clusters vs outside
cluster_node_ids = set()
for comp in components:
    cluster_node_ids.update(comp)

cluster_defaults = df[df['customer_id'].isin(cluster_node_ids)]['default'].mean() * 100
isolated_defaults = df[~df['customer_id'].isin(cluster_node_ids)]['default'].mean() * 100

labels2 = [f'Cluster Default Rate\n({round(cluster_defaults, 1)}%)', 
           f'Isolated Default Rate\n({round(isolated_defaults, 1)}%)']
sizes2 = [cluster_defaults, isolated_defaults]
colors2 = ['#e74c3c', '#27ae60']
explode2 = (0.08, 0)

axes[1].pie(sizes2, explode=explode2, labels=labels2, colors=colors2,
            autopct='%1.1f%%', startangle=140, textprops={'color': 'white', 'fontsize': 11})
axes[1].set_title('Default Rate: Clustered vs Isolated', color='white', fontsize=14, fontweight='bold')
axes[1].set_facecolor('#0a0a1a')

plt.tight_layout(rect=[0, 0, 1, 0.93])
plt.savefig(r"Y:\programs folder\PBL - DS\Dataset\cluster_analysis_chart.png", 
            dpi=200, bbox_inches='tight', facecolor='#0a0a1a')
plt.close()
print("Saved: cluster_analysis_chart.png")

print(f"\n{'='*60}")
print(f"SUMMARY")
print(f"{'='*60}")
print(f"  Total Clusters Found: {len(components)}")
print(f"  Fraud Ring Clusters (5-14 members): {fraud_clusters}")
print(f"  Household Clusters (2-4 members): {household_clusters}")
print(f"  Workplace Clusters (15+ members): {workplace_clusters}")
print(f"  Default Rate INSIDE clusters: {round(cluster_defaults, 2)}%")
print(f"  Default Rate OUTSIDE clusters: {round(isolated_defaults, 2)}%")
print(f"\nALL VISUALS SAVED TO PROJECT FOLDER!")
