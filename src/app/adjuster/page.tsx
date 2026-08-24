"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, StatusPill } from "@/components/ui";
import { CLAIMS, ORGANIZATIONS, expectedLossFor } from "@/lib/seed-data";
import { assessFraud } from "@/lib/fraud-model";

function QueueInner() {
  const params = useSearchParams();
  const orgId = params.get("org") ?? ORGANIZATIONS[0].id;
  const org = ORGANIZATIONS.find((o) => o.id === orgId) ?? ORGANIZATIONS[0];
  const claims = CLAIMS.filter((c) => c.organization_id === org.id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <SectionLabel>Adjuster — {org.name}</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Claims queue</h1>
      <p className="text-ink-muted text-sm mb-6">
        {claims.length} open claims · SLA target {org.sla_hours}h · fraud
        review triggers above {Math.round(org.fraud_threshold * 100)}%
      </p>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[100px_1.4fr_1fr_100px_100px_120px_100px] gap-3 px-4 py-2.5 bg-surface-sunken text-xs font-mono uppercase tracking-wider text-ink-muted">
          <div>Claim</div>
          <div>Policyholder</div>
          <div>Type</div>
          <div>Amount</div>
          <div>Fraud</div>
          <div>Status</div>
          <div>Assigned</div>
        </div>
        {claims.map((claim) => {
          const fraud = assessFraud(claim, expectedLossFor(claim.claim_type));
          return (
            <Link
              key={claim.id}
              href={`/adjuster/${claim.id}?org=${org.id}`}
              className="grid grid-cols-[100px_1.4fr_1fr_100px_100px_120px_100px] gap-3 px-4 py-3 border-t border-border items-center text-sm hover:bg-surface-sunken transition-colors"
            >
              <div className="font-mono text-xs text-ink-muted">{claim.id}</div>
              <div className="font-medium">{claim.policyholder_name}</div>
              <div className="text-ink-muted capitalize">
                {claim.claim_type.replace(/_/g, " ")}
              </div>
              <div className="font-mono">${claim.estimated_loss.toLocaleString()}</div>
              <div
                className={`font-mono font-medium ${
                  fraud.score > org.fraud_threshold ? "text-red" : "text-ink-muted"
                }`}
              >
                {Math.round(fraud.score * 100)}%
              </div>
              <div>
                <StatusPill status={claim.status} />
              </div>
              <div className="text-ink-muted text-xs">
                {claim.assigned_to ?? "Unassigned"}
              </div>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

export default function AdjusterQueuePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <QueueInner />
      </Suspense>
    </AppShell>
  );
}
