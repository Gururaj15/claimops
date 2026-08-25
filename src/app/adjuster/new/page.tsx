"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel } from "@/components/ui";

const CLAIM_TYPES = ["water_damage", "fire", "theft", "wind_hail", "liability", "bodily_injury", "trip_cancellation", "lost_baggage"];

function NewClaimInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orgId = params.get("org") ?? "";

  const [form, setForm] = useState({
    claim_type: "water_damage",
    policyholder_name: "",
    policy_id: "",
    loss_date: new Date().toISOString().slice(0, 10),
    estimated_loss: "10000",
    repair_cost: "9000",
    policy_age_days: "365",
    previous_claims_count: "0",
    days_since_policy_start: "365",
    document_anomaly_score: "0.1",
    geography: "Texas",
    severity: "medium",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-claimops-source": "web_form" },
      body: JSON.stringify({ organization_id: orgId, ...form }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(JSON.stringify(data.error));
      return;
    }
    router.push(`/adjuster/${data.claim.id}?org=${orgId}`);
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <SectionLabel>FNOL — web form channel</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Submit a new claim</h1>
      <p className="text-ink-muted text-sm mb-6">
        This actually POSTs to <code className="font-mono text-xs bg-surface-sunken px-1 rounded">/api/claims</code>, runs the
        real intake pipeline (fraud model, coverage retrieval, rules engine, smart assignment), and takes you straight to the
        result. The same endpoint also accepts JSON directly, and CSV/webhook variants exist for bulk and system-to-system intake.
      </p>

      <Card className="p-6">
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <Field label="Claim type">
            <select className="input" value={form.claim_type} onChange={(e) => set("claim_type", e.target.value)}>
              {CLAIM_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Policyholder name">
            <input className="input" required value={form.policyholder_name} onChange={(e) => set("policyholder_name", e.target.value)} />
          </Field>
          <Field label="Policy ID">
            <input className="input" required value={form.policy_id} onChange={(e) => set("policy_id", e.target.value)} />
          </Field>
          <Field label="Loss date">
            <input type="date" className="input" value={form.loss_date} onChange={(e) => set("loss_date", e.target.value)} />
          </Field>
          <Field label="Estimated loss ($)">
            <input type="number" className="input" value={form.estimated_loss} onChange={(e) => set("estimated_loss", e.target.value)} />
          </Field>
          <Field label="Repair cost ($)">
            <input type="number" className="input" value={form.repair_cost} onChange={(e) => set("repair_cost", e.target.value)} />
          </Field>
          <Field label="Policy age (days)">
            <input type="number" className="input" value={form.policy_age_days} onChange={(e) => set("policy_age_days", e.target.value)} />
          </Field>
          <Field label="Previous claims count">
            <input type="number" className="input" value={form.previous_claims_count} onChange={(e) => set("previous_claims_count", e.target.value)} />
          </Field>
          <Field label="Days since policy start">
            <input type="number" className="input" value={form.days_since_policy_start} onChange={(e) => set("days_since_policy_start", e.target.value)} />
          </Field>
          <Field label="Document anomaly score (0–1)">
            <input type="number" step="0.05" min={0} max={1} className="input" value={form.document_anomaly_score} onChange={(e) => set("document_anomaly_score", e.target.value)} />
          </Field>
          <Field label="Geography">
            <input className="input" value={form.geography} onChange={(e) => set("geography", e.target.value)} />
          </Field>
          <Field label="Severity">
            <select className="input" value={form.severity} onChange={(e) => set("severity", e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>

          {error && <div className="sm:col-span-2 text-sm text-red">{error}</div>}

          <div className="sm:col-span-2 flex justify-end pt-2 border-t border-border mt-2">
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? "Running pipeline…" : "Submit claim"}
            </button>
          </div>
        </form>
      </Card>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 14px;
          background: var(--surface);
          color: var(--ink);
        }
        .btn-primary {
          background: var(--teal);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-muted block mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function NewClaimPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <NewClaimInner />
      </Suspense>
    </AppShell>
  );
}
