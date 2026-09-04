/**
 * Core structured types for the Rehab Evaluator Audit application.
 *
 * These types are the contract between the extraction/audit engine and the
 * presentation layer. They mirror the JSON schema in the product spec.
 * NOTHING in this file encodes patient-specific data — it is pure structure.
 *
 * v2 note: this file was EXTENDED, not rebuilt, for the full-episode /
 * multi-discipline scope (see PRE_BUILD_RUBRIC_ANALYSIS.md). Everything a v1
 * caller relied on (RehabAuditResult's shape, AuditCriterionResult, etc.) is
 * still here with the same field names — new fields were added alongside.
 */

export type Discipline = "PT" | "OT" | "SLP";

export type DocumentType =
  | "EVALUATION"
  | "PROGRESS_REPORT"
  | "DAILY_TREATMENT_NOTE"
  | "RECERTIFICATION"
  | "DISCHARGE"
  | "OTHER";

export type AuditStatus =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "UNABLE_TO_VALIDATE"
  | "PENDING_RUBRIC_CONFIRMATION"
  | "N/A";

export type RiskLevel =
  | "SUPPORTED"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type EvidenceType =
  | "DIRECT"
  | "DERIVED"
  | "CROSS_REFERENCED"
  | "EXTERNAL_VALIDATION_REQUIRED";

/** Not Found sentinel used for any unextractable field. Never fabricate a value. */
export const NOT_FOUND = "Not Found" as const;
export type NotFound = typeof NOT_FOUND;

export interface EvidenceRef {
  page: number | NotFound;
  section: string;
  text: string;
}

export interface PatientInfo {
  name: string | NotFound;
  mrn: string | NotFound;
  dob: string | NotFound;
  facility: string | NotFound;
  payer: string | NotFound;
}

export interface TherapyEpisode {
  discipline: Discipline | NotFound;
  evaluator: string | NotFound;
  evaluationDOS: string | NotFound;
  completionDate: string | NotFound;
  therapistSignatureDate: string | NotFound;
  physicianSignatureDate: string | NotFound;
  startOfCare: string | NotFound;
  certificationStart: string | NotFound;
  certificationEnd: string | NotFound;
  medicalDiagnosis: string | NotFound;
  treatmentDiagnosis: string | NotFound;
  frequency: string | NotFound;
  duration: string | NotFound;
  intensity: string | NotFound;
  plannedCptCodes: string[];
  treatmentApproaches: string[];
}

export interface DocumentClassificationEntry {
  page: number;
  documentType: DocumentType;
  heading: string;
  confidence: Confidence;
}

export interface EpisodeBoundary {
  documentType: DocumentType;
  discipline: Discipline | NotFound;
  startPage: number;
  endPage: number;
}

export type FunctionalChangeDirection =
  | "Improved"
  | "Declined"
  | "Unchanged"
  | "Not Assessed";

export interface FunctionalChangeRow {
  area: string;
  plof: string | NotFound;
  clof: string | NotFound;
  change: FunctionalChangeDirection;
  notes?: string;
}

export interface GoalRecord {
  id: string;
  statement: string;
  baseline: string | NotFound;
  target: string | NotFound;
  targetDate: string | NotFound;
  functionalArea: string;
  measurable: boolean;
  aboveClof: boolean | "Unknown";
  relatedImpairment: string | NotFound;
  relatedDiagnosis: string | NotFound;
  relatedTreatment: string | NotFound;
  attainable: "Likely" | "Uncertain" | "Unrealistic";
  finding: string;
  page: number;
}

export interface GoalMappingEntry {
  stgId: string;
  ltgId: string | null;
  basis: string;
  confidence: Confidence;
}

export interface GoalLogicFinding {
  goalId: string;
  issue: string;
  detail: string;
}

export interface GoalAnalysis {
  shortTermGoals: GoalRecord[];
  longTermGoals: GoalRecord[];
  goalMapping: GoalMappingEntry[];
  logicFindings: GoalLogicFinding[];
}

export interface AuditCriterionResult {
  criterionId: string;
  section: string;
  criterion: string;
  score: number | null;
  maxPoints: number;
  scoringType: string;
  status: AuditStatus;
  risk: RiskLevel;
  confidence: Confidence;
  confidenceReason?: string;
  evidenceType: EvidenceType;
  evidence: EvidenceRef[];
  auditorComment: string;
  recommendation: string;
  externalValidation?: {
    required: boolean;
    reason: string;
    recommendedAction: string;
  };
  /** Present only when status === "PENDING_RUBRIC_CONFIRMATION". The score/
   *  maxPoints fields still carry the criterion's point value for display,
   *  but score is null and the points are excluded from the scored
   *  denominator — see AuditTotals.pendingRubricConfirmationOpportunity. */
  rubricConfirmation?: {
    reason: string;
    factualFinding: string;
    observationalHumanExample?: string;
  };
  /** Human reviewer override, kept separate from the original AI result. */
  review?: {
    overriddenScore: number | null;
    overriddenStatus?: AuditStatus;
    reviewerNote: string;
    reviewedBy?: string;
    reviewedAt?: string;
    marked: boolean;
  };
}

export interface AdditionalFinding {
  id: string;
  category: string;
  description: string;
  evidence: EvidenceRef[];
  confidence: Confidence;
}

export interface StrengthFinding {
  id: string;
  description: string;
  evidence: EvidenceRef[];
}

export interface TopOpportunity {
  finding: string;
  riskLevel: RiskLevel;
  whyItMatters: string;
  evidence: EvidenceRef[];
  recommendedImprovement: string;
}

export interface AuditTotals {
  earned: number;
  possible: number;
  percentage: number;
  passed: number;
  partial: number;
  failed: number;
  unableToValidate: number;
  scoredOpportunity: number;
  externalValidationOpportunity: number;
  externalValidationCriteriaCount: number;
  /** Criteria whose Key rule itself is undefined (not merely missing
   *  evidence) — see PENDING_RUBRIC_CONFIRMATION in AuditStatus. Tracked
   *  separately and excluded from `percentage`, same as external validation. */
  pendingRubricConfirmation: number;
  pendingRubricConfirmationOpportunity: number;
  pendingRubricConfirmationCriteriaCount: number;
}

// ---------------------------------------------------------------------------
// v2 additions: episode timeline, goal lifecycle, treatment frequency,
// documentation similarity/consistency. See PRE_BUILD_RUBRIC_ANALYSIS.md
// Section G for why these are additive, not replacements.
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  documentType: DocumentType;
  discipline: Discipline | NotFound;
  /** Date of service (single date for Evaluation/Daily encounters) or the
   *  period start for a Progress Report / Discharge Summary spanning a range. */
  dos: string | NotFound;
  dosEnd: string | NotFound;
  completionDate: string | NotFound;
  signatureDate: string | NotFound;
  clinician: string | NotFound;
  pages: { start: number; end: number };
}

export type GoalTerminalStatus =
  | "Met"
  | "Partially Met"
  | "Not Met"
  | "Discontinued"
  | "Not Addressed"
  | "Continuing"
  | "Unknown";

export interface GoalProgressStatus {
  date: string | NotFound;
  sourceDocument: DocumentType;
  status: string; // verbatim status word from the source, e.g. "Continue", "Goal Met"
  value: string | NotFound;
  page: number | NotFound;
}

export interface GoalLifecycleRecord {
  goalId: string;
  discipline: Discipline | NotFound;
  kind: "STG" | "LTG";
  goalText: string;
  baseline: string | NotFound;
  target: string | NotFound;
  targetDate: string | NotFound;
  evaluationStatus: string;
  progressStatuses: GoalProgressStatus[];
  metDate: string | NotFound;
  modifiedDate: string | NotFound;
  discontinuedDate: string | NotFound;
  dischargeStatus: GoalTerminalStatus;
  /** True when this goal was met on a documented date but CPT billing
   *  continued to target it afterward without a documented modification —
   *  feeds Daily Notes "Discontinued When Goal Met". */
  treatmentAfterGoalMetFlag: boolean;
}

export interface FrequencyWeekRow {
  weekLabel: string;
  orderedFrequency: string | NotFound;
  actualUniqueDOS: string[];
  missedOrRefused: string[];
  variance: number | NotFound;
  finding: string;
}

export interface FrequencyAnalysis {
  discipline: Discipline | NotFound;
  orderedFrequencyRaw: string | NotFound;
  sourceDocument: string;
  rows: FrequencyWeekRow[];
  toleranceApplied: { type: string; varianceVisitsAllowed: number };
}

export type SimilarityDimension =
  | "ResponseToTreatment"
  | "TreatmentNarrative"
  | "CaregiverEducation"
  | "SkilledNeedLanguage";

export type SimilarityClassification =
  | "Patient-specific"
  | "Template-heavy"
  | "Near duplicate"
  | "Exact duplicate";

export interface DocumentationSimilarityFinding {
  dimension: SimilarityDimension;
  discipline: Discipline | NotFound;
  classification: SimilarityClassification;
  datesCompared: string[];
  sampleText: string;
  note: string;
}

export interface DocumentationConsistencyFinding {
  field: string;
  discipline: Discipline | NotFound;
  values: { date: string | NotFound; value: string; sourceDocType: DocumentType; page: number | NotFound }[];
  note: string;
}

export interface RubricConfirmationItem {
  criterionId: string;
  criterion: string;
  section: string;
  factualFinding: string;
  potentialPoints: number;
  note: string;
}

export interface RehabAuditResult {
  discipline: Discipline | NotFound;
  patient: PatientInfo;
  therapyEpisode: TherapyEpisode;
  documentClassification: DocumentClassificationEntry[];
  episodeBoundaries: EpisodeBoundary[];
  timeline: TimelineEntry[];
  functionalChange: FunctionalChangeRow[];
  audit: AuditCriterionResult[];
  goalAnalysis: GoalAnalysis;
  goalLifecycle: GoalLifecycleRecord[];
  frequencyAnalysis: FrequencyAnalysis[];
  documentationSimilarity: DocumentationSimilarityFinding[];
  documentationConsistency: DocumentationConsistencyFinding[];
  additionalFindings: AdditionalFinding[];
  strengths: StrengthFinding[];
  correctiveActions: string[];
  externalValidationNeeded: string[];
  rubricConfirmationNeeded: RubricConfirmationItem[];
  totals: AuditTotals;
  /** Statement required to appear in the UI, carried in the data too for export fidelity. */
  disclaimer: string;
  generatedAt: string;
  module: "REHAB_EVALUATOR_AUDIT";
}

/** Top-level batch result: one RehabAuditResult PER DISCIPLINE found in the
 *  uploaded NetHealth batch, plus whatever is genuinely shared across the
 *  whole batch (document classification, boundaries) and an optional
 *  informational cross-discipline summary. Disciplines are never blended
 *  when calculating a score — see PRE_BUILD_RUBRIC_ANALYSIS.md principle #6. */
export interface EpisodeAuditReport {
  batchPatient: PatientInfo;
  documentClassification: DocumentClassificationEntry[];
  episodeBoundaries: EpisodeBoundary[];
  disciplineAudits: RehabAuditResult[];
  documentationConsistency: DocumentationConsistencyFinding[];
  disclaimer: string;
  generatedAt: string;
}
