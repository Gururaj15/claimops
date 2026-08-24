# Market research

Notes from researching ClaimSorted and three adjacent claims-tech companies
before designing ClaimOps, based on public company pages, YC's launch
listing, and third-party analyst comparisons (CB Insights, Dealroom) as of
August 2026. Not based on any private materials.

## ClaimSorted

ClaimSorted is a Y Combinator company that positions itself as an AI-first
third-party administrator: it pairs automated fraud checks, compliance
checks, and claim decisioning with a team of human experts, so insurers can
outsource claims operations instead of running them in-house. It was
founded in 2024, is based in New York, and has raised roughly $16M to date.
Its FDE-style hiring reflects that positioning — the role is about standing
up a new client's claims operation quickly, not just maintaining one
existing product.

**What this means for the project:** onboarding speed and human-in-the-loop
AI aren't incidental features here — they're close to the company's core
pitch. That's why ClaimOps treats onboarding as a first-class module rather
than an afterthought bolted onto a claims list.

## Snapsheet

Snapsheet runs the full claims workflow from first notice of loss through
settlement, including virtual appraisals and digital payments, with the
stated goal of cutting cycle times for carriers of all sizes. Partner case
studies describe the platform as API-driven and configurable enough that an
MGA can stand up a customized claims workflow in weeks rather than months.

**What this means for the project:** configurability — per-tenant workflows
instead of one fixed process — and fast implementation are the two things
Snapsheet's own customers cite as the reason they adopted it. ClaimOps
mirrors that with per-organization rules and a schema mapper instead of a
single hardcoded claim form.

## Five Sigma

Five Sigma offers a cloud-based claims management platform plus an AI
"claims adjuster" layer designed to sit on top of an insurer's existing
system, aimed at cutting cost and manual effort through automation and
real-time insight, while keeping a human adjuster of record.

**What this means for the project:** the "AI assists, a human decides"
framing recurs across this whole market, not just at ClaimSorted. ClaimOps
follows the same principle — no model in this codebase can auto-approve or
auto-deny a claim.

## Working assumption going into the build

No single vendor description covers onboarding tooling, a rules engine,
fraud scoring, and reporting all in one place — most companies specialize
in one layer (TPA services, appraisal/payments, or an AI-adjuster add-on).
ClaimOps is a deliberate synthesis across that layer split, meant to
demonstrate end-to-end thinking relevant to an FDE role — not a claim that
any one company's actual roadmap was reverse-engineered.

## Sources
- https://www.ycombinator.com/companies/claimsorted
- https://www.cbinsights.com/company/claimsorted
- https://app.dealroom.co/companies/claimsorted
- https://app.dealroom.co/companies/snapsheet
- https://www.cbinsights.com/compare/snapsheet-vs-five-sigma
