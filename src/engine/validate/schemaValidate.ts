import { z } from "zod";
import type { RehabAuditResult } from "../../types/audit";

/**
 * schemaValidate
 * ===============
 * The structured AI output is validated against this schema BEFORE the
 * dashboard renders it (spec requirement: "Validate the response against a
 * schema before rendering."). This catches engine bugs (a criterion missing
 * required fields, an out-of-range score, etc.) rather than silently
 * rendering malformed data.
 *
 * v2 note: extended for the full 7-section, multi-discipline
 * RehabAuditResult shape. The newer longitudinal structures (timeline, goal
 * lifecycle, frequency analysis, documentation similarity/consistency) are
 * validated loosely (their fields may legitimately hold "Not Found" sentinels
 * or empty arrays in many shapes) — the audit/score/status integrity check
 * below is the safety-critical part and remains fully strict.
 */

const evidenceRefSchema = z.object({
  page: z.union([z.number(), z.literal("Not Found")]),
  section: z.string(),
  text: z.string(),
});

const auditStatusSchema = z.enum(["PASS", "PARTIAL", "FAIL", "UNABLE_TO_VALIDATE", "PENDING_RUBRIC_CONFIRMATION", "N/A"]);
const riskSchema = z.enum(["SUPPORTED", "LOW", "MODERATE", "HIGH", "CRITICAL"]);
const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const evidenceTypeSchema = z.enum(["DIRECT", "DERIVED", "CROSS_REFERENCED", "EXTERNAL_VALIDATION_REQUIRED"]);

const auditCriterionSchema = z
  .object({
    criterionId: z.string().min(1),
    section: z.string().min(1),
    criterion: z.string().min(1),
    score: z.number().min(0).nullable(),
    maxPoints: z.number().positive(),
    scoringType: z.string(),
    status: auditStatusSchema,
    risk: riskSchema,
    confidence: confidenceSchema,
    confidenceReason: z.string().optional(),
    evidenceType: evidenceTypeSchema,
    evidence: z.array(evidenceRefSchema),
    auditorComment: z.string().min(1),
    recommendation: z.string().min(1),
    externalValidation: z
      .object({ required: z.boolean(), reason: z.string(), recommendedAction: z.string() })
      .optional(),
    rubricConfirmation: z
      .object({
        reason: z.string(),
        factualFinding: z.string(),
        observationalHumanExample: z.string().optional(),
      })
      .optional(),
    review: z
      .object({
        overriddenScore: z.number().nullable(),
        overriddenStatus: auditStatusSchema.optional(),
        reviewerNote: z.string(),
        reviewedBy: z.string().optional(),
        reviewedAt: z.string().optional(),
        marked: z.boolean(),
      })
      .optional(),
  })
  .refine((c) => c.score === null || c.score <= c.maxPoints, {
    message: "score must not exceed maxPoints",
  })
  .refine(
    (c) => {
      if (c.status === "UNABLE_TO_VALIDATE" || c.status === "PENDING_RUBRIC_CONFIRMATION") return c.score === null;
      return true;
    },
    { message: "UNABLE_TO_VALIDATE / PENDING_RUBRIC_CONFIRMATION criteria must not carry a numeric score" },
  );

const goalRecordSchema = z.object({
  id: z.string(),
  statement: z.string(),
  baseline: z.string(),
  target: z.string(),
  targetDate: z.string(),
  functionalArea: z.string(),
  measurable: z.boolean(),
  aboveClof: z.union([z.boolean(), z.literal("Unknown")]),
  relatedImpairment: z.string(),
  relatedDiagnosis: z.string(),
  relatedTreatment: z.string(),
  attainable: z.enum(["Likely", "Uncertain", "Unrealistic"]),
  finding: z.string(),
});

// The newer longitudinal structures carry many optional/"Not Found"-sentinel
// fields whose exact shape is still evolving alongside the UI layer (see
// PRE_BUILD_RUBRIC_ANALYSIS.md Section G item 5) — validated permissively
// here as arrays of open records rather than fully-typed schemas, so a
// legitimate new field never trips a false validation failure while the
// dashboard for these panels is still being built.
const looseArray = z.array(z.record(z.string(), z.unknown()));

const rehabAuditResultSchema = z.object({
  discipline: z.string(),
  patient: z.object({
    name: z.string(),
    mrn: z.string(),
    dob: z.string(),
    facility: z.string(),
    payer: z.string(),
  }),
  therapyEpisode: z.object({
    discipline: z.string(),
    evaluator: z.string(),
    evaluationDOS: z.string(),
    completionDate: z.string(),
    therapistSignatureDate: z.string(),
    physicianSignatureDate: z.string(),
    startOfCare: z.string(),
    certificationStart: z.string(),
    certificationEnd: z.string(),
    medicalDiagnosis: z.string(),
    treatmentDiagnosis: z.string(),
    frequency: z.string(),
    duration: z.string(),
    intensity: z.string(),
    plannedCptCodes: z.array(z.string()),
    treatmentApproaches: z.array(z.string()),
  }),
  documentClassification: z.array(
    z.object({ page: z.number(), documentType: z.string(), heading: z.string(), confidence: confidenceSchema }),
  ),
  episodeBoundaries: z.array(
    z.object({ documentType: z.string(), discipline: z.string(), startPage: z.number(), endPage: z.number() }),
  ),
  timeline: looseArray,
  functionalChange: z.array(
    z.object({
      area: z.string(),
      plof: z.string(),
      clof: z.string(),
      change: z.enum(["Improved", "Declined", "Unchanged", "Not Assessed"]),
      notes: z.string().optional(),
    }),
  ),
  audit: z.array(auditCriterionSchema).min(1),
  goalAnalysis: z.object({
    shortTermGoals: z.array(goalRecordSchema),
    longTermGoals: z.array(goalRecordSchema),
    goalMapping: z.array(z.object({ stgId: z.string(), ltgId: z.string().nullable(), basis: z.string(), confidence: confidenceSchema })),
    logicFindings: z.array(z.object({ goalId: z.string(), issue: z.string(), detail: z.string() })),
  }),
  goalLifecycle: looseArray,
  frequencyAnalysis: looseArray,
  documentationSimilarity: looseArray,
  documentationConsistency: looseArray,
  additionalFindings: z.array(
    z.object({ id: z.string(), category: z.string(), description: z.string(), evidence: z.array(evidenceRefSchema), confidence: confidenceSchema }),
  ),
  strengths: z.array(z.object({ id: z.string(), description: z.string(), evidence: z.array(evidenceRefSchema) })),
  correctiveActions: z.array(z.string()),
  externalValidationNeeded: z.array(z.string()),
  rubricConfirmationNeeded: z.array(
    z.object({
      criterionId: z.string(),
      criterion: z.string(),
      section: z.string(),
      factualFinding: z.string(),
      potentialPoints: z.number(),
      note: z.string(),
    }),
  ),
  totals: z.object({
    earned: z.number(),
    possible: z.number(),
    percentage: z.number(),
    passed: z.number(),
    partial: z.number(),
    failed: z.number(),
    unableToValidate: z.number(),
    scoredOpportunity: z.number(),
    externalValidationOpportunity: z.number(),
    externalValidationCriteriaCount: z.number(),
    pendingRubricConfirmation: z.number(),
    pendingRubricConfirmationOpportunity: z.number(),
    pendingRubricConfirmationCriteriaCount: z.number(),
  }),
  disclaimer: z.string().min(1),
  generatedAt: z.string(),
  module: z.literal("REHAB_EVALUATOR_AUDIT"),
});

export interface ValidationOutcome {
  success: boolean;
  errors: string[];
}

export function validateRehabAuditResult(data: unknown): ValidationOutcome {
  const parsed = rehabAuditResultSchema.safeParse(data);
  if (parsed.success) return { success: true, errors: [] };
  return {
    success: false,
    errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

// Re-exported so callers can reference the canonical type without importing
// from two places.
export type { RehabAuditResult };
