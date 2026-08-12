import pandas as pd
import numpy as np
from faker import Faker
import random
import uuid

fake = Faker('en_IN')
np.random.seed(42)
random.seed(42)

NUM_TOTAL_ROWS = 3500
NUM_NORMAL_ROWS = 3000
NUM_FRAUD_CLUSTERS = 8
NUM_HOUSEHOLD_CLUSTERS = 50
NUM_WORKPLACE_CLUSTERS = 5

data = []

def generate_base_profile():
    age = np.random.randint(18, 70)
    monthly_income = np.random.lognormal(mean=np.log(40000), sigma=0.5)
    annual_income = monthly_income * 12
    monthly_debt_payments = monthly_income * np.random.uniform(0.1, 0.6)
    monthly_expenses = monthly_income * np.random.uniform(0.2, 0.4)
    dti = monthly_debt_payments / monthly_income if monthly_income > 0 else 0
    total_existing_debt = monthly_debt_payments * np.random.randint(12, 120)
    
    credit_score = int(np.random.normal(loc=650, scale=80))
    credit_score = max(300, min(850, credit_score))
    
    return {
        'customer_id': f"CUST_{uuid.uuid4().hex[:8].upper()}",
        'full_name': fake.name(),
        'age': age,
        'gender': random.choice(['Male', 'Female']),
        'marital_status': random.choice(['Single', 'Married', 'Divorced']),
        'num_dependents': np.random.choice([0, 1, 2, 3, 4], p=[0.4, 0.3, 0.15, 0.1, 0.05]),
        'education_level': random.choice(['High School', 'Graduate', 'Post-Graduate']),
        'national_id': fake.bothify(text='?????####?').upper(),
        
        'phone_number': fake.phone_number(),
        'email_domain': fake.free_email_domain(),
        'residential_address': fake.address().replace('\n', ', '),
        'city': fake.city(),
        'zip_code': fake.postcode(),
        'state': fake.state(),
        
        'device_id': f"DEV_{uuid.uuid4().hex[:10].upper()}",
        'ip_address': fake.ipv4(),
        'browser_fingerprint': f"BFP_{uuid.uuid4().hex[:8].upper()}",
        'phone_imei': f"IMEI_{fake.numerify(text='###############')}",
        
        'employer_name': fake.company(),
        'employer_id': f"EMP_{uuid.uuid4().hex[:6].upper()}",
        'job_title': fake.job(),
        'employment_type': random.choice(['Salaried', 'Self-Employed', 'Freelance']),
        'employment_years': round(np.random.uniform(0, age - 18), 1) if age > 18 else 0.0,
        
        'monthly_income': round(monthly_income, 2),
        'annual_income': round(annual_income, 2),
        'monthly_expenses': round(monthly_expenses, 2),
        'monthly_debt_payments': round(monthly_debt_payments, 2),
        'debt_to_income_ratio': round(dti, 4),
        'total_existing_debt': round(total_existing_debt, 2),
        'savings_balance': round(monthly_income * np.random.uniform(0, 10), 2),
        'num_bank_accounts': np.random.randint(1, 5),
        'num_open_loans': np.random.randint(0, 4),
        'num_credit_cards': np.random.randint(0, 5),
        'credit_utilization_pct': round(np.random.uniform(0, 0.95), 4),
        
        'credit_score': credit_score,
        'credit_history_months': np.random.randint(6, 120),
        'num_past_defaults': np.random.choice([0, 1, 2], p=[0.85, 0.1, 0.05]),
        'num_late_payments_30d': np.random.choice([0, 1, 2, 3], p=[0.7, 0.15, 0.1, 0.05]),
        'num_late_payments_60d': np.random.choice([0, 1, 2], p=[0.8, 0.15, 0.05]),
        'num_late_payments_90d': np.random.choice([0, 1, 2], p=[0.9, 0.08, 0.02]),
        'num_credit_inquiries_6m': np.random.randint(0, 6),
        
        'loan_amount': round(np.random.uniform(50000, 2000000), 2),
        'loan_purpose': random.choice(['Personal', 'Home', 'Auto', 'Education']),
        'loan_term_months': random.choice([12, 24, 36, 48, 60]),
        'interest_rate': round(np.random.uniform(8.5, 24.0), 2),
        'collateral_value': 0.0,
        'application_channel': random.choice(['Online', 'Branch', 'Mobile App']),
        
        'avg_monthly_transactions': np.random.randint(10, 100),
        'avg_transaction_amount': round(np.random.uniform(500, 10000), 2),
        'salary_deposit_regularity': round(np.random.uniform(0.5, 1.0), 2),
        'emi_bounce_count': np.random.choice([0, 1, 2, 3], p=[0.8, 0.1, 0.07, 0.03]),
        'account_age_months': np.random.randint(1, 120),
        
        'co_applicant_id': None,
        'guarantor_id': None,
        'shared_account_flag': False,
        'default': 0
    }

def set_default_prob(profile):
    score = 0
    if profile['credit_score'] < 600: score += 2
    if profile['debt_to_income_ratio'] > 0.5: score += 1
    if profile['num_past_defaults'] > 0: score += 2
    if profile['emi_bounce_count'] > 0: score += 1
    
    prob = 0.05 + (score * 0.15)
    prob = min(prob, 0.85)
    return np.random.binomial(1, prob)

# Generate normal rows
for _ in range(NUM_NORMAL_ROWS):
    prof = generate_base_profile()
    prof['default'] = set_default_prob(prof)
    data.append(prof)

# Generate fraud clusters
for _ in range(NUM_FRAUD_CLUSTERS):
    cluster_size = np.random.randint(5, 16)
    shared_device = f"DEV_FRAUD_{uuid.uuid4().hex[:6].upper()}"
    shared_ip = fake.ipv4()
    for _ in range(cluster_size):
        prof = generate_base_profile()
        prof['device_id'] = shared_device
        if random.random() > 0.3:
            prof['ip_address'] = shared_ip
        # High default chance for fraud
        prof['default'] = np.random.choice([0, 1], p=[0.1, 0.9])
        data.append(prof)

# Generate household clusters
for _ in range(NUM_HOUSEHOLD_CLUSTERS):
    cluster_size = np.random.randint(2, 5)
    shared_addr = fake.address().replace('\n', ', ')
    shared_zip = fake.postcode()
    shared_city = fake.city()
    shared_ip = fake.ipv4()
    
    members = []
    base_default = np.random.choice([0, 1], p=[0.8, 0.2]) # if one defaults, others likely do
    for _ in range(cluster_size):
        prof = generate_base_profile()
        prof['residential_address'] = shared_addr
        prof['zip_code'] = shared_zip
        prof['city'] = shared_city
        prof['ip_address'] = shared_ip
        prof['shared_account_flag'] = True
        
        prob = 0.8 if base_default == 1 else 0.05
        prof['default'] = np.random.binomial(1, prob)
        members.append(prof)
        data.append(prof)
        
    # Add co-applicant links
    if len(members) >= 2:
        members[0]['co_applicant_id'] = members[1]['customer_id']
        members[1]['co_applicant_id'] = members[0]['customer_id']

# Generate workplace clusters
for _ in range(NUM_WORKPLACE_CLUSTERS):
    cluster_size = np.random.randint(15, 30)
    shared_employer = fake.company()
    shared_emp_id = f"EMP_CORP_{uuid.uuid4().hex[:6].upper()}"
    # Simulate a company layoff (high default) or normal company (low default)
    layoff_scenario = random.choice([True, False])
    
    for _ in range(cluster_size):
        prof = generate_base_profile()
        prof['employer_name'] = shared_employer
        prof['employer_id'] = shared_emp_id
        
        prob = 0.6 if layoff_scenario else set_default_prob(prof)
        prof['default'] = np.random.binomial(1, prob) if layoff_scenario else set_default_prob(prof)
        data.append(prof)

df = pd.DataFrame(data)
# Shuffle dataframe
df = df.sample(frac=1).reset_index(drop=True)
df.to_csv("synthetic_credit_data.csv", index=False)
print(f"Generated {len(df)} rows. Saved to synthetic_credit_data.csv")
print(f"Defaults: {df['default'].sum()} ({round(df['default'].mean()*100, 2)}%)")
print(f"Unique Devices: {df['device_id'].nunique()}")
print(f"Unique IPs: {df['ip_address'].nunique()}")
