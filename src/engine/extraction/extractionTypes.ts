import type { Discipline, EvidenceRef, NotFound } from "../../types/audit";

/** A single "row" of the vendor's label/value table layout, e.g. the row
 *  whose left-column label is "Medical Hx" and whose content is
 *  "Prior Medical History: cervical CA, HTN, ...". Carries page + section
 *  for evidence traceability. */
export interface ExtractedRow {
  page: number;
  section: string;
  rowLabel: string;
  text: string;
}

export interface RawGoal {
  id: string; // e.g. "STG#1.0" / "LTG#2.0"
  kind: "STG" | "LTG";
  statusWord: string; // "New Goal" | "Continue" | "Discontinue on ..."
  statement: string;
  targetDate: string | NotFound;
  plofValue: string | NotFound;
  baselineValue: string | NotFound;
  subItemLabel: string | null; // e.g. "Picking up object" when the value row has its own descriptor
  page: number;
}

export interface DiagnosisEntry {
  type: "Med" | "Tx" | string;
  code: string;
  description: string;
  onset: string | NotFound;
  page: number;
}

export interface TreatmentApproachEntry {
  name: string;
  cptCode: string | null;
}

// ---------------------------------------------------------------------------
// v2 additions: Progress Report / Daily-Treatment-Encounter-Note / Discharge
// Summary / Recertification extraction models. See ProgressReportExtractor,
// DailyNoteExtractor, DischargeExtractor, RecertExtractor.
// ---------------------------------------------------------------------------

export interface SignatureBlock {
  name: string;
  credential: string;
  date: string; // date+time string as documented
}

export interface CptEntry {
  code: string;
  narrative: string;
}

/** One dated encounter parsed out of a "Treatment Encounter Note(s)"
 *  document, which packs MANY dated encounters into one PDF boundary. */
export interface DailyEncounter {
  dos: string | NotFound;
  completedDate: string | NotFound;
  precautions: string;
  contraindications: string;
  preTx: string;
  cptEntries: CptEntry[];
  coTreatmentRaw: string;
  responseToTx: string;
  complexities: string;
  supervisionRaw: string;
  originalSignature: SignatureBlock | null;
  cosignature: SignatureBlock | null;
  revisionSignature: SignatureBlock | null;
  page: number;
}

export interface ExtractedDailyNoteDocument {
  discipline: Discipline | NotFound;
  encounters: DailyEncounter[];
  boundaryPages: { start: number; end: number };
}

export interface ExtractedProgressReport {
  discipline: Discipline | NotFound;
  periodStart: string | NotFound;
  periodEnd: string | NotFound;
  selfReportedDaysSeen: number | null;
  diagnoses: DiagnosisEntry[];
  rawGoals: RawGoal[];
  patientProgress: { text: string | NotFound; evidence: EvidenceRef[] };
  originalSignature: (SignatureBlock & { page: number | NotFound }) | null;
  cosignature: (SignatureBlock & { page: number | NotFound }) | null;
  boundaryPages: { start: number; end: number };
}

export interface ExtractedDischarge {
  discipline: Discipline | NotFound;
  periodStart: string | NotFound;
  periodEnd: string | NotFound; // discharge DOS
  dcReason: string | NotFound;
  dcLocation: string | NotFound;
  diagnoses: DiagnosisEntry[];
  rawGoals: RawGoal[];
  dcRecommendations: { text: string | NotFound; evidence: EvidenceRef[] };
  originalSignature: (SignatureBlock & { page: number | NotFound }) | null;
  boundaryPages: { start: number; end: number };
}

/** Generic, UNVALIDATED-against-real-data extractor output for a
 *  Recertification document — no recert exists in the James Askew fixture
 *  (episode discharged before one fell due), so this shape follows the same
 *  vendor-family conventions as Evaluation/Progress but has not been checked
 *  against an actual sample. See RecertExtractor.ts header comment. */
export interface ExtractedRecert {
  discipline: Discipline | NotFound;
  dos: string | NotFound;
  rawGoals: RawGoal[];
  frequency: string | NotFound;
  continuedSkillNarrative: { text: string | NotFound; evidence: EvidenceRef[] };
  originalSignature: (SignatureBlock & { page: number | NotFound }) | null;
  boundaryPages: { start: number; end: number };
}

/** Everything pulled out of the Initial Evaluation & Plan of Treatment
 *  pages, with page-level provenance retained on every field so the
 *  AuditEngine can cite evidence rather than assert conclusions. */
export interface ExtractedEvaluation {
  discipline: Discipline | NotFound;
  facility: string | NotFound;
  patientName: string | NotFound;
  mrn: string | NotFound;
  dob: string | NotFound;
  payer: string | NotFound;
  startOfCare: string | NotFound;
  certificationStart: string | NotFound;
  certificationEnd: string | NotFound;

  therapistName: string | NotFound;
  therapistSignatureDate: string | NotFound; // date+time string as documented
  therapistSignaturePage: number | NotFound;
  physicianName: string | NotFound;
  physicianSignatureDate: string | NotFound;
  physicianSignatureRequired: boolean | "Unknown";
  planOfTreatmentPage: number | NotFound;

  diagnoses: DiagnosisEntry[];
  medicalDiagnosis: string | NotFound;
  treatmentDiagnosis: string | NotFound;
  treatmentApproaches: TreatmentApproachEntry[];
  frequency: string | NotFound;
  duration: string | NotFound;
  intensity: string | NotFound;

  rows: ExtractedRow[]; // full row index, for generic lookups / evidence search
  rawGoals: RawGoal[];

  // Convenience accessors resolved from `rows` (each carries its own evidence ref)
  reasonForReferral: { text: string | NotFound; evidence: EvidenceRef[] };
  medicalHistory: { text: string | NotFound; evidence: EvidenceRef[] };
  medications: { text: string | NotFound; evidence: EvidenceRef[] };
  fallHistory: { text: string | NotFound; evidence: EvidenceRef[] };
  priorLivingAndEquipment: { text: string | NotFound; evidence: EvidenceRef[] };

  plofFunctionalItems: { label: string; value: string; evidence: EvidenceRef[] }[];
  clofFunctionalItems: { label: string; value: string; evidence: EvidenceRef[] }[];

  objectiveTests: { name: string; result: string; evidence: EvidenceRef[] }[];

  painStatement: { text: string | NotFound; evidence: EvidenceRef[] };
  communication: { text: string | NotFound; evidence: EvidenceRef[] };
  cognition: { text: string | NotFound; evidence: EvidenceRef[] };
  reasonForTherapy: { text: string | NotFound; evidence: EvidenceRef[] };
  complexities: { text: string | NotFound; evidence: EvidenceRef[] };

  evaluationBoundaryPages: { start: number; end: number };
}
