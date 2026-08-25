import { z } from "zod";

export const ClaimIntakeSchema = z.object({
  organization_id: z.string().min(1),
  claim_type: z.string().min(1),
  policyholder_name: z.string().min(1),
  policy_id: z.string().min(1),
  loss_date: z.string().min(1),
  estimated_loss: z.coerce.number().min(0),
  repair_cost: z.coerce.number().min(0).default(0),
  policy_age_days: z.coerce.number().min(0).default(0),
  previous_claims_count: z.coerce.number().min(0).default(0),
  days_since_policy_start: z.coerce.number().min(0).default(0),
  document_anomaly_score: z.coerce.number().min(0).max(1).default(0),
  geography: z.string().default("Unknown"),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
});

export const OrganizationCreateSchema = z.object({
  name: z.string().min(1),
  line_of_business: z.string().min(1),
  sla_hours: z.coerce.number().min(1),
  fraud_threshold: z.coerce.number().min(0).max(1),
  high_value_threshold: z.coerce.number().min(0),
  required_documents: z.array(z.string()).default([]),
  claims_source: z.string().default("Web form"),
  policy_source: z.string().default("JSON API"),
});

export const RuleCreateSchema = z.object({
  organization_id: z.string().min(1),
  name: z.string().min(1),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum([">", "<", ">=", "<=", "==", "!="]),
        value: z.union([z.string(), z.coerce.number()]),
      })
    )
    .min(1),
  actions: z.array(z.string()).min(1),
  priority: z.coerce.number().default(10),
});

export const ClaimStatusUpdateSchema = z.object({
  status: z.enum(["approved", "rejected", "pending_information", "in_review"]),
  actor: z.string().default("adjuster"),
});
