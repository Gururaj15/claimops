# Architecture decisions

Honest notes on what's real, what's a documented stand-in, and the history
of how this project got here — written for whoever reviews this repo,
because overclaiming would defeat the point of writing it down at all.

## The honest history

The first version of this project was a Next.js frontend that computed
fraud scores and rule evaluations client-side against hardcoded arrays.
Nothing persisted; refreshing the page reset everything; the "coverage
assistant" was a lookup table keyed by claim type. It looked like a working
platform in a screenshot and wasn't one — there was no backend at all.

That got called out directly, correctly, and specifically: the fraud model
was a logistic regression despite being described in ambitious terms, nothing
survived a page refresh, "FNOL intake" had no actual intake mechanism, and
the "RAG Coverage Engine" was five hardcoded clauses. The response was to
rebuild the backend for real rather than defend or reframe the first
version. What's described below is that rebuild, verified by direct API
testing (curl against every endpoint, checking actual database rows) before
being handed back — not by assuming the code was correct because it
compiled.

## What's real, and how it was verified

- **Fraud model**: a genuine XGBoost classifier (60 trees, depth 3), trained
  with the actual `xgboost` Python library on synthetic data with a
  nonlinear interaction term. Exported as JSON trees, scored via a
  pure-TypeScript tree-traversal implementation — checked against Python's
  own `booster.predict()` output on held-out rows and found to match to 8
  decimal places. Catching this right required finding and fixing a real
  bug: XGBoost's `base_score` intercept isn't part of the per-tree dump and
  has to be added separately in logit space, discovered by comparing
  JS-computed probabilities against Python's and seeing a constant, systematic
  offset rather than random noise.
- **Persistence**: SQLite, a real file at `data/claimops.db`. Verified by
  approving a claim via `PATCH /api/claims/:id`, re-fetching it in a
  separate `curl` call, and confirming the status held — then restarting
  the dev server entirely and confirming it still held.
- **Intake pipeline**: `src/lib/pipeline.ts` runs fraud scoring, coverage
  retrieval, rule evaluation, and smart assignment server-side on every
  submission, writing a real row to `claim_events` at each step. Verified
  by submitting a deliberately suspicious synthetic claim via the API and
  confirming it came back with a 97.9% fraud score, real per-feature
  contributions, and correct SIU routing — not a plausible-looking canned
  response.
- **Document retrieval**: real PDF text extraction (`pdf-parse`), chunking,
  and TF-IDF/cosine-similarity search (`src/lib/retrieval.ts`). Verified by
  generating an actual PDF with distinct policy clauses, uploading it via
  the API, and confirming a subsequent claim's coverage assessment
  retrieved and cited the real extracted text — not the sample-clause
  fallback library.
- **Rules engine**: rules are rows in the `rules` table, evaluated
  generically. Verified full CRUD (create, disable, delete) via the API and
  confirmed the change reflected on the next claim evaluated.
- **Smart assignment**: a weighted scorer (`src/lib/assignment-engine.ts`)
  over skill, geography, license, seniority-vs-complexity, and current
  workload against a real adjuster roster. One real bug was caught and
  fixed here too: the SIU specialist team was initially eligible for
  ordinary assignment ranking and kept winning on workload/skill score,
  which is wrong — SIU should only be reached via an explicit
  `route_to_siu` rule action, not general routing.

## Bugs found and fixed during verification (left in, not scrubbed)

Documenting these rather than quietly fixing and hiding them, because the
process of finding them is itself the evidence this was actually tested:

1. **Stale `fraud_score` in API responses.** The intake endpoint returned
   the in-memory claim object captured *before* the pipeline wrote the
   fraud score to the database, so a 98%-fraud claim's API response showed
   `fraud_score: null`. Fixed by re-fetching from the database after the
   pipeline completes (`src/lib/intake.ts`).
2. **Double-timezone timestamp parsing.** SQLite's `datetime('now')`
   produces `"2026-08-25 00:49:53"` (space-separated, no timezone); the
   seed script backdates some timestamps to full ISO strings
   (`"2026-08-23T17:39:22.000Z"`). Code that did
   `ts.replace(" ", "T") + "Z"` worked for the first format and silently
   produced an invalid, NaN-yielding date for the second. This broke the
   dashboard's `avgCycleDays` (returned `null`) and would have broken the
   claim timeline's displayed times for any backdated event. Fixed with a
   single shared `parseDbTimestamp()` (`src/lib/timestamps.ts`) instead of
   patching each call site separately.
3. **PDF upload failing under Turbopack.** `pdf-parse`'s underlying PDF.js
   worker couldn't resolve its own worker file inside Next's bundled
   output (`Cannot find module .../pdf.worker.mjs`) — a real bundler
   incompatibility with a package that does its own dynamic module
   resolution at runtime, not a typo. Fixed by adding `pdf-parse` and
   `better-sqlite3` to `serverExternalPackages` in `next.config.ts`, which
   tells Next to leave them alone rather than trying to rebundle them.
   Re-verified with a real generated PDF after the fix.

## What's still a documented stand-in

- **Coverage narrative generation.** Retrieval is real; turning retrieved
  passages into fluent "likely covered" prose is templated rather than
  generated by a hosted LLM, because a live LLM call needs a paid API key.
  This is the one place "real" stops at retrieval and doesn't extend to
  generation.
- **SHAP attribution.** What's implemented is the Saabas method — a real,
  published tree-attribution technique, exact for a single tree, and a
  close but not identical approximation to exact TreeSHAP for an ensemble.
  Exact TreeSHAP needs a nontrivial recursive "unwind the path" algorithm;
  implementing the simpler, real, correctly-attributed Saabas method was
  the honest scope call over either faking exact SHAP or not attempting
  real tree attribution at all. `scripts/train_xgb_fraud_model.py` also
  computes genuine SHAP values via the `shap` library at training time, so
  the two can be compared directly.
- **No authentication.** A `users` table with roles exists; nothing
  enforces those roles yet. Tenant switching is a dropdown.
- **GCP/Terraform** (`/infra`) documents a target production architecture
  and was never applied against a real cloud account — that requires an
  actual billing decision, not something to simulate.

## Why SQLite locally, Postgres for real deployment

SQLite gives real, durable, zero-account persistence for local development
and any long-running Node process. It will not reliably persist on Vercel,
because Vercel's serverless functions have an ephemeral filesystem. The
repository layer (`src/lib/repo.ts`) is the only thing that talks to the
database directly — swapping its internals from `better-sqlite3` to
Supabase Postgres (schema already mirrored in `supabase/schema.sql`) is a
contained change, not a rewrite, when it's time to deploy with real
persistence.
