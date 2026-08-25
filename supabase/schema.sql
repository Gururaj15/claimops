-- ClaimOps schema for Postgres (Supabase or any hosted Postgres).
-- Every table carries organization_id so one database instance safely
-- serves many insurers/MGAs. Run this whole file once in the Supabase
-- SQL Editor (or via psql against any Postgres instance) before starting
-- the app. Safe to re-run only if you drop the tables first — it does not
-- use IF NOT EXISTS, so re-running against existing tables will error
-- rather than silently doing nothing.

create extension if not exists pgcrypto;

create table organizations (
  id text primary key,
  name text not null,
  line_of_business text not null,
  sla_hours int not null default 48,
  fraud_threshold numeric not null default 0.75,
  high_value_threshold numeric not null default 25000,
  required_documents jsonb not null default '[]',
  brand_color text default '#17726A',
  claims_source text,
  policy_source text,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id text references organizations(id) on delete cascade,
  name text not null,
  role text not null check (role in ('fde', 'adjuster', 'senior_adjuster', 'executive', 'siu')),
  email text,
  created_at timestamptz not null default now()
);

create table adjusters (
  id uuid primary key default gen_random_uuid(),
  organization_id text references organizations(id) on delete cascade,
  name text not null,
  skills jsonb not null default '[]',
  geography text not null,
  license_states jsonb not null default '[]',
  seniority text not null default 'standard',
  current_workload int not null default 0,
  max_workload int not null default 12
);

create table rules (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  name text not null,
  conditions jsonb not null,
  actions jsonb not null,
  priority int not null default 10,
  enabled boolean not null default true
);

create table claims (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  claim_type text not null,
  policyholder_name text not null,
  policy_id text not null,
  loss_date date not null,
  estimated_loss numeric not null,
  repair_cost numeric not null default 0,
  policy_age_days int not null default 0,
  previous_claims_count int not null default 0,
  days_since_policy_start int not null default 0,
  document_anomaly_score numeric not null default 0,
  status text not null default 'new',
  assigned_to text,
  geography text,
  severity text default 'medium',
  sla_hours int not null default 48,
  source text not null default 'web_form',
  fraud_score numeric,
  human_review_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id text references claims(id) on delete cascade,
  timestamp timestamptz not null default now(),
  label text not null,
  actor text not null default 'system',
  detail text
);

create table policy_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id text references organizations(id) on delete cascade,
  claim_id text references claims(id) on delete cascade,
  filename text not null,
  full_text text not null,
  uploaded_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references policy_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  term_freqs jsonb not null
);

create index idx_claims_org on claims(organization_id);
create index idx_rules_org on rules(organization_id);
create index idx_events_claim on claim_events(claim_id);
create index idx_adjusters_org on adjusters(organization_id);
create index idx_chunks_doc on document_chunks(document_id);
