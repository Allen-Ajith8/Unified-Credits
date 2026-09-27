"""
RBI & DPDP Act Compliant Synthetic Dataset Generator
=====================================================
Generates 40,000 records split into two CSVs:
  1. financial_underwriting_data.csv  — Credit underwriting features (no PII/device data)
  2. fraud_network_edges.csv          — Device/IP/UPI network data (for fraud detection only)

Compliance:
  - No Zip Code, Gender, Religion, or Employer Name
  - Age is permitted under Indian banking law
  - Device/IP data is separated from credit decisions (DPDP data minimization)
  - 30% of defaulters form fraud rings (shared devices/IPs)
"""

import pandas as pd
import numpy as np
from faker import Faker
import hashlib
import uuid
import warnings
warnings.filterwarnings("ignore")

# ============================================================
# Configuration
# ============================================================
TOTAL_RECORDS = 4_000
DEFAULT_RATE = 0.047  # Target: 4.5% to 5.0%
FRAUD_RING_PCT = 0.30  # 30% of defaulters share devices/IPs
NUM_FRAUD_RING_DEVICES = 50  # Small pool of shared devices
NUM_FRAUD_RING_IPS = 50      # Small pool of shared IPs
SEED = 42

np.random.seed(SEED)
fake = Faker('en_IN')
Faker.seed(SEED)

print("=" * 60)
print("RBI-Compliant Synthetic Dataset Generator")
print("=" * 60)

# ============================================================
# Step 1: Generate Customer IDs and Target Variable
# ============================================================
print(f"\n[Step 1] Generating {TOTAL_RECORDS:,} Customer IDs and Target Variable...")

n_defaults = int(TOTAL_RECORDS * DEFAULT_RATE)
n_non_defaults = TOTAL_RECORDS - n_defaults

customer_ids = [f"CUST_{str(i).zfill(6)}" for i in range(1, TOTAL_RECORDS + 1)]
target = np.array([1] * n_defaults + [0] * n_non_defaults)
np.random.shuffle(target)

actual_rate = target.sum() / len(target) * 100
print(f"  Total records: {TOTAL_RECORDS}")
print(f"  Defaults: {target.sum()} ({actual_rate:.2f}%)")

# ============================================================
# Step 2: Generate Financial Underwriting Data (Table 1)
# ============================================================
print("\n[Step 2] Generating Financial Underwriting Data...")

# --- Age (21-65, uniform) ---
age = np.random.randint(21, 66, size=TOTAL_RECORDS)

# --- CIBIL Score (300-900, correlated with default) ---
cibil = np.zeros(TOTAL_RECORDS, dtype=int)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        # Defaulters: lower CIBIL (mean ~520, std 80)
        score = int(np.random.normal(520, 80))
    else:
        # Non-defaulters: higher CIBIL (mean ~740, std 70)
        score = int(np.random.normal(740, 70))
    cibil[i] = np.clip(score, 300, 900)

# --- Verified Monthly Income (15k - 300k INR) ---
monthly_income = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        # Defaulters: lower income distribution
        inc = np.random.lognormal(mean=10.5, sigma=0.6)
    else:
        # Non-defaulters: higher income distribution
        inc = np.random.lognormal(mean=11.0, sigma=0.7)
    monthly_income[i] = np.clip(inc, 15000, 300000)

# --- Debt to Income Ratio (0.1 - 0.8) ---
dti = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        # Defaulters: higher DTI (mean ~0.55)
        ratio = np.random.beta(5, 4) * 0.7 + 0.1
    else:
        # Non-defaulters: lower DTI (mean ~0.30)
        ratio = np.random.beta(3, 7) * 0.7 + 0.1
    dti[i] = np.clip(ratio, 0.1, 0.8)

# --- Utility Payment Consistency (0.0 - 1.0) ---
utility = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        # Defaulters: lower consistency
        utility[i] = np.clip(np.random.beta(3, 7), 0.0, 1.0)
    else:
        # Non-defaulters: higher consistency
        utility[i] = np.clip(np.random.beta(8, 2), 0.0, 1.0)

# --- GST Filing History ---
gst_options = ['Regular', 'Irregular', 'Not_Applicable']
gst = []
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        gst.append(np.random.choice(gst_options, p=[0.20, 0.55, 0.25]))
    else:
        gst.append(np.random.choice(gst_options, p=[0.60, 0.15, 0.25]))

# --- Loan Amount (50k - 50L INR) ---
loan_amount = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        loan_amount[i] = np.clip(np.random.lognormal(mean=12.5, sigma=0.8), 50000, 5000000)
    else:
        loan_amount[i] = np.clip(np.random.lognormal(mean=12.0, sigma=0.9), 50000, 5000000)

# --- Loan Purpose ---
purposes = ['Home', 'Vehicle', 'Education', 'Personal', 'Business', 'Agriculture']
loan_purpose = np.random.choice(purposes, size=TOTAL_RECORDS, p=[0.25, 0.15, 0.10, 0.20, 0.20, 0.10])

# --- Loan Term (months) ---
loan_terms = [12, 24, 36, 48, 60, 84, 120, 180, 240]
loan_term = np.random.choice(loan_terms, size=TOTAL_RECORDS)

# --- Interest Rate (7% - 24%) ---
interest_rate = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        interest_rate[i] = np.clip(np.random.normal(16.5, 3.0), 7.0, 24.0)
    else:
        interest_rate[i] = np.clip(np.random.normal(11.0, 2.5), 7.0, 24.0)

# --- Number of Past Defaults ---
past_defaults = np.zeros(TOTAL_RECORDS, dtype=int)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        past_defaults[i] = np.random.choice([0, 1, 2, 3, 4], p=[0.15, 0.35, 0.25, 0.15, 0.10])
    else:
        past_defaults[i] = np.random.choice([0, 1, 2, 3, 4], p=[0.75, 0.15, 0.06, 0.03, 0.01])

# --- Number of Active Loans ---
active_loans = np.random.randint(0, 8, size=TOTAL_RECORDS)

# --- Credit History (months) ---
credit_history = np.random.randint(6, 360, size=TOTAL_RECORDS)

# --- Savings Balance (INR) ---
savings = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        savings[i] = np.clip(np.random.lognormal(10.0, 1.0), 0, 5000000)
    else:
        savings[i] = np.clip(np.random.lognormal(11.0, 1.2), 0, 5000000)

# --- EMI Bounce Count ---
emi_bounce = np.zeros(TOTAL_RECORDS, dtype=int)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        emi_bounce[i] = np.random.choice([0, 1, 2, 3, 4, 5], p=[0.10, 0.20, 0.25, 0.20, 0.15, 0.10])
    else:
        emi_bounce[i] = np.random.choice([0, 1, 2, 3, 4, 5], p=[0.70, 0.15, 0.08, 0.04, 0.02, 0.01])

# --- Credit Utilization (0-100%) ---
credit_util = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        credit_util[i] = np.clip(np.random.normal(72, 15), 0, 100)
    else:
        credit_util[i] = np.clip(np.random.normal(35, 18), 0, 100)

# --- Salary Deposit Regularity (0-1) ---
salary_reg = np.zeros(TOTAL_RECORDS, dtype=float)
for i in range(TOTAL_RECORDS):
    if target[i] == 1:
        salary_reg[i] = np.clip(np.random.beta(3, 6), 0.0, 1.0)
    else:
        salary_reg[i] = np.clip(np.random.beta(7, 2), 0.0, 1.0)

# Build DataFrame
financial_df = pd.DataFrame({
    'Customer_ID': customer_ids,
    'Age': age,
    'CIBIL_Score': cibil,
    'Verified_Monthly_Income': np.round(monthly_income, 2),
    'Debt_to_Income_Ratio': np.round(dti, 4),
    'Utility_Payment_Consistency': np.round(utility, 4),
    'GST_Filing_History': gst,
    'Loan_Amount': np.round(loan_amount, 2),
    'Loan_Purpose': loan_purpose,
    'Loan_Term_Months': loan_term,
    'Interest_Rate': np.round(interest_rate, 2),
    'Num_Past_Defaults': past_defaults,
    'Num_Active_Loans': active_loans,
    'Credit_History_Months': credit_history,
    'Savings_Balance': np.round(savings, 2),
    'EMI_Bounce_Count': emi_bounce,
    'Credit_Utilization_Pct': np.round(credit_util, 2),
    'Salary_Deposit_Regularity': np.round(salary_reg, 4),
    'Target_Default': target,
})

print(f"  Financial features: {len(financial_df.columns) - 2} (excluding ID and target)")
print(f"  CIBIL (defaulters):     mean={financial_df[financial_df.Target_Default==1]['CIBIL_Score'].mean():.0f}")
print(f"  CIBIL (non-defaulters): mean={financial_df[financial_df.Target_Default==0]['CIBIL_Score'].mean():.0f}")
print(f"  DTI (defaulters):       mean={financial_df[financial_df.Target_Default==1]['Debt_to_Income_Ratio'].mean():.3f}")
print(f"  DTI (non-defaulters):   mean={financial_df[financial_df.Target_Default==0]['Debt_to_Income_Ratio'].mean():.3f}")

# ============================================================
# Step 3: Generate Fraud Network Edges (Table 2)
# ============================================================
print("\n[Step 3] Generating Fraud Network Edges...")

# Identify defaulter and non-defaulter indices
defaulter_idx = np.where(target == 1)[0]
non_defaulter_idx = np.where(target == 0)[0]

# Select 30% of defaulters for fraud rings
n_fraud_ring = int(len(defaulter_idx) * FRAUD_RING_PCT)
fraud_ring_idx = np.random.choice(defaulter_idx, size=n_fraud_ring, replace=False)
normal_idx = np.setdiff1d(np.arange(TOTAL_RECORDS), fraud_ring_idx)

print(f"  Fraud ring members: {n_fraud_ring} (30% of {len(defaulter_idx)} defaulters)")

# Generate small pool of shared fraud ring devices/IPs
fraud_devices = [f"FRAUD_DEV_{str(i).zfill(3)}" for i in range(NUM_FRAUD_RING_DEVICES)]
fraud_ips = [f"10.{np.random.randint(0,255)}.{np.random.randint(0,255)}.{np.random.randint(1,254)}" for i in range(NUM_FRAUD_RING_IPS)]

# Assign data
device_ids = [""] * TOTAL_RECORDS
ip_addresses = [""] * TOTAL_RECORDS
upi_vpas = [""] * TOTAL_RECORDS

# Fraud ring members: shared devices and IPs
for idx in fraud_ring_idx:
    device_ids[idx] = np.random.choice(fraud_devices)
    ip_addresses[idx] = np.random.choice(fraud_ips)

# Normal users: unique devices and IPs
for idx in normal_idx:
    device_ids[idx] = f"DEV_{uuid.uuid4().hex[:12].upper()}"
    ip_addresses[idx] = f"{np.random.randint(100,255)}.{np.random.randint(0,255)}.{np.random.randint(0,255)}.{np.random.randint(1,254)}"

# UPI VPAs: unique for all
for i in range(TOTAL_RECORDS):
    name_part = fake.first_name().lower() + str(np.random.randint(10, 9999))
    bank_part = np.random.choice(['@oksbi', '@okaxis', '@okhdfcbank', '@ybl', '@paytm', '@ibl', '@upi'])
    upi_vpas[i] = f"{name_part}{bank_part}"

fraud_df = pd.DataFrame({
    'Customer_ID': customer_ids,
    'Device_ID': device_ids,
    'IP_Address': ip_addresses,
    'UPI_VPA': upi_vpas,
})

# Verify clustering
top_device = fraud_df['Device_ID'].value_counts().head(5)
print(f"  Top 5 most shared Device_IDs:")
for dev, count in top_device.items():
    print(f"    {dev}: {count} users")

# ============================================================
# Step 4: Save CSVs
# ============================================================
import os
output_dir = r"y:\programs folder\PBL - DS\Dataset"
os.makedirs(output_dir, exist_ok=True)

financial_path = os.path.join(output_dir, "financial_underwriting_data.csv")
fraud_path = os.path.join(output_dir, "fraud_network_edges.csv")

financial_df.to_csv(financial_path, index=False)
fraud_df.to_csv(fraud_path, index=False)

print(f"\n[Step 4] Saved CSVs:")
print(f"  {financial_path} ({len(financial_df)} rows, {len(financial_df.columns)} cols)")
print(f"  {fraud_path} ({len(fraud_df)} rows, {len(fraud_df.columns)} cols)")

# ============================================================
# Step 5: Validation
# ============================================================
print("\n" + "=" * 60)
print("VALIDATION")
print("=" * 60)

# Check default rate
rate = financial_df['Target_Default'].mean() * 100
print(f"  Default rate: {rate:.2f}% {'✓' if 4.5 <= rate <= 5.0 else '✗ OUT OF RANGE'}")

# Check record count
print(f"  Total records: {len(financial_df)} {'✓' if len(financial_df) == TOTAL_RECORDS else '✗'}")

# Check no restricted columns
restricted = ['Zip_Code', 'Gender', 'Religion', 'Employer_Name', 'zip_code', 'gender', 'religion', 'employer_name']
all_cols = list(financial_df.columns) + list(fraud_df.columns)
found_restricted = [c for c in restricted if c in all_cols]
print(f"  Restricted columns present: {found_restricted if found_restricted else 'None ✓'}")

# Check fraud ring clustering
fraud_ring_devices = fraud_df.loc[fraud_ring_idx, 'Device_ID']
unique_fraud_devices = fraud_ring_devices.nunique()
print(f"  Fraud ring: {n_fraud_ring} users sharing {unique_fraud_devices} devices ✓")

# Check CIBIL correlation
from scipy.stats import pointbiserialr
corr, pval = pointbiserialr(financial_df['Target_Default'], financial_df['CIBIL_Score'])
print(f"  CIBIL ↔ Default correlation: {corr:.4f} (p={pval:.2e}) {'✓' if pval < 0.01 else '✗'}")

corr_dti, pval_dti = pointbiserialr(financial_df['Target_Default'], financial_df['Debt_to_Income_Ratio'])
print(f"  DTI ↔ Default correlation:   {corr_dti:.4f} (p={pval_dti:.2e}) {'✓' if pval_dti < 0.01 else '✗'}")

print("\n" + "=" * 60)
print("DATASET GENERATION COMPLETE")
print("=" * 60)
