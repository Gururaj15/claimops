import type { Organization, Rule } from "./types";

/**
 * NOTE: this file used to also hold hardcoded CLAIMS and CLAIM_EVENTS
 * arrays that the whole app read from directly — that was the fake part
 * flagged during review (nothing persisted, nothing was server-computed).
 * Claims and events now live in the real SQLite database (src/lib/db,
 * src/lib/repo.ts) and are created via the intake pipeline
 * (src/lib/pipeline.ts). ORGANIZATIONS and RULES below are still plain data
 * — they're the *seed* values scripts/seed.ts inserts into the database on
 * first run, not a runtime data source the app reads from anymore.
 */

export const ORGANIZATIONS: Organization[] = [
  {
    id: "org_acme",
    name: "Acme Insurance",
    line_of_business: "Commercial Property",
    sla_hours: 48,
    fraud_threshold: 0.75,
    high_value_threshold: 25000,
    required_documents: ["Invoice", "Photos", "Policy", "Proof of Loss"],
    brand_color: "#17726A",
    claims_source: "CSV upload",
    policy_source: "JSON API",
  },
  {
    id: "org_voyage",
    name: "Voyage Travel Insurance",
    line_of_business: "Travel",
    sla_hours: 24,
    fraud_threshold: 0.65,
    high_value_threshold: 10000,
    required_documents: ["Booking Confirmation", "Receipt", "Medical Evidence"],
    brand_color: "#C8790E",
    claims_source: "Webhook",
    policy_source: "Legacy XML feed",
  },
];

export const RULES: Rule[] = [
  {
    id: "rule_acme_high_value",
    organization_id: "org_acme",
    name: "High Value Claim",
    conditions: [{ field: "estimated_loss", operator: ">", value: 25000 }],
    actions: ["assign_senior_adjuster", "require_human_review", "priority_high"],
    priority: 1,
    enabled: true,
  },
  {
    id: "rule_acme_fraud",
    organization_id: "org_acme",
    name: "Potential Fraud",
    conditions: [{ field: "fraud_score", operator: ">", value: 0.75 }],
    actions: ["route_to_siu", "require_human_review"],
    priority: 0,
    enabled: true,
  },
  {
    id: "rule_acme_docs",
    organization_id: "org_acme",
    name: "Elevated Document Anomaly",
    conditions: [{ field: "document_anomaly_score", operator: ">", value: 0.6 }],
    actions: ["request_additional_documents", "status_pending_information"],
    priority: 2,
    enabled: true,
  },
  {
    id: "rule_voyage_high_value",
    organization_id: "org_voyage",
    name: "High Value Claim",
    conditions: [{ field: "estimated_loss", operator: ">", value: 10000 }],
    actions: ["assign_senior_adjuster", "require_human_review", "priority_high"],
    priority: 1,
    enabled: true,
  },
  {
    id: "rule_voyage_fraud",
    organization_id: "org_voyage",
    name: "Potential Fraud",
    conditions: [{ field: "fraud_score", operator: ">", value: 0.65 }],
    actions: ["route_to_siu", "require_human_review"],
    priority: 0,
    enabled: true,
  },
  {
    id: "rule_voyage_new_policy",
    organization_id: "org_voyage",
    name: "New Policy Claim",
    conditions: [{ field: "days_since_policy_start", operator: "<", value: 14 }],
    actions: ["route_to_siu", "priority_high"],
    priority: 3,
    enabled: true,
  },
];

const CLAIM_TYPE_EXPECTED_LOSS: Record<string, number> = {
  water_damage: 14000,
  fire: 32000,
  theft: 6000,
  liability: 40000,
  wind_hail: 18000,
  bodily_injury: 22000,
  trip_cancellation: 3200,
  lost_baggage: 1400,
};
export const SAMPLE_SCHEMA_MAPPING = [
  { sourceField: "customer_claim_number", targetField: "claim_id", confidence: 0.98 },
  { sourceField: "insured_name", targetField: "policyholder_name", confidence: 0.96 },
  { sourceField: "loss_date", targetField: "date_of_loss", confidence: 0.99 },
  { sourceField: "loss_type", targetField: "claim_type", confidence: 0.94 },
  { sourceField: "policy_ref", targetField: "policy_id", confidence: 0.91 },
  { sourceField: "estimated_damage", targetField: "estimated_loss", confidence: 0.89 },
];

export function expectedLossFor(claimType: string): number {
  return CLAIM_TYPE_EXPECTED_LOSS[claimType] ?? 15000;
}
