"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel } from "@/components/ui";
import { SAMPLE_SCHEMA_MAPPING } from "@/lib/seed-data";
import { Check, ArrowRight, Sparkles } from "lucide-react";

type Step = 0 | 1 | 2 | 3;

const STEPS = ["Program details", "Connect data", "Map schema", "Go live"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [programName, setProgramName] = useState("Meridian Mutual");
  const [line, setLine] = useState("Commercial Auto");
  const [slaHours, setSlaHours] = useState(48);
  const [fraudThreshold, setFraudThreshold] = useState(0.7);
  const [claimsSource, setClaimsSource] = useState("CSV upload");
  const [policySource, setPolicySource] = useState("JSON API");
  const [approved, setApproved] = useState<Record<string, boolean>>(
    Object.fromEntries(SAMPLE_SCHEMA_MAPPING.map((m) => [m.sourceField, true]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function goLive() {
    setSubmitting(true);
    setApiError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: programName,
          line_of_business: line,
          sla_hours: slaHours,
          fraud_threshold: fraudThreshold,
          high_value_threshold: 25000,
          required_documents: ["Invoice", "Photos", "Policy"],
          claims_source: claimsSource,
          policy_source: policySource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(JSON.stringify(data.error));
      } else {
        setCreatedOrgId(data.organization.id);
      }
    } catch {
      setApiError("Network error — is the dev server running?");
    }
    setSubmitting(false);
    setStep(3);
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <SectionLabel>Implementation Engineer workspace</SectionLabel>
        <h1 className="font-display text-2xl font-semibold mb-1">
          Onboard a new insurance program
        </h1>
        <p className="text-ink-muted text-sm mb-8 max-w-2xl">
          This is the workflow behind every tenant on the platform — the same
          steps that turned Acme Insurance and Voyage Travel into fully
          configured programs you can see in the Claims Queue and Dashboard.
        </p>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-mono font-medium border ${
                  i < step
                    ? "bg-teal border-teal text-white"
                    : i === step
                    ? "border-teal text-teal"
                    : "border-border text-ink-muted"
                }`}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  i <= step ? "text-ink" : "text-ink-muted"
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border mx-1" />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card className="p-6">
            <h2 className="font-display font-semibold mb-4">Program details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Program name">
                <input
                  className="input"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                />
              </Field>
              <Field label="Line of business">
                <input
                  className="input"
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                />
              </Field>
              <Field label="SLA target (hours)">
                <input
                  type="number"
                  className="input"
                  value={slaHours}
                  onChange={(e) => setSlaHours(Number(e.target.value))}
                />
              </Field>
              <Field label="Fraud review threshold">
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  className="input"
                  value={fraudThreshold}
                  onChange={(e) => setFraudThreshold(Number(e.target.value))}
                />
              </Field>
            </div>
            <StepFooter onNext={() => setStep(1)} />
          </Card>
        )}

        {step === 1 && (
          <Card className="p-6">
            <h2 className="font-display font-semibold mb-4">Connect data sources</h2>
            <p className="text-sm text-ink-muted mb-4">
              Every insurer sends claims and policy data differently. Pick what
              this program uses today — the schema mapper in the next step
              adapts to whatever format you choose.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Claims source">
                <select
                  className="input"
                  value={claimsSource}
                  onChange={(e) => setClaimsSource(e.target.value)}
                >
                  <option>CSV upload</option>
                  <option>JSON API</option>
                  <option>Webhook</option>
                  <option>Legacy XML feed</option>
                  <option>Email attachment</option>
                </select>
              </Field>
              <Field label="Policy source">
                <select
                  className="input"
                  value={policySource}
                  onChange={(e) => setPolicySource(e.target.value)}
                >
                  <option>JSON API</option>
                  <option>CSV upload</option>
                  <option>Legacy XML feed</option>
                  <option>Direct database link</option>
                </select>
              </Field>
            </div>
            <StepFooter onBack={() => setStep(0)} onNext={() => setStep(2)} />
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-teal" />
              <h2 className="font-display font-semibold">Schema mapper</h2>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              Suggested mappings from {programName}&apos;s source fields to the
              ClaimOps canonical schema. Confidence is a simple field-name
              similarity score in this prototype — review and approve each one.
            </p>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 px-4 py-2 bg-surface-sunken text-xs font-mono uppercase tracking-wider text-ink-muted">
                <div>Source field</div>
                <div></div>
                <div>Canonical field</div>
                <div>Confidence</div>
                <div>Approve</div>
              </div>
              {SAMPLE_SCHEMA_MAPPING.map((m) => (
                <div
                  key={m.sourceField}
                  className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 px-4 py-3 border-t border-border items-center text-sm"
                >
                  <div className="font-mono text-ink-muted">{m.sourceField}</div>
                  <ArrowRight size={14} className="text-ink-muted" />
                  <div className="font-mono">{m.targetField}</div>
                  <div
                    className={
                      m.confidence > 0.95
                        ? "text-teal font-medium"
                        : m.confidence > 0.9
                        ? "text-amber font-medium"
                        : "text-ink-muted font-medium"
                    }
                  >
                    {Math.round(m.confidence * 100)}%
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--teal)]"
                    checked={approved[m.sourceField]}
                    onChange={(e) =>
                      setApproved((prev) => ({
                        ...prev,
                        [m.sourceField]: e.target.checked,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <StepFooter onBack={() => setStep(1)} onNext={goLive} nextLabel={submitting ? "Creating program…" : "Create program & go live"} />
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Check size={18} className="text-teal" />
              <h2 className="font-display font-semibold">
                {programName} is live
              </h2>
            </div>
            {createdOrgId ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <SummaryRow label="Organization ID" value={createdOrgId} />
                  <SummaryRow label="Line of business" value={line} />
                  <SummaryRow label="SLA target" value={`${slaHours} hours`} />
                  <SummaryRow
                    label="Fraud review threshold"
                    value={`${Math.round(fraudThreshold * 100)}%`}
                  />
                  <SummaryRow label="Claims source" value={claimsSource} />
                  <SummaryRow label="Policy source" value={policySource} />
                </div>
                <p className="text-sm text-ink-muted mt-6 leading-relaxed">
                  This actually created a new row in the <code className="font-mono text-xs bg-surface-sunken px-1 py-0.5 rounded">organizations</code> table
                  via <code className="font-mono text-xs bg-surface-sunken px-1 py-0.5 rounded">POST /api/organizations</code> — it&apos;s a real
                  tenant now. It has no rules or claims yet; add rules on the Rules page, then submit or import claims and
                  they&apos;ll run through the same pipeline as every other tenant.
                </p>
                <div className="mt-6 flex gap-3 flex-wrap">
                  <a href={`/rules?org=${createdOrgId}`} className="btn-primary">
                    Configure rules for {programName}
                  </a>
                  <a href={`/adjuster/new?org=${createdOrgId}`} className="btn-secondary">
                    Submit a test claim
                  </a>
                  <button onClick={() => { setStep(0); setCreatedOrgId(null); }} className="btn-secondary">
                    Start another program
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-red">{apiError ?? "Something went wrong creating the program."}</p>
            )}
          </Card>
        )}
      </div>

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
        .input:focus {
          outline: none;
          border-color: var(--teal);
          box-shadow: 0 0 0 3px var(--teal-soft);
        }
        .btn-primary {
          background: var(--teal);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }
        .btn-secondary {
          background: var(--surface-sunken);
          color: var(--ink);
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }
      `}</style>
    </AppShell>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StepFooter({
  onBack,
  onNext,
  nextLabel = "Continue",
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="flex justify-between mt-6 pt-4 border-t border-border">
      {onBack ? (
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
      ) : (
        <span />
      )}
      <button onClick={onNext} className="btn-primary">
        {nextLabel}
      </button>
    </div>
  );
}
