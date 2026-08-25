import { NextRequest, NextResponse } from "next/server";
import { getOrganization, listClaims } from "@/lib/repo";
import { expectedLossFor } from "@/lib/seed-data";
import { parseDbTimestamp } from "@/lib/timestamps";

/**
 * Every number here is computed from real rows in the database at request
 * time — no pseudo-random hash standing in for "actual hours elapsed" like
 * the earlier version had. SLA status is genuinely (now - created_at) vs.
 * sla_hours. Fraud flags come from the fraud_score column set by the real
 * pipeline at intake. Leakage proxy compares stored estimated_loss against
 * the same expected-loss table the fraud model itself uses.
 */
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) return NextResponse.json({ error: "org query param required" }, { status: 400 });

  const org = await getOrganization(orgId);
  if (!org) return NextResponse.json({ error: "Unknown organization" }, { status: 404 });

  const claims = await listClaims(orgId);
  const now = Date.now();

  const rows = claims.map((c) => {
    const createdMs = parseDbTimestamp(c.created_at).getTime();
    const actualHours = Math.round((now - createdMs) / (3600 * 1000));
    const breached = !["approved", "rejected"].includes(c.status) && actualHours > c.sla_hours;
    const closed = ["approved", "rejected"].includes(c.status);
    return { claim: c, actualHours, breached, closed };
  });

  const open = rows.filter((r) => !r.closed).length;
  const closed = rows.filter((r) => r.closed).length;
  const slaBreaches = rows.filter((r) => r.breached).length;
  const slaCompliance = rows.length ? Math.round(((rows.length - slaBreaches) / rows.length) * 1000) / 10 : 100;
  const avgCycleDays = rows.reduce((s, r) => s + r.actualHours, 0) / (rows.length || 1) / 24;

  const totalEstimated = rows.reduce((s, r) => s + r.claim.estimated_loss, 0);
  const leakage =
    rows.reduce((s, r) => s + Math.max(0, r.claim.estimated_loss - expectedLossFor(r.claim.claim_type)), 0) /
    (totalEstimated || 1);

  const byType = new Map<string, number>();
  rows.forEach((r) => byType.set(r.claim.claim_type, (byType.get(r.claim.claim_type) ?? 0) + r.claim.estimated_loss));

  return NextResponse.json({
    organization: org,
    open,
    closed,
    slaCompliance,
    avgCycleDays,
    leakage,
    fraudFlags: claims.filter((c) => c.human_review_required || (c.fraud_score ?? 0) > org.fraud_threshold).length,
    byType: Array.from(byType.entries()).map(([type, value]) => ({ type: type.replace(/_/g, " "), value })),
    slaRows: rows.map((r) => ({
      claimId: r.claim.id,
      slaHours: r.claim.sla_hours,
      actualHours: r.actualHours,
      breached: r.breached,
      status: r.claim.status,
    })),
  });
}
