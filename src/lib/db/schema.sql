-- SQLite schema for local development (Node's built-in node:sqlite module —
-- no native compilation needed on any platform). Mirrors supabase/schema.sql
-- conceptually but in SQLite dialect. This is what actually runs when you do
-- `npm run dev` — real persistence, real file on disk at data/claimops.db,
-- no cloud account needed.
--
-- IMPORTANT — read before deploying: this file-based DB works for local
-- dev and for a normal long-running Node server (e.g. a VPS, Railway,
-- Render). It will NOT persist reliably on Vercel, because Vercel's
-- serverless functions get an ephemeral filesystem — writes can vanish
-- between requests. To deploy with real persistence on Vercel, run this
-- same schema (translated — see supabase/schema.sql) against a real
-- Postgres instance (Supabase free tier) and swap src/lib/repo.ts's
-- driver. The repository functions are the same either way; only
-- src/lib/db/client.ts changes.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  line_of_business TEXT NOT NULL,
  sla_hours INTEGER NOT NULL DEFAULT 48,
  fraud_threshold REAL NOT NULL DEFAULT 0.75,
  high_value_threshold REAL NOT NULL DEFAULT 25000,
  required_documents TEXT NOT NULL DEFAULT '[]', -- JSON array
  brand_color TEXT DEFAULT '#17726A',
  claims_source TEXT,
  policy_source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('fde', 'adjuster', 'senior_adjuster', 'executive', 'siu')),
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS adjusters (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '[]',      -- JSON array, e.g. ["property","liability"]
  geography TEXT NOT NULL,
  license_states TEXT NOT NULL DEFAULT '[]', -- JSON array
  seniority TEXT NOT NULL DEFAULT 'standard', -- standard | senior
  current_workload INTEGER NOT NULL DEFAULT 0,
  max_workload INTEGER NOT NULL DEFAULT 12
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL, -- JSON array of {field, operator, value}
  actions TEXT NOT NULL,    -- JSON array of strings
  priority INTEGER NOT NULL DEFAULT 10,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  claim_type TEXT NOT NULL,
  policyholder_name TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  loss_date TEXT NOT NULL,
  estimated_loss REAL NOT NULL,
  repair_cost REAL NOT NULL DEFAULT 0,
  policy_age_days INTEGER NOT NULL DEFAULT 0,
  previous_claims_count INTEGER NOT NULL DEFAULT 0,
  days_since_policy_start INTEGER NOT NULL DEFAULT 0,
  document_anomaly_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  geography TEXT,
  severity TEXT DEFAULT 'medium',
  sla_hours INTEGER NOT NULL DEFAULT 48,
  source TEXT NOT NULL DEFAULT 'web_form', -- web_form | api | csv | webhook
  fraud_score REAL,
  human_review_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS claim_events (
  id TEXT PRIMARY KEY,
  claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  label TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail TEXT
);

CREATE TABLE IF NOT EXISTS policy_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  full_text TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES policy_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  term_freqs TEXT NOT NULL -- JSON object: term -> count, precomputed for retrieval
);

CREATE INDEX IF NOT EXISTS idx_claims_org ON claims(organization_id);
CREATE INDEX IF NOT EXISTS idx_rules_org ON rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_claim ON claim_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_adjusters_org ON adjusters(organization_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
