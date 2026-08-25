import { NextRequest, NextResponse } from "next/server";
import { handleClaimIntake } from "@/lib/intake";

/**
 * Real CSV intake: parses actual CSV text (no library needed for this
 * shape — plain split/trim is enough and avoids adding a dependency for
 * something this small). Expects a header row matching the canonical
 * schema field names. Each row runs through the same handleClaimIntake as
 * every other channel, so a malformed row fails independently without
 * aborting the whole batch.
 *
 * Example body (Content-Type: text/csv):
 * organization_id,claim_type,policyholder_name,policy_id,loss_date,estimated_loss,repair_cost,policy_age_days,previous_claims_count,days_since_policy_start,document_anomaly_score,geography,severity
 * org_acme,water_damage,Jane Doe,POL-1,2026-08-01,15000,14000,300,0,300,0.1,Texas,medium
 */
export async function POST(req: NextRequest) {
  const text = await req.text();
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV needs a header row and at least one data row" }, { status: 400 });
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const results: { row: number; ok: boolean; claimId?: string; error?: unknown }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => (record[h] = cells[idx]));

    const result = handleClaimIntake(record, "csv");
    if (result.ok) {
      results.push({ row: i, ok: true, claimId: result.claim.id });
    } else {
      results.push({ row: i, ok: false, error: result.error });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({ succeeded, failed: results.length - succeeded, results });
}
