import weights from "./fraud-model-weights.json";
import type { Claim, FraudAssessment } from "./types";

/**
 * This model is a real logistic regression trained (offline, via scikit-learn)
 * on 4,000 synthetic claims — see /scripts/train_fraud_model.py for the exact
 * training code and /docs/07-architecture-decisions.md for why logistic
 * regression was chosen over XGBoost for a v1 (interpretability, no server
 * round-trip needed, trivial to retrain per-tenant later).
 *
 * Because the model is linear, each feature's SHAP value has a closed form:
 * contribution_i = coef_i * (scaled_value_i), which is exactly what a
 * linear SHAP explainer returns relative to the training mean. That's what
 * we display as the "why" behind every score.
 */

const {
  feature_names,
  coef,
  intercept,
  scaler_mean,
  scaler_scale,
}: {
  feature_names: string[];
  coef: number[];
  intercept: number;
  scaler_mean: number[];
  scaler_scale: number[];
} = weights;

const FEATURE_LABELS: Record<string, string> = {
  claim_amount_ratio: "Claim amount vs. expected range",
  policy_age_days: "Policy age",
  previous_claims_count: "Previous claims on file",
  days_since_policy_start: "Time since policy start",
  document_anomaly_score: "Document anomaly signal",
  repair_cost_ratio: "Repair cost vs. expected range",
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function assessFraud(claim: Claim, expectedLoss: number): FraudAssessment {
  const claim_amount_ratio = expectedLoss > 0 ? claim.estimated_loss / expectedLoss : 1;
  const repair_cost_ratio = expectedLoss > 0 ? claim.repair_cost / expectedLoss : 1;

  const rawFeatures: Record<string, number> = {
    claim_amount_ratio,
    policy_age_days: claim.policy_age_days,
    previous_claims_count: claim.previous_claims_count,
    days_since_policy_start: claim.days_since_policy_start,
    document_anomaly_score: claim.document_anomaly_score,
    repair_cost_ratio,
  };

  let logit = intercept;
  const contributions: { label: string; value: number }[] = [];

  feature_names.forEach((name, i) => {
    const scaled = (rawFeatures[name] - scaler_mean[i]) / scaler_scale[i];
    const contribution = coef[i] * scaled;
    logit += contribution;
    contributions.push({ label: FEATURE_LABELS[name] ?? name, value: contribution });
  });

  const score = sigmoid(logit);

  contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const flags: string[] = [];
  if (claim_amount_ratio > 1.25) {
    flags.push(
      `Claim amount ${Math.round((claim_amount_ratio - 1) * 100)}% above expected range for this loss type`
    );
  }
  if (claim.document_anomaly_score > 0.55) {
    flags.push("Elevated document anomaly signal (possible tampering or inconsistency)");
  }
  if (claim.previous_claims_count >= 2) {
    flags.push(`${claim.previous_claims_count} previous claims on this policy`);
  }
  if (repair_cost_ratio > 1.2) {
    flags.push("Repair estimate inconsistent with claim type");
  }
  if (claim.days_since_policy_start < 30) {
    flags.push("Claim filed within 30 days of policy start");
  }

  return { score, contributions, flags };
}
