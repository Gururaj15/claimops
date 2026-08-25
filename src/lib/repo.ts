import { randomUUID } from "crypto";
import { getDb } from "./db/client";
import type { Claim, ClaimStatus, Organization, Rule } from "./types";

// ---------- Organizations ----------

export function listOrganizations(): Organization[] {
  const rows = getDb().prepare("SELECT * FROM organizations ORDER BY created_at").all() as any[];
  return rows.map(mapOrg);
}

export function getOrganization(id: string): Organization | null {
  const row = getDb().prepare("SELECT * FROM organizations WHERE id = ?").get(id) as any;
  return row ? mapOrg(row) : null;
}

export function createOrganization(input: {
  name: string;
  line_of_business: string;
  sla_hours: number;
  fraud_threshold: number;
  high_value_threshold: number;
  required_documents: string[];
  claims_source: string;
  policy_source: string;
}): Organization {
  const id = "org_" + slug(input.name) + "_" + randomUUID().slice(0, 6);
  getDb()
    .prepare(
      `INSERT INTO organizations
        (id, name, line_of_business, sla_hours, fraud_threshold, high_value_threshold, required_documents, claims_source, policy_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.line_of_business,
      input.sla_hours,
      input.fraud_threshold,
      input.high_value_threshold,
      JSON.stringify(input.required_documents),
      input.claims_source,
      input.policy_source
    );
  return getOrganization(id)!;
}

function mapOrg(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    line_of_business: row.line_of_business,
    sla_hours: row.sla_hours,
    fraud_threshold: row.fraud_threshold,
    high_value_threshold: row.high_value_threshold,
    required_documents: JSON.parse(row.required_documents),
    brand_color: row.brand_color,
    claims_source: row.claims_source,
    policy_source: row.policy_source,
  };
}

// ---------- Rules ----------

export function listRules(orgId: string): Rule[] {
  const rows = getDb()
    .prepare("SELECT * FROM rules WHERE organization_id = ? ORDER BY priority")
    .all(orgId) as any[];
  return rows.map(mapRule);
}

export function createRule(input: {
  organization_id: string;
  name: string;
  conditions: Rule["conditions"];
  actions: string[];
  priority: number;
}): Rule {
  const id = "rule_" + randomUUID().slice(0, 8);
  getDb()
    .prepare(
      `INSERT INTO rules (id, organization_id, name, conditions, actions, priority, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      id,
      input.organization_id,
      input.name,
      JSON.stringify(input.conditions),
      JSON.stringify(input.actions),
      input.priority
    );
  return mapRule(getDb().prepare("SELECT * FROM rules WHERE id = ?").get(id));
}

export function updateRule(id: string, patch: Partial<{ enabled: boolean; priority: number }>): void {
  if (patch.enabled !== undefined) {
    getDb().prepare("UPDATE rules SET enabled = ? WHERE id = ?").run(patch.enabled ? 1 : 0, id);
  }
  if (patch.priority !== undefined) {
    getDb().prepare("UPDATE rules SET priority = ? WHERE id = ?").run(patch.priority, id);
  }
}

export function deleteRule(id: string): void {
  getDb().prepare("DELETE FROM rules WHERE id = ?").run(id);
}

function mapRule(row: any): Rule {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    conditions: JSON.parse(row.conditions),
    actions: JSON.parse(row.actions),
    priority: row.priority,
    enabled: !!row.enabled,
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

export function listAdjusters(orgId: string): Adjuster[] {
  const rows = getDb()
    .prepare("SELECT * FROM adjusters WHERE organization_id = ?")
    .all(orgId) as any[];
  return rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    skills: JSON.parse(row.skills),
    geography: row.geography,
    license_states: JSON.parse(row.license_states),
    seniority: row.seniority,
    current_workload: row.current_workload,
    max_workload: row.max_workload,
  }));
}

export function incrementAdjusterWorkload(id: string, delta: number): void {
  getDb()
    .prepare("UPDATE adjusters SET current_workload = current_workload + ? WHERE id = ?")
    .run(delta, id);
}

// ---------- Claims ----------

export function listClaims(orgId: string): Claim[] {
  const rows = getDb()
    .prepare("SELECT * FROM claims WHERE organization_id = ? ORDER BY created_at DESC")
    .all(orgId) as any[];
  return rows.map(mapClaim);
}

export function getClaim(id: string): Claim | null {
  const row = getDb().prepare("SELECT * FROM claims WHERE id = ?").get(id) as any;
  return row ? mapClaim(row) : null;
}

export function createClaim(
  input: Omit<Claim, "id" | "created_at" | "fraud_score" | "human_review_required"> & { source: string }
): Claim {
  const id = "CLM-" + Date.now().toString(36).toUpperCase();
  getDb()
    .prepare(
      `INSERT INTO claims
       (id, organization_id, claim_type, policyholder_name, policy_id, loss_date, estimated_loss,
        repair_cost, policy_age_days, previous_claims_count, days_since_policy_start,
        document_anomaly_score, status, assigned_to, geography, severity, sla_hours, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
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
      input.source
    );
  return getClaim(id)!;
}

export function updateClaimStatus(id: string, status: ClaimStatus, assignedTo?: string | null): void {
  if (assignedTo !== undefined) {
    getDb().prepare("UPDATE claims SET status = ?, assigned_to = ? WHERE id = ?").run(status, assignedTo, id);
  } else {
    getDb().prepare("UPDATE claims SET status = ? WHERE id = ?").run(status, id);
  }
}

export function setClaimFraudScore(id: string, score: number, humanReviewRequired: boolean): void {
  getDb()
    .prepare("UPDATE claims SET fraud_score = ?, human_review_required = ? WHERE id = ?")
    .run(score, humanReviewRequired ? 1 : 0, id);
}

function mapClaim(row: any): Claim {
  return {
    id: row.id,
    organization_id: row.organization_id,
    claim_type: row.claim_type,
    policyholder_name: row.policyholder_name,
    policy_id: row.policy_id,
    loss_date: row.loss_date,
    estimated_loss: row.estimated_loss,
    repair_cost: row.repair_cost,
    policy_age_days: row.policy_age_days,
    previous_claims_count: row.previous_claims_count,
    days_since_policy_start: row.days_since_policy_start,
    document_anomaly_score: row.document_anomaly_score,
    status: row.status,
    assigned_to: row.assigned_to,
    geography: row.geography,
    severity: row.severity,
    created_at: row.created_at,
    sla_hours: row.sla_hours,
    fraud_score: row.fraud_score ?? null,
    human_review_required: !!row.human_review_required,
  };
}

// ---------- Claim events (real audit trail) ----------

export type ClaimEventRow = {
  id: string;
  claim_id: string;
  timestamp: string;
  label: string;
  actor: string;
  detail: string | null;
};

export function addClaimEvent(claimId: string, label: string, actor: string, detail?: string): void {
  getDb()
    .prepare("INSERT INTO claim_events (id, claim_id, label, actor, detail) VALUES (?,?,?,?,?)")
    .run(randomUUID(), claimId, label, actor, detail ?? null);
}

export function listClaimEvents(claimId: string): ClaimEventRow[] {
  return getDb()
    .prepare("SELECT * FROM claim_events WHERE claim_id = ? ORDER BY timestamp ASC")
    .all(claimId) as ClaimEventRow[];
}

// ---------- Policy documents (for retrieval) ----------

export function addPolicyDocument(orgId: string, claimId: string | null, filename: string, fullText: string): string {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO policy_documents (id, organization_id, claim_id, filename, full_text) VALUES (?,?,?,?,?)"
    )
    .run(id, orgId, claimId, filename, fullText);
  return id;
}

export function addDocumentChunk(documentId: string, index: number, content: string, termFreqs: Record<string, number>): void {
  getDb()
    .prepare(
      "INSERT INTO document_chunks (id, document_id, chunk_index, content, term_freqs) VALUES (?,?,?,?,?)"
    )
    .run(randomUUID(), documentId, index, content, JSON.stringify(termFreqs));
}

export function listChunksForOrg(orgId: string): { content: string; termFreqs: Record<string, number>; filename: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT dc.content, dc.term_freqs, pd.filename
       FROM document_chunks dc
       JOIN policy_documents pd ON pd.id = dc.document_id
       WHERE pd.organization_id = ?`
    )
    .all(orgId) as any[];
  return rows.map((r) => ({ content: r.content, termFreqs: JSON.parse(r.term_freqs), filename: r.filename }));
}

export function listDocumentsForOrg(orgId: string): { id: string; filename: string; uploaded_at: string }[] {
  return getDb()
    .prepare("SELECT id, filename, uploaded_at FROM policy_documents WHERE organization_id = ? ORDER BY uploaded_at DESC")
    .all(orgId) as any[];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
}
