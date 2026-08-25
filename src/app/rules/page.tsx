"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel } from "@/components/ui";
import type { Rule, RuleCondition } from "@/lib/types";
import { Trash2, Plus } from "lucide-react";

const FIELDS = ["estimated_loss", "repair_cost", "previous_claims_count", "document_anomaly_score", "fraud_score", "days_since_policy_start", "claim_type"];
const OPERATORS = [">", "<", ">=", "<=", "==", "!="] as const;
const ACTIONS = ["assign_senior_adjuster", "require_human_review", "priority_high", "route_to_siu", "request_additional_documents", "status_pending_information"];

function emptyCondition(): RuleCondition {
  return { field: "estimated_loss", operator: ">", value: 25000 };
}

function RulesInner() {
  const params = useSearchParams();
  const orgId = params.get("org");
  const [rules, setRules] = useState<Rule[] | null>(null);

  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<RuleCondition[]>([emptyCondition()]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [priority, setPriority] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    if (!orgId) return;
    fetch(`/api/rules?org=${orgId}`)
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []));
  }

  useEffect(load, [orgId]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!name || selectedActions.length === 0) return;
    setSubmitting(true);
    await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: orgId, name, conditions, actions: selectedActions, priority }),
    });
    setName("");
    setConditions([emptyCondition()]);
    setSelectedActions([]);
    setSubmitting(false);
    load();
  }

  async function toggleEnabled(rule: Rule) {
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <SectionLabel>Rules builder</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Configure the rules engine</h1>
      <p className="text-ink-muted text-sm mb-6">
        These are real rows in the <code className="font-mono text-xs bg-surface-sunken px-1 rounded">rules</code> table —
        every claim submitted for this tenant is evaluated against exactly what&apos;s listed below, live.
      </p>

      <Card className="p-5 mb-6">
        <h2 className="font-display font-semibold mb-3">Existing rules</h2>
        <div className="space-y-2">
          {rules === null && <div className="text-sm text-ink-muted">Loading…</div>}
          {rules?.length === 0 && <div className="text-sm text-ink-muted">No rules yet for this tenant.</div>}
          {rules?.map((r) => (
            <div key={r.id} className="border border-border rounded-md p-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-ink-muted font-mono mt-1">
                  IF {r.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(" AND ")}
                </div>
                <div className="text-xs text-ink-muted mt-1">THEN {r.actions.join(", ")}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleEnabled(r)}
                  className={`text-xs font-medium px-2 py-1 rounded ${r.enabled ? "bg-teal-soft text-teal" : "bg-surface-sunken text-ink-muted"}`}
                >
                  {r.enabled ? "Enabled" : "Disabled"}
                </button>
                <button onClick={() => remove(r.id)} className="text-red hover:opacity-70">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-semibold mb-3">New rule</h2>
        <form onSubmit={createRule} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted block mb-1">Rule name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High Value Commercial Claim" />
          </label>

          <div>
            <span className="text-xs font-medium text-ink-muted block mb-2">Conditions (all must match)</span>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs font-mono text-ink-muted w-8">{i === 0 ? "IF" : "AND"}</span>
                  <select
                    className="input"
                    value={c.field}
                    onChange={(e) => setConditions((cs) => cs.map((cc, idx) => (idx === i ? { ...cc, field: e.target.value } : cc)))}
                  >
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    className="input w-20"
                    value={c.operator}
                    onChange={(e) => setConditions((cs) => cs.map((cc, idx) => (idx === i ? { ...cc, operator: e.target.value as any } : cc)))}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    value={c.value}
                    onChange={(e) => setConditions((cs) => cs.map((cc, idx) => (idx === i ? { ...cc, value: e.target.value } : cc)))}
                  />
                  {conditions.length > 1 && (
                    <button type="button" onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))} className="text-red">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
                className="text-xs text-teal font-medium flex items-center gap-1"
              >
                <Plus size={12} /> Add condition
              </button>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-ink-muted block mb-2">Actions (THEN)</span>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <label key={a} className={`text-xs px-2.5 py-1.5 rounded-md border cursor-pointer ${selectedActions.includes(a) ? "bg-teal-soft border-teal text-teal" : "border-border text-ink-muted"}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selectedActions.includes(a)}
                    onChange={(e) =>
                      setSelectedActions((prev) => (e.target.checked ? [...prev, a] : prev.filter((x) => x !== a)))
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <label className="block max-w-[160px]">
            <span className="text-xs font-medium text-ink-muted block mb-1">Priority (lower runs first)</span>
            <input type="number" className="input" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </label>

          <div className="pt-2 border-t border-border flex justify-end">
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? "Saving…" : "Create rule"}
            </button>
          </div>
        </form>
      </Card>

      <style jsx global>{`
        .input {
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 13px;
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

export default function RulesPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <RulesInner />
      </Suspense>
    </AppShell>
  );
}
