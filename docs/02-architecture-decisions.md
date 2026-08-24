# Architecture decisions

Honest notes on what's real, what's simplified, and why — written for
whoever reviews this repo as part of a job application. Overclaiming here
would defeat the point.

## What's real

- **Fraud model**: a logistic regression trained with scikit-learn on 4,000
  synthetic claims (`scripts/train_fraud_model.py`). The trained
  coefficients are exported to JSON and used directly in
  `src/lib/fraud-model.ts`. Because the model is linear, each feature's
  contribution to the final score has a closed form equal to its SHAP value
  under a linear explainer — that's what's displayed as "why" on every
  claim, not an invented number.
- **Rules engine**: genuinely data-driven. Rules are JSON objects with
  conditions and actions (`src/lib/seed-data.ts`), evaluated generically by
  `src/lib/rules-engine.ts`. Adding a rule for a new tenant doesn't touch
  the evaluation code.
- **Multi-tenancy**: every claim, rule, and org record carries an
  `organization_id`. Two tenants (Acme Insurance, Voyage Travel Insurance)
  run on the identical codebase with different SLA hours, fraud thresholds,
  and rule sets.

## What's simplified, and why

- **Coverage assistant is not a live LLM call.** A real version would run
  retrieval over a tenant's uploaded policy PDFs and pass matched clauses to
  a model. Standing that up needs a paid LLM API key, which conflicts with
  building this for $0. `src/lib/coverage-assistant.ts` encodes the same
  clause-matching logic against a small library of realistic sample
  clauses. The calling code doesn't know the difference — swapping the
  function body for a real retrieval+generation call is the only change
  needed later.
- **Persistence is optional, not required.** The app runs entirely on
  in-memory seed data by default so it works with zero setup. Setting two
  Supabase env vars (see `.env.example`) is meant to enable real writes
  against `supabase/schema.sql`, but the claim-detail page's approve/reject
  actions currently only update local component state — see the note in
  that file. The schema and client wiring are real; full CRUD wiring is the
  most honest thing to call out as "next, not done."
- **Smart assignment isn't a trained model.** It's the rules engine routing
  on severity/value/fraud score, which is what most competitor platforms
  actually describe publicly too (rule-based routing on skill, geography,
  workload) rather than a black-box ranking model.
- **No auth.** Persona switching is a nav link, not a login. A real
  deployment needs per-tenant auth and row-level security in Postgres
  (the schema is shaped for RLS, it's just not turned on).

## Why Next.js + Postgres instead of the originally-sketched GCP/Terraform stack

The full production sketch (Cloud Run, Cloud SQL, Pub/Sub, a separate Python
ML microservice) is a reasonable target architecture and is documented in
`/infra` as such, but running it live would cost money and multiple days of
setup neither of which this project had. Vercel + Supabase free tiers get a
live, shareable URL with genuine multi-tenant Postgres behind it at $0. The
`/infra` Terraform is written to show the target design, not applied against
a real cloud account.
