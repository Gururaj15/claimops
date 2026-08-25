import type { Claim } from "./types";
import { assessFraud } from "./fraud-model";
import { assessCoverage } from "./coverage-assistant";
import { evaluateRules, resolveActions } from "./rules-engine";
import { assignClaim } from "./assignment-engine";
import { expectedLossFor } from "./seed-data";
import {
  addClaimEvent,
  getOrganization,
  incrementAdjusterWorkload,
  listAdjusters,
  listRules,
  setClaimFraudScore,
  updateClaimStatus,
} from "./repo";

/**
 * The "AI + Rules + Workflow" pipeline, executed server-side when a claim
 * is created — not computed lazily in the browser on render. Every step
 * writes a row to claim_events, so the timeline on the claim detail page
 * reflects what the system actually did, in order.
 *
 * Async throughout because every database call now goes over the network
 * to Postgres rather than hitting a local file — the steps still run in
 * the same order, each one awaited before the next starts.
 */
export async function runIntakePipeline(claim: Claim) {
  await addClaimEvent(claim.id, "FNOL received", "policyholder");

  const org = await getOrganization(claim.organization_id);
  if (!org) throw new Error("Unknown organization");

  await addClaimEvent(claim.id, "Policy matched", "system", `Policy ${claim.policy_id}`);

  const coverage = await assessCoverage(claim);
  await addClaimEvent(claim.id, "Coverage analysis complete", "system", coverage.verdict);

  const fraud = assessFraud(claim, expectedLossFor(claim.claim_type));
  await setClaimFraudScore(claim.id, fraud.score, fraud.score > org.fraud_threshold);
  await addClaimEvent(
    claim.id,
    "Fraud score generated",
    "system",
    `${Math.round(fraud.score * 100)}% (XGBoost, ${fraud.contributions.length} features)`
  );

  const rules = await listRules(claim.organization_id);
  const triggers = evaluateRules(claim, fraud, rules);
  const actions = resolveActions(triggers);
  await addClaimEvent(
    claim.id,
    "Rule engine executed",
    "system",
    `${triggers.filter((t) => t.matched).length} rule(s) matched: ${actions.join(", ") || "none"}`
  );

  const requiresHumanReview =
    actions.includes("require_human_review") || fraud.score > org.fraud_threshold;
  const routeToSiu = actions.includes("route_to_siu");

  let status: Claim["status"] = "new";
  let assignedTo: string | null = null;

  if (routeToSiu) {
    status = "siu_review";
    await addClaimEvent(claim.id, "Routed to SIU", "system");
  } else if (actions.includes("request_additional_documents")) {
    status = "pending_information";
    await addClaimEvent(claim.id, "Additional documents requested", "system");
  } else {
    // SIU is a specialist queue reached only via an explicit "route_to_siu"
    // rule action above, not a candidate in ordinary smart-assignment ranking.
    const allAdjusters = await listAdjusters(claim.organization_id);
    const adjusters = allAdjusters.filter((a) => a.name !== "SIU Team");
    const assignment = assignClaim(claim, adjusters, fraud.score);
    if (assignment.adjuster) {
      assignedTo = assignment.adjuster.name;
      await incrementAdjusterWorkload(assignment.adjuster.id, 1);
      await addClaimEvent(
        claim.id,
        "Smart assignment routed claim",
        "system",
        `${assignment.adjuster.name} (score ${assignment.score}) — ${assignment.reasoning.join("; ")}`
      );
    }
    status = "in_review";
  }

  await updateClaimStatus(claim.id, status, assignedTo);

  if (requiresHumanReview) {
    await addClaimEvent(claim.id, "Human review requested", "system");
  }

  return { fraud, coverage, triggers, actions, status, assignedTo };
}
