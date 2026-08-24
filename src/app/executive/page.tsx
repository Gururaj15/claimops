"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, KpiCard, SectionLabel } from "@/components/ui";
import { CLAIMS, ORGANIZATIONS, expectedLossFor } from "@/lib/seed-data";
import { assessFraud } from "@/lib/fraud-model";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Deterministic pseudo-actual-hours per claim, derived from its id, so the
// SLA table is stable across renders without needing a real clock/DB.
function pseudoActualHours(claimId: string, slaHours: number): number {
  let hash = 0;
  for (const ch of claimId) hash = (hash * 31 + ch.charCodeAt(0)) % 97;
  const variance = (hash % 40) - 12; // -12..+27
  return Math.max(4, slaHours + variance);
}

function DashboardInner() {
  const params = useSearchParams();
  const orgId = params.get("org") ?? ORGANIZATIONS[0].id;
  const org = ORGANIZATIONS.find((o) => o.id === orgId) ?? ORGANIZATIONS[0];
  const claims = CLAIMS.filter((c) => c.organization_id === org.id);

  const rows = useMemo(
    () =>
      claims.map((c) => {
        const fraud = assessFraud(c, expectedLossFor(c.claim_type));
        const actualHours = pseudoActualHours(c.id, c.sla_hours);
        return { claim: c, fraud, actualHours };
      }),
    [claims]
  );

  const open = rows.filter((r) => !["approved", "rejected"].includes(r.claim.status)).length;
  const closed = rows.filter((r) => ["approved", "rejected"].includes(r.claim.status)).length;
  const fraudFlags = rows.filter((r) => r.fraud.score > org.fraud_threshold).length;
  const slaBreaches = rows.filter((r) => r.actualHours > r.claim.sla_hours).length;
  const slaCompliance = rows.length
    ? Math.round(((rows.length - slaBreaches) / rows.length) * 1000) / 10
    : 100;
  const avgCycle =
    rows.reduce((sum, r) => sum + r.actualHours, 0) / (rows.length || 1) / 24;
  const totalEstimated = rows.reduce((s, r) => s + r.claim.estimated_loss, 0);
  const leakageProxy =
    rows.reduce((s, r) => s + Math.max(0, r.claim.estimated_loss - expectedLossFor(r.claim.claim_type)), 0) /
    (totalEstimated || 1);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      map.set(r.claim.claim_type, (map.get(r.claim.claim_type) ?? 0) + r.claim.estimated_loss);
    });
    return Array.from(map.entries()).map(([type, value]) => ({
      type: type.replace(/_/g, " "),
      value,
    }));
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <SectionLabel>Executive — {org.name}</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Claims overview</h1>
      <p className="text-ink-muted text-sm mb-6">
        {org.line_of_business} · SLA target {org.sla_hours}h
      </p>

      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Open claims" value={String(open)} />
        <KpiCard label="Closed" value={String(closed)} />
        <KpiCard
          label="Avg cycle time"
          value={`${avgCycle.toFixed(1)}d`}
          tone={avgCycle * 24 > org.sla_hours ? "warn" : "good"}
        />
        <KpiCard
          label="SLA compliance"
          value={`${slaCompliance}%`}
          tone={slaCompliance > 90 ? "good" : slaCompliance > 75 ? "warn" : "bad"}
        />
        <KpiCard
          label="Leakage proxy"
          value={`${(leakageProxy * 100).toFixed(1)}%`}
          sub="vs. expected loss by claim type"
          tone={leakageProxy > 0.1 ? "warn" : "good"}
        />
        <KpiCard
          label="Fraud flags"
          value={String(fraudFlags)}
          sub={`above ${Math.round(org.fraud_threshold * 100)}%`}
          tone={fraudFlags > 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-5">
          <h2 className="font-display font-semibold mb-4">Estimated loss by claim type</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, "Estimated loss"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="value" fill="var(--teal)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold mb-4">SLA status</h2>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-mono uppercase text-ink-muted text-left">
                  <th className="pb-2">Claim</th>
                  <th className="pb-2">SLA</th>
                  <th className="pb-2">Actual</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ claim, actualHours }) => {
                  const breached = actualHours > claim.sla_hours;
                  const close = !breached && actualHours > claim.sla_hours * 0.85;
                  return (
                    <tr key={claim.id} className="border-t border-border">
                      <td className="py-2 font-mono text-xs">{claim.id}</td>
                      <td className="py-2 font-mono text-xs">{claim.sla_hours}h</td>
                      <td className="py-2 font-mono text-xs">{actualHours}h</td>
                      <td className="py-2">
                        {breached ? (
                          <span className="text-red font-medium">Breached</span>
                        ) : close ? (
                          <span className="text-amber font-medium">At risk</span>
                        ) : (
                          <span className="text-teal font-medium">On track</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DashboardInner />
      </Suspense>
    </AppShell>
  );
}
