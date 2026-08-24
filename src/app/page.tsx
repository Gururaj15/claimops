import Link from "next/link";
import { ORGANIZATIONS } from "@/lib/seed-data";
import { Card } from "@/components/ui";

const PIPELINE = [
  { label: "Claim Intake", detail: "FNOL normalized from any source format" },
  { label: "Rules", detail: "Tenant-configured conditions" },
  { label: "AI", detail: "Coverage + fraud signals" },
  { label: "Risk Score", detail: "Combined, explainable" },
  { label: "Workflow", detail: "Auto / Human / SIU routing" },
  { label: "Reporting", detail: "SLA, leakage, cycle time" },
];

const PERSONAS = [
  {
    href: "/onboarding",
    title: "Implementation Engineer",
    description:
      "Bring a new insurer onto the platform: map their claim schema, configure rules, SLAs and required documents.",
    cta: "Open onboarding workspace",
  },
  {
    href: "/adjuster",
    title: "Claims Adjuster",
    description:
      "Work a queue of live claims with AI-assisted coverage review, an explainable fraud score, and one-click actions.",
    cta: "Open claims queue",
  },
  {
    href: "/executive",
    title: "Insurance Executive",
    description:
      "See SLA compliance, leakage, fraud flags and cycle time across every program on the platform, in real time.",
    cta: "Open dashboard",
  },
];

export default function Home() {
  const defaultOrg = ORGANIZATIONS[0].id;
  return (
    <div>
      <section className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20">
          <div className="max-w-2xl">
            <div className="font-mono text-xs uppercase tracking-widest text-teal mb-4">
              Multi-tenant claims operations
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight">
              One configurable pipeline, not one custom app per insurer.
            </h1>
            <p className="mt-5 text-white/70 text-lg leading-relaxed">
              ClaimOps onboards a new insurance program in an afternoon, routes
              every claim through rules and AI-assisted review, and keeps a
              human in the loop before anything gets decided. Built to run the
              same way for a commercial-property MGA and a travel insurer —
              same schema, different configuration.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="bg-teal text-white px-5 py-2.5 rounded-md font-medium text-sm hover:bg-teal/90 transition-colors"
              >
                Walk through onboarding
              </Link>
              <Link
                href={`/adjuster?org=${defaultOrg}`}
                className="bg-white/10 text-white px-5 py-2.5 rounded-md font-medium text-sm hover:bg-white/15 transition-colors border border-white/20"
              >
                See the claims queue
              </Link>
            </div>
          </div>

          <div className="mt-14 overflow-x-auto">
            <div className="flex items-stretch gap-0 min-w-[820px]">
              {PIPELINE.map((step, i) => (
                <div key={step.label} className="flex items-stretch flex-1">
                  <div className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-4 py-4">
                    <div className="font-mono text-[11px] text-teal">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="font-display font-medium mt-1">{step.label}</div>
                    <div className="text-xs text-white/50 mt-1 leading-snug">
                      {step.detail}
                    </div>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className="flex items-center px-2 text-white/30">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-wider text-ink-muted mb-2">
            Three views, one dataset
          </div>
          <h2 className="font-display text-2xl font-semibold">
            Explore the platform the way each user would.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PERSONAS.map((p) => (
            <Card key={p.href} className="p-6 flex flex-col">
              <h3 className="font-display text-lg font-semibold">{p.title}</h3>
              <p className="text-sm text-ink-muted mt-2 leading-relaxed flex-1">
                {p.description}
              </p>
              <Link
                href={p.href === "/onboarding" ? p.href : `${p.href}?org=${defaultOrg}`}
                className="mt-4 text-sm font-medium text-teal hover:underline"
              >
                {p.cta} →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-10 grid sm:grid-cols-3 gap-6 text-sm text-ink-muted">
          <div>
            <div className="font-display text-ink font-medium mb-1">Two live tenants</div>
            Acme Insurance (commercial property, 48h SLA) and Voyage Travel
            Insurance (24h SLA) run on the identical codebase with different
            rules and thresholds.
          </div>
          <div>
            <div className="font-display text-ink font-medium mb-1">Real trained model</div>
            Fraud scores come from a logistic regression trained on synthetic
            data, with linear SHAP-style attributions shown on every claim.
          </div>
          <div>
            <div className="font-display text-ink font-medium mb-1">Human-gated AI</div>
            Coverage assessments and fraud scores inform routing — they never
            auto-approve or auto-deny a claim.
          </div>
        </div>
      </section>
    </div>
  );
}
