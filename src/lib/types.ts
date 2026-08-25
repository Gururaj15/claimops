export type ClaimStatus =
  | "new"
  | "pending_information"
  | "in_review"
  | "approved"
  | "rejected"
  | "siu_review";

export type Organization = {
  id: string;
  name: string;
  line_of_business: string;
  sla_hours: number;
  fraud_threshold: number;
  high_value_threshold: number;
  required_documents: string[];
  brand_color: string;
  claims_source: string;
  policy_source: string;
};

export type SchemaField = {
  sourceField: string;
  targetField: string;
  confidence: number;
  approved: boolean;
};

export type ClaimEvent = {
  id: string;
  claim_id: string;
  timestamp: string;
  label: string;
  actor: "system" | "adjuster" | "policyholder";
};

export type FraudFeatureContribution = {
  label: string;
  value: number;
};

export type FraudAssessment = {
  score: number;
  contributions: FraudFeatureContribution[];
  flags: string[];
};

export type CoverageAssessment = {
  verdict: "likely_covered" | "likely_excluded" | "needs_review";
  relevantClauses: string[];
  exclusion: string | null;
  deductible: number;
  coverageLimit: number;
  confidence: number;
  reasoning: string;
};

export type RuleCondition = {
  field: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  value: number | string;
};

export type Rule = {
  id: string;
  name: string;
  organization_id: string;
  conditions: RuleCondition[];
  actions: string[];
  priority: number;
  enabled: boolean;
};

export type RuleTrigger = {
  rule: Rule;
  matched: boolean;
};

export type Claim = {
  id: string;
  organization_id: string;
  claim_type: string;
  policyholder_name: string;
  policy_id: string;
  loss_date: string;
  estimated_loss: number;
  repair_cost: number;
  policy_age_days: number;
  previous_claims_count: number;
  days_since_policy_start: number;
  document_anomaly_score: number;
  status: ClaimStatus;
  assigned_to: string | null;
  geography: string;
  severity: "low" | "medium" | "high";
  created_at: string;
  sla_hours: number;
  fraud_score: number | null;
  human_review_required: boolean;
};
