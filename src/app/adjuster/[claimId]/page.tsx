"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, StatusPill } from "@/components/ui";
import type { Claim, CoverageAssessment, FraudAssessment, RuleTrigger } from "@/lib/types";
import { parseDbTimestamp } from "@/lib/timestamps";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertTriangle, ShieldCheck, ShieldAlert, FileSearch } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  assign_senior_adjuster: "Assign senior adjuster",
  require_human_review: "Human review required",
  priority_high: "Priority: High",
  route_to_siu: "Route to SIU",
  request_additional_documents: "Request additional documents",
  status_pending_information: "Status → Pending information",
};

type ClaimDetailResponse = {
  claim: Claim;
  fraud: FraudAssessment;
  coverage: CoverageAssessment;
  triggers: RuleTrigger[];
  actions: string[];
  events: { id: string; timestamp: string; label: string; actor: string; detail: string | null }[];
};

function ClaimDetailInner() {
  const { claimId } = useParams<{ claimId: string }>();
  const params = useSearchParams();
  const orgId = params.get("org");

  const [data, setData] = useState<ClaimDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/claims/${claimId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Claim not found."));
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(status: string) {
    setUpdating(true);
    await fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, actor: "adjuster" }),
    });
    load();
    setUpdating(false);
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Card className="p-6 text-sm text-red">{error}</Card>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-5xl mx-auto px-6 py-10 text-sm text-ink-muted">Loading from the database…</div>;
  }

  const { claim, fraud, coverage, triggers, actions, events } = data;
  const chartData = fraud.contributions.map((c) => ({ name: c.label, value: Number(c.value.toFixed(3)) }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <SectionLabel>Org {claim.organization_id}</SectionLabel>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">
            {claim.id} — {claim.policyholder_name}
          </h1>
          <div className="text-sm text-ink-muted">
            {claim.claim_type.replace(/_/g, " ")} · Policy {claim.policy_id} · Loss date {claim.loss_date} ·{" "}
            {claim.geography}
          </div>
        </div>
        <StatusPill status={claim.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {claim.human_review_required ? (
                  <ShieldAlert size={18} className="text-red" />
                ) : (
                  <ShieldCheck size={18} className="text-teal" />
                )}
                <h2 className="font-display font-semibold">Leakage / fraud signal</h2>
              </div>
              <div className={`font-mono text-2xl font-semibold ${claim.human_review_required ? "text-red" : "text-teal"}`}>
                {Math.round(fraud.score * 100)}%
              </div>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Real XGBoost model (60 trees), scored server-side on submission — see docs/02-architecture-decisions.md
              for how the tree traversal is verified against Python's own predictions.
            </p>

            {fraud.flags.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {fraud.flags.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={14} className="text-amber mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
                  <ReferenceLine x={0} stroke="var(--border)" />
                  <Bar dataKey="value" radius={3}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.value >= 0 ? "var(--red)" : "var(--teal)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Bars pushing right increase fraud probability; bars pushing left decrease it (Saabas-style tree attribution).
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <FileSearch size={18} className="text-teal" />
              <h2 className="font-display font-semibold">Coverage assistant</h2>
              <span className="ml-auto text-xs font-mono text-ink-muted">{Math.round(coverage.confidence * 100)}% confidence</span>
            </div>
            <div
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${
                coverage.verdict === "likely_covered"
                  ? "bg-teal-soft text-teal"
                  : coverage.verdict === "likely_excluded"
                  ? "bg-red-soft text-red"
                  : "bg-amber-soft text-amber"
              }`}
            >
              {coverage.verdict.replace(/_/g, " ")}
            </div>
            <p className="text-sm leading-relaxed mb-3">{coverage.reasoning}</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs font-mono uppercase text-ink-muted mb-1">Retrieved / relevant clauses</div>
                <ul className="space-y-1">
                  {coverage.relevantClauses.map((c) => (
                    <li key={c} className="font-mono text-xs">{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-ink-muted mb-1">Possible exclusion</div>
                <p className="text-xs font-mono">{coverage.exclusion ?? "None identified"}</p>
                <div className="mt-2 text-xs text-ink-muted">
                  Deductible ${coverage.deductible.toLocaleString()} · Limit ${coverage.coverageLimit.toLocaleString()}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display font-semibold mb-3">Claim timeline (real audit trail)</h2>
            <div className="space-y-2">
              {events.length === 0 && <div className="text-sm text-ink-muted">No events recorded yet.</div>}
              {events.map((e) => (
                <div key={e.id} className="flex gap-3 text-sm">
                  <div className="font-mono text-xs text-ink-muted w-16 shrink-0 pt-0.5">
                    {parseDbTimestamp(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex-1 border-l-2 border-teal-soft pl-3 pb-1">
                    {e.label}
                    <span className="text-ink-muted text-xs ml-2">({e.actor})</span>
                    {e.detail && <div className="text-xs text-ink-muted mt-0.5">{e.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display font-semibold mb-3">Rules engine</h2>
            <div className="space-y-2 mb-4">
              {triggers.map((t) => (
                <div
                  key={t.rule.id}
                  className={`text-sm px-3 py-2 rounded-md border ${
                    t.matched ? "border-teal/30 bg-teal-soft" : "border-border bg-surface-sunken text-ink-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.rule.name}</span>
                    <span className="text-xs font-mono">{t.matched ? "MATCHED" : "no match"}</span>
                  </div>
                </div>
              ))}
              {triggers.length === 0 && <div className="text-sm text-ink-muted">No rules configured for this tenant yet.</div>}
            </div>
            {actions.length > 0 && (
              <>
                <div className="text-xs font-mono uppercase text-ink-muted mb-1.5">Resulting actions</div>
                <ul className="space-y-1 text-sm">
                  {actions.map((a) => (
                    <li key={a}>· {ACTION_LABELS[a] ?? a}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display font-semibold mb-3">Adjuster actions</h2>
            <div className="space-y-2">
              <button
                disabled={updating}
                onClick={() => updateStatus("approved")}
                className="w-full text-left px-3 py-2 rounded-md bg-teal-soft text-teal text-sm font-medium hover:opacity-80 disabled:opacity-50"
              >
                Approve claim
              </button>
              <button
                disabled={updating}
                onClick={() => updateStatus("pending_information")}
                className="w-full text-left px-3 py-2 rounded-md bg-amber-soft text-amber text-sm font-medium hover:opacity-80 disabled:opacity-50"
              >
                Request more information
              </button>
              <button
                disabled={updating}
                onClick={() => updateStatus("rejected")}
                className="w-full text-left px-3 py-2 rounded-md bg-red-soft text-red text-sm font-medium hover:opacity-80 disabled:opacity-50"
              >
                Reject claim
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-3">
              This actually writes to the database and appends a real timeline event — refresh the page and the status holds.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ClaimDetailPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ClaimDetailInner />
      </Suspense>
    </AppShell>
  );
}
