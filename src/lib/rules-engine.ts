import type { Claim, Rule, RuleTrigger, FraudAssessment } from "./types";

/**
 * Rules are pure data (see seed-data.ts / eventually the `rules` table),
 * not hardcoded branches. A rule matches when ALL of its conditions are true.
 * This is intentionally simple (AND-only, flat conditions) — the point for a
 * v1 is that a non-engineer can define these in the Onboarding UI, not that
 * it supports arbitrary boolean logic on day one.
 */

function getFieldValue(
  field: string,
  claim: Claim,
  fraud: FraudAssessment
): number | string {
  switch (field) {
    case "estimated_loss":
      return claim.estimated_loss;
    case "repair_cost":
      return claim.repair_cost;
    case "previous_claims_count":
      return claim.previous_claims_count;
    case "document_anomaly_score":
      return claim.document_anomaly_score;
    case "fraud_score":
      return fraud.score;
    case "claim_type":
      return claim.claim_type;
    case "days_since_policy_start":
      return claim.days_since_policy_start;
    default:
      return "";
  }
}

function evaluateCondition(
  value: number | string,
  operator: Rule["conditions"][number]["operator"],
  target: number | string
): boolean {
  if (typeof value === "number" && typeof target === "number") {
    switch (operator) {
      case ">":
        return value > target;
      case "<":
        return value < target;
      case ">=":
        return value >= target;
      case "<=":
        return value <= target;
      case "==":
        return value === target;
      case "!=":
        return value !== target;
    }
  }
  switch (operator) {
    case "==":
      return value === target;
    case "!=":
      return value !== target;
    default:
      return false;
  }
}

export function evaluateRules(
  claim: Claim,
  fraud: FraudAssessment,
  rules: Rule[]
): RuleTrigger[] {
  return rules
    .filter((r) => r.organization_id === claim.organization_id && r.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((rule) => {
      const matched = rule.conditions.every((cond) =>
        evaluateCondition(getFieldValue(cond.field, claim, fraud), cond.operator, cond.value)
      );
      return { rule, matched };
    });
}

export function resolveActions(triggers: RuleTrigger[]): string[] {
  const actions = new Set<string>();
  triggers
    .filter((t) => t.matched)
    .forEach((t) => t.rule.actions.forEach((a) => actions.add(a)));
  return Array.from(actions);
}
