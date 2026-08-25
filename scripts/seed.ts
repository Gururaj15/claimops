/**
 * Populates the real SQLite database with starting data: organizations,
 * rules, an adjuster roster, sample policy documents (chunked and indexed
 * for retrieval, same code path a real upload uses), and a handful of demo
 * claims run through the REAL intake pipeline (fraud model, rules engine,
 * coverage assistant, smart assignment) so the audit trail on each one is
 * genuine, not hand-written.
 *
 * Run with: npm run db:seed
 * Safe to re-run: it clears and re-seeds rather than duplicating rows.
 */
import { getDb } from "../src/lib/db/client";
import { ORGANIZATIONS, RULES } from "../src/lib/seed-data";
import { addDocumentChunk, addPolicyDocument, createClaim } from "../src/lib/repo";
import { chunkText, termFrequencies } from "../src/lib/retrieval";
import { runIntakePipeline } from "../src/lib/pipeline";
import { randomUUID } from "crypto";

const db = getDb();

console.log("Clearing existing data...");
db.exec(`
  DELETE FROM claim_events;
  DELETE FROM document_chunks;
  DELETE FROM policy_documents;
  DELETE FROM claims;
  DELETE FROM adjusters;
  DELETE FROM rules;
  DELETE FROM users;
  DELETE FROM organizations;
`);

console.log("Seeding organizations...");
const insertOrg = db.prepare(`
  INSERT INTO organizations
    (id, name, line_of_business, sla_hours, fraud_threshold, high_value_threshold, required_documents, brand_color, claims_source, policy_source)
  VALUES (@id, @name, @line_of_business, @sla_hours, @fraud_threshold, @high_value_threshold, @required_documents, @brand_color, @claims_source, @policy_source)
`);
for (const org of ORGANIZATIONS) {
  insertOrg.run({ ...org, required_documents: JSON.stringify(org.required_documents) });
}

console.log("Seeding rules...");
const insertRule = db.prepare(`
  INSERT INTO rules (id, organization_id, name, conditions, actions, priority, enabled)
  VALUES (@id, @organization_id, @name, @conditions, @actions, @priority, @enabled)
`);
for (const rule of RULES) {
  insertRule.run({
    ...rule,
    conditions: JSON.stringify(rule.conditions),
    actions: JSON.stringify(rule.actions),
    enabled: rule.enabled ? 1 : 0,
  });
}

console.log("Seeding users...");
const insertUser = db.prepare(`INSERT INTO users (id, organization_id, name, role, email) VALUES (?,?,?,?,?)`);
insertUser.run(randomUUID(), "org_acme", "Jamie Alvarez", "senior_adjuster", "jamie@acme.example");
insertUser.run(randomUUID(), "org_acme", "Rae Kim", "adjuster", "rae@acme.example");
insertUser.run(randomUUID(), "org_acme", "Priya Shah", "fde", "priya@acme.example");
insertUser.run(randomUUID(), "org_acme", "Dana Cho", "executive", "dana@acme.example");
insertUser.run(randomUUID(), "org_voyage", "Tunde Osei", "adjuster", "tunde@voyage.example");
insertUser.run(randomUUID(), "org_voyage", "Sam Ruiz", "executive", "sam@voyage.example");

console.log("Seeding adjuster roster...");
const insertAdjuster = db.prepare(`
  INSERT INTO adjusters (id, organization_id, name, skills, geography, license_states, seniority, current_workload, max_workload)
  VALUES (?,?,?,?,?,?,?,?,?)
`);
const adjusters = [
  { org: "org_acme", name: "J. Alvarez", skills: ["property", "liability"], geo: "Texas", lic: ["Texas", "Oklahoma"], sr: "senior", wl: 6, max: 12 },
  { org: "org_acme", name: "R. Kim", skills: ["property"], geo: "Oklahoma", lic: ["Oklahoma", "Texas"], sr: "standard", wl: 4, max: 10 },
  { org: "org_acme", name: "M. Dubois", skills: ["liability"], geo: "Ohio", lic: ["Ohio"], sr: "standard", wl: 9, max: 10 },
  { org: "org_acme", name: "SIU Team", skills: ["property", "liability"], geo: "Texas", lic: ["Texas", "Ohio", "Oklahoma"], sr: "senior", wl: 3, max: 20 },
  { org: "org_voyage", name: "T. Osei", skills: ["travel"], geo: "New York", lic: ["New York", "Florida"], sr: "senior", wl: 5, max: 12 },
  { org: "org_voyage", name: "L. Fernandez", skills: ["travel"], geo: "Florida", lic: ["Florida", "California"], sr: "standard", wl: 3, max: 10 },
  { org: "org_voyage", name: "SIU Team", skills: ["travel"], geo: "New York", lic: ["New York", "Florida", "California"], sr: "senior", wl: 2, max: 20 },
];
for (const a of adjusters) {
  insertAdjuster.run(
    randomUUID(), a.org, a.name, JSON.stringify(a.skills), a.geo, JSON.stringify(a.lic), a.sr, a.wl, a.max
  );
}

console.log("Seeding a sample policy document for Acme (real chunking + indexing)...");
const acmePolicyText = `
Acme Insurance Commercial Property Policy — Form CP-2200

Section 1.1 General Coverage Grant. This policy provides coverage for direct
physical loss or damage to covered property caused by a covered peril,
subject to the limits, deductibles, and exclusions stated herein.

Section 3.1 Fire and Lightning. Loss caused by fire or lightning is covered
up to the policy limit, including resulting smoke damage to contents under
Section 7.3. Section 3.4 Intentional Acts Exclusion applies if investigation
determines the fire was deliberately caused by an insured party.

Section 4.2 Sudden and Accidental Water Discharge. Loss caused by the sudden
and accidental discharge of water from a plumbing, heating, or air
conditioning system is covered. Section 4.5 Gradual Leakage or Seepage
Exclusion applies when the discharge occurred gradually over a period of
weeks or months rather than suddenly.

Section 5.2 Theft of Property. Theft of covered property is covered subject
to Section 5.6 Proof of Forced Entry Requirement — a police report or
physical evidence of forced entry is required for claims exceeding $5,000.
Section 5.7 Unattended Vehicle Exclusion applies to property stolen from an
unlocked or unattended vehicle.

Section 7.1 Interior Property Damage. Damage to the interior of a covered
structure, including flooring, drywall, and fixtures, is covered when
caused by a covered peril under Section 3 or Section 4.

Section 8.1 General Liability Coverage. This policy provides liability
coverage for third-party bodily injury and property damage arising from
the insured's business operations, subject to Section 8.9 Professional
Services Exclusion, which excludes claims arising from the rendering of or
failure to render professional services.
`;
const acmeDocId = addPolicyDocument("org_acme", null, "acme-commercial-property-CP-2200.txt", acmePolicyText);
chunkText(acmePolicyText).forEach((chunk, i) => addDocumentChunk(acmeDocId, i, chunk, termFrequencies(chunk)));

console.log("Creating demo claims and running them through the real pipeline...");

type SeedClaim = {
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
  geography: string;
  severity: "low" | "medium" | "high";
  backdateHours: number; // how many hours ago this claim was created, for a realistic SLA table
};

const demoClaims: SeedClaim[] = [
  { organization_id: "org_acme", claim_type: "water_damage", policyholder_name: "Nadia Ferreira", policy_id: "POL-8821", loss_date: "2026-08-10", estimated_loss: 18500, repair_cost: 17200, policy_age_days: 812, previous_claims_count: 0, days_since_policy_start: 812, document_anomaly_score: 0.12, geography: "Texas", severity: "medium", backdateHours: 31 },
  { organization_id: "org_acme", claim_type: "fire", policyholder_name: "Marcus Webb", policy_id: "POL-4410", loss_date: "2026-08-18", estimated_loss: 87000, repair_cost: 81000, policy_age_days: 1490, previous_claims_count: 1, days_since_policy_start: 1490, document_anomaly_score: 0.22, geography: "Texas", severity: "high", backdateHours: 6 },
  { organization_id: "org_acme", claim_type: "theft", policyholder_name: "Priya Nair", policy_id: "POL-2290", loss_date: "2026-08-15", estimated_loss: 9200, repair_cost: 9200, policy_age_days: 40, previous_claims_count: 3, days_since_policy_start: 40, document_anomaly_score: 0.71, geography: "Ohio", severity: "medium", backdateHours: 60 },
  { organization_id: "org_acme", claim_type: "wind_hail", policyholder_name: "Devon Cole", policy_id: "POL-7712", loss_date: "2026-08-05", estimated_loss: 21000, repair_cost: 19800, policy_age_days: 260, previous_claims_count: 0, days_since_policy_start: 260, document_anomaly_score: 0.18, geography: "Oklahoma", severity: "medium", backdateHours: 20 },
  { organization_id: "org_acme", claim_type: "liability", policyholder_name: "Chen Logistics LLC", policy_id: "POL-9931", loss_date: "2026-08-19", estimated_loss: 61000, repair_cost: 0, policy_age_days: 950, previous_claims_count: 0, days_since_policy_start: 950, document_anomaly_score: 0.09, geography: "Texas", severity: "high", backdateHours: 3 },
  { organization_id: "org_voyage", claim_type: "trip_cancellation", policyholder_name: "Elena Sokolova", policy_id: "VPL-3301", loss_date: "2026-08-12", estimated_loss: 2900, repair_cost: 0, policy_age_days: 90, previous_claims_count: 0, days_since_policy_start: 90, document_anomaly_score: 0.08, geography: "New York", severity: "low", backdateHours: 10 },
  { organization_id: "org_voyage", claim_type: "lost_baggage", policyholder_name: "Omar Haddad", policy_id: "VPL-5540", loss_date: "2026-08-20", estimated_loss: 1650, repair_cost: 0, policy_age_days: 8, previous_claims_count: 1, days_since_policy_start: 8, document_anomaly_score: 0.44, geography: "Florida", severity: "low", backdateHours: 28 },
  { organization_id: "org_voyage", claim_type: "bodily_injury", policyholder_name: "Grace Adeyemi", policy_id: "VPL-1187", loss_date: "2026-08-17", estimated_loss: 13400, repair_cost: 0, policy_age_days: 210, previous_claims_count: 0, days_since_policy_start: 210, document_anomaly_score: 0.15, geography: "California", severity: "high", backdateHours: 15 },
];

for (const dc of demoClaims) {
  const { backdateHours, ...rest } = dc;
  const org = ORGANIZATIONS.find((o) => o.id === dc.organization_id)!;
  const claim = createClaim({
    ...rest,
    status: "new",
    assigned_to: null,
    sla_hours: org.sla_hours,
    source: "seed",
  });

  // Run the real pipeline (fraud model, coverage assistant, rules engine, assignment)
  runIntakePipeline(claim);

  // Backdate created_at + every event for this claim by the same offset, so
  // the SLA table on the executive dashboard shows a realistic mix of
  // on-track/at-risk/breached claims computed from real elapsed time —
  // while preserving the real spacing between pipeline steps.
  const shiftMs = backdateHours * 3600 * 1000;
  const backdatedCreatedAt = new Date(Date.now() - shiftMs).toISOString();
  db.prepare("UPDATE claims SET created_at = ? WHERE id = ?").run(backdatedCreatedAt, claim.id);

  const events = db.prepare("SELECT id, timestamp FROM claim_events WHERE claim_id = ?").all(claim.id) as {
    id: string;
    timestamp: string;
  }[];
  const shiftStmt = db.prepare("UPDATE claim_events SET timestamp = ? WHERE id = ?");
  for (const ev of events) {
    const shifted = new Date(new Date(ev.timestamp.replace(" ", "T") + "Z").getTime() - shiftMs).toISOString();
    shiftStmt.run(shifted, ev.id);
  }
}

console.log("Done. Database at data/claimops.db is ready.");
console.log(`Organizations: ${ORGANIZATIONS.length}, Rules: ${RULES.length}, Adjusters: ${adjusters.length}, Claims: ${demoClaims.length}`);
