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
 * This is the actual "AI + Rules + Workflow" pipeline from the original
 * spec, executed server-side when a claim is created — not computed lazily
 * in the browser on render. Every step below writes a real row to
 * claim_events, so the timeline on the claim detail page reflects what the
 * system actually did, in order, not a static seeded list.
 */
export function runIntakePipeline(claim: Claim) {
  addClaimEvent(claim.id, "FNOL received", "policyholder");

  const org = getOrganization(claim.organization_id);
  if (!org) throw new Error("Unknown organization");

  addClaimEvent(claim.id, "Policy matched", "system", `Policy ${claim.policy_id}`);

  const coverage = assessCoverage(claim);
  addClaimEvent(claim.id, "Coverage analysis complete", "system", coverage.verdict);

  const fraud = assessFraud(claim, expectedLossFor(claim.claim_type));
  setClaimFraudScore(claim.id, fraud.score, fraud.score > org.fraud_threshold);
  addClaimEvent(
    claim.id,
    "Fraud score generated",
    "system",
    `${Math.round(fraud.score * 100)}% (XGBoost, ${fraud.contributions.length} features)`
  );

  const rules = listRules(claim.organization_id);
  const triggers = evaluateRules(claim, fraud, rules);
  const actions = resolveActions(triggers);
  addClaimEvent(
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
    addClaimEvent(claim.id, "Routed to SIU", "system");
  } else if (actions.includes("request_additional_documents")) {
    status = "pending_information";
    addClaimEvent(claim.id, "Additional documents requested", "system");
  } else {
    // SIU is a specialist queue reached only via an explicit "route_to_siu"
    // rule action above, not a candidate in ordinary smart-assignment ranking.
    const adjusters = listAdjusters(claim.organization_id).filter((a) => a.name !== "SIU Team");
    const assignment = assignClaim(claim, adjusters, fraud.score);
    if (assignment.adjuster) {
      assignedTo = assignment.adjuster.name;
      incrementAdjusterWorkload(assignment.adjuster.id, 1);
      addClaimEvent(
        claim.id,
        "Smart assignment routed claim",
        "system",
        `${assignment.adjuster.name} (score ${assignment.score}) — ${assignment.reasoning.join("; ")}`
      );
    }
    status = requiresHumanReview ? "in_review" : "in_review";
  }

  updateClaimStatus(claim.id, status, assignedTo);

  if (requiresHumanReview) {
    addClaimEvent(claim.id, "Human review requested", "system");
  }

  return { fraud, coverage, triggers, actions, status, assignedTo };
}
