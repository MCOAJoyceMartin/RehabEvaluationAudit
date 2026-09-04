import type { AuditCriterionResult, AuditStatus, AuditTotals, RehabAuditResult } from "../../types/audit";
import type { ReviewerOverride } from "../../state/reviewerOverrides";
import { overrideKey } from "../../state/reviewerOverrides";

/**
 * A reviewer override always wins over the AI's original score and status
 * for every downstream calculation and display — the criterion card's own
 * badge/score, the header summary's overall score and pass/partial/fail
 * counts, and the printed/exported report's "Overall Score" section all go
 * through this same module. Before this existed, an override only changed
 * the little "Reviewer override" panel at the bottom of one criterion card
 * — the AI's original score kept driving every total above it, so a
 * reviewer could override "Unable to Validate" to a passing score and the
 * overall percentage/pass-fail counts would never move. That's the bug
 * this file fixes: one effective-score rule, applied everywhere a score or
 * status is shown to a human.
 *
 * Score -> status derivation (when an override sets a score but not an
 * explicit status) mirrors the same rule the audit engine itself uses when
 * it first scores a criterion (see AuditEngine.ts's `base()` callers): full
 * points is PASS, zero is FAIL, anything in between is PARTIAL. This keeps
 * a reviewer-overridden criterion consistent with how every AI-scored
 * criterion in the same report is judged.
 */
export function deriveStatusFromScore(score: number, maxPoints: number): AuditStatus {
  if (maxPoints <= 0) return score > 0 ? "PASS" : "FAIL";
  if (score >= maxPoints) return "PASS";
  if (score <= 0) return "FAIL";
  return "PARTIAL";
}

export interface EffectiveCriterion {
  /** The score to display/count everywhere: the override's score if one was
   *  set, otherwise the AI's original score. */
  score: number | null;
  /** The status to display/count everywhere: an explicit override status if
   *  given, else derived from the override's score, else the AI's original
   *  status. */
  status: AuditStatus;
  /** True when a reviewer override is actually changing what's shown for
   *  this criterion (a note-only / marked-only override with no score set
   *  does not count — nothing to recalculate in that case). */
  isOverridden: boolean;
}

/** The score/status actually in effect for one criterion, after applying
 *  any reviewer override for it. Every place that shows a criterion's score
 *  or status to a human should read it through here rather than straight
 *  off `AuditCriterionResult`, so a reviewer override can never silently
 *  disagree with what the rest of the app displays for the same criterion. */
export function getEffectiveCriterion(a: AuditCriterionResult, override?: ReviewerOverride): EffectiveCriterion {
  if (override && override.overriddenScore !== null) {
    const score = override.overriddenScore;
    return {
      score,
      status: override.overriddenStatus ?? deriveStatusFromScore(score, a.maxPoints),
      isOverridden: true,
    };
  }
  return { score: a.score, status: a.status, isOverridden: false };
}

/** Recomputes every aggregate total for one discipline's audit — earned,
 *  possible, percentage, pass/partial/fail/unable-to-validate counts, and
 *  the excluded-opportunity figures — the same way `computeTotals` in
 *  RehabAuditPipeline.ts does for the AI's first pass, but using each
 *  criterion's EFFECTIVE (post-override) score and status. A criterion a
 *  reviewer overrides out of "Unable to Validate" or "Pending Rubric
 *  Confirmation" (by giving it a real score) moves into the scored set here
 *  exactly as if the AI had scored it that way to begin with — which is
 *  what lets it count toward the score at all. This is the version that
 *  should drive every score display a human reviewer sees. */
export function computeEffectiveTotals(result: RehabAuditResult, overrides: Record<string, ReviewerOverride>): AuditTotals {
  const effective = result.audit.map((a) => ({
    a,
    eff: getEffectiveCriterion(a, overrides[overrideKey(result.discipline, a.criterionId)]),
  }));

  const scored = effective.filter(
    ({ eff }) => eff.status !== "N/A" && eff.status !== "UNABLE_TO_VALIDATE" && eff.status !== "PENDING_RUBRIC_CONFIRMATION",
  );
  const unable = effective.filter(({ eff }) => eff.status === "UNABLE_TO_VALIDATE");
  const pending = effective.filter(({ eff }) => eff.status === "PENDING_RUBRIC_CONFIRMATION");

  const earned = scored.reduce((s, { eff }) => s + (eff.score ?? 0), 0);
  const possible = scored.reduce((s, { a }) => s + a.maxPoints, 0);

  return {
    earned,
    possible,
    percentage: possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0,
    passed: effective.filter(({ eff }) => eff.status === "PASS").length,
    partial: effective.filter(({ eff }) => eff.status === "PARTIAL").length,
    failed: effective.filter(({ eff }) => eff.status === "FAIL").length,
    unableToValidate: unable.length,
    scoredOpportunity: possible,
    externalValidationOpportunity: unable.reduce((s, { a }) => s + a.maxPoints, 0),
    externalValidationCriteriaCount: unable.length,
    pendingRubricConfirmation: pending.length,
    pendingRubricConfirmationOpportunity: pending.reduce((s, { a }) => s + a.maxPoints, 0),
    pendingRubricConfirmationCriteriaCount: pending.length,
  };
}

/** True if applying overrides actually changed the overall totals — used to
 *  decide whether to show an "adjusted from the AI's original score" note
 *  next to the recalculated score, so the AI's original figure is never
 *  silently dropped from the record. */
export function totalsWereAdjusted(original: AuditTotals, effective: AuditTotals): boolean {
  return (
    original.earned !== effective.earned ||
    original.possible !== effective.possible ||
    original.passed !== effective.passed ||
    original.partial !== effective.partial ||
    original.failed !== effective.failed ||
    original.unableToValidate !== effective.unableToValidate ||
    original.pendingRubricConfirmation !== effective.pendingRubricConfirmation
  );
}
