-- ClaimOps multi-tenant schema
-- Every table carries organization_id so a single Postgres instance safely
-- serves many insurers/MGAs. In production, add Row Level Security policies
-- keyed on organization_id + the authenticated user's org claim; omitted
-- here to keep the free-tier demo simple (see /docs/07-architecture-decisions.md).

create table organizations (
  id text primary key,
  name text not null,
  line_of_business text not null,
  sla_hours int not null default 48,
  fraud_threshold numeric not null default 0.75,
  high_value_threshold numeric not null default 25000,
  required_documents text[] not null default '{}',
  brand_color text default '#17726A',
  claims_source text,
  policy_source text,
  created_at timestamptz not null default now()
);

create table schema_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id text references organizations(id) on delete cascade,
  source_field text not null,
  target_field text not null,
  confidence numeric not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table rules (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  name text not null,
  conditions jsonb not null,
  actions text[] not null,
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
  created_at timestamptz not null default now()
);

create table claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id text references claims(id) on delete cascade,
  timestamp timestamptz not null default now(),
  label text not null,
  actor text not null default 'system'
);

create index idx_claims_org on claims(organization_id);
create index idx_rules_org on rules(organization_id);
create index idx_events_claim on claim_events(claim_id);
