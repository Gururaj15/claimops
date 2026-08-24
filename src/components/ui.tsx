import { ReactNode } from "react";
import type { ClaimStatus } from "@/lib/types";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg shadow-[0_1px_2px_rgba(16,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-2">
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<ClaimStatus, { bg: string; text: string; label: string }> = {
  new: { bg: "bg-surface-sunken", text: "text-ink-muted", label: "New" },
  pending_information: { bg: "bg-amber-soft", text: "text-amber", label: "Pending Info" },
  in_review: { bg: "bg-teal-soft", text: "text-teal", label: "In Review" },
  approved: { bg: "bg-teal-soft", text: "text-teal", label: "Approved" },
  rejected: { bg: "bg-red-soft", text: "text-red", label: "Rejected" },
  siu_review: { bg: "bg-red-soft", text: "text-red", label: "SIU Review" },
};

export function StatusPill({ status }: { status: ClaimStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-teal",
    warn: "text-amber",
    bad: "text-red",
  }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`font-display text-3xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </Card>
  );
}
