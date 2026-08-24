import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import json

rng = np.random.default_rng(42)
N = 4000

# Features: claim_amount_ratio (claim vs expected), policy_age_days, previous_claims_count,
# days_since_policy_start, document_anomaly_score, repair_cost_ratio
claim_amount_ratio = rng.normal(1.0, 0.35, N).clip(0.2, 3.5)
policy_age_days = rng.exponential(400, N).clip(1, 4000)
previous_claims_count = rng.poisson(0.6, N).clip(0, 8)
days_since_policy_start = rng.exponential(300, N).clip(1, 3000)
document_anomaly_score = rng.beta(2, 6, N)
repair_cost_ratio = rng.normal(1.0, 0.3, N).clip(0.1, 3.0)

# ground truth fraud generative rule (nonlinear-ish combo), then binarize with noise
logit = (
    2.6 * (claim_amount_ratio - 1.0)
    + 3.1 * document_anomaly_score
    - 0.0025 * (policy_age_days / 100)
    + 0.55 * previous_claims_count
    - 0.002 * (days_since_policy_start / 100)
    + 1.4 * (repair_cost_ratio - 1.0)
    - 2.1
)
prob = 1 / (1 + np.exp(-logit))
y = (rng.uniform(0, 1, N) < prob).astype(int)

X = np.column_stack([
    claim_amount_ratio, policy_age_days, previous_claims_count,
    days_since_policy_start, document_anomaly_score, repair_cost_ratio
])
feature_names = [
    "claim_amount_ratio", "policy_age_days", "previous_claims_count",
    "days_since_policy_start", "document_anomaly_score", "repair_cost_ratio"
]

scaler = StandardScaler()
Xs = scaler.fit_transform(X)

model = LogisticRegression(max_iter=1000)
model.fit(Xs, y)

train_acc = model.score(Xs, y)
print("train accuracy:", train_acc)

export = {
    "feature_names": feature_names,
    "coef": model.coef_[0].tolist(),
    "intercept": float(model.intercept_[0]),
    "scaler_mean": scaler.mean_.tolist(),
    "scaler_scale": scaler.scale_.tolist(),
    "train_accuracy": train_acc,
    "n_train_samples": N,
}

with open("/home/claude/claimops/src/lib/fraud-model-weights.json", "w") as f:
    json.dump(export, f, indent=2)

print(json.dumps(export, indent=2))
