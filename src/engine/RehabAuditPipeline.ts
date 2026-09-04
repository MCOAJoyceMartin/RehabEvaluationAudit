import { extractPageTexts, type PdfDocumentLike, type PageText } from "./pdf/PDFParser";
import { classifyDocumentPages } from "./pdf/DocumentClassifier";
import { detectEpisodeBoundaries, detectDisciplinesInBatch, boundariesForDiscipline } from "./pdf/EpisodeDetector";
import { extractEvaluation } from "./extraction/EvaluationExtractor";
import { extractProgressReport } from "./extraction/ProgressReportExtractor";
import { extractDailyNoteEncounters } from "./extraction/DailyNoteExtractor";
import { extractDischarge } from "./extraction/DischargeExtractor";
import { extractRecert } from "./extraction/RecertExtractor";
import { buildFunctionalChangeTable } from "./audit/FunctionalComparisonEngine";
import { analyzeGoals } from "./audit/GoalAnalysisEngine";
import { runFullAudit, EDUCATION_CONTENT_RE, type EpisodeContext } from "./audit/AuditEngine";
import { buildGoalLifecycle } from "./audit/GoalLifecycleEngine";
import { analyzeFrequency } from "./audit/TreatmentFrequencyEngine";
import { analyzeDocumentationSimilarity } from "./audit/DocumentationSimilarityEngine";
import { checkFieldConsistency } from "./audit/DocumentationConsistencyEngine";
import { buildAdditionalFindings, buildAdditionalCorrectiveActions, buildStrengths } from "./audit/FindingsEngine";
import { evaluatorAuditRubric } from "../audit-rubrics/evaluatorAuditRubric";
import { validateRehabAuditResult, type ValidationOutcome } from "./validate/schemaValidate";
import { parseCalendarDate } from "../utils/dates";
import { NOT_FOUND } from "../types/audit";
import type {
  AuditCriterionResult,
  AuditTotals,
  Discipline,
  DocumentClassificationEntry,
  DocumentationConsistencyFinding,
  DocumentType,
  EpisodeAuditReport,
  EpisodeBoundary,
  NotFound,
  RehabAuditResult,
  RubricConfirmationItem,
  TimelineEntry,
} from "../types/audit";
import type {
  DailyEncounter,
  ExtractedDailyNoteDocument,
  ExtractedDischarge,
  ExtractedEvaluation,
  ExtractedProgressReport,
  ExtractedRecert,
} from "./extraction/extractionTypes";

export const DISCLAIMER =
  "AI-assisted clinical documentation review. Findings are intended to support, not replace, qualified clinical review.";

function computeTotals(audit: AuditCriterionResult[]): AuditTotals {
  const scored = audit.filter((a) => a.status !== "N/A" && a.status !== "UNABLE_TO_VALIDATE" && a.status !== "PENDING_RUBRIC_CONFIRMATION");
  const unable = audit.filter((a) => a.status === "UNABLE_TO_VALIDATE");
  const pending = audit.filter((a) => a.status === "PENDING_RUBRIC_CONFIRMATION");

  const earned = scored.reduce((s, a) => s + (a.score ?? 0), 0);
  const possible = scored.reduce((s, a) => s + a.maxPoints, 0);

  return {
    earned,
    possible,
    percentage: possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0,
    passed: audit.filter((a) => a.status === "PASS").length,
    partial: audit.filter((a) => a.status === "PARTIAL").length,
    failed: audit.filter((a) => a.status === "FAIL").length,
    unableToValidate: unable.length,
    scoredOpportunity: possible,
    externalValidationOpportunity: unable.reduce((s, a) => s + a.maxPoints, 0),
    externalValidationCriteriaCount: unable.length,
    pendingRubricConfirmation: pending.length,
    pendingRubricConfirmationOpportunity: pending.reduce((s, a) => s + a.maxPoints, 0),
    pendingRubricConfirmationCriteriaCount: pending.length,
  };
}

function pagesForBoundary(pages: PageText[], boundary: EpisodeBoundary): PageText[] {
  return pages.filter((p) => p.pageNumber >= boundary.startPage && p.pageNumber <= boundary.endPage);
}

function dateMs(v: string | NotFound | null | undefined): number {
  return parseCalendarDate(v ?? null)?.getTime() ?? 0;
}

function buildTimeline(
  discipline: Discipline,
  extracted: ExtractedEvaluation,
  progressReports: ExtractedProgressReport[],
  dailyDocs: ExtractedDailyNoteDocument[],
  discharge: ExtractedDischarge | null,
  recert: ExtractedRecert | null,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({
    documentType: "EVALUATION",
    discipline,
    dos: extracted.startOfCare,
    dosEnd: extracted.startOfCare,
    completionDate: extracted.therapistSignatureDate,
    signatureDate: extracted.therapistSignatureDate,
    clinician: extracted.therapistName,
    pages: extracted.evaluationBoundaryPages,
  });

  for (const pr of progressReports) {
    entries.push({
      documentType: "PROGRESS_REPORT",
      discipline,
      dos: pr.periodStart,
      dosEnd: pr.periodEnd,
      completionDate: pr.originalSignature?.date ?? NOT_FOUND,
      signatureDate: pr.originalSignature?.date ?? NOT_FOUND,
      clinician: pr.originalSignature?.name ?? NOT_FOUND,
      pages: pr.boundaryPages,
    });
  }

  for (const doc of dailyDocs) {
    const dates = doc.encounters.map((e) => e.dos).filter((d): d is string => d !== NOT_FOUND);
    const sorted = [...dates].sort((a, b) => dateMs(a) - dateMs(b));
    entries.push({
      documentType: "DAILY_TREATMENT_NOTE",
      discipline,
      dos: sorted[0] ?? NOT_FOUND,
      dosEnd: sorted[sorted.length - 1] ?? NOT_FOUND,
      completionDate: NOT_FOUND,
      signatureDate: NOT_FOUND,
      clinician: NOT_FOUND,
      pages: doc.boundaryPages,
    });
  }

  if (discharge) {
    entries.push({
      documentType: "DISCHARGE",
      discipline,
      dos: discharge.periodEnd,
      dosEnd: discharge.periodEnd,
      completionDate: discharge.originalSignature?.date ?? NOT_FOUND,
      signatureDate: discharge.originalSignature?.date ?? NOT_FOUND,
      clinician: discharge.originalSignature?.name ?? NOT_FOUND,
      pages: discharge.boundaryPages,
    });
  }

  if (recert) {
    entries.push({
      documentType: "RECERTIFICATION",
      discipline,
      dos: recert.dos,
      dosEnd: recert.dos,
      completionDate: recert.originalSignature?.date ?? NOT_FOUND,
      signatureDate: recert.originalSignature?.date ?? NOT_FOUND,
      clinician: recert.originalSignature?.name ?? NOT_FOUND,
      pages: recert.boundaryPages,
    });
  }

  return entries.sort((a, b) => dateMs(a.dos) - dateMs(b.dos));
}

interface DisciplineBuild {
  result: RehabAuditResult;
  extracted: ExtractedEvaluation;
  discharge: ExtractedDischarge | null;
}

/**
 * Builds one discipline's full RehabAuditResult. Nothing here is shared
 * across disciplines — every extraction, engine call, and score is derived
 * ONLY from this discipline's own boundaries, per the confirmed principle
 * that PT/OT/SLP audits are never blended (see PRE_BUILD_RUBRIC_ANALYSIS.md
 * principle #6).
 */
function buildDisciplineResult(
  discipline: Discipline,
  pages: PageText[],
  classification: DocumentClassificationEntry[],
  allBoundaries: EpisodeBoundary[],
): DisciplineBuild {
  const boundaries = boundariesForDiscipline(allBoundaries, discipline);
  const evalBoundary = boundaries.find((b) => b.documentType === "EVALUATION");
  if (!evalBoundary) {
    // detectDisciplinesInBatch only reports a discipline when an EVALUATION
    // boundary was found for it, so this should be unreachable — guarded
    // anyway rather than assuming.
    throw new Error(`No Initial Evaluation & Plan of Treatment document was identified for ${discipline} in this PDF.`);
  }

  const evaluationPages = pagesForBoundary(pages, evalBoundary);
  const extracted = extractEvaluation(evaluationPages);
  const functionalChange = buildFunctionalChangeTable(extracted);
  const goalAnalysis = analyzeGoals(extracted);

  const progressReports = boundaries
    .filter((b) => b.documentType === "PROGRESS_REPORT")
    .map((b) => extractProgressReport(pagesForBoundary(pages, b)))
    .sort((a, b) => dateMs(a.periodEnd) - dateMs(b.periodEnd));

  const dailyDocs = boundaries
    .filter((b) => b.documentType === "DAILY_TREATMENT_NOTE")
    .map((b) => extractDailyNoteEncounters(pagesForBoundary(pages, b)));
  const dailyEncounters: DailyEncounter[] = dailyDocs
    .flatMap((d) => d.encounters)
    .sort((a, b) => dateMs(a.dos) - dateMs(b.dos));

  const dischargeBoundary = boundaries.find((b) => b.documentType === "DISCHARGE");
  const discharge = dischargeBoundary ? extractDischarge(pagesForBoundary(pages, dischargeBoundary)) : null;

  const recertBoundary = boundaries.find((b) => b.documentType === "RECERTIFICATION");
  const recert = recertBoundary ? extractRecert(pagesForBoundary(pages, recertBoundary)) : null;

  const progressSnapshots = progressReports.map((pr) => ({ periodEnd: pr.periodEnd, page: pr.boundaryPages.start, goals: pr.rawGoals }));
  const goalLifecycle = buildGoalLifecycle(discipline, extracted.rawGoals, progressSnapshots, discharge?.rawGoals ?? null, dailyEncounters);

  const varianceVisitsAllowed =
    evaluatorAuditRubric.criteria.find((c) => c.id === "PN_TREATMENT_FREQUENCY")?.toleranceBand?.varianceVisitsAllowed ?? 0;
  const frequencyAnalyses = progressReports.map((pr) => {
    const start = parseCalendarDate(pr.periodStart);
    const end = parseCalendarDate(pr.periodEnd);
    const inPeriod = dailyEncounters.filter((e) => {
      const d = parseCalendarDate(e.dos === NOT_FOUND ? null : e.dos);
      return !!d && !!start && !!end && d >= start && d <= end;
    });
    return analyzeFrequency(
      discipline,
      extracted.frequency,
      extracted.startOfCare,
      inPeriod.map((e) => e.dos),
      `Progress Report ${pr.periodStart} - ${pr.periodEnd}`,
      varianceVisitsAllowed,
    );
  });

  const documentationSimilarity = analyzeDocumentationSimilarity(discipline, {
    ResponseToTreatment: dailyEncounters.map((e) => ({ date: e.dos, text: e.responseToTx })),
    TreatmentNarrative: dailyEncounters.map((e) => ({ date: e.dos, text: e.cptEntries.map((c) => c.narrative).join(" ") })),
    CaregiverEducation: dailyEncounters.map((e) => ({
      date: e.dos,
      text: e.cptEntries.filter((c) => EDUCATION_CONTENT_RE.test(c.narrative)).map((c) => c.narrative).join(" "),
    })),
  });

  const ctx: EpisodeContext = {
    discipline,
    extracted,
    functionalChange,
    goalAnalysis,
    progressReports,
    dailyEncounters,
    discharge,
    recert,
    goalLifecycle,
    frequencyAnalyses,
    documentationSimilarity,
  };

  const audit = runFullAudit(ctx);

  const additionalFindings = buildAdditionalFindings(extracted, functionalChange, documentationSimilarity, goalLifecycle, frequencyAnalyses);
  const strengths = buildStrengths(extracted, functionalChange, goalAnalysis, documentationSimilarity, frequencyAnalyses);
  const externalValidationNeeded = audit
    .filter((a) => a.externalValidation?.required)
    .map((a) => `${a.criterion}: ${a.externalValidation!.reason}`);
  const correctiveActions = [
    ...audit.filter((a) => a.status === "FAIL" || a.status === "PARTIAL").map((a) => `${a.criterion}: ${a.recommendation}`),
    ...buildAdditionalCorrectiveActions(documentationSimilarity, goalLifecycle, frequencyAnalyses),
  ];
  const rubricConfirmationNeeded: RubricConfirmationItem[] = audit
    .filter((a) => a.status === "PENDING_RUBRIC_CONFIRMATION" && a.rubricConfirmation)
    .map((a) => ({
      criterionId: a.criterionId,
      criterion: a.criterion,
      section: a.section,
      factualFinding: a.rubricConfirmation!.factualFinding,
      potentialPoints: a.maxPoints,
      note: a.rubricConfirmation!.reason,
    }));

  const timeline = buildTimeline(discipline, extracted, progressReports, dailyDocs, discharge, recert);
  const totals = computeTotals(audit);

  const result: RehabAuditResult = {
    discipline,
    patient: {
      name: extracted.patientName,
      mrn: extracted.mrn,
      dob: extracted.dob,
      facility: extracted.facility,
      payer: extracted.payer,
    },
    therapyEpisode: {
      discipline: extracted.discipline,
      evaluator: extracted.therapistName,
      evaluationDOS: extracted.startOfCare,
      completionDate: extracted.therapistSignatureDate,
      therapistSignatureDate: extracted.therapistSignatureDate,
      physicianSignatureDate: extracted.physicianSignatureDate,
      startOfCare: extracted.startOfCare,
      certificationStart: extracted.certificationStart,
      certificationEnd: extracted.certificationEnd,
      medicalDiagnosis: extracted.medicalDiagnosis,
      treatmentDiagnosis: extracted.treatmentDiagnosis,
      frequency: extracted.frequency,
      duration: extracted.duration,
      intensity: extracted.intensity,
      plannedCptCodes: extracted.treatmentApproaches.map((t) => t.cptCode).filter((c): c is string => !!c),
      treatmentApproaches: extracted.treatmentApproaches.map((t) => t.name),
    },
    documentClassification: classification,
    episodeBoundaries: boundaries,
    timeline,
    functionalChange,
    audit,
    goalAnalysis,
    goalLifecycle,
    frequencyAnalysis: frequencyAnalyses,
    documentationSimilarity,
    // Cross-discipline consistency is computed once at the batch level (see
    // buildCrossDisciplineConsistency) and surfaced on EpisodeAuditReport —
    // never duplicated per-discipline here.
    documentationConsistency: [],
    additionalFindings,
    strengths,
    correctiveActions,
    externalValidationNeeded,
    rubricConfirmationNeeded,
    totals,
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    module: "REHAB_EVALUATOR_AUDIT",
  };

  return { result, extracted, discharge };
}

/**
 * Cross-discipline documentation consistency: fields that SHOULD agree
 * across a batch containing more than one discipline's documentation for
 * the same patient/episode (payer, a shared diagnosis's onset date,
 * discharge disposition). Per spec, this only ever flags a POTENTIAL
 * inconsistency for reviewer attention (see DocumentationConsistencyEngine)
 * — it never asserts which value is correct, and produces nothing when
 * only one discipline is present (there is nothing to cross-check).
 */
function buildCrossDisciplineConsistency(
  disciplineData: { discipline: Discipline; extracted: ExtractedEvaluation; discharge: ExtractedDischarge | null }[],
): DocumentationConsistencyFinding[] {
  const findings: DocumentationConsistencyFinding[] = [];
  if (disciplineData.length < 2) return findings;

  const payerValues = disciplineData.map((d) => ({
    date: d.extracted.startOfCare,
    value: d.extracted.payer === NOT_FOUND ? "" : d.extracted.payer,
    sourceDocType: "EVALUATION" as DocumentType,
    page: d.extracted.planOfTreatmentPage,
  }));
  const payerFinding = checkFieldConsistency("Payer", NOT_FOUND, payerValues);
  if (payerFinding) findings.push(payerFinding);

  const onsetsByDescription = new Map<string, { date: string | NotFound; value: string; sourceDocType: DocumentType; page: number | NotFound }[]>();
  for (const d of disciplineData) {
    for (const diag of d.extracted.diagnoses) {
      const key = diag.description.trim().toLowerCase();
      if (!key) continue;
      if (!onsetsByDescription.has(key)) onsetsByDescription.set(key, []);
      onsetsByDescription.get(key)!.push({
        date: diag.onset,
        value: diag.onset === NOT_FOUND ? "" : diag.onset,
        sourceDocType: "EVALUATION",
        page: diag.page,
      });
    }
  }
  for (const [description, values] of onsetsByDescription) {
    const finding = checkFieldConsistency(`Diagnosis Onset Date — ${description}`, NOT_FOUND, values);
    if (finding) findings.push(finding);
  }

  const dcValues = disciplineData
    .filter((d): d is typeof d & { discharge: ExtractedDischarge } => d.discharge !== null)
    .map((d) => ({
      date: d.discharge.periodEnd,
      value: d.discharge.dcLocation === NOT_FOUND ? "" : d.discharge.dcLocation,
      sourceDocType: "DISCHARGE" as DocumentType,
      page: d.discharge.originalSignature?.page ?? NOT_FOUND,
    }));
  const dcFinding = checkFieldConsistency("Discharge Disposition", NOT_FOUND, dcValues);
  if (dcFinding) findings.push(dcFinding);

  return findings;
}

export interface EpisodeAuditPipelineResult {
  report: EpisodeAuditReport;
  validations: Partial<Record<Discipline, ValidationOutcome>>;
}

/**
 * Runs the full Rehab Evaluator Audit pipeline against an already-loaded
 * pdf.js document (browser and Node callers construct that document
 * differently — see loadPdfBrowser.ts and scripts/lib/loadPdfNode.mjs).
 * Produces ONE RehabAuditResult per discipline detected in the uploaded
 * NetHealth batch (never blended — see PRE_BUILD_RUBRIC_ANALYSIS.md
 * principle #6), plus a batch-level documentation-consistency check.
 */
export async function runRehabEvaluatorAudit(pdfDoc: PdfDocumentLike): Promise<EpisodeAuditPipelineResult> {
  const pages = await extractPageTexts(pdfDoc);
  const classification = classifyDocumentPages(pages);
  const boundaries = detectEpisodeBoundaries(classification, pages);
  const disciplines = detectDisciplinesInBatch(boundaries);

  if (disciplines.length === 0) {
    throw new Error(
      "No Initial Evaluation & Plan of Treatment document was identified in this PDF for any discipline. Upload a record that includes at least one PT/OT/SLP evaluation.",
    );
  }

  const builds = disciplines.map((d) => buildDisciplineResult(d, pages, classification, boundaries));

  const validations: Partial<Record<Discipline, ValidationOutcome>> = {};
  for (const b of builds) {
    validations[b.result.discipline as Discipline] = validateRehabAuditResult(b.result);
  }

  const documentationConsistency = buildCrossDisciplineConsistency(
    builds.map((b) => ({ discipline: b.result.discipline as Discipline, extracted: b.extracted, discharge: b.discharge })),
  );

  const report: EpisodeAuditReport = {
    batchPatient: builds[0].result.patient,
    documentClassification: classification,
    episodeBoundaries: boundaries,
    disciplineAudits: builds.map((b) => b.result),
    documentationConsistency,
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };

  return { report, validations };
}

export interface PipelineResult {
  result: RehabAuditResult;
  validation: ValidationOutcome;
}

/**
 * Backward-compatible single-discipline entry point, kept for existing
 * callers (App.tsx pre-multi-discipline-UI, scripts/dev-run-pipeline.ts)
 * until the UI is updated to consume the full multi-discipline
 * EpisodeAuditReport (see PRE_BUILD_RUBRIC_ANALYSIS.md Section G item 5).
 * Returns the first discipline detected in the batch.
 */
export async function runRehabEvaluationAudit(pdfDoc: PdfDocumentLike): Promise<PipelineResult> {
  const { report, validations } = await runRehabEvaluatorAudit(pdfDoc);
  const result = report.disciplineAudits[0];
  const validation = validations[result.discipline as Discipline] ?? { success: false, errors: ["No validation outcome was recorded for this discipline."] };
  return { result, validation };
}

export { buildTopOpportunities } from "./audit/FindingsEngine";
