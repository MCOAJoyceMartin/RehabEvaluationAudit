import type { ExtractedEvaluation } from "../extraction/extractionTypes";
import type {
  AdditionalFinding,
  AuditCriterionResult,
  DocumentationSimilarityFinding,
  FrequencyAnalysis,
  FunctionalChangeRow,
  GoalAnalysis,
  GoalLifecycleRecord,
  SimilarityDimension,
  StrengthFinding,
  TopOpportunity,
} from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";

/**
 * FindingsEngine
 * ===============
 * Produces the non-scored "quality check" layer required by the spec:
 * ADDITIONAL DOCUMENTATION FINDINGS, WHAT WAS DONE WELL (strengths), TOP
 * DOCUMENTATION OPPORTUNITIES, and supplementary CORRECTIVE ACTIONS. None
 * of this affects the official Key score — it surfaces patterns
 * (repetition, missing signature, generic language, inconsistencies,
 * over-treatment, frequency variance) for reviewer attention.
 *
 * v2 note: the goal-lifecycle / treatment-frequency / documentation
 * -similarity engines primarily feed individual SCORED criteria (see
 * DN_LINKED_TO_GOALS, DN_DISCONTINUE_WHEN_MET, PN_TREATMENT_FREQUENCY,
 * DN_ATTENDANCE_COMPLIANCE, DN_PATIENT_RESPONSE in AuditEngine.ts) — this
 * layer adds EPISODE-LEVEL, aggregate findings on top of that (e.g. "N of M
 * weeks deviated" rather than one week's score), which a single criterion's
 * per-period comment doesn't surface on its own. Some overlap with a
 * criterion's own auditorComment is expected and intentional, the same way
 * the pre-existing "Missing frequency" finding already overlapped with a
 * scored criterion — this layer is a supplementary QA pass, not a
 * replacement for reading the scored criteria themselves.
 */

let findingCounter = 0;
function nextId(prefix: string): string {
  findingCounter += 1;
  return `${prefix}-${findingCounter}`;
}

function dimensionLabel(dim: SimilarityDimension): string {
  return dim.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function buildAdditionalFindings(
  extracted: ExtractedEvaluation,
  functionalChange: FunctionalChangeRow[],
  documentationSimilarity: DocumentationSimilarityFinding[] = [],
  goalLifecycle: GoalLifecycleRecord[] = [],
  frequencyAnalysis: FrequencyAnalysis[] = [],
): AdditionalFinding[] {
  const findings: AdditionalFinding[] = [];

  if (extracted.therapistSignatureDate === NOT_FOUND) {
    findings.push({ id: nextId("finding"), category: "Missing signature", description: "No evaluating therapist signature/date could be identified.", evidence: [], confidence: "MEDIUM" });
  }
  if (extracted.frequency === NOT_FOUND) {
    findings.push({ id: nextId("finding"), category: "Missing frequency", description: "No treatment frequency was identified on the Plan of Treatment.", evidence: [], confidence: "MEDIUM" });
  }
  if (extracted.duration === NOT_FOUND) {
    findings.push({ id: nextId("finding"), category: "Missing duration", description: "No treatment duration was identified on the Plan of Treatment.", evidence: [], confidence: "MEDIUM" });
  }
  if (/\bfall\b|\bfell\b|found on floor/i.test(extracted.reasonForReferral.text) || (extracted.fallHistory.text !== NOT_FOUND && /\byes\b/i.test(extracted.fallHistory.text))) {
    findings.push({
      id: nextId("finding"),
      category: "PCC fall documentation",
      description: "A fall is referenced in the referral history and/or fall risk assessment. PCC fall/incident documentation could not be confirmed from this record — reviewer validation recommended.",
      evidence: [...extracted.reasonForReferral.evidence, ...extracted.fallHistory.evidence],
      confidence: "MEDIUM",
    });
  }
  if (extracted.medications.text !== NOT_FOUND && /^(none|no known|n\/a)/i.test(extracted.medications.text)) {
    findings.push({ id: nextId("finding"), category: "Generic medical necessity", description: `Medications documented as "${extracted.medications.text}" — confirm this reflects an actual medication review rather than an unreviewed default.`, evidence: extracted.medications.evidence, confidence: "LOW" });
  }
  const declines = functionalChange.filter((r) => r.change === "Declined");
  if (declines.length === 0 && functionalChange.length > 0) {
    findings.push({ id: nextId("finding"), category: "Functional change not clearly documented", description: "No functional area shows a clear decline from PLOF to CLOF based on the documented values — confirm this reflects the patient's actual presentation.", evidence: [], confidence: "MEDIUM" });
  }
  const notFoundAreas = functionalChange.filter((r) => r.plof === "Not Found");
  if (notFoundAreas.length > 0) {
    findings.push({
      id: nextId("finding"),
      category: "PLOF/CLOF gap",
      description: `${notFoundAreas.length} functional area(s) documented at evaluation have no matching prior-level-of-function entry: ${notFoundAreas.map((a) => a.area).join(", ")}.`,
      evidence: [],
      confidence: "LOW",
    });
  }

  // --- v2: documentation similarity, episode-wide -----------------------
  for (const sim of documentationSimilarity) {
    if (sim.classification === "Exact duplicate" || sim.classification === "Near duplicate") {
      findings.push({
        id: nextId("finding"),
        category: "Templated/duplicated documentation",
        description: `${dimensionLabel(sim.dimension)}: ${sim.note}`,
        evidence: [],
        confidence: sim.classification === "Exact duplicate" ? "HIGH" : "MEDIUM",
      });
    }
  }

  // --- v2: goals billed against after being documented as met ----------
  const treatedAfterMet = goalLifecycle.filter((g) => g.treatmentAfterGoalMetFlag);
  if (treatedAfterMet.length > 0) {
    findings.push({
      id: nextId("finding"),
      category: "Treatment continued after goal met",
      description: `${treatedAfterMet.length} goal(s) had billed treatment continue after their documented met date with no modification note identified: ${treatedAfterMet.map((g) => g.goalId).join(", ")}.`,
      evidence: [],
      confidence: "MEDIUM",
    });
  }

  // --- v2: aggregate treatment-frequency variance across the episode ----
  const allWeeks = frequencyAnalysis.flatMap((f) => f.rows);
  const deviatedWeeks = allWeeks.filter((r) => typeof r.variance === "number" && r.variance !== 0);
  if (deviatedWeeks.length > 0) {
    findings.push({
      id: nextId("finding"),
      category: "Treatment frequency variance",
      description: `Treatment frequency deviated from the ordered plan in ${deviatedWeeks.length} of ${allWeeks.length} documented week(s) across the episode, with no documented refusal/reschedule entry identified for the difference.`,
      evidence: [],
      confidence: "MEDIUM",
    });
  }

  return findings;
}

export function buildStrengths(
  extracted: ExtractedEvaluation,
  functionalChange: FunctionalChangeRow[],
  goalAnalysis: GoalAnalysis,
  documentationSimilarity: DocumentationSimilarityFinding[] = [],
  frequencyAnalysis: FrequencyAnalysis[] = [],
): StrengthFinding[] {
  const strengths: StrengthFinding[] = [];
  const declines = functionalChange.filter((r) => r.change === "Declined");
  if (declines.length >= 2) {
    strengths.push({
      id: nextId("strength"),
      description: `Clear functional decline is documented across multiple areas (${declines.slice(0, 3).map((d) => d.area).join(", ")}), directly supporting the need for skilled intervention.`,
      evidence: declines.slice(0, 1).flatMap((d) => extracted.clofFunctionalItems.find((i) => i.label === d.area)?.evidence ?? []),
    });
  }
  if (extracted.medicalHistory.text !== NOT_FOUND && extracted.medicalHistory.text.split(/,|;/).length >= 2) {
    strengths.push({ id: nextId("strength"), description: "Relevant, specific medical history is documented rather than deferring to the chart.", evidence: extracted.medicalHistory.evidence });
  }
  if (extracted.reasonForTherapy.text !== NOT_FOUND && extracted.reasonForTherapy.text.length > 60) {
    strengths.push({ id: nextId("strength"), description: "Reason for skilled services is patient-specific rather than generic boilerplate.", evidence: extracted.reasonForTherapy.evidence });
  }
  const wellMappedGoals = goalAnalysis.goalMapping.filter((m) => m.ltgId !== null && m.confidence === "HIGH");
  if (wellMappedGoals.length > 0) {
    strengths.push({ id: nextId("strength"), description: "Short-term goals are appropriate and clearly nest within a long-term goal.", evidence: [] });
  }

  // --- v2: consistently patient-specific documentation across the episode
  const comparedDimensions = documentationSimilarity.filter((s) => s.datesCompared.length >= 2);
  if (comparedDimensions.length > 0 && comparedDimensions.every((s) => s.classification === "Patient-specific")) {
    strengths.push({
      id: nextId("strength"),
      description: "Daily documentation is consistently patient-specific across the episode — no templated or duplicated narrative was flagged in response-to-treatment, treatment narrative, or caregiver education entries.",
      evidence: [],
    });
  }

  // --- v2: treatment frequency matched the order across every documented week
  const allWeeks = frequencyAnalysis.flatMap((f) => f.rows);
  const numericWeeks = allWeeks.filter((r) => typeof r.variance === "number");
  if (numericWeeks.length > 0 && numericWeeks.every((r) => r.variance === 0)) {
    strengths.push({
      id: nextId("strength"),
      description: "Treatment frequency matched the ordered plan with no unexplained deviation across the documented certification period(s).",
      evidence: [],
    });
  }

  return strengths;
}

export function buildTopOpportunities(auditResults: AuditCriterionResult[]): TopOpportunity[] {
  const candidates = auditResults.filter((r) => r.status === "FAIL" || r.status === "PARTIAL" || r.status === "UNABLE_TO_VALIDATE");
  const ranked = [...candidates].sort((a, b) => {
    const weight = (r: AuditCriterionResult) => (r.status === "FAIL" ? 3 : r.status === "UNABLE_TO_VALIDATE" ? 2 : 1);
    return weight(b) - weight(a);
  });
  return ranked.slice(0, 5).map((r) => ({
    finding: `${r.criterion}: ${r.status === "UNABLE_TO_VALIDATE" ? "Unable to validate" : r.status}`,
    riskLevel: r.risk,
    whyItMatters: r.auditorComment,
    evidence: r.evidence,
    recommendedImprovement: r.recommendation,
  }));
}

/**
 * Supplementary corrective actions drawn from the v2 episode-level engines
 * (documentation similarity, goal lifecycle, treatment frequency) rather
 * than a single scored criterion — appended to (never replacing) the
 * corrective actions already derived from FAIL/PARTIAL rubric criteria.
 */
export function buildAdditionalCorrectiveActions(
  documentationSimilarity: DocumentationSimilarityFinding[] = [],
  goalLifecycle: GoalLifecycleRecord[] = [],
  frequencyAnalysis: FrequencyAnalysis[] = [],
): string[] {
  const actions: string[] = [];

  for (const sim of documentationSimilarity) {
    if (sim.classification === "Exact duplicate" || sim.classification === "Near duplicate") {
      actions.push(
        `${dimensionLabel(sim.dimension)}: ${sim.note} Ensure future entries reflect that day's specific presentation and response rather than reused phrasing.`,
      );
    }
  }

  for (const g of goalLifecycle.filter((g) => g.treatmentAfterGoalMetFlag)) {
    actions.push(
      `Goal ${g.goalId} ("${g.goalText}") continued to receive targeted billing after its documented met date (${g.metDate}) — discontinue treatment toward this goal or document a modification/new goal.`,
    );
  }

  for (const f of frequencyAnalysis) {
    const deviated = f.rows.filter((r) => typeof r.variance === "number" && r.variance !== 0);
    if (deviated.length > 0) {
      actions.push(
        `${f.sourceDocument}: reconcile treatment frequency — ordered ${f.orderedFrequencyRaw}, ${deviated.length} of ${f.rows.length} documented week(s) deviated with no documented refusal/reschedule entry.`,
      );
    }
  }

  return actions;
}
