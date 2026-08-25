"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, StatusPill } from "@/components/ui";
import type { Claim, Organization } from "@/lib/types";

function QueueInner() {
  const params = useSearchParams();
  const orgId = params.get("org");
  const [org, setOrg] = useState<Organization | null>(null);
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setClaims(null);
    Promise.all([
      fetch("/api/organizations").then((r) => r.json()),
      fetch(`/api/claims?org=${orgId}`).then((r) => r.json()),
    ])
      .then(([orgsRes, claimsRes]) => {
        const found = orgsRes.organizations?.find((o: Organization) => o.id === orgId);
        setOrg(found ?? null);
        setClaims(claimsRes.claims ?? []);
      })
      .catch(() => setError("Failed to load — is the dev server running with the database seeded?"));
  }, [orgId]);

  if (!orgId) {
    return <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-ink-muted">Pick a tenant from the dropdown above.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-1">
        <SectionLabel>Adjuster — {org?.name ?? "…"}</SectionLabel>
        <div className="flex gap-2">
          <Link href={`/adjuster/review?org=${orgId}`} className="text-xs font-medium text-teal hover:underline">
            Human review queue →
          </Link>
          <Link href={`/adjuster/new?org=${orgId}`} className="text-xs font-medium bg-teal text-white px-3 py-1.5 rounded-md">
            + New claim (FNOL)
          </Link>
        </div>
      </div>
      <h1 className="font-display text-2xl font-semibold mb-1">Claims queue</h1>
      <p className="text-ink-muted text-sm mb-6">
        {claims ? `${claims.length} claims` : "Loading…"}
        {org && ` · SLA target ${org.sla_hours}h · fraud review triggers above ${Math.round(org.fraud_threshold * 100)}%`}
      </p>

      {error && <Card className="p-4 text-sm text-red mb-4">{error}</Card>}

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
        {claims === null && <div className="px-4 py-8 text-sm text-ink-muted">Loading claims from the database…</div>}
        {claims?.length === 0 && (
          <div className="px-4 py-8 text-sm text-ink-muted">
            No claims yet. Run <code className="font-mono text-xs bg-surface-sunken px-1 rounded">npm run db:seed</code>{" "}
            or submit one via &quot;+ New claim&quot;.
          </div>
        )}
        {claims?.map((claim) => (
          <Link
            key={claim.id}
            href={`/adjuster/${claim.id}?org=${orgId}`}
            className="grid grid-cols-[100px_1.4fr_1fr_100px_100px_120px_100px] gap-3 px-4 py-3 border-t border-border items-center text-sm hover:bg-surface-sunken transition-colors"
          >
            <div className="font-mono text-xs text-ink-muted">{claim.id}</div>
            <div className="font-medium">{claim.policyholder_name}</div>
            <div className="text-ink-muted capitalize">{claim.claim_type.replace(/_/g, " ")}</div>
            <div className="font-mono">${claim.estimated_loss.toLocaleString()}</div>
            <div
              className={`font-mono font-medium ${
                claim.human_review_required ? "text-red" : "text-ink-muted"
              }`}
            >
              {claim.fraud_score != null ? `${Math.round(claim.fraud_score * 100)}%` : "—"}
            </div>
            <div>
              <StatusPill status={claim.status} />
            </div>
            <div className="text-ink-muted text-xs">{claim.assigned_to ?? "Unassigned"}</div>
          </Link>
        ))}
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
