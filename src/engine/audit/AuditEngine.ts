import { evaluatorAuditRubric } from "../../audit-rubrics/evaluatorAuditRubric";
import type { RubricCriterion, TimingRule } from "../../audit-rubrics/rubricTypes";
import type {
  ExtractedEvaluation,
  ExtractedProgressReport,
  ExtractedDischarge,
  ExtractedRecert,
  DailyEncounter,
} from "../extraction/extractionTypes";
import type {
  AuditCriterionResult,
  AuditStatus,
  Confidence,
  Discipline,
  DocumentationSimilarityFinding,
  EvidenceRef,
  EvidenceType,
  FrequencyAnalysis,
  FunctionalChangeRow,
  GoalAnalysis,
  GoalLifecycleRecord,
} from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";
import { isTestResultCompleted, STANDARDIZED_TESTS } from "../extraction/ClinicalNormalizer";
import { parseCalendarDate, calendarDayDiff } from "../../utils/dates";
import { classifyRisk } from "./RiskEngine";
import { areasForCpt } from "./cptGoalMapping";
import { classifyFunctionalArea } from "./GoalAnalysisEngine";

/**
 * AuditEngine
 * ============
 * Consumes the evaluatorAuditRubric config plus the extracted/derived
 * clinical model for ONE discipline's episode and produces one
 * AuditCriterionResult per applicable rubric criterion. v1's 11 Evaluation
 * -scope evaluators are unchanged in substance (see PRE_BUILD_RUBRIC_
 * ANALYSIS.md Section G item 1); the 22 Progress/Daily/Recert/Discharge
 * evaluators below are new.
 */

export interface EpisodeContext {
  discipline: Discipline;
  extracted: ExtractedEvaluation;
  functionalChange: FunctionalChangeRow[];
  goalAnalysis: GoalAnalysis;
  progressReports: ExtractedProgressReport[];
  dailyEncounters: DailyEncounter[]; // combined across all Daily/TEN boundaries for this discipline, sorted by DOS
  discharge: ExtractedDischarge | null;
  recert: ExtractedRecert | null;
  goalLifecycle: GoalLifecycleRecord[];
  frequencyAnalyses: FrequencyAnalysis[]; // one per Progress Report period, in the same order as progressReports
  documentationSimilarity: DocumentationSimilarityFinding[];
}

type Evaluator = (ctx: EpisodeContext, criterion: RubricCriterion) => Omit<AuditCriterionResult, "criterionId" | "section" | "criterion" | "maxPoints" | "scoringType">;

function base(
  score: number | null,
  status: AuditStatus,
  confidence: Confidence,
  evidenceType: EvidenceType,
  evidence: EvidenceRef[],
  auditorComment: string,
  recommendation: string,
  criterionId: string,
  maxPoints: number,
  extra?: Partial<AuditCriterionResult>,
): Omit<AuditCriterionResult, "criterionId" | "section" | "criterion" | "maxPoints" | "scoringType"> {
  return {
    score,
    status,
    risk: classifyRisk(criterionId, status, score, maxPoints),
    confidence,
    evidenceType,
    evidence,
    auditorComment,
    recommendation,
    ...extra,
  };
}

function scoreByTimingRules(days: number, timingRules: TimingRule[]): number {
  for (const rule of timingRules) {
    if (rule.calendarDays !== undefined && rule.calendarDaysMin === undefined && days === rule.calendarDays) return rule.points;
    if (rule.calendarDaysMin !== undefined && rule.calendarDays !== undefined && days >= rule.calendarDaysMin && days <= rule.calendarDays) return rule.points;
    if (rule.calendarDaysMin !== undefined && rule.calendarDays === undefined && days >= rule.calendarDaysMin) return rule.points;
  }
  return 0;
}

function summarize(text: string): string {
  return text.length > 140 ? text.slice(0, 140).trim() + "…" : text;
}

// =====================================================================
// SECTION: Evaluation Medical Review / Evaluation / Plan of Care
// (unchanged in substance from v1 — see evaluationAuditRubric.ts history)
// =====================================================================

const evalMedicalHistory: Evaluator = ({ extracted }, criterion) => {
  const { text, evidence } = extracted.medicalHistory;
  const referralText = extracted.reasonForReferral.text;
  // Cross-section satisfaction (confirmed 9/1/2026): content anywhere in the
  // SAME evaluation document counts, not only a dedicated Medical History field.
  const candidateText = text !== NOT_FOUND ? text : referralText !== NOT_FOUND ? referralText : NOT_FOUND;
  const candidateEvidence = text !== NOT_FOUND ? evidence : extracted.reasonForReferral.evidence;
  if (candidateText === NOT_FOUND) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No medical history was identified anywhere in the evaluation (Medical History field or Reason for Referral).",
      "Document a clinically relevant medical history (diagnoses, hospitalizations, falls, surgical/neuro/cardiopulmonary/MSK history) somewhere in the evaluation.", criterion.id, criterion.maxPoints);
  }
  const zeroPhrase = criterion.automaticZero?.phrases.find((p) => candidateText.toLowerCase().includes(p));
  if (zeroPhrase) {
    return base(0, "FAIL", "HIGH", "DIRECT", candidateEvidence,
      `Medical history defers to "${zeroPhrase}" rather than documenting specific history. ${criterion.automaticZero!.reason}`,
      "Replace the chart-reference with the specific diagnoses/events relevant to this episode of care.", criterion.id, criterion.maxPoints);
  }
  const items = candidateText.split(/,|;/).map((s) => s.trim()).filter(Boolean);
  const hasNarrative = items.length >= 1 && candidateText.length > 8;
  if (hasNarrative) {
    return base(3, "PASS", "HIGH", text !== NOT_FOUND ? "DIRECT" : "CROSS_REFERENCED", candidateEvidence,
      `Patient-specific medical history is documented: "${summarize(candidateText)}".${text === NOT_FOUND ? " (Found in Reason for Referral, not a dedicated Medical History field — accepted per confirmed cross-section rule.)" : ""}`,
      "No action needed.", criterion.id, criterion.maxPoints);
  }
  return base(0, "FAIL", "HIGH", "DIRECT", candidateEvidence, "Only a bare diagnosis/minimal reference is present, with no patient-specific narrative history.",
    "Document specific, patient-relevant medical history rather than a bare code or one-word reference.", criterion.id, criterion.maxPoints);
};

const evalMedications: Evaluator = ({ extracted }, criterion) => {
  const { text, evidence } = extracted.medications;
  if (text === NOT_FOUND) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No medications section was identified in the Initial Evaluation.",
      "Document medications that could affect therapy tolerance, cognition, balance, or cardiovascular response.", criterion.id, criterion.maxPoints);
  }
  const zeroPhrase = criterion.automaticZero?.phrases.find((p) => text.toLowerCase().includes(p));
  const hasNamedMedication = /\b[A-Z][a-zA-Z]{3,}(?:-[A-Za-z]+)?\b.*\d/.test(text) || /medications? impacting/i.test(text);
  if (zeroPhrase && !hasNamedMedication) {
    return base(0, "FAIL", "HIGH", "DIRECT", evidence,
      `Medications section defers to "${zeroPhrase}" instead of naming medications. ${criterion.automaticZero!.reason}`,
      "Name the specific medication(s) relevant to therapy rather than referencing the MAR.", criterion.id, criterion.maxPoints);
  }
  const isNoneStatement = /^(none|no known|n\/a|nka|not applicable)\.?$/i.test(text.trim());
  if (isNoneStatement) {
    return base(0, "FAIL", "MEDIUM", "DIRECT", evidence,
      `Medications section states "${text}" — no medication identified (may be clinically accurate if the patient truly takes none, but the Key requires an identified medication for full credit).`,
      "If the patient is on any medications at all, name them and note relevance to treatment.", criterion.id, criterion.maxPoints);
  }
  return base(3, "PASS", "HIGH", "DIRECT", evidence,
    `At least one specific, clinically relevant medication is named: "${summarize(text)}". A complete MAR reproduction is not required.`,
    "No action needed.", criterion.id, criterion.maxPoints);
};

const evalCompletedTimely: Evaluator = ({ extracted }, criterion) => {
  const dos = parseCalendarDate(extracted.startOfCare);
  const completion = parseCalendarDate(extracted.therapistSignatureDate);
  const evidence: EvidenceRef[] = [
    { page: 1, section: "Identification Information", text: `Start of Care: ${extracted.startOfCare}` },
    ...(extracted.therapistSignatureDate !== NOT_FOUND
      ? [{ page: extracted.therapistSignaturePage, section: "Plan of Treatment Signature", text: `Original Signature: Electronically signed by ${extracted.therapistName} ${extracted.therapistSignatureDate}` } as EvidenceRef]
      : []),
  ];
  if (!dos || !completion) {
    return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", evidence,
      "Evaluation date of service and/or the evaluating therapist's completion/signature date could not both be identified in the record.",
      "Confirm the evaluation date of service and the therapist's signature date are both documented and legible.", criterion.id, criterion.maxPoints, { externalValidation: undefined });
  }
  const days = calendarDayDiff(dos, completion);
  const score = scoreByTimingRules(days, criterion.timingRules!);
  return base(score, score === 3 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL", "HIGH", "DERIVED", evidence,
    `Evaluation DOS ${extracted.startOfCare}; evaluating therapist completion/signature ${extracted.therapistSignatureDate} — calendar-day difference: ${days}. (Physician certification signature date, if present, is tracked separately and never substituted here; a later cosignature never changes this score.)`,
    score < 3 ? "Complete and sign evaluations the same day as the date of service where feasible." : "No action needed.", criterion.id, criterion.maxPoints);
};

const evalHealthStatusReferral: Evaluator = ({ extracted }, criterion) => {
  const { text, evidence } = extracted.reasonForReferral;
  if (text === NOT_FOUND) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No reason for referral / current illness was documented.",
      "Document the specific change (hospitalization, fall, decline, etc.) that prompted this episode of care.", criterion.id, criterion.maxPoints);
  }
  const diagnosisTerms = [extracted.medicalDiagnosis, extracted.treatmentDiagnosis].filter((d) => d !== NOT_FOUND).join(" ").toLowerCase();
  const changeIndicators = /hospital|fall|decline|weak|change|onset|injur|surg|admit|encephalopathy|deconditio|AMS|altered mental|GLF|ground level fall/i.test(text);
  const diagnosisWords = diagnosisTerms.split(/\W+/).filter((w) => w.length > 5);
  const literalOverlap = diagnosisWords.some((w) => text.toLowerCase().includes(w));
  const synonymPairs: { diagnosis: RegExp; referral: RegExp }[] = [
    { diagnosis: /encephalopathy/i, referral: /\bAMS\b|altered mental status|confusion|dementia/i },
    { diagnosis: /muscle wast|atrophy|weakness/i, referral: /weak|deconditio|poor po intake|rhabdomyolysis|hypokalemia|prolonged (bed rest|immobility)/i },
    { diagnosis: /fall/i, referral: /\bfall\b|\bfell\b|found on floor|GLF|ground level fall/i },
    { diagnosis: /fracture|contusion/i, referral: /fracture|fall|orif|surgery|contusion|GLF/i },
    { diagnosis: /stroke|cva|hemipleg/i, referral: /stroke|cva|hemipleg|weakness on (one|the) side/i },
    { diagnosis: /walking|ambulat/i, referral: /difficulty (in )?ambulat|walk|gait/i },
  ];
  const synonymMatch = synonymPairs.some((p) => p.diagnosis.test(diagnosisTerms) && p.referral.test(text));
  const correlatesWithDiagnosis = literalOverlap || synonymMatch;

  const fallMentioned = /\bfall\b|\bfell\b|found on floor|GLF|ground level fall/i.test(text);
  const externalValidation = fallMentioned && criterion.pcc
    ? { required: true, reason: criterion.pcc.reasonTemplate, recommendedAction: criterion.pcc.recommendedAction }
    : undefined;

  let score: number;
  let comment: string;
  if (changeIndicators && correlatesWithDiagnosis) {
    score = 3;
    comment = `A specific change (${summarize(text)}) is documented and reasonably corresponds to the diagnosis on file (${extracted.medicalDiagnosis}${extracted.treatmentDiagnosis !== NOT_FOUND ? ` / ${extracted.treatmentDiagnosis}` : ""}).`;
  } else if (changeIndicators) {
    score = 2;
    comment = `A change is documented (${summarize(text)}) but its correspondence to the billed diagnosis is not clearly stated.`;
  } else {
    score = 1;
    comment = "Reason for referral is present but does not clearly describe a specific change in status.";
  }
  if (fallMentioned) {
    comment += " A fall/fall-related event is referenced — see Fall Reported / PCC Fall Validation, tracked separately and never reducing this score merely because PCC evidence wasn't uploaded.";
  }
  return base(score, score === 3 ? "PASS" : "PARTIAL", "MEDIUM", "CROSS_REFERENCED", evidence, comment,
    score < 3 ? "State explicitly how the reason for referral relates to the diagnosis/impairment being treated." : "No action needed.",
    criterion.id, criterion.maxPoints, {
      externalValidation,
      ...(fallMentioned
        ? {
            confidenceReason: undefined,
          }
        : {}),
    });
};

const evalObjectiveTest: Evaluator = ({ extracted, discipline }, criterion) => {
  const testPatterns = STANDARDIZED_TESTS[discipline] ?? STANDARDIZED_TESTS.PT;
  if (extracted.objectiveTests.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No objective/standardized test section or entry was identified in the evaluation.",
      "Administer and document a discipline-appropriate standardized/objective measure with a scored result.", criterion.id, criterion.maxPoints);
  }
  const withDisciplineMatch = extracted.objectiveTests.map((t) => ({ ...t, disciplineAppropriate: testPatterns.some((p) => p.test(t.name)), completed: isTestResultCompleted(t.result) }));
  const passing = withDisciplineMatch.find((t) => t.disciplineAppropriate && t.completed);
  const evidence = withDisciplineMatch.flatMap((t) => t.evidence);
  if (passing) {
    return base(3, "PASS", "HIGH", "DIRECT", evidence, `A completed, discipline-appropriate standardized measure was administered: "${passing.name}" = ${passing.result}.`,
      "No action needed.", criterion.id, criterion.maxPoints);
  }
  const attemptedNotCompleted = withDisciplineMatch.find((t) => !t.completed);
  const comment = attemptedNotCompleted
    ? `Objective testing section lists "${attemptedNotCompleted.name}" as "${attemptedNotCompleted.result}." A completed standardized outcome measure was not identified. Per the Key, a section heading or attempted-but-not-completed test does not receive credit.`
    : "No discipline-appropriate standardized/objective measure with a completed, scored result was identified.";
  return base(0, "FAIL", "HIGH", "DIRECT", evidence, comment,
    "Administer a discipline-appropriate standardized measure to completion, or document the specific clinical reason it could not be completed.", criterion.id, criterion.maxPoints);
};

const evalTherapistAssessment: Evaluator = ({ extracted, functionalChange }, criterion) => {
  const assessed = functionalChange.filter((r) => r.change === "Declined" || r.change === "Improved");
  const evidence: EvidenceRef[] = functionalChange.filter((r) => r.change !== "Not Assessed").slice(0, 3).flatMap((r) => extracted.clofFunctionalItems.find((i) => i.label === r.area)?.evidence ?? []);
  const painNoted = extracted.painStatement.text !== NOT_FOUND && /\byes\b/i.test(extracted.painStatement.text);
  const painCorrelationOk = !painNoted || /pain/i.test(extracted.reasonForTherapy.text) || /pain/i.test(extracted.medicalHistory.text);
  const externalValidation = criterion.pcc ? { required: true, reason: criterion.pcc.reasonTemplate, recommendedAction: criterion.pcc.recommendedAction } : undefined;
  let score: number;
  let comment: string;
  if (assessed.length >= 3) {
    score = 3;
    const declines = assessed.filter((r) => r.change === "Declined");
    comment = `A clear PLOF-to-CLOF functional change is documented across ${assessed.length} functional areas (e.g., ${declines.slice(0, 2).map((d) => `${d.area}: ${d.plof} → ${d.clof}`).join("; ") || `${assessed[0].area}: ${assessed[0].plof} → ${assessed[0].clof}`}), supporting skilled intervention.`;
  } else if (assessed.length >= 1) {
    score = 2;
    comment = "A PLOF-to-CLOF change is documented for at least one functional area, but the comparison is not comprehensive across the functional mobility assessment.";
  } else {
    score = 0;
    comment = "No clear PLOF-to-CLOF functional change could be identified from the documented prior level of function versus current assessment.";
  }
  if (painNoted) {
    comment += painCorrelationOk ? " Pain is noted and is addressed in the context of the clinical picture." : " Pain is noted but its correlation to goals/diagnosis is not clearly stated.";
    if (!painCorrelationOk && score > 0) score = Math.max(1, score - 1);
  }
  comment += " Cross-reference against nursing PCC documentation is flagged separately as external validation and does not affect this score.";
  return base(score, score === 3 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL", "MEDIUM", "CROSS_REFERENCED", evidence, comment,
    score < 3 ? "Document a clear, comprehensive comparison between prior level of function and current level of function." : "No action needed.", criterion.id, criterion.maxPoints, { externalValidation });
};

const evalOrdersInPcc: Evaluator = ({ extracted }, criterion) => {
  const evidence: EvidenceRef[] = [{ page: extracted.planOfTreatmentPage, section: "Plan of Treatment", text: `Frequency: ${extracted.frequency}; Duration: ${extracted.duration}; Certification Period: ${extracted.certificationStart} - ${extracted.certificationEnd}` }];
  return base(null, "UNABLE_TO_VALIDATE", "HIGH", "EXTERNAL_VALIDATION_REQUIRED", evidence,
    "The uploaded therapy documentation does not contain PCC order evidence. The physician's Plan of Treatment certification within this document is not, by itself, treated as proof of a matching PCC order.",
    criterion.pcc!.recommendedAction, criterion.id, criterion.maxPoints,
    { externalValidation: { required: true, reason: criterion.pcc!.reasonTemplate, recommendedAction: criterion.pcc!.recommendedAction } });
};

const RISK_WITHOUT_TREATMENT_RE = /at risk for|risk of|without (skilled )?(pt|ot|slp|therapy|intervention)|further (decline|caregiver dependence)|return to (prior|community|home)/i;
const BOILERPLATE_ONLY_RE = /^(skilled therapy is medically necessary\.?|medically necessary\.?)$/i;

const evalMedicalNecessity: Evaluator = ({ extracted, functionalChange }, criterion) => {
  const { text, evidence } = extracted.reasonForTherapy;
  if (text === NOT_FOUND) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No reason-for-skilled-services narrative was identified.",
      "Document how the diagnosis/change in status creates an impairment and functional limitation requiring a skilled therapist.", criterion.id, criterion.maxPoints);
  }
  if (BOILERPLATE_ONLY_RE.test(text.trim())) {
    return base(0, "FAIL", "HIGH", "DIRECT", evidence, `Documentation states only "${text}" without patient-specific justification — this is generic boilerplate, not evidence of medical necessity.`,
      "Replace the generic statement with a patient-specific chain from diagnosis/impairment to functional limitation to skilled need.", criterion.id, criterion.maxPoints);
  }
  const hasRisk = RISK_WITHOUT_TREATMENT_RE.test(text);
  const declines = functionalChange.filter((r) => r.change === "Declined").length;
  const hasDiagnosisLink = extracted.medicalDiagnosis !== NOT_FOUND || extracted.treatmentDiagnosis !== NOT_FOUND;
  const isSpecific = text.length > 60;
  let score: number;
  let comment: string;
  if (hasRisk && hasDiagnosisLink && isSpecific) {
    score = 3;
    comment = `Documentation connects the diagnosis/functional decline (${declines} functional area(s) documented as declined) to the need for skilled intervention and identifies risk without treatment: "${summarize(text)}"`;
  } else if (isSpecific && hasDiagnosisLink) {
    score = 2;
    comment = `A patient-specific rationale is documented, but the connection to risk/consequence without skilled treatment is not explicit: "${summarize(text)}"`;
  } else {
    score = 1;
    comment = `A brief rationale is documented but lacks a clear chain from diagnosis/impairment to functional limitation to skilled need: "${summarize(text)}"`;
  }
  return base(score, score === 3 ? "PASS" : "PARTIAL", "MEDIUM", "CROSS_REFERENCED", evidence, comment,
    score < 3 ? "State explicitly what happens without skilled intervention (e.g., fall risk, further decline, inability to return to prior living situation)." : "No action needed.", criterion.id, criterion.maxPoints);
};

const evalAssessmentSummary: Evaluator = ({ extracted, functionalChange }, criterion) => {
  const elements: { present: boolean; label: string }[] = [
    { present: extracted.reasonForTherapy.text !== NOT_FOUND && extracted.reasonForTherapy.text.length > 40, label: "Clinical impression / reason for skilled services" },
    { present: RISK_WITHOUT_TREATMENT_RE.test(extracted.reasonForTherapy.text), label: "Risk factors / risk without treatment" },
    { present: extracted.complexities.text !== NOT_FOUND && extracted.complexities.text.length > 10, label: "Barriers/complexities" },
    { present: functionalChange.some((r) => r.change === "Declined" || r.change === "Improved"), label: "Change in functional levels" },
  ];
  const presentCount = elements.filter((e) => e.present).length;
  const score = Math.min(criterion.maxPoints, presentCount);
  const evidence = [...extracted.reasonForTherapy.evidence, ...extracted.complexities.evidence];
  const fallMentioned = /\bfall\b|\bfell\b/i.test(extracted.reasonForTherapy.text) || (extracted.fallHistory.text !== NOT_FOUND && /\byes\b/i.test(extracted.fallHistory.text));
  const externalValidation = fallMentioned && criterion.pcc ? { required: true, reason: criterion.pcc.reasonTemplate, recommendedAction: criterion.pcc.recommendedAction } : undefined;
  const status: AuditStatus = score === criterion.maxPoints ? "PASS" : score === 0 ? "FAIL" : "PARTIAL";
  const comment = `Assessment summary synthesizes ${presentCount} of ${elements.length} expected elements (${elements.filter((e) => e.present).map((e) => e.label).join("; ") || "none"}).${fallMentioned ? " A fall is referenced — PCC corroboration is flagged separately and does not reduce this score." : ""}`;
  return base(score, status, "MEDIUM", "CROSS_REFERENCED", evidence, comment,
    score < criterion.maxPoints ? `Incorporate the missing element(s): ${elements.filter((e) => !e.present).map((e) => e.label).join("; ")}.` : "No action needed.", criterion.id, criterion.maxPoints, { externalValidation });
};

const evalLtgJustification: Evaluator = ({ extracted, goalAnalysis }, criterion) => {
  const ltgs = goalAnalysis.longTermGoals;
  if (ltgs.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No long-term goals were identified in the Initial Evaluation.",
      "Document at least one long-term goal supported by the diagnosis and reason for referral.", criterion.id, criterion.maxPoints);
  }
  const notAbove = ltgs.filter((g) => g.aboveClof === false);
  const unknown = ltgs.filter((g) => g.aboveClof === "Unknown");
  const evidenceFromGoals: EvidenceRef[] = ltgs.map((g) => ({ page: g.page, section: "Objective Progress / Long-Term Goals", text: `${g.id}: "${g.statement}" (baseline: ${g.baseline})` }));
  let score: number;
  let comment: string;
  if (notAbove.length === 0 && unknown.length === 0) {
    score = 3;
    comment = `All ${ltgs.length} long-term goal(s) target an outcome above the documented CLOF/baseline and are supported by the diagnosis (${extracted.medicalDiagnosis === NOT_FOUND ? extracted.treatmentDiagnosis : extracted.medicalDiagnosis}) and planned CPT codes.`;
  } else if (notAbove.length === 0) {
    score = 2;
    comment = `Long-term goal(s) appear supported, but the target-vs-baseline relationship could not be automatically confirmed for: ${unknown.map((g) => g.id).join(", ")} (free-text target not parseable) — reviewer confirmation recommended.`;
  } else {
    score = 1;
    comment = `${notAbove.length} of ${ltgs.length} long-term goal(s) do not clearly target an outcome above the documented CLOF/baseline: ${notAbove.map((g) => `${g.id} (target "${g.target}" vs. baseline "${g.baseline}")`).join("; ")}.`;
  }
  return base(score, score === 3 ? "PASS" : "PARTIAL", unknown.length > 0 ? "MEDIUM" : "HIGH", "CROSS_REFERENCED", evidenceFromGoals, comment,
    score < 3 ? "Confirm each long-term goal's target explicitly exceeds the documented baseline/CLOF and ties to the diagnosis/CPT codes." : "No action needed.", criterion.id, criterion.maxPoints);
};

const evalStgAppropriate: Evaluator = ({ goalAnalysis }, criterion) => {
  const stgs = goalAnalysis.shortTermGoals;
  if (stgs.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No short-term goals were identified in the Initial Evaluation.",
      "Document short-term goals that function as intermediate steps toward the long-term goals.", criterion.id, criterion.maxPoints);
  }
  const mapping = goalAnalysis.goalMapping;
  const unmapped = mapping.filter((m) => m.ltgId === null);
  const lowConfidence = mapping.filter((m) => m.confidence === "LOW" && m.ltgId !== null);
  const notMeasurable = stgs.filter((g) => !g.measurable);
  const evidence: EvidenceRef[] = stgs.map((g) => ({ page: g.page, section: "Objective Progress / Short-Term Goals", text: `${g.id}: "${g.statement}"` }));
  let score: number;
  let comment: string;
  if (unmapped.length === 0 && notMeasurable.length === 0) {
    score = 3;
    comment = `All ${stgs.length} short-term goal(s) are measurable and map to a long-term goal (${mapping.map((m) => `${m.stgId}→${m.ltgId}`).join(", ")}).${lowConfidence.length ? " Some mappings are inferred from clinical domain rather than an explicit link in the source document — reviewer confirmation recommended." : ""}`;
  } else if (unmapped.length === 0) {
    score = 2;
    comment = `Short-term goals map to long-term goals, but ${notMeasurable.length} lack a clearly measurable target: ${notMeasurable.map((g) => g.id).join(", ")}.`;
  } else {
    score = 1;
    comment = `${unmapped.length} of ${stgs.length} short-term goal(s) could not be linked to any long-term goal: ${unmapped.map((m) => m.stgId).join(", ")}.`;
  }
  return base(score, score === 3 ? "PASS" : "PARTIAL", lowConfidence.length > 0 ? "MEDIUM" : "HIGH", "CROSS_REFERENCED", evidence, comment,
    score < 3 ? "Ensure every short-term goal is measurable and explicitly supports a documented long-term goal." : "No action needed.", criterion.id, criterion.maxPoints);
};

// =====================================================================
// SECTION: Progress Notes
// =====================================================================

function latestProgressReport(ctx: EpisodeContext): ExtractedProgressReport | null {
  if (ctx.progressReports.length === 0) return null;
  return [...ctx.progressReports].sort((a, b) => (parseCalendarDate(a.periodEnd)?.getTime() ?? 0) - (parseCalendarDate(b.periodEnd)?.getTime() ?? 0)).slice(-1)[0];
}

const pnCompletedTimely: Evaluator = (ctx, criterion) => {
  if (ctx.progressReports.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Progress Report document was identified in this discipline's episode documentation.",
      "Ensure a Progress Report is generated at the required interval and included in the record.", criterion.id, criterion.maxPoints);
  }
  const rows = ctx.progressReports.map((pr) => {
    const periodEnd = parseCalendarDate(pr.periodEnd);
    const sig = parseCalendarDate(pr.originalSignature?.date ?? null);
    if (!periodEnd || !sig) return { pr, days: null };
    return { pr, days: calendarDayDiff(periodEnd, sig) };
  });
  const missing = rows.filter((r) => r.days === null);
  if (missing.length === rows.length) {
    return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", [], "Progress Report period end date and/or original signature date could not be identified for any Progress Report in this episode.",
      "Confirm the progress period end date and original signature date are both documented and legible.", criterion.id, criterion.maxPoints);
  }
  const scored = rows.filter((r): r is { pr: ExtractedProgressReport; days: number } => r.days !== null).map((r) => ({ ...r, points: scoreByTimingRules(r.days, criterion.timingRules!) }));
  const worst = scored.reduce((a, b) => (b.points < a.points ? b : a));
  const evidence: EvidenceRef[] = scored.map((r) => ({ page: r.pr.originalSignature?.page ?? NOT_FOUND, section: "Progress Report", text: `Period end ${r.pr.periodEnd}; original signature ${r.pr.originalSignature?.date} — ${r.days} calendar day(s).` }));
  return base(worst.points, worst.points === 3 ? "PASS" : worst.points === 0 ? "FAIL" : "PARTIAL", "HIGH", "DERIVED", evidence,
    `${scored.map((r) => `Period ending ${r.pr.periodEnd}: original signature ${r.pr.originalSignature?.date ?? "Not Found"} (${r.days} calendar day(s), ${r.points}/3)`).join("; ")}. Worst-case result across ${scored.length} Progress Report(s) determines this score; a cosignature never changes it.`,
    worst.points < 3 ? "Complete and sign progress reports the same day as the reporting period's end date where feasible." : "No action needed.", criterion.id, criterion.maxPoints);
};

const pnPatientResponse: Evaluator = (ctx, criterion) => {
  const pr = latestProgressReport(ctx);
  if (!pr) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Progress Report document was identified in this discipline's episode documentation.", "Ensure a Progress Report is included in the record.", criterion.id, criterion.maxPoints);
  }
  const { text, evidence } = pr.patientProgress;
  const goalsWithoutProgress = ctx.goalLifecycle.filter((g) => g.progressStatuses.some((p) => /^Continue/i.test(p.status)) && !g.progressStatuses.some((p) => /Met/i.test(p.status)));
  if (text === NOT_FOUND) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No patient response/progress narrative was identified in the Progress Report.", "Document the patient's response to treatment for this reporting period, including comment on any goal without progress.", criterion.id, criterion.maxPoints);
  }
  const isGeneric = /^(patient is progressing with current treatment interventions and plan of treatment\.?|pt is progressing towards (his|her) .* goals?( and showing good response.*)?\.?)$/i.test(text.trim());
  const hasBarrierLanguage = /barrier|limit|difficult|declin|unable|refus/i.test(text);
  let score: number;
  let comment: string;
  if (!isGeneric && (goalsWithoutProgress.length === 0 || hasBarrierLanguage)) {
    score = 3;
    comment = `Patient-specific response documented: "${summarize(text)}".${goalsWithoutProgress.length > 0 ? " Barriers are summarized for goals without progress." : ""}`;
  } else if (isGeneric && goalsWithoutProgress.length === 0) {
    score = 2;
    comment = `Response narrative is documented ("${summarize(text)}") but reads as a general status update rather than patient-specific detail.`;
  } else {
    score = 1;
    comment = `${goalsWithoutProgress.length} goal(s) show "Continue" with no documented progress this period (${goalsWithoutProgress.map((g) => g.goalId).join(", ")}), and no barrier explanation was identified in the response narrative: "${summarize(text)}".`;
  }
  return base(score, score === 3 ? "PASS" : "PARTIAL", "MEDIUM", "DIRECT", evidence, comment,
    score < 3 ? "Document a patient-specific response to treatment, and explicitly summarize barriers for any goal without progress this period." : "No action needed.", criterion.id, criterion.maxPoints);
};

const pnPocModifications: Evaluator = (ctx, criterion) => {
  const pr = latestProgressReport(ctx);
  if (!pr) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Progress Report document was identified in this discipline's episode documentation.", "Ensure a Progress Report is included in the record.", criterion.id, criterion.maxPoints);
  }
  const goalsForDiscipline = ctx.goalLifecycle.filter((g) => g.progressStatuses.length > 0);
  const changedStatus = goalsForDiscipline.filter((g) => new Set(g.progressStatuses.map((p) => p.status)).size > 1 || g.progressStatuses.some((p) => /Met/i.test(p.status)));
  const evidence: EvidenceRef[] = pr.rawGoals.slice(0, 3).map((g) => ({ page: g.page, section: "Objective Progress/Functional Comparison with Goals", text: `${g.id} - ${g.statusWord}` }));
  if (goalsForDiscipline.length === 0) {
    return base(1, "PARTIAL", "LOW", "DIRECT", evidence, "No goal-level status history could be constructed to confirm whether modifications are being tracked.",
      "Ensure each goal's status (Continue / Goal Met / etc.) is documented at every Progress Report.", criterion.id, criterion.maxPoints);
  }
  const score = changedStatus.length > 0 || goalsForDiscipline.every((g) => g.progressStatuses.every((p) => /^Continue/i.test(p.status))) ? 3 : 2;
  return base(score, score === 3 ? "PASS" : "PARTIAL", "MEDIUM", "DIRECT", evidence,
    `Goal status is tracked with a baseline-vs-current status word at each Progress Report (${goalsForDiscipline.map((g) => `${g.goalId}: ${g.progressStatuses.map((p) => p.status).join(" → ")}`).slice(0, 3).join("; ")}).`,
    score < 3 ? "Document an explicit modification note whenever a goal's plan changes." : "No action needed.", criterion.id, criterion.maxPoints);
};

const pnTreatmentFrequency: Evaluator = (ctx, criterion) => {
  if (ctx.frequencyAnalyses.length === 0) {
    return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", [], "Ordered frequency and/or treatment dates could not be identified to compute a frequency comparison.",
      "Confirm the Plan of Treatment's ordered frequency and treatment encounter dates are both documented and legible.", criterion.id, criterion.maxPoints);
  }
  const allRows = ctx.frequencyAnalyses.flatMap((fa) => fa.rows);
  const outOfTolerance = allRows.filter((r) => typeof r.variance === "number" && Math.abs(r.variance) > 0);
  const evidence: EvidenceRef[] = allRows.slice(0, 4).map((r) => ({ page: NOT_FOUND, section: "Treatment Frequency Analysis", text: `${r.weekLabel}: ordered ${r.orderedFrequency}, actual ${r.actualUniqueDOS.length} unique date(s) — ${r.finding}` }));
  const score = outOfTolerance.length === 0 ? 3 : 0;
  return base(score, score === 3 ? "PASS" : "FAIL", "HIGH", "DERIVED", evidence,
    outOfTolerance.length === 0
      ? "Actual unique treatment dates match the ordered frequency for every reporting week analyzed."
      : `${outOfTolerance.length} reporting week(s) deviate from the ordered frequency: ${outOfTolerance.map((r) => r.finding).join(" ")}`,
    score < 3 ? "Align actual visit count with the ordered frequency, or document a physician-approved frequency change / refusal for any deviation." : "No action needed.", criterion.id, criterion.maxPoints);
};

// =====================================================================
// SECTION: Daily Notes / Treatment Encounter Notes
// =====================================================================

const dnPatientResponse: Evaluator = (ctx, criterion) => {
  if (ctx.dailyEncounters.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Daily/Treatment Encounter Note was identified in this discipline's episode documentation.", "Ensure daily treatment encounter notes are included in the record.", criterion.id, criterion.maxPoints);
  }
  const finding = ctx.documentationSimilarity.find((f) => f.dimension === "ResponseToTreatment");
  const evidence: EvidenceRef[] = ctx.dailyEncounters.slice(0, 3).map((e) => ({ page: e.page, section: "Response to Tx", text: `${e.dos}: ${e.responseToTx || "(not documented)"}` }));
  if (!finding || finding.classification === "Patient-specific") {
    return base(3, "PASS", "MEDIUM", "DIRECT", evidence, "Response-to-treatment narrative varies meaningfully across documented dates rather than repeating a stock phrase.",
      "No action needed.", criterion.id, criterion.maxPoints);
  }
  const score = finding.classification === "Exact duplicate" ? 1 : finding.classification === "Near duplicate" ? 1 : 2;
  return base(score, "PARTIAL", "MEDIUM", "DIRECT", evidence,
    `${finding.note} Sample: "${summarize(finding.sampleText)}". Never labeled outright "copy/paste" from common therapy terminology alone — flagged here as potential repetitive/template documentation for reviewer validation.`,
    "Vary response-to-treatment documentation to reflect the patient's actual, specific reaction each session.", criterion.id, criterion.maxPoints);
};

const SKILLED_LANGUAGE_RE = /facilitat|adjustment of center of mass|cueing|graded|progress(ed|ion)|correct(ed|ion) (of|during)|instructed in compensatory|manual (contact|guidance)|verbal instruction (given|required) due to|resistance (given|for)/i;
const dnTreatmentProgression: Evaluator = (ctx, criterion) => {
  if (ctx.dailyEncounters.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Daily/Treatment Encounter Note was identified in this discipline's episode documentation.", "Ensure daily treatment encounter notes are included in the record.", criterion.id, criterion.maxPoints);
  }
  let skilledCount = 0;
  let total = 0;
  const evidence: EvidenceRef[] = [];
  for (const enc of ctx.dailyEncounters) {
    for (const c of enc.cptEntries) {
      total++;
      const hasSkilledLanguage = SKILLED_LANGUAGE_RE.test(c.narrative);
      const hasMeasurable = /\d+\s?(ft|feet|reps?|sets?|minutes?|min|%|lbs?|pounds?)/i.test(c.narrative);
      if (hasSkilledLanguage || hasMeasurable) {
        skilledCount++;
        if (evidence.length < 3) evidence.push({ page: enc.page, section: `Summary of Daily Skilled Services (${c.code})`, text: `${enc.dos}: ${summarize(c.narrative)}` });
      }
    }
  }
  const ratio = total > 0 ? skilledCount / total : 0;
  let score: number;
  if (ratio >= 0.7) score = 3;
  else if (ratio >= 0.4) score = 2;
  else if (ratio > 0) score = 1;
  else score = 0;
  return base(score, score === 3 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL", "MEDIUM", "DIRECT", evidence,
    `${skilledCount} of ${total} documented CPT interventions include measurable/objective detail or explicit skilled-clinician language (facilitation, cueing, graded progression) distinguishing skilled intervention from patient activity alone.`,
    score < 3 ? "Document the specific skilled technique/cueing/progression applied, not just the activity the patient performed." : "No action needed.", criterion.id, criterion.maxPoints);
};

const dnAttendanceCompliance: Evaluator = (ctx, criterion) => {
  if (ctx.dailyEncounters.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Daily/Treatment Encounter Note was identified in this discipline's episode documentation.", "Ensure daily treatment encounter notes are included in the record.", criterion.id, criterion.maxPoints);
  }
  if (ctx.frequencyAnalyses.length === 0) {
    return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", [], "Ordered frequency could not be identified to compute an attendance/compliance comparison.", "Confirm the ordered frequency is documented.", criterion.id, criterion.maxPoints);
  }
  const allRows = ctx.frequencyAnalyses.flatMap((fa) => fa.rows);
  const deviatingWeeks = allRows.filter((r) => typeof r.variance === "number" && r.variance !== 0);
  const underWeeks = deviatingWeeks.filter((r) => typeof r.variance === "number" && r.variance < 0);
  const hasMissedVisitEntry = ctx.dailyEncounters.some((e) => /missed|refus|reschedul|cancel/i.test(e.responseToTx + " " + e.complexities + " " + e.preTx));
  const evidence: EvidenceRef[] = deviatingWeeks.slice(0, 3).map((r) => ({ page: NOT_FOUND, section: "Treatment Frequency Analysis", text: r.finding }));
  if (deviatingWeeks.length === 0) {
    return base(3, "PASS", "HIGH", "DERIVED", evidence, "Treatment occurred on every ordered date of service with no unexplained gaps identified across the episode.", "No action needed.", criterion.id, criterion.maxPoints);
  }
  if (underWeeks.length > 0 && !hasMissedVisitEntry) {
    return base(0, "FAIL", "HIGH", "DERIVED", evidence, `Under-frequency identified with no documented missed-visit/reschedule entry: ${underWeeks.map((r) => r.finding).join(" ")}`,
      "Document a missed-visit entry and any communication/rescheduling attempt for every gap from the ordered frequency.", criterion.id, criterion.maxPoints);
  }
  return base(0, "FAIL", "MEDIUM", "DERIVED", evidence, `Frequency deviation identified (over- or under-treatment relative to the ordered plan): ${deviatingWeeks.map((r) => r.finding).join(" ")}`,
    "Align treatment frequency with the ordered plan, or document a physician-approved frequency change.", criterion.id, criterion.maxPoints);
};

/**
 * Genuine patient/caregiver EDUCATION content (teaching a topic — a home
 * exercise program, safety/fall-prevention education, caregiver training on
 * a technique) — deliberately narrower than a bare "instructed"/"instruction"
 * match. Those words appear constantly in routine SKILLED CUEING narrative
 * during an exercise ("...moderate verbal instruction given due to
 * compromised technique...", see SKILLED_LANGUAGE_RE above), which is a
 * normal, distinct element of skilled intervention — not caregiver/patient
 * education — and treating every such cueing mention as "education" produced
 * false PASS results the human reviewer did not agree with (an "instruction"
 * -only match should never, by itself, count as documented education).
 * Exported for reuse by the Documentation Similarity Engine's
 * "CaregiverEducation" text-collection dimension in RehabAuditPipeline.ts.
 */
export const EDUCATION_CONTENT_RE = /\beducat|\bcaregiver\b|\bfamily train|\bhome exercise program\b|\bHEP\b|train(?:ed|ing)?\s+(?:the\s+)?(?:patient|caregiver|family)/i;
/** A mention this short (after collapsing whitespace) is treated as
 *  boilerplate-generic regardless of exact wording — e.g. "Caregiver
 *  education provided." carries no actual topic, technique, or barrier — so
 *  this is a length heuristic rather than a fixed phrase list, which would
 *  be too brittle across vendor templates. */
const GENERIC_EDUCATION_MIN_LENGTH = 40;

const dnCaregiverEducation: Evaluator = (ctx, criterion) => {
  if (ctx.dailyEncounters.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Daily/Treatment Encounter Note was identified in this discipline's episode documentation.", "Ensure daily treatment encounter notes are included in the record.", criterion.id, criterion.maxPoints);
  }
  const educationMentions = ctx.dailyEncounters.flatMap((e) =>
    e.cptEntries.filter((c) => EDUCATION_CONTENT_RE.test(c.narrative)).map((c) => ({ dos: e.dos, page: e.page, text: c.narrative })),
  );
  const finding = ctx.documentationSimilarity.find((f) => f.dimension === "CaregiverEducation");
  const evidence: EvidenceRef[] = educationMentions.slice(0, 3).map((m) => ({ page: m.page, section: "Summary of Daily Skilled Services", text: `${m.dos}: ${summarize(m.text)}` }));
  if (educationMentions.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No patient/caregiver education content was identified across the episode's daily notes.", "Document specific patient/caregiver education addressing barriers or discharge readiness.", criterion.id, criterion.maxPoints);
  }
  const onlyGeneric = educationMentions.every((m) => m.text.trim().replace(/\s+/g, " ").length < GENERIC_EDUCATION_MIN_LENGTH);
  if (onlyGeneric || (finding && (finding.classification === "Exact duplicate" || finding.classification === "Near duplicate"))) {
    return base(1, "PARTIAL", "MEDIUM", "DIRECT", evidence, `Education content is mentioned but limited to brief, generic language with no specific technique/topic/barrier documented, and/or repeated near-identically across dates.${finding ? ` ${finding.note}` : ""}`,
      "Document the specific content of patient/caregiver education (technique taught, barrier addressed, discharge-readiness topic) rather than a brief generic reference.", criterion.id, criterion.maxPoints);
  }
  return base(3, "PASS", "MEDIUM", "DIRECT", evidence, `Patient/caregiver education is documented with specific content across ${educationMentions.length} encounter(s), not limited to brief generic language.`,
    "No action needed.", criterion.id, criterion.maxPoints);
};

const dnLinkedToGoals: Evaluator = (ctx, criterion) => {
  if (ctx.dailyEncounters.length === 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No Daily/Treatment Encounter Note was identified in this discipline's episode documentation.", "Ensure daily treatment encounter notes are included in the record.", criterion.id, criterion.maxPoints);
  }
  // "Active" here means "part of the Plan of Care during the episode's
  // daily treatment" — NOT filtered by the goal's eventual discharge status.
  // A goal formally closed out as "Discontinued" (or "Met") at discharge was
  // still the goal daily treatment was legitimately working toward for
  // nearly the whole episode; excluding it would make this check fail for
  // almost every completed episode, since essentially every goal reaches
  // some terminal discharge status by definition. Treatment continuing
  // AFTER a goal's own documented met-date is a separate, correctly-scoped
  // check (DN_DISCONTINUE_WHEN_MET below).
  const activeGoalAreas = new Set(ctx.goalLifecycle.map((g) => classifyFunctionalArea(g.goalText)).filter((a) => a !== "Unclassified"));
  const allCpt = ctx.dailyEncounters.flatMap((e) => e.cptEntries.map((c) => ({ ...c, dos: e.dos, page: e.page })));
  const treatmentCpt = allCpt.filter((c) => c.code !== "97162" && c.code !== "97166"); // exclude eval codes
  const linked = treatmentCpt.filter((c) => areasForCpt(c.code).some((a) => activeGoalAreas.has(a)));
  const ratio = treatmentCpt.length > 0 ? linked.length / treatmentCpt.length : 0;
  const evidence: EvidenceRef[] = linked.slice(0, 3).map((c) => ({ page: c.page, section: "Summary of Daily Skilled Services", text: `${c.dos}: ${c.code} — ${summarize(c.narrative)}` }));
  let score: number;
  if (ratio >= 0.8) score = 3;
  else if (ratio >= 0.5) score = 2;
  else if (ratio > 0) score = 1;
  else score = 0;
  return base(score, score === 3 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL", "MEDIUM", "CROSS_REFERENCED", evidence,
    `${linked.length} of ${treatmentCpt.length} billed CPT interventions map to an active goal's functional area (a CPT code alone does not prove the linkage — narrative support was checked). Active goal areas: ${[...activeGoalAreas].join(", ") || "none classified"}.`,
    score < 3 ? "Document explicitly how each billed intervention targets a specific active short-/long-term goal." : "No action needed.", criterion.id, criterion.maxPoints);
};

const dnDiscontinueWhenMet: Evaluator = (ctx, criterion) => {
  const metGoals = ctx.goalLifecycle.filter((g) => g.metDate !== NOT_FOUND);
  if (metGoals.length === 0) {
    return base(null, "N/A", "HIGH", "DERIVED", [], "No goal has been documented as met during this episode.", "No action needed.", criterion.id, criterion.maxPoints);
  }
  const violating = metGoals.filter((g) => g.treatmentAfterGoalMetFlag);
  const evidence: EvidenceRef[] = violating.map((g) => ({ page: NOT_FOUND, section: "Goal Lifecycle", text: `${g.goalId} met ${g.metDate}; billing continued targeting the same functional area afterward with no documented modification.` }));
  if (violating.length === 0) {
    return base(3, "PASS", "MEDIUM", "DERIVED", [], `${metGoals.length} goal(s) documented as met; no continued targeted billing was identified after the met-date without a documented modification.`, "No action needed.", criterion.id, criterion.maxPoints);
  }
  return base(0, "FAIL", "MEDIUM", "DERIVED", evidence, `${violating.length} of ${metGoals.length} met goal(s) show continued CPT billing targeting the same functional area after the documented met-date, with no modification/new-goal note identified: ${violating.map((g) => g.goalId).join(", ")}.`,
    "Document a modification or new goal when continuing to bill toward a functional area whose goal has already been met.", criterion.id, criterion.maxPoints);
};

// =====================================================================
// SECTION: Recertification (N/A when discharged before recert due)
// =====================================================================

function recertNotDueEvaluator(criterion: RubricCriterion): ReturnType<Evaluator> {
  return base(null, "N/A", "HIGH", "DERIVED", [], "No Recertification document was identified, and the episode's discharge occurred before a recertification fell due — consistent with the Key's own N/A-handling example.", "No action needed.", criterion.id, criterion.maxPoints);
}
function recertUnableToDetermineEvaluator(criterion: RubricCriterion): ReturnType<Evaluator> {
  return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", [], "No Recertification or Discharge document was identified in the uploaded batch — applicability of a recertification requirement could not be determined from this record alone.",
    "Confirm whether a recertification was due within this episode and, if so, include that document.", criterion.id, criterion.maxPoints);
}

function makeRecertEvaluator(narrativeField: "recert-generic" | "recert-pcc" | "recert-timely"): Evaluator {
  return (ctx, criterion) => {
    if (!ctx.recert) {
      return ctx.discharge ? recertNotDueEvaluator(criterion) : recertUnableToDetermineEvaluator(criterion);
    }
    if (narrativeField === "recert-pcc") {
      return base(null, "UNABLE_TO_VALIDATE", "HIGH", "EXTERNAL_VALIDATION_REQUIRED", [], "The uploaded therapy documentation does not contain PCC order evidence for the recertification.",
        criterion.pcc!.recommendedAction, criterion.id, criterion.maxPoints, { externalValidation: { required: true, reason: criterion.pcc!.reasonTemplate, recommendedAction: criterion.pcc!.recommendedAction } });
    }
    if (narrativeField === "recert-timely") {
      const dos = parseCalendarDate(ctx.recert.dos);
      const sig = parseCalendarDate(ctx.recert.originalSignature?.date ?? null);
      if (!dos || !sig) return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", [], "Recertification date and/or signature date could not be identified.", "Confirm both dates are documented.", criterion.id, criterion.maxPoints);
      const days = calendarDayDiff(dos, sig);
      const score = scoreByTimingRules(days, criterion.timingRules!);
      return base(score, score === 3 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL", "HIGH", "DERIVED", [], `Recertification date ${ctx.recert.dos}; signature ${ctx.recert.originalSignature?.date} — ${days} calendar day(s). UNVALIDATED extraction — see RecertExtractor.ts.`,
        score < 3 ? "Complete and sign the recertification promptly." : "No action needed.", criterion.id, criterion.maxPoints);
    }
    const text = ctx.recert.continuedSkillNarrative.text;
    const score = text !== NOT_FOUND && text.length > 40 ? 3 : text !== NOT_FOUND ? 2 : 0;
    return base(score, score === 3 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL", "LOW", "CROSS_REFERENCED", ctx.recert.continuedSkillNarrative.evidence,
      `${text !== NOT_FOUND ? `Documented: "${summarize(text)}". ` : "No narrative identified. "}UNVALIDATED extraction — no real Recertification sample exists to confirm this parser's field patterns; see RecertExtractor.ts.`,
      score < 3 ? "Document a patient-specific justification for continued/modified skilled services at recertification." : "No action needed.", criterion.id, criterion.maxPoints);
  };
}

// =====================================================================
// SECTION: Discharge Summary
// =====================================================================

const dcAllGoalsAddressed: Evaluator = (ctx, criterion) => {
  if (!ctx.discharge) {
    return base(null, "N/A", "HIGH", "DERIVED", [], "No Discharge Summary was identified in the uploaded batch — this episode may still be active, or the discharge document was not included.", "No action needed.", criterion.id, criterion.maxPoints);
  }
  const notAddressed = ctx.goalLifecycle.filter((g) => g.dischargeStatus === "Not Addressed");
  const addressed = ctx.goalLifecycle.filter((g) => g.dischargeStatus !== "Not Addressed" && g.dischargeStatus !== "Unknown");
  const evidence: EvidenceRef[] = ctx.discharge.rawGoals.slice(0, 4).map((g) => ({ page: g.page, section: "Objective Progress/Functional Comparison with Goals", text: `${g.id} - ${g.statusWord}` }));
  if (notAddressed.length === 0 && addressed.length > 0) {
    return base(3, "PASS", "HIGH", "DIRECT", evidence, `All ${addressed.length} goal(s) carried from the Plan of Care appear in the discharge table with a terminal status (${addressed.map((g) => `${g.goalId}: ${g.dischargeStatus}`).join(", ")}).`, "No action needed.", criterion.id, criterion.maxPoints);
  }
  if (notAddressed.length > 0) {
    return base(0, "FAIL", "HIGH", "DIRECT", evidence, `${notAddressed.length} goal(s) from the Plan of Care do not appear in the discharge goal table with any terminal status: ${notAddressed.map((g) => g.goalId).join(", ")}.`,
      "Ensure every goal from the Plan of Care is accounted for at discharge with an explicit status (Met/Partially Met/Not Met/Discontinued).", criterion.id, criterion.maxPoints);
  }
  return base(1, "PARTIAL", "LOW", "DIRECT", evidence, "Goal lifecycle could not be fully reconstructed to confirm every goal was addressed.", "Confirm every goal from the Plan of Care carries an explicit discharge status.", criterion.id, criterion.maxPoints);
};

const dcReasonForDischarge: Evaluator = (ctx, criterion) => {
  if (!ctx.discharge) {
    return base(null, "N/A", "HIGH", "DERIVED", [], "No Discharge Summary was identified in the uploaded batch.", "No action needed.", criterion.id, criterion.maxPoints);
  }
  const reason = ctx.discharge.dcReason;
  if (reason === NOT_FOUND) {
    return base(0, "FAIL", "HIGH", "DIRECT", [], "No reason for discharge was documented.", "Document a specific reason for discharge.", criterion.id, criterion.maxPoints);
  }
  const evidence: EvidenceRef[] = [{ page: ctx.discharge.originalSignature?.page ?? NOT_FOUND, section: "Identification Information", text: `D/C Reason: ${reason}` }];
  const isBoilerplateOnly = reason.trim().split(/\s+/).length <= 6 && !ctx.discharge.dcRecommendations.text;
  const score = isBoilerplateOnly ? 2 : 3;
  return base(score, score === 3 ? "PASS" : "PARTIAL", "MEDIUM", "DIRECT", evidence, `Documented reason for discharge: "${reason}".${ctx.discharge.dcRecommendations.text !== NOT_FOUND ? ` Supported by discharge recommendations: "${summarize(ctx.discharge.dcRecommendations.text)}".` : ""}`,
    score < 3 ? "Add supporting context for the discharge reason beyond the bare label." : "No action needed.", criterion.id, criterion.maxPoints);
};

const dcCompletedTimely: Evaluator = (ctx, criterion) => {
  if (!ctx.discharge) {
    return base(null, "N/A", "HIGH", "DERIVED", [], "No Discharge Summary was identified in the uploaded batch.", "No action needed.", criterion.id, criterion.maxPoints);
  }
  const dos = parseCalendarDate(ctx.discharge.periodEnd);
  const sig = parseCalendarDate(ctx.discharge.originalSignature?.date ?? null);
  if (!dos || !sig) {
    return base(null, "UNABLE_TO_VALIDATE", "LOW", "DERIVED", [], "Discharge date of service and/or original signature date could not be identified.", "Confirm both dates are documented and legible.", criterion.id, criterion.maxPoints);
  }
  const days = calendarDayDiff(dos, sig);
  const evidence: EvidenceRef[] = [{ page: ctx.discharge.originalSignature?.page ?? NOT_FOUND, section: "Discharge Summary", text: `Discharge DOS ${ctx.discharge.periodEnd}; original signature ${ctx.discharge.originalSignature?.date} — ${days} calendar day(s).` }];
  return base(null, "PENDING_RUBRIC_CONFIRMATION", "HIGH", "DERIVED", evidence,
    `FACTUAL FINDING: Discharge DOS ${ctx.discharge.periodEnd}, completed/signed ${ctx.discharge.originalSignature?.date} — a ${days}-calendar-day gap. The Key defines no timeliness thresholds for this criterion ("document completed timely" only); no numeric score is assigned until the actual organizational threshold is confirmed (see PRE_BUILD_RUBRIC_ANALYSIS.md Decision #1).`,
    "Confirm the organization's actual Discharge Summary timeliness threshold so this criterion can be scored.", criterion.id, criterion.maxPoints,
    { rubricConfirmation: { reason: criterion.ambiguityNote ?? "Key defines no thresholds for this criterion.", factualFinding: `${days} calendar day(s) between discharge DOS and completion/signature.` } });
};

const dcOrdersInPcc: Evaluator = (ctx, criterion) => {
  if (!ctx.discharge) {
    return base(null, "N/A", "HIGH", "DERIVED", [], "No Discharge Summary was identified in the uploaded batch.", "No action needed.", criterion.id, criterion.maxPoints);
  }
  const evidence: EvidenceRef[] = ctx.discharge.dcRecommendations.evidence;
  return base(null, "UNABLE_TO_VALIDATE", "HIGH", "EXTERNAL_VALIDATION_REQUIRED", evidence,
    `The uploaded therapy documentation does not contain PCC order evidence for the discharge. ${ctx.discharge.dcRecommendations.text !== NOT_FOUND ? `Discharge-disposition/home-health-referral language ("${summarize(ctx.discharge.dcRecommendations.text)}") is not, by itself, treated as proof of a matching PCC order — same standard used for the Evaluation-section Orders in PCC criterion, per confirmed decision.` : ""}`,
    criterion.pcc!.recommendedAction, criterion.id, criterion.maxPoints,
    { externalValidation: { required: true, reason: criterion.pcc!.reasonTemplate, recommendedAction: criterion.pcc!.recommendedAction } });
};

const EVALUATORS: Record<string, Evaluator> = {
  EVAL_MEDICAL_HISTORY: evalMedicalHistory,
  EVAL_MEDICATIONS: evalMedications,
  EVAL_COMPLETED_TIMELY: evalCompletedTimely,
  EVAL_HEALTH_STATUS_REFERRAL: evalHealthStatusReferral,
  EVAL_OBJECTIVE_TEST: evalObjectiveTest,
  EVAL_THERAPIST_ASSESSMENT: evalTherapistAssessment,
  EVAL_ORDERS_IN_PCC: evalOrdersInPcc,
  EVAL_MEDICAL_NECESSITY: evalMedicalNecessity,
  EVAL_ASSESSMENT_SUMMARY: evalAssessmentSummary,
  EVAL_LTG_JUSTIFICATION: evalLtgJustification,
  EVAL_STG_APPROPRIATE: evalStgAppropriate,

  PN_COMPLETED_TIMELY: pnCompletedTimely,
  PN_PATIENT_RESPONSE: pnPatientResponse,
  PN_POC_MODIFICATIONS: pnPocModifications,
  PN_TREATMENT_FREQUENCY: pnTreatmentFrequency,

  DN_PATIENT_RESPONSE: dnPatientResponse,
  DN_TREATMENT_PROGRESSION: dnTreatmentProgression,
  DN_ATTENDANCE_COMPLIANCE: dnAttendanceCompliance,
  DN_CAREGIVER_EDUCATION: dnCaregiverEducation,
  DN_LINKED_TO_GOALS: dnLinkedToGoals,
  DN_DISCONTINUE_WHEN_MET: dnDiscontinueWhenMet,

  RC_LTG_JUSTIFIED: makeRecertEvaluator("recert-generic"),
  RC_STG_APPROPRIATE: makeRecertEvaluator("recert-generic"),
  RC_TREATMENT_RELEVANT_TO_IMPAIRMENT: makeRecertEvaluator("recert-generic"),
  RC_TREATMENT_RELATED_TO_GOALS: makeRecertEvaluator("recert-generic"),
  RC_AMOUNT_FREQUENCY_DURATION: makeRecertEvaluator("recert-generic"),
  RC_CONTINUED_SERVICES_JUSTIFIED: makeRecertEvaluator("recert-generic"),
  RC_ORDERS_IN_PCC: makeRecertEvaluator("recert-pcc"),
  RC_COMPLETED_TIMELY: makeRecertEvaluator("recert-timely"),

  DC_ALL_GOALS_ADDRESSED: dcAllGoalsAddressed,
  DC_REASON_FOR_DISCHARGE: dcReasonForDischarge,
  DC_COMPLETED_TIMELY: dcCompletedTimely,
  DC_ORDERS_IN_PCC: dcOrdersInPcc,
};

export function runFullAudit(ctx: EpisodeContext): AuditCriterionResult[] {
  return evaluatorAuditRubric.criteria
    .filter((c) => c.applicableDisciplines.includes(ctx.discipline))
    .map((criterion) => {
      const evaluator = EVALUATORS[criterion.id];
      const result = evaluator(ctx, criterion);
      return {
        criterionId: criterion.id,
        section: criterion.section,
        criterion: criterion.title,
        maxPoints: criterion.maxPoints,
        scoringType: criterion.scoringType,
        ...result,
      };
    });
}

// Re-exported for callers that only need the v1 Evaluation-scope audit
// (kept for the dev-check scripts that validate against the original
// Arlington fixture, which has no Progress/Daily/Discharge documents).
export function runEvaluationAudit(
  extracted: ExtractedEvaluation,
  functionalChange: FunctionalChangeRow[],
  goalAnalysis: GoalAnalysis,
): AuditCriterionResult[] {
  const discipline: Discipline = extracted.discipline === NOT_FOUND ? "PT" : extracted.discipline;
  const ctx: EpisodeContext = {
    discipline,
    extracted,
    functionalChange,
    goalAnalysis,
    progressReports: [],
    dailyEncounters: [],
    discharge: null,
    recert: null,
    goalLifecycle: [],
    frequencyAnalyses: [],
    documentationSimilarity: [],
  };
  return evaluatorAuditRubric.criteria
    .filter((c) => c.section === "Evaluation Medical Review" || c.section === "Evaluation" || c.section === "Plan of Care/Treatment")
    .filter((c) => c.applicableDisciplines.includes(discipline))
    .map((criterion) => {
      const evaluator = EVALUATORS[criterion.id];
      const result = evaluator(ctx, criterion);
      return { criterionId: criterion.id, section: criterion.section, criterion: criterion.title, maxPoints: criterion.maxPoints, scoringType: criterion.scoringType, ...result };
    });
}
