# ClaimOps

A multi-tenant claims operations platform. It onboards a new insurance program, takes claims in through four different intake channels, runs each one through a fraud model and a rules engine, retrieves relevant policy language for a coverage assessment, routes it to the right adjuster, and reports on all of it — while keeping a human in the loop for every decision.

Built as a portfolio project for Forward Deployed Engineer roles at claims-tech companies.

![ClaimOps homepage](docs/screenshots/homepage.png)

## Architecture

![ClaimOps architecture diagram](docs/screenshots/architecture-diagram.svg)

The browser talks to a Next.js API layer. Every intake channel — a web form, a direct JSON API call, a CSV batch, or a webhook — normalizes into the same canonical claim schema and runs through the same four-stage pipeline: the fraud model scores it, the coverage engine retrieves relevant policy clauses, the rules engine checks tenant-specific conditions, and the assignment engine routes it to an adjuster. Every stage writes its own timestamped event, so each claim ends up with a complete audit trail of what the system did and when.

## What's in it

**Fraud detection.** An XGBoost classifier (60 trees, depth 3) trained on synthetic claims data with a deliberately nonlinear interaction between "new policy" and "document anomaly score" — a pattern a simpler linear model can't pick up. Training accuracy is 77.4%, test accuracy 76.3% on held-out data, which is reasonable for a first-pass model on synthetic data with only six features — real fraud models in production typically use dozens of features and years of labeled claims history. Each score comes with a feature-by-feature breakdown (Saabas-style tree attribution, a real published technique closely related to SHAP) so an adjuster can see *why* a claim scored the way it did, not just the number.

**Coverage assistant.** Upload a policy PDF and it's parsed, split into overlapping text chunks, and indexed with TF-IDF. When a claim comes in, its details are used as a search query against that index, and the most relevant clauses are surfaced with a similarity score. This is genuine information retrieval — it finds the passages that actually match, not a lookup table keyed by claim type. What it doesn't do yet is turn those passages into fluent explanatory prose; that step would need a hosted LLM API, which this project intentionally avoids to keep running costs at zero (see Future work below).

**Rules engine.** Rules are rows in a database table — a name, a set of conditions (field, operator, value), and a list of actions — evaluated generically against every claim. A tenant admin can create, disable, or delete rules from the UI without anyone touching code.

**Smart assignment.** A weighted scoring algorithm ranks each tenant's adjuster roster against a new claim on skill match, geographic/license fit, seniority versus claim complexity, and current workload, and assigns the best fit. High-value or high-fraud-score claims route to a senior adjuster automatically; anything flagged for fraud goes to a separate SIU (Special Investigation Unit) queue instead of the general pool.

**Four intake channels.** A web form for manual entry, a JSON API endpoint for system-to-system integration, a CSV batch endpoint for bulk imports, and a public webhook endpoint (the kind you'd point an external system or an email-to-webhook bridge like SendGrid Inbound Parse at). All four call the same underlying intake function, so there's exactly one place that defines what a valid claim looks like.

**Onboarding.** A step-by-step wizard for standing up a new tenant: program details, data source configuration, a schema-mapping step that matches a new insurer's field names to the canonical schema, and a final step that actually creates the organization in the database. A brand-new tenant shows up immediately in every other part of the app.

**Multi-tenancy.** Every table — organizations, rules, claims, adjusters, documents — is scoped by organization ID. Two tenants ship pre-seeded (a commercial property insurer and a travel insurer), each with its own SLA target, fraud threshold, and rule set, proving the isolation works rather than just asserting it.

**Executive dashboard.** Open claims, closed claims, average cycle time, SLA compliance, a leakage proxy (estimated loss versus expected loss by claim type), and fraud flag counts — computed from the database at request time, not cached or mocked.

**Human review queue.** A dedicated view listing every claim that got flagged for fraud review or routed to SIU, separate from the general adjuster queue.

## Model details

| | |
|---|---|
| Algorithm | XGBoost (gradient-boosted decision trees) |
| Trees | 60, max depth 3 |
| Training data | 4,800 synthetic claims |
| Test data | 1,200 synthetic claims (held out) |
| Train accuracy | 77.4% |
| Test accuracy | 76.3% |
| Features | claim-to-expected-loss ratio, policy age, prior claims count, days since policy start, document anomaly score, repair-cost ratio |
| Explainability | Saabas-style per-feature tree attribution |

The model is trained offline in Python (`scripts/train_xgb_fraud_model.py`) and exported as JSON trees, then scored at request time with a small TypeScript tree-walker rather than a live Python process — this was checked against Python's own predictions on held-out data and matches to 8 decimal places, so it's not an approximation of the trained model, it's the same model running in a different language.

The accuracy numbers are honest but modest, and that's expected: this is a synthetic dataset with a hand-designed fraud rule generating the labels, not real claims history. The point of training a real model here was to demonstrate the pipeline — data in, model out, explainable score, wired into a decision engine — not to claim production-grade fraud detection. A real deployment would need real labeled claims, many more features, and ongoing retraining.

## What's not real yet

- **Coverage narrative generation.** Retrieval works; turning retrieved clauses into an explanatory paragraph is templated rather than generated by an LLM (no API key, to keep this at $0 to run).
- **Authentication.** Tenant and persona switching is a dropdown in the nav, not a login. A `users` table with roles exists but nothing enforces those roles.
- **Cloud deployment.** `/infra` documents a target GCP architecture (Cloud Run, Cloud SQL, Pub/Sub) but it was never deployed against a real cloud account — that needs an actual billing decision.
- **Exact SHAP values.** What's shown is the Saabas method, a real and simpler tree-attribution technique, not the full TreeSHAP algorithm.

Full detail on every one of these, plus the bugs that were found and fixed while building this, is in `docs/02-architecture-decisions.md`.

## Future work

Roughly in priority order if this were to keep going:

1. **Authentication and role enforcement** — real login, and actually gating actions by the `users.role` field that already exists in the schema.
2. **LLM-generated coverage narratives** — swap the templated coverage explanation for a real generation step once retrieval has passed a human review (the retrieval step is the expensive, hard part and is already done).
3. ~~Migrate to Postgres for production~~ — **done.** The app now runs on Postgres (Supabase or any host) everywhere, including local development, rather than SQLite. `supabase/schema.sql` is the single source of truth for the database structure.
4. **Real historical data + model retraining pipeline** — replace the synthetic training set with actual labeled claims and add a retraining job, rather than a one-time offline training script.
5. **Deploy the GCP target architecture** — take `/infra`'s Terraform from illustrative to applied, once there's a real cloud budget.
6. **A drag-and-drop rules builder** — the current rules UI is a form; a visual IF/AND/THEN builder would match the original product vision more closely.
7. **Per-competitor research docs** — split `docs/01-market-research.md` into individual deep-dives per competitor instead of one combined summary.

## Requirements

- Node.js 22 or newer
- A Postgres database (Supabase's free tier works well — see `.env.example`)

## Running it

Create `.env.local` with your database connection string:
```
DATABASE_URL=postgresql://postgres:your-password@your-host.supabase.co:5432/postgres
```

Run `supabase/schema.sql` once against that database — paste it into Supabase's SQL Editor and run it, or:
```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

Then:
```bash
npm install
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. No environment variables or cloud accounts required.

To retrain the fraud model from scratch:
```bash
pip install xgboost shap numpy
python3 scripts/train_xgb_fraud_model.py
```

## Pages

| Persona | Route | What it does |
|---|---|---|
| Implementation engineer | `/onboarding` | Creates a new tenant |
| Claims adjuster | `/adjuster`, `/adjuster/new`, `/adjuster/review` | Claims queue, FNOL submission form, human review queue |
| Rules admin | `/rules` | Create/enable/disable/delete rules |
| Documents | `/documents` | Upload and index policy PDFs |
| Executive | `/executive` | Aggregate KPIs and SLA tracking |

## Stack

Next.js 16 (TypeScript, App Router), Tailwind, Recharts. Postgres (via `pg`) for persistence — this project used SQLite earlier in development (first `better-sqlite3`, then Node's built-in `node:sqlite` after `better-sqlite3` failed to install on Windows), but moved to Postgres everywhere once real, always-on persistence was needed rather than something that only worked on one machine's local disk. `pdf-parse` for PDF text extraction. XGBoost / scikit-learn / shap (Python) for offline model training.

## Docs

- `docs/01-market-research.md` — research on ClaimSorted, Snapsheet, and Five Sigma that shaped the design
- `docs/02-architecture-decisions.md` — full detail on what's built, what's a stand-in, and the bugs found and fixed along the way
- `docs/DEPLOY.md` — deployment notes
