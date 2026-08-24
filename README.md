# ClaimOps

A configurable, multi-tenant claims operations platform: onboard a new
insurance program, ingest claims, run them through a rules engine plus
AI-assisted coverage and fraud signals, and keep a human adjuster in the
loop before anything is decided.

Built as a portfolio project while applying to Forward Deployed Engineer
roles at claims-tech companies. See `/docs` for the market research and
architecture reasoning behind the design decisions, not just the code.

**Live demo:** _add your Vercel URL here after deploying — see `docs/DEPLOY.md`_

## Why this exists

Most claims-tech vendors specialize in one layer: outsourced claims
operations, appraisal/payments, or an AI-adjuster add-on bolted onto an
existing system. This project is a synthesis across that layer split —
onboarding, a rules engine, an explainable fraud model, a (clearly labeled)
coverage-assistant prototype, and reporting — built to run identically for
two different tenants with two different configurations.

## Three ways to look at it

| Persona | Route | What it shows |
|---|---|---|
| Implementation Engineer | `/onboarding` | Program setup + schema mapper for onboarding a new insurer |
| Claims Adjuster | `/adjuster` | A claims queue, and a claim detail page with fraud SHAP breakdown, coverage assessment, rules engine output, and a timeline |
| Executive | `/executive` | SLA compliance, leakage proxy, fraud flags, cycle time |

Switch tenants with the dropdown in the top nav — Acme Insurance (commercial
property, 48h SLA) and Voyage Travel Insurance (travel, 24h SLA) run on the
same code with different configuration.

## What's real vs. simplified

Full honesty about scope is in `docs/02-architecture-decisions.md`. Short
version: the fraud model is a real logistic regression trained on synthetic
data with real linear-SHAP attributions; the rules engine is genuinely
data-driven; the coverage assistant is a documented prototype (clause
matching, not a live LLM call) built that way specifically to keep this
project's running cost at $0.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind, Recharts, deployed on
Vercel. Optional persistence via Supabase Postgres (see `supabase/schema.sql`
and `.env.example`). `/infra` documents — but does not deploy — the
GCP/Terraform production target architecture.

## Running locally

```bash
npm install
npm run dev
```
Open http://localhost:3000 — no environment variables required.

## Training the fraud model

```bash
pip install scikit-learn numpy
python3 scripts/train_fraud_model.py
```
Regenerates `src/lib/fraud-model-weights.json` from a fresh synthetic
dataset (see the script for the generative assumptions).

## Docs

- `docs/01-market-research.md` — what ClaimSorted, Snapsheet, and Five Sigma
  publicly say about their own products, and what that implied for scope
- `docs/02-architecture-decisions.md` — what's real, what's simplified, and why
- `docs/DEPLOY.md` — free-tier deployment steps
