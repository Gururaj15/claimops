import type { Claim, CoverageAssessment } from "./types";

/**
 * PROTOTYPE NOTE (read this before assuming it's a live LLM call):
 * This is deliberately NOT wired to a hosted LLM. A real Coverage
 * Intelligence Engine would run retrieval over the tenant's uploaded policy
 * PDFs (endorsements, exclusions, schedules) and pass the retrieved clauses
 * + claim facts to a model, with the output still gated behind mandatory
 * human review (see /docs/07-architecture-decisions.md for why the LLM never
 * auto-decides). Standing up that pipeline needs a paid LLM API key, which
 * conflicts with the $0 constraint on this build, so this module encodes the
 * same clause-matching logic against a small library of realistic sample
 * policy clauses instead. Swapping this function's body for a real
 * retrieval + generation call is the only change needed to go from
 * prototype to production — the calling code (claim detail page) doesn't
 * change.
 */

type ClauseLibraryEntry = {
  claimTypes: string[];
  verdict: CoverageAssessment["verdict"];
  clauses: string[];
  exclusion: string | null;
  reasoning: string;
};

const CLAUSE_LIBRARY: ClauseLibraryEntry[] = [
  {
    claimTypes: ["water_damage"],
    verdict: "likely_covered",
    clauses: ["Section 4.2 — Sudden and Accidental Water Discharge", "Section 7.1 — Interior Property Damage"],
    exclusion: "Section 4.5 — Gradual Leakage or Seepage Exclusion may apply if onset predates policy period",
    reasoning:
      "Sudden, accidental discharge from a plumbing failure falls under the named-peril water damage clause. Gradual leakage over time is carved out separately and would need adjuster confirmation of onset date.",
  },
  {
    claimTypes: ["fire"],
    verdict: "likely_covered",
    clauses: ["Section 3.1 — Fire and Lightning", "Section 7.3 — Smoke Damage to Contents"],
    exclusion: "Section 3.4 — Intentional Acts Exclusion",
    reasoning:
      "Fire is a named peril under the base form. Coverage holds unless investigation finds evidence of intentional cause, which would trigger the exclusion.",
  },
  {
    claimTypes: ["theft"],
    verdict: "needs_review",
    clauses: ["Section 5.2 — Theft of Property", "Section 5.6 — Proof of Forced Entry Requirement"],
    exclusion: "Section 5.7 — Unattended Vehicle Exclusion",
    reasoning:
      "Theft is covered but the policy requires evidence of forced entry for full limits. Without a police report or forced-entry evidence on file, this needs adjuster review before a verdict.",
  },
  {
    claimTypes: ["liability", "bodily_injury"],
    verdict: "needs_review",
    clauses: ["Section 8.1 — General Liability Coverage", "Section 8.4 — Third-Party Bodily Injury"],
    exclusion: "Section 8.9 — Professional Services Exclusion",
    reasoning:
      "Liability claims carry higher exposure and a professional-services carve-out that needs a facts-of-loss review before any coverage determination is finalized.",
  },
  {
    claimTypes: ["wind_hail", "weather"],
    verdict: "likely_covered",
    clauses: ["Section 3.6 — Windstorm and Hail", "Section 7.1 — Interior Property Damage"],
    exclusion: "Section 3.8 — Flood Exclusion (flood requires separate policy)",
    reasoning:
      "Wind and hail are named perils. If the loss narrative mentions rising water rather than wind-driven rain, the flood exclusion would need to be checked separately.",
  },
];

const DEFAULT_ENTRY: ClauseLibraryEntry = {
  claimTypes: [],
  verdict: "needs_review",
  clauses: ["Section 1.1 — General Coverage Grant"],
  exclusion: "No specific exclusion matched — manual policy review recommended",
  reasoning:
    "This claim type doesn't match a clause pattern in the sample library. In production this would fall through to full-document retrieval instead of a template match.",
};

export function assessCoverage(claim: Claim): CoverageAssessment {
  const entry =
    CLAUSE_LIBRARY.find((e) => e.claimTypes.includes(claim.claim_type)) ?? DEFAULT_ENTRY;

  // Confidence is nudged by document anomaly score and claim type match, to keep
  // the number connected to actual claim data rather than a static constant.
  const baseConfidence = entry === DEFAULT_ENTRY ? 0.4 : 0.87;
  const confidence = Math.max(
    0.3,
    Math.min(0.97, baseConfidence - claim.document_anomaly_score * 0.25)
  );

  return {
    verdict: entry.verdict,
    relevantClauses: entry.clauses,
    exclusion: entry.exclusion,
    deductible: 2500,
    coverageLimit: claim.estimated_loss > 60000 ? 250000 : 100000,
    confidence,
    reasoning: entry.reasoning,
  };
}
