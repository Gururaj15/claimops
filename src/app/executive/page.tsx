"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, KpiCard, SectionLabel } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

type DashboardData = {
  organization: { name: string; line_of_business: string; sla_hours: number; fraud_threshold: number };
  open: number;
  closed: number;
  slaCompliance: number;
  avgCycleDays: number;
  leakage: number;
  fraudFlags: number;
  byType: { type: string; value: number }[];
  slaRows: { claimId: string; slaHours: number; actualHours: number; breached: boolean; status: string }[];
};

function DashboardInner() {
  const params = useSearchParams();
  const orgId = params.get("org");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setData(null);
    fetch(`/api/dashboard?org=${orgId}`)
      .then((r) => r.json())
      .then(setData);
  }, [orgId]);

  if (!data) {
    return <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-ink-muted">Loading real aggregates from the database…</div>;
  }

  const { organization: org } = data;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <SectionLabel>Executive — {org.name}</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Claims overview</h1>
      <p className="text-ink-muted text-sm mb-6">
        {org.line_of_business} · SLA target {org.sla_hours}h · computed live from the database, not mocked
      </p>

      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Open claims" value={String(data.open)} />
        <KpiCard label="Closed" value={String(data.closed)} />
        <KpiCard
          label="Avg cycle time"
          value={`${data.avgCycleDays.toFixed(1)}d`}
          tone={data.avgCycleDays * 24 > org.sla_hours ? "warn" : "good"}
        />
        <KpiCard
          label="SLA compliance"
          value={`${data.slaCompliance}%`}
          tone={data.slaCompliance > 90 ? "good" : data.slaCompliance > 75 ? "warn" : "bad"}
        />
        <KpiCard
          label="Leakage proxy"
          value={`${(data.leakage * 100).toFixed(1)}%`}
          sub="vs. expected loss by claim type"
          tone={data.leakage > 0.1 ? "warn" : "good"}
        />
        <KpiCard
          label="Fraud flags"
          value={String(data.fraudFlags)}
          sub={`above ${Math.round(org.fraud_threshold * 100)}%`}
          tone={data.fraudFlags > 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-5">
          <h2 className="font-display font-semibold mb-4">Estimated loss by claim type</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byType} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Estimated loss"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" fill="var(--teal)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold mb-4">SLA status (real elapsed time)</h2>
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
                {data.slaRows.map((r) => {
                  const closed = ["approved", "rejected"].includes(r.status);
                  const atRisk = !closed && !r.breached && r.actualHours > r.slaHours * 0.85;
                  return (
                    <tr key={r.claimId} className="border-t border-border">
                      <td className="py-2 font-mono text-xs">{r.claimId}</td>
                      <td className="py-2 font-mono text-xs">{r.slaHours}h</td>
                      <td className="py-2 font-mono text-xs">{r.actualHours}h</td>
                      <td className="py-2">
                        {r.breached ? (
                          <span className="text-red font-medium">Breached</span>
                        ) : atRisk ? (
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
