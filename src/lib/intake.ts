import { createClaim, getClaim, getOrganization } from "./repo";
import { ClaimIntakeSchema } from "./validation";
import { runIntakePipeline } from "./pipeline";

export type IntakeResult =
  | { ok: true; claim: ReturnType<typeof createClaim>; fraud: any; coverage: any; actions: string[]; status: string; assignedTo: string | null }
  | { ok: false; status: number; error: unknown };

/**
 * One canonical intake path, called by every channel (web form, JSON API,
 * CSV bulk upload, webhook). This is the actual point of a canonical
 * schema — four "different source formats" from the original spec all
 * normalize down to this one function and one pipeline run, rather than
 * four separate hand-rolled code paths that happen to look similar.
 */
export function handleClaimIntake(rawBody: unknown, source: string): IntakeResult {
  const parsed = ClaimIntakeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.flatten() };
  }

  const org = getOrganization(parsed.data.organization_id);
  if (!org) {
    return { ok: false, status: 404, error: "Unknown organization_id" };
  }

  const claim = createClaim({
    ...parsed.data,
    status: "new",
    assigned_to: null,
    sla_hours: org.sla_hours,
    source,
  });

  const result = runIntakePipeline(claim);

  // Re-fetch rather than patch the in-memory object: the pipeline writes
  // fraud_score, human_review_required, status, and assigned_to as separate
  // UPDATE statements, so the object captured before the pipeline ran is
  // stale by the time we respond. Caught this exact bug via a manual API
  // test (fraud_score showed null in the response despite a 98% score being
  // stored) — worth leaving this comment so it doesn't regress.
  const freshClaim = getClaim(claim.id)!;

  return {
    ok: true,
    claim: freshClaim,
    fraud: result.fraud,
    coverage: result.coverage,
    actions: result.actions,
    status: result.status,
    assignedTo: result.assignedTo,
  };
}
