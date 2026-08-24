# Target production architecture (not deployed)

This folder documents the infrastructure ClaimOps would run on in
production, following the GCP-oriented stack from the original project
brief. None of this is applied against a real cloud account for this
build — see /docs/02-architecture-decisions.md for why. It's here to show
the intended design, not to be `terraform apply`'d as-is.

```
Next.js UI
    │
Node.js / API layer (this repo, deployed on Vercel today)
    │
    ├── Cloud SQL (Postgres)        — today: Supabase free tier
    ├── Cloud Storage               — today: Supabase Storage
    ├── Pub/Sub (claim events)      — today: direct writes to claim_events
    ├── Secret Manager              — today: Vercel environment variables
    └── Python ML service (Cloud Run) — today: model runs in-process (lib/fraud-model.ts)
```

The migration path from "today" to "target" is additive: each swap
(Supabase → Cloud SQL, direct writes → Pub/Sub, in-process model → a real
Cloud Run service) can happen independently without changing the API
contracts the frontend depends on.

See `network.tf`, `cloud-run.tf`, `cloud-sql.tf`, `storage.tf`, `pubsub.tf`,
and `iam.tf` for what each piece would look like.
