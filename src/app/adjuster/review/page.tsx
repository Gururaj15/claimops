"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, StatusPill } from "@/components/ui";
import type { Claim } from "@/lib/types";

function ReviewInner() {
  const params = useSearchParams();
  const orgId = params.get("org");
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/claims?org=${orgId}`)
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []));
  }, [orgId]);

  const flagged = (claims ?? []).filter((c) => c.human_review_required || c.status === "siu_review");

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <SectionLabel>Human review queue</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Claims requiring a human decision</h1>
      <p className="text-ink-muted text-sm mb-6">
        Every claim here was routed here by the rules engine or crossed the tenant&apos;s fraud threshold — the model
        never approves or denies on its own.
      </p>

      <Card className="overflow-hidden">
        {claims === null && <div className="px-4 py-8 text-sm text-ink-muted">Loading…</div>}
        {claims && flagged.length === 0 && (
          <div className="px-4 py-8 text-sm text-ink-muted">Nothing flagged for human review right now.</div>
        )}
        {flagged.map((c) => (
          <Link
            key={c.id}
            href={`/adjuster/${c.id}?org=${orgId}`}
            className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border first:border-t-0 hover:bg-surface-sunken text-sm"
          >
            <div className="font-mono text-xs text-ink-muted w-28">{c.id}</div>
            <div className="flex-1 font-medium">{c.policyholder_name}</div>
            <div className="text-ink-muted capitalize w-32">{c.claim_type.replace(/_/g, " ")}</div>
            <div className="font-mono text-red w-16">
              {c.fraud_score != null ? `${Math.round(c.fraud_score * 100)}%` : "—"}
            </div>
            <StatusPill status={c.status} />
          </Link>
        ))}
      </Card>
    </div>
  );
}

export default function ReviewQueuePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ReviewInner />
      </Suspense>
    </AppShell>
  );
}
