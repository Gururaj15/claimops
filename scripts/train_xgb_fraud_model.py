import numpy as np
import xgboost as xgb
import shap
import json
import math

rng = np.random.default_rng(42)
N = 6000

claim_amount_ratio = rng.normal(1.0, 0.35, N).clip(0.2, 3.5)
policy_age_days = rng.exponential(400, N).clip(1, 4000)
previous_claims_count = rng.poisson(0.6, N).clip(0, 8)
days_since_policy_start = rng.exponential(300, N).clip(1, 3000)
document_anomaly_score = rng.beta(2, 6, N)
repair_cost_ratio = rng.normal(1.0, 0.3, N).clip(0.1, 3.0)

logit = (
    2.6 * (claim_amount_ratio - 1.0)
    + 3.1 * document_anomaly_score
    - 0.0025 * (policy_age_days / 100)
    + 0.55 * previous_claims_count
    - 0.002 * (days_since_policy_start / 100)
    + 1.4 * (repair_cost_ratio - 1.0)
    - 2.1
    # nonlinear interaction: new policy + high doc anomaly is extra suspicious
    + 1.8 * ((days_since_policy_start < 30).astype(float) * document_anomaly_score)
)
prob = 1 / (1 + np.exp(-logit))
y = (rng.uniform(0, 1, N) < prob).astype(int)

feature_names = [
    "claim_amount_ratio", "policy_age_days", "previous_claims_count",
    "days_since_policy_start", "document_anomaly_score", "repair_cost_ratio"
]
X = np.column_stack([
    claim_amount_ratio, policy_age_days, previous_claims_count,
    days_since_policy_start, document_anomaly_score, repair_cost_ratio
])

split = int(N * 0.8)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

model = xgb.XGBClassifier(
    n_estimators=60,
    max_depth=3,
    learning_rate=0.15,
    subsample=0.9,
    colsample_bytree=0.9,
    eval_metric="logloss",
)
model.fit(X_train, y_train)

train_acc = model.score(X_train, y_train)
test_acc = model.score(X_test, y_test)
print("train accuracy:", train_acc, "test accuracy:", test_acc)

# Real SHAP values via the shap library's TreeExplainer, computed on a sample
explainer = shap.TreeExplainer(model)
sample = X_test[:50]
shap_values = explainer.shap_values(sample)
base_value = float(explainer.expected_value)
print("SHAP base value:", base_value)
print("sample SHAP row 0:", shap_values[0])

# Export the raw trees as JSON so we can do pure-JS inference (no native
# binary / ONNX runtime needed on the Node side).
booster = model.get_booster()
trees_json = booster.get_dump(dump_format="json", with_stats=True)
trees = [json.loads(t) for t in trees_json]

# CRITICAL: xgboost's per-tree dump does NOT include base_score. base_score
# is a separate learned intercept (roughly the training positive rate) that
# must be added, in logit space, to the sum of leaf values at prediction
# time. Skipping this silently produces plausible-but-wrong probabilities —
# caught here by verifying against booster.predict() directly, not assumed.
import re
config = json.loads(booster.save_config())
base_score_raw = config["learner"]["learner_model_param"]["base_score"]
base_score = float(re.findall(r"[-\d.Ee+]+", str(base_score_raw))[0])
base_margin = math.log(base_score / (1 - base_score))

# Verify: manual traversal + base_margin must match native predict exactly.
native_margins = booster.predict(xgb.DMatrix(X_test[:20]), output_margin=True)
for i in range(20):
    feats = X_test[i]
    m = base_margin
    for t in trees:
        node = t
        while "leaf" not in node:
            fidx = int(node["split"][1:])
            val = feats[fidx]
            nxt_id = node["yes"] if val < node["split_condition"] else node["no"]
            node = next(c for c in node["children"] if c["nodeid"] == nxt_id)
        m += node["leaf"]
    assert abs(m - native_margins[i]) < 1e-4, f"mismatch at {i}: {m} vs {native_margins[i]}"
print("Verified: manual JSON-tree traversal + base_margin matches booster.predict() exactly on 20 held-out rows.")

export = {
    "feature_names": feature_names,
    "trees": trees,
    "base_margin": base_margin,
    "shap_base_value": base_value,
    "n_estimators": len(trees),
    "train_accuracy": train_acc,
    "test_accuracy": test_acc,
    "n_train_samples": int(split),
}

with open("/home/claude/claimops/src/lib/fraud-model-xgb.json", "w") as f:
    json.dump(export, f)

print("exported", len(trees), "trees")
