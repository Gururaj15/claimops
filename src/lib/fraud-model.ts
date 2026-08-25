import modelData from "./fraud-model-xgb.json";
import type { Claim, FraudAssessment } from "./types";

/**
 * This is a REAL XGBoost model — trained with the actual xgboost Python
 * library (scripts/train_xgb_fraud_model.py), 60 boosted trees, depth 3,
 * on 6,000 synthetic claims with a deliberately nonlinear interaction term
 * (new-policy × document-anomaly) that a linear model cannot capture.
 *
 * Why pure TypeScript instead of a Python service or ONNX runtime:
 * `onnxruntime-node` needs to download a prebuilt binary from NuGet at
 * install time. That's a completely normal thing to do on your own machine
 * with normal internet access, but it fails in the sandboxed environment
 * this was authored in, so it couldn't be verified end-to-end there. XGBoost's
 * own tree dump format is plain JSON (see fraud-model-xgb.json), and boosted
 * trees are just nested if/else splits, so walking that JSON directly in
 * TypeScript reproduces XGBoost's own prediction exactly, with zero native
 * dependencies, zero install risk, and zero hosting cost. If you'd rather run
 * the actual Python model behind a small FastAPI/Flask service later, the
 * training script and exported JSON make that a very small follow-up, not a
 * rewrite.
 *
 * SHAP note: exact TreeSHAP (the polynomial-time algorithm from Lundberg &
 * Lee) needs a nontrivial recursive "unwind the path" implementation to be
 * correct. What's implemented here is the Saabas method (Saabas, 2014): walk
 * the decision path for each tree and attribute the change in the
 * cover-weighted expected output at each split to the feature that split on.
 * It's a real, published, exact-for-a-single-tree attribution method and a
 * close approximation to SHAP for an ensemble — not identical to exact
 * TreeSHAP. `scripts/train_xgb_fraud_model.py` also computes real SHAP
 * values via the `shap` Python library at training time, printed to stdout,
 * so the two can be compared directly if exact TreeSHAP parity matters later.
 */

type XgbNode = {
  nodeid: number;
  depth?: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  cover: number;
  leaf?: number;
  children?: XgbNode[];
};

const { feature_names, trees, base_margin } = modelData as {
  feature_names: string[];
  trees: XgbNode[];
  base_margin: number;
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function findNode(nodes: XgbNode[], id: number): XgbNode {
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.nodeid === id) return n;
    if (n.children) stack.push(...n.children);
  }
  throw new Error(`node ${id} not found`);
}

/** Cover-weighted expected leaf value of the subtree rooted at `node`. */
function expectedValue(node: XgbNode): number {
  if (node.leaf !== undefined) return node.leaf;
  const [a, b] = node.children!;
  return (expectedValue(a) * a.cover + expectedValue(b) * b.cover) / node.cover;
}

function scoreTree(
  root: XgbNode,
  features: Record<string, number>
): { leafValue: number; contributions: Record<string, number> } {
  const contributions: Record<string, number> = {};
  let node = root;
  let parentExpected = expectedValue(root);

  while (node.leaf === undefined) {
    const featIdx = Number(node.split!.slice(1)); // "f3" -> 3
    const featName = feature_names[featIdx];
    const value = features[featName] ?? 0;
    const goYes = value < node.split_condition!; // xgboost: missing/condition-true -> yes branch
    const nextId = goYes ? node.yes! : node.no!;
    const nextNode = findNode(node.children!, nextId);

    const nextExpected = expectedValue(nextNode);
    contributions[featName] = (contributions[featName] ?? 0) + (nextExpected - parentExpected);

    parentExpected = nextExpected;
    node = nextNode;
  }

  return { leafValue: node.leaf!, contributions };
}

export function scoreWithXgb(features: Record<string, number>): {
  probability: number;
  margin: number;
  contributions: Record<string, number>;
} {
  let margin = base_margin;
  const totalContributions: Record<string, number> = {};

  for (const tree of trees) {
    const { leafValue, contributions } = scoreTree(tree, features);
    margin += leafValue;
    for (const [f, v] of Object.entries(contributions)) {
      totalContributions[f] = (totalContributions[f] ?? 0) + v;
    }
  }

  return { probability: sigmoid(margin), margin, contributions: totalContributions };
}

const FEATURE_LABELS: Record<string, string> = {
  claim_amount_ratio: "Claim amount vs. expected range",
  policy_age_days: "Policy age",
  previous_claims_count: "Previous claims on file",
  days_since_policy_start: "Time since policy start",
  document_anomaly_score: "Document anomaly signal",
  repair_cost_ratio: "Repair cost vs. expected range",
};

export function assessFraud(claim: Claim, expectedLoss: number): FraudAssessment {
  const claim_amount_ratio = expectedLoss > 0 ? claim.estimated_loss / expectedLoss : 1;
  const repair_cost_ratio = expectedLoss > 0 ? claim.repair_cost / expectedLoss : 1;

  const features: Record<string, number> = {
    claim_amount_ratio,
    policy_age_days: claim.policy_age_days,
    previous_claims_count: claim.previous_claims_count,
    days_since_policy_start: claim.days_since_policy_start,
    document_anomaly_score: claim.document_anomaly_score,
    repair_cost_ratio,
  };

  const { probability, contributions } = scoreWithXgb(features);

  const ranked = Object.entries(contributions)
    .map(([f, v]) => ({ label: FEATURE_LABELS[f] ?? f, value: v }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

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
  if (claim.days_since_policy_start < 30 && claim.document_anomaly_score > 0.4) {
    flags.push("New policy combined with document anomaly — pattern the model weighs heavily");
  }

  return { score: probability, contributions: ranked, flags };
}
