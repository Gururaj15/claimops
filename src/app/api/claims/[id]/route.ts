import { NextRequest, NextResponse } from "next/server";
import { addClaimEvent, getClaim, listClaimEvents, listRules, updateClaimStatus } from "@/lib/repo";
import { assessFraud } from "@/lib/fraud-model";
import { assessCoverage } from "@/lib/coverage-assistant";
import { evaluateRules, resolveActions } from "@/lib/rules-engine";
import { expectedLossFor } from "@/lib/seed-data";
import { ClaimStatusUpdateSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  const fraud = assessFraud(claim, expectedLossFor(claim.claim_type));
  const coverage = await assessCoverage(claim);
  const rules = await listRules(claim.organization_id);
  const triggers = evaluateRules(claim, fraud, rules);
  const actions = resolveActions(triggers);
  const events = await listClaimEvents(claim.id);

  return NextResponse.json({ claim, fraud, coverage, triggers, actions, events });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  const body = await req.json();
  const parsed = ClaimStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await updateClaimStatus(id, parsed.data.status);
  await addClaimEvent(id, `Claim ${parsed.data.status.replace(/_/g, " ")}`, parsed.data.actor);

  return NextResponse.json({ claim: await getClaim(id) });
}
