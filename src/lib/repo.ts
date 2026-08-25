import { randomUUID } from "crypto";
import { getPool } from "./db/client";
import type { Claim, ClaimStatus, Organization, Rule } from "./types";

/**
 * Every function here is async now (Postgres queries are asynchronous,
 * unlike the SQLite version this replaced, which was synchronous). Every
 * caller — API routes, the pipeline, the seed script — awaits these.
 * jsonb columns (conditions, actions, required_documents, skills,
 * license_states, term_freqs) come back from `pg` already parsed into JS
 * objects/arrays; no JSON.parse needed on read, and objects/arrays can be
 * passed directly on write without JSON.stringify.
 */

// ---------- Organizations ----------

export async function listOrganizations(): Promise<Organization[]> {
  const { rows } = await getPool().query("SELECT * FROM organizations ORDER BY created_at");
  return rows.map(mapOrg);
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const { rows } = await getPool().query("SELECT * FROM organizations WHERE id = $1", [id]);
  return rows[0] ? mapOrg(rows[0]) : null;
}

export async function createOrganization(input: {
  name: string;
  line_of_business: string;
  sla_hours: number;
  fraud_threshold: number;
  high_value_threshold: number;
  required_documents: string[];
  claims_source: string;
  policy_source: string;
}): Promise<Organization> {
  const id = "org_" + slug(input.name) + "_" + randomUUID().slice(0, 6);
  await getPool().query(
    `INSERT INTO organizations
      (id, name, line_of_business, sla_hours, fraud_threshold, high_value_threshold, required_documents, claims_source, policy_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.name,
      input.line_of_business,
      input.sla_hours,
      input.fraud_threshold,
      input.high_value_threshold,
      JSON.stringify(input.required_documents),
      input.claims_source,
      input.policy_source,
    ]
  );
  return (await getOrganization(id))!;
}

function mapOrg(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    line_of_business: row.line_of_business,
    sla_hours: row.sla_hours,
    fraud_threshold: Number(row.fraud_threshold),
    high_value_threshold: Number(row.high_value_threshold),
    required_documents: row.required_documents,
    brand_color: row.brand_color,
    claims_source: row.claims_source,
    policy_source: row.policy_source,
  };
}

// ---------- Rules ----------

export async function listRules(orgId: string): Promise<Rule[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM rules WHERE organization_id = $1 ORDER BY priority",
    [orgId]
  );
  return rows.map(mapRule);
}

export async function createRule(input: {
  organization_id: string;
  name: string;
  conditions: Rule["conditions"];
  actions: string[];
  priority: number;
}): Promise<Rule> {
  const id = "rule_" + randomUUID().slice(0, 8);
  const { rows } = await getPool().query(
    `INSERT INTO rules (id, organization_id, name, conditions, actions, priority, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
    [
      id,
      input.organization_id,
      input.name,
      JSON.stringify(input.conditions),
      JSON.stringify(input.actions),
      input.priority,
    ]
  );
  return mapRule(rows[0]);
}

export async function updateRule(
  id: string,
  patch: Partial<{ enabled: boolean; priority: number }>
): Promise<void> {
  if (patch.enabled !== undefined) {
    await getPool().query("UPDATE rules SET enabled = $1 WHERE id = $2", [patch.enabled, id]);
  }
  if (patch.priority !== undefined) {
    await getPool().query("UPDATE rules SET priority = $1 WHERE id = $2", [patch.priority, id]);
  }
}

export async function deleteRule(id: string): Promise<void> {
  await getPool().query("DELETE FROM rules WHERE id = $1", [id]);
}

function mapRule(row: any): Rule {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    conditions: row.conditions,
    actions: row.actions,
    priority: row.priority,
    enabled: row.enabled,
  };
}

// ---------- Adjusters ----------

export type Adjuster = {
  id: string;
  organization_id: string;
  name: string;
  skills: string[];
  geography: string;
  license_states: string[];
  seniority: "standard" | "senior";
  current_workload: number;
  max_workload: number;
};

export async function listAdjusters(orgId: string): Promise<Adjuster[]> {
  const { rows } = await getPool().query("SELECT * FROM adjusters WHERE organization_id = $1", [
    orgId,
  ]);
  return rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    skills: row.skills,
    geography: row.geography,
    license_states: row.license_states,
    seniority: row.seniority,
    current_workload: row.current_workload,
    max_workload: row.max_workload,
  }));
}

export async function incrementAdjusterWorkload(id: string, delta: number): Promise<void> {
  await getPool().query("UPDATE adjusters SET current_workload = current_workload + $1 WHERE id = $2", [
    delta,
    id,
  ]);
}

// ---------- Claims ----------

export async function listClaims(orgId: string): Promise<Claim[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM claims WHERE organization_id = $1 ORDER BY created_at DESC",
    [orgId]
  );
  return rows.map(mapClaim);
}

export async function getClaim(id: string): Promise<Claim | null> {
  const { rows } = await getPool().query("SELECT * FROM claims WHERE id = $1", [id]);
  return rows[0] ? mapClaim(rows[0]) : null;
}

export async function createClaim(
  input: Omit<Claim, "id" | "created_at" | "fraud_score" | "human_review_required"> & {
    source: string;
  }
): Promise<Claim> {
  const id = "CLM-" + Date.now().toString(36).toUpperCase();
  await getPool().query(
    `INSERT INTO claims
     (id, organization_id, claim_type, policyholder_name, policy_id, loss_date, estimated_loss,
      repair_cost, policy_age_days, previous_claims_count, days_since_policy_start,
      document_anomaly_score, status, assigned_to, geography, severity, sla_hours, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      id,
      input.organization_id,
      input.claim_type,
      input.policyholder_name,
      input.policy_id,
      input.loss_date,
      input.estimated_loss,
      input.repair_cost,
      input.policy_age_days,
      input.previous_claims_count,
      input.days_since_policy_start,
      input.document_anomaly_score,
      input.status,
      input.assigned_to,
      input.geography,
      input.severity,
      input.sla_hours,
      input.source,
    ]
  );
  return (await getClaim(id))!;
}

export async function updateClaimStatus(
  id: string,
  status: ClaimStatus,
  assignedTo?: string | null
): Promise<void> {
  if (assignedTo !== undefined) {
    await getPool().query("UPDATE claims SET status = $1, assigned_to = $2 WHERE id = $3", [
      status,
      assignedTo,
      id,
    ]);
  } else {
    await getPool().query("UPDATE claims SET status = $1 WHERE id = $2", [status, id]);
  }
}

export async function setClaimFraudScore(
  id: string,
  score: number,
  humanReviewRequired: boolean
): Promise<void> {
  await getPool().query(
    "UPDATE claims SET fraud_score = $1, human_review_required = $2 WHERE id = $3",
    [score, humanReviewRequired, id]
  );
}

function mapClaim(row: any): Claim {
  return {
    id: row.id,
    organization_id: row.organization_id,
    claim_type: row.claim_type,
    policyholder_name: row.policyholder_name,
    policy_id: row.policy_id,
    loss_date:
      row.loss_date instanceof Date ? row.loss_date.toISOString().slice(0, 10) : row.loss_date,
    estimated_loss: Number(row.estimated_loss),
    repair_cost: Number(row.repair_cost),
    policy_age_days: row.policy_age_days,
    previous_claims_count: row.previous_claims_count,
    days_since_policy_start: row.days_since_policy_start,
    document_anomaly_score: Number(row.document_anomaly_score),
    status: row.status,
    assigned_to: row.assigned_to,
    geography: row.geography,
    severity: row.severity,
    created_at: row.created_at.toISOString(),
    sla_hours: row.sla_hours,
    fraud_score: row.fraud_score === null ? null : Number(row.fraud_score),
    human_review_required: row.human_review_required,
  };
}

// ---------- Claim events (audit trail) ----------

export type ClaimEventRow = {
  id: string;
  claim_id: string;
  timestamp: string;
  label: string;
  actor: string;
  detail: string | null;
};

export async function addClaimEvent(
  claimId: string,
  label: string,
  actor: string,
  detail?: string
): Promise<void> {
  await getPool().query(
    "INSERT INTO claim_events (id, claim_id, label, actor, detail) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), claimId, label, actor, detail ?? null]
  );
}

export async function listClaimEvents(claimId: string): Promise<ClaimEventRow[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM claim_events WHERE claim_id = $1 ORDER BY timestamp ASC",
    [claimId]
  );
  return rows.map((r) => ({
    id: r.id,
    claim_id: r.claim_id,
    timestamp: r.timestamp.toISOString(),
    label: r.label,
    actor: r.actor,
    detail: r.detail,
  }));
}

// ---------- Policy documents (for retrieval) ----------

export async function addPolicyDocument(
  orgId: string,
  claimId: string | null,
  filename: string,
  fullText: string
): Promise<string> {
  const id = randomUUID();
  await getPool().query(
    "INSERT INTO policy_documents (id, organization_id, claim_id, filename, full_text) VALUES ($1,$2,$3,$4,$5)",
    [id, orgId, claimId, filename, fullText]
  );
  return id;
}

export async function addDocumentChunk(
  documentId: string,
  index: number,
  content: string,
  termFreqs: Record<string, number>
): Promise<void> {
  await getPool().query(
    "INSERT INTO document_chunks (id, document_id, chunk_index, content, term_freqs) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), documentId, index, content, JSON.stringify(termFreqs)]
  );
}

export async function listChunksForOrg(
  orgId: string
): Promise<{ content: string; termFreqs: Record<string, number>; filename: string }[]> {
  const { rows } = await getPool().query(
    `SELECT dc.content, dc.term_freqs, pd.filename
     FROM document_chunks dc
     JOIN policy_documents pd ON pd.id = dc.document_id
     WHERE pd.organization_id = $1`,
    [orgId]
  );
  return rows.map((r) => ({ content: r.content, termFreqs: r.term_freqs, filename: r.filename }));
}

export async function listDocumentsForOrg(
  orgId: string
): Promise<{ id: string; filename: string; uploaded_at: string }[]> {
  const { rows } = await getPool().query(
    "SELECT id, filename, uploaded_at FROM policy_documents WHERE organization_id = $1 ORDER BY uploaded_at DESC",
    [orgId]
  );
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    uploaded_at: r.uploaded_at.toISOString(),
  }));
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}
