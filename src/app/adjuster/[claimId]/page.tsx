"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, StatusPill } from "@/components/ui";
import { CLAIMS, ORGANIZATIONS, RULES, eventsForClaim, expectedLossFor } from "@/lib/seed-data";
import { assessFraud } from "@/lib/fraud-model";
import { assessCoverage } from "@/lib/coverage-assistant";
import { evaluateRules, resolveActions } from "@/lib/rules-engine";
import type { ClaimStatus } from "@/lib/types";
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

function ClaimDetailInner() {
  const { claimId } = useParams<{ claimId: string }>();
  const params = useSearchParams();
  const orgId = params.get("org") ?? ORGANIZATIONS[0].id;
  const org = ORGANIZATIONS.find((o) => o.id === orgId) ?? ORGANIZATIONS[0];
  const claim = CLAIMS.find((c) => c.id === claimId);

  const [status, setStatus] = useState<ClaimStatus | null>(claim?.status ?? null);

  const fraud = useMemo(
    () => (claim ? assessFraud(claim, expectedLossFor(claim.claim_type)) : null),
    [claim]
  );
  const coverage = useMemo(() => (claim ? assessCoverage(claim) : null), [claim]);
  const triggers = useMemo(
    () => (claim && fraud ? evaluateRules(claim, fraud, RULES) : []),
    [claim, fraud]
  );
  const actions = useMemo(() => resolveActions(triggers), [triggers]);
  const events = claim ? eventsForClaim(claim.id) : [];

  if (!claim || !fraud || !coverage) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Card className="p-6 text-sm text-ink-muted">Claim not found in this tenant.</Card>
      </div>
    );
  }

  const chartData = fraud.contributions.map((c) => ({
    name: c.label,
    value: Number(c.value.toFixed(3)),
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <SectionLabel>{org.name}</SectionLabel>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold mb-1">
            {claim.id} — {claim.policyholder_name}
          </h1>
          <div className="text-sm text-ink-muted">
            {claim.claim_type.replace(/_/g, " ")} · Policy {claim.policy_id} · Loss date{" "}
            {claim.loss_date} · {claim.geography}
          </div>
        </div>
        {status && <StatusPill status={status} />}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Fraud / leakage */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {fraud.score > org.fraud_threshold ? (
                  <ShieldAlert size={18} className="text-red" />
                ) : (
                  <ShieldCheck size={18} className="text-teal" />
                )}
                <h2 className="font-display font-semibold">Leakage / fraud signal</h2>
              </div>
              <div
                className={`font-mono text-2xl font-semibold ${
                  fraud.score > org.fraud_threshold ? "text-red" : "text-teal"
                }`}
              >
                {Math.round(fraud.score * 100)}%
              </div>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Trained logistic regression, not a static rule — see feature
              contributions below (linear SHAP-equivalent attribution).
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
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
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
              Bars pushing right increase fraud probability; bars pushing left
              decrease it.
            </div>
          </Card>

          {/* Coverage assistant */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <FileSearch size={18} className="text-teal" />
              <h2 className="font-display font-semibold">Coverage assistant</h2>
              <span className="ml-auto text-xs font-mono text-ink-muted">
                {Math.round(coverage.confidence * 100)}% confidence
              </span>
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
                <div className="text-xs font-mono uppercase text-ink-muted mb-1">
                  Relevant clauses
                </div>
                <ul className="space-y-1">
                  {coverage.relevantClauses.map((c) => (
                    <li key={c} className="font-mono text-xs">{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-ink-muted mb-1">
                  Possible exclusion
                </div>
                <p className="text-xs font-mono">{coverage.exclusion ?? "None identified"}</p>
                <div className="mt-2 text-xs text-ink-muted">
                  Deductible ${coverage.deductible.toLocaleString()} · Limit $
                  {coverage.coverageLimit.toLocaleString()}
                </div>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-5">
            <h2 className="font-display font-semibold mb-3">Claim timeline</h2>
            <div className="space-y-2">
              {events.length === 0 && (
                <div className="text-sm text-ink-muted">No events recorded yet.</div>
              )}
              {events.map((e) => (
                <div key={e.id} className="flex gap-3 text-sm">
                  <div className="font-mono text-xs text-ink-muted w-16 shrink-0 pt-0.5">
                    {new Date(e.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex-1 border-l-2 border-teal-soft pl-3 pb-1">
                    {e.label}
                    <span className="text-ink-muted text-xs ml-2">({e.actor})</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Rules */}
          <Card className="p-5">
            <h2 className="font-display font-semibold mb-3">Rules engine</h2>
            <div className="space-y-2 mb-4">
              {triggers.map((t) => (
                <div
                  key={t.rule.id}
                  className={`text-sm px-3 py-2 rounded-md border ${
                    t.matched
                      ? "border-teal/30 bg-teal-soft"
                      : "border-border bg-surface-sunken text-ink-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.rule.name}</span>
                    <span className="text-xs font-mono">
                      {t.matched ? "MATCHED" : "no match"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {actions.length > 0 && (
              <>
                <div className="text-xs font-mono uppercase text-ink-muted mb-1.5">
                  Resulting actions
                </div>
                <ul className="space-y-1 text-sm">
                  {actions.map((a) => (
                    <li key={a}>· {ACTION_LABELS[a] ?? a}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Actions */}
          <Card className="p-5">
            <h2 className="font-display font-semibold mb-3">Adjuster actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => setStatus("approved")}
                className="w-full text-left px-3 py-2 rounded-md bg-teal-soft text-teal text-sm font-medium hover:opacity-80"
              >
                Approve claim
              </button>
              <button
                onClick={() => setStatus("pending_information")}
                className="w-full text-left px-3 py-2 rounded-md bg-amber-soft text-amber text-sm font-medium hover:opacity-80"
              >
                Request more information
              </button>
              <button
                onClick={() => setStatus("rejected")}
                className="w-full text-left px-3 py-2 rounded-md bg-red-soft text-red text-sm font-medium hover:opacity-80"
              >
                Reject claim
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-3">
              Status changes are local to this session in the prototype —
              wiring the Supabase table in <code className="font-mono">supabase/schema.sql</code> makes
              them persist and log a new timeline event.
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
