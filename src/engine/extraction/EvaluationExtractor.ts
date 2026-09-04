import type { PageText } from "../pdf/PDFParser";
import { positionedLinesFromPageItems } from "../pdf/PDFParser";
import type { Discipline, EvidenceRef, NotFound } from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";
import { detectDisciplineFromHeading } from "../pdf/DocumentClassifier";
import { extractRows, parseInlineKeyValues } from "./rowExtraction";
import { parseRawGoals } from "./GoalBlockParser";
import { extractOriginalSignature } from "./sharedExtraction";
import type { DiagnosisEntry, ExtractedEvaluation, TreatmentApproachEntry } from "./extractionTypes";

/**
 * EvaluationExtractor
 * =====================
 * Turns the raw page text of the Initial Evaluation & Plan of Treatment
 * boundary into the structured ExtractedEvaluation model. Every field is
 * either a value found verbatim in the source text (returns NOT_FOUND
 * otherwise — never guessed) or a direct, cited transformation of one
 * (e.g. joining wrapped lines). No clinical judgment happens here — that's
 * the AuditEngine's job, working from this structured, evidence-linked
 * model.
 */

function notFound<T extends string>(v: T | undefined | null): T | NotFound {
  return v && v.trim() ? (v.trim() as T) : NOT_FOUND;
}

function ev(page: number | NotFound, section: string, text: string): EvidenceRef {
  return { page, section, text };
}

function findFirst(fullText: string, re: RegExp): string | undefined {
  const m = fullText.match(re);
  return m?.[1]?.trim();
}

/** Full-text prompt/value search used ONLY for the handful of fields whose
 *  vendor-template row label wraps across two physical lines (which breaks
 *  the row-based extractor's label-start detection — see rowExtraction.ts
 *  header comment). Bounded by an explicit stop lookahead per field rather
 *  than a generic "next prompt" scan, since only these two fields need it. */
function extractBoundedNarrative(fullText: string, startRe: RegExp, stopRe: RegExp): string | undefined {
  const startMatch = fullText.match(startRe);
  if (!startMatch || startMatch.index === undefined) return undefined;
  const from = startMatch.index + startMatch[0].length;
  const rest = fullText.slice(from);
  const stopMatch = rest.match(stopRe);
  const raw = stopMatch && stopMatch.index !== undefined ? rest.slice(0, stopMatch.index) : rest;
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Some rows in this vendor template wrap their left-column label across two
 * physical lines (e.g. "Reason for" / "Therapy"). Because the label sits at
 * a smaller x than the value column, the wrapped SECOND label line lands at
 * the same y as a VALUE continuation line and gets glued onto it when text
 * is fully flattened — producing artifacts like "...is medically Therapy
 * necessary...". Rebuilding the text using only items at/after the value
 * column's x removes the leaked label fragment without disturbing the
 * narrative itself. Threshold picked empirically from this template's
 * table geometry (label column ~x42, value column starts ~x120).
 */
const VALUE_COLUMN_MIN_X = 100;

function buildValueColumnText(pages: PageText[]): string {
  const out: string[] = [];
  for (const page of pages) {
    const positionedLines = positionedLinesFromPageItems(page.items).sort((a, b) => b.y - a.y);
    for (const line of positionedLines) {
      const kept = line.items.filter((it) => it.x >= VALUE_COLUMN_MIN_X).map((it) => it.str);
      if (kept.length) out.push(kept.join(" ").replace(/\s+/g, " ").trim());
    }
  }
  return out.join("\n");
}

export function extractEvaluation(evaluationPages: PageText[]): ExtractedEvaluation {
  const fullText = evaluationPages.map((p) => p.rawText).join("\n");
  const valueColumnText = buildValueColumnText(evaluationPages);
  const rows = extractRows(evaluationPages);
  const rawGoals = parseRawGoals(evaluationPages);

  const findRow = (label: string) => rows.find((r) => r.rowLabel.toLowerCase() === label.toLowerCase());
  const findRows = (label: string) => rows.filter((r) => r.rowLabel.toLowerCase() === label.toLowerCase());

  // ---- Header / identification -------------------------------------------------
  const discipline: Discipline | NotFound = detectDisciplineFromHeading(evaluationPages) ?? NOT_FOUND;
  const facility = notFound(findFirst(fullText, /Provider:\s*(.+?)(?:\s{2,}|\n)/));
  const patientName = notFound(findFirst(fullText, /Patient:\s*(.+?)\s{2,}DOB:/));
  const dob = notFound(findFirst(fullText, /DOB:\s*([\d/]+)/));
  const mrn = notFound(findFirst(fullText, /MRN:\s*(\S+)/));
  const payer = notFound(findFirst(fullText, /Payer:\s*(.+?)\n/));
  const startOfCare = notFound(findFirst(fullText, /Start of Care:\s*([\d/]+)/));
  const certRange = findFirst(fullText, /Cert(?:ification)?\.?\s*Period:\s*([\d/]+)\s*-\s*([\d/]+)/i);
  const certMatch = fullText.match(/Cert(?:ification)?\.?\s*Period:\s*([\d/]+)\s*-\s*([\d/]+)/i);
  const certificationStart = notFound(certMatch?.[1]);
  const certificationEnd = notFound(certMatch?.[2]);
  void certRange;

  // ---- Signatures ----------------------------------------------------------
  // Uses the shared signature parser (sharedExtraction.ts) rather than its
  // own copy of this regex — this used to be a separate, hand-duplicated
  // pattern here with a narrower credential list that missed "OTR"/"OTA"
  // signers entirely (silently producing "Not Found" evaluator/completion
  // date for any evaluation signed by one). Keeping one shared, tested
  // pattern means a credential fix like that only has to happen once.
  const therapistSig = extractOriginalSignature(fullText);
  const therapistName = notFound(therapistSig?.name);
  const therapistSignatureDate = notFound(therapistSig?.date);
  const therapistSignaturePage = findEvidencePage(evaluationPages, "Original Signature:");
  const planOfTreatmentPage = findEvidencePage(evaluationPages, "Frequency:");

  const physicianSigMatch = fullText.match(
    /Physician Signature:\s*Electronically signed by\s+([^,\n]+),?\s*MD[\s\S]{0,120}?Date:\s*([\d/]+\s+[\d:]+\s*(?:AM|PM)?\s*[A-Z]{2,4})/i,
  );
  const physicianName = notFound(physicianSigMatch?.[1]);
  const physicianSignatureDate = notFound(physicianSigMatch?.[2]);
  // NOTE: the source PDF's "☐ Physician Signature Not Required" is a
  // checkbox; pdf.js text extraction cannot reliably tell checked from
  // unchecked (both render the same label text). Rather than guess, we only
  // assert `true` when an actual physician signature was found in the text
  // (unambiguous), and report "Unknown" otherwise instead of fabricating a
  // checkbox state.
  const physicianSignatureRequired: boolean | "Unknown" = physicianSigMatch ? true : "Unknown";

  // ---- Diagnoses -------------------------------------------------------------
  const diagnoses: DiagnosisEntry[] = [];
  for (const page of evaluationPages) {
    for (const line of page.lines) {
      const m = line.match(/^(Med|Tx)\s+([A-Z0-9.]{3,10})\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/);
      if (m) {
        diagnoses.push({ type: m[1], code: m[2], description: m[3].trim(), onset: m[4], page: page.pageNumber });
      }
    }
  }
  const medicalDiagnosis = notFound(diagnoses.find((d) => d.type === "Med")?.description);
  const treatmentDiagnosis = notFound(diagnoses.find((d) => d.type === "Tx")?.description);

  // ---- Plan of Treatment: approaches / frequency / duration / intensity -----
  const treatmentApproaches: TreatmentApproachEntry[] = [];
  const potBlockMatch = fullText.match(/Plan of Treatment\s*Treatment Approaches May Include\s*([\s\S]*?)Frequency:/i);
  if (potBlockMatch) {
    const approachLines = potBlockMatch[1].split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of approachLines) {
      const m = line.match(/^l?\s*(.+?)\s*\((\d{5})\)\s*$/);
      if (m) treatmentApproaches.push({ name: m[1].trim(), cptCode: m[2] });
      else if (line.length > 1) treatmentApproaches.push({ name: line.replace(/^l\s*/, "").trim(), cptCode: null });
    }
  }
  const frequency = notFound(findFirst(fullText, /Frequency:\s*(.+?)\n/));
  const duration = notFound(findFirst(fullText, /Duration:\s*(.+?)\n/));
  const intensity = notFound(findFirst(fullText, /Intensity:\s*(.+?)\n/));

  // ---- Narrative rows (row-extraction handles these cleanly; see tests) ----
  const currentReferralRow = findRow("Current Referral");
  const reasonForReferralText = currentReferralRow
    ? notFound(currentReferralRow.text.replace(/^Reason for Referral\s*\/?\s*Current Illness:\s*/i, "").replace(/\n/g, " "))
    : NOT_FOUND;

  const medicalHxRow = findRow("Medical Hx");
  const medicalHistoryText = medicalHxRow
    ? notFound(medicalHxRow.text.replace(/^Prior Medical History:\s*/i, "").replace(/\n/g, " "))
    : NOT_FOUND;

  const medicationsRow = findRow("Medications");
  const medicationsText = medicationsRow
    ? notFound(medicationsRow.text.replace(/^Medications Impacting Condition\/Treatment:\s*/i, "").replace(/\n/g, " "))
    : NOT_FOUND;

  const fallHistoryRow = findRow("History of Falls");
  const fallHistoryText = fallHistoryRow ? notFound(fallHistoryRow.text.replace(/\n/g, " ")) : NOT_FOUND;

  const priorLivingRows = findRows("Prior Living");
  const priorEquipmentRow = findRow("Prior Equipment");
  const priorLivingText = notFound(
    [...priorLivingRows.map((r) => r.text), priorEquipmentRow?.text ?? ""].join(" ").replace(/\n/g, " ").trim(),
  );

  const painRow = findRow("Pain");
  const painText = painRow ? notFound(painRow.text.replace(/\n/g, " ")) : NOT_FOUND;

  const communicationRow = findRow("Communication");
  const communicationText = communicationRow ? notFound(communicationRow.text.split("\n")[0]) : NOT_FOUND;

  // Cognition row can absorb a wrapped "Reason for Therapy" label overflow
  // (see rowExtraction.ts header comment) — only the first line is the
  // actual Cognition value; extractBoundedNarrative (below) recovers the
  // Reason for Therapy text independently and correctly.
  const cognitionRow = findRow("Cognition");
  const cognitionText = cognitionRow ? notFound(cognitionRow.text.split("\n")[0]) : NOT_FOUND;

  const complexitiesRow = findRow("Complexities");
  const complexitiesText = complexitiesRow ? notFound(complexitiesRow.text.replace(/\n/g, " ")) : NOT_FOUND;

  // "Reason for Therapy" and "Prior Level(s) of Function" both wrap their
  // row label across two physical lines in this vendor template, which the
  // row extractor can't anchor on — recovered here via bounded full-text
  // search instead (see module docstring).
  const reasonForTherapyText = notFound(
    extractBoundedNarrative(
      valueColumnText,
      /Clinical Impressions\/Reason for Skilled Services:\s*/i,
      /\n(?:Barriers Likely to Impact Discharge to Next Level|Patient Characteristics that may Impact Treatment|Can interventions be provided)/i,
    ),
  );

  const plofListText = extractBoundedNarrative(fullText, /\bPLOF:\s*/i, /\n(?:Fall Risk Assessment|History of Falls|Has Patient fallen)/i);
  const plofFunctionalItems = plofListText
    ? parseInlineKeyValues(plofListText).map((kv) => ({
        label: kv.label,
        value: kv.value,
        evidence: [ev(findEvidencePage(evaluationPages, "PLOF:"), "Prior Level(s) of Function", `PLOF: ${plofListText}`)],
      }))
    : [];

  // ---- CLOF (Functional Mobility Assessment) --------------------------------
  const CLOF_ROW_LABELS = ["Bed Mobility", "Transfers", "Ambulation", "Curbs/Stairs", "W/C Mobility", "Other"];
  const clofFunctionalItems: { label: string; value: string; evidence: EvidenceRef[] }[] = [];
  for (const label of CLOF_ROW_LABELS) {
    const row = findRow(label);
    if (!row) continue;
    const pairs = parseInlineKeyValues(row.text);
    for (const pair of pairs) {
      clofFunctionalItems.push({
        label: pair.label,
        value: pair.value,
        evidence: [ev(row.page, "Functional Mobility Assessment", `${row.rowLabel}: ${pair.label} = ${pair.value}`)],
      });
    }
  }

  // ---- Objective tests -------------------------------------------------------
  const objectiveTestRows = rows.filter((r) => r.section === "Objective Tests and Measures");
  const objectiveTests = objectiveTestRows.map((row) => {
    const pairs = parseInlineKeyValues(row.text);
    const primary = pairs[0];
    const name = primary ? `${row.rowLabel} ${primary.label}`.replace(/\s+/g, " ").trim() : row.rowLabel;
    const result = primary ? primary.value : row.text.replace(/\n/g, " ");
    return { name, result, evidence: [ev(row.page, "Objective Tests and Measures", `${row.rowLabel} ${row.text.replace(/\n/g, " ")}`)] };
  });

  return {
    discipline,
    facility,
    patientName,
    mrn,
    dob,
    payer,
    startOfCare,
    certificationStart,
    certificationEnd,
    therapistName,
    therapistSignatureDate,
    therapistSignaturePage,
    physicianName,
    physicianSignatureDate,
    physicianSignatureRequired,
    planOfTreatmentPage,
    diagnoses,
    medicalDiagnosis,
    treatmentDiagnosis,
    treatmentApproaches,
    frequency,
    duration,
    intensity,
    rows,
    rawGoals,
    reasonForReferral: {
      text: reasonForReferralText,
      evidence: currentReferralRow ? [ev(currentReferralRow.page, "Patient Referral and History", currentReferralRow.text.replace(/\n/g, " "))] : [],
    },
    medicalHistory: {
      text: medicalHistoryText,
      evidence: medicalHxRow ? [ev(medicalHxRow.page, "Patient Referral and History", medicalHxRow.text.replace(/\n/g, " "))] : [],
    },
    medications: {
      text: medicationsText,
      evidence: medicationsRow ? [ev(medicationsRow.page, "Patient Referral and History", medicationsRow.text.replace(/\n/g, " "))] : [],
    },
    fallHistory: {
      text: fallHistoryText,
      evidence: fallHistoryRow ? [ev(fallHistoryRow.page, "Fall Risk Assessment", fallHistoryRow.text.replace(/\n/g, " "))] : [],
    },
    priorLivingAndEquipment: {
      text: priorLivingText,
      evidence: priorLivingRows.map((r) => ev(r.page, "Patient Referral and History", r.text.replace(/\n/g, " "))),
    },
    plofFunctionalItems,
    clofFunctionalItems,
    objectiveTests,
    painStatement: { text: painText, evidence: painRow ? [ev(painRow.page, "Other System/Condition Assessment", painRow.text.replace(/\n/g, " "))] : [] },
    communication: { text: communicationText, evidence: communicationRow ? [ev(communicationRow.page, "Assessment Summary", communicationRow.text.split("\n")[0])] : [] },
    cognition: { text: cognitionText, evidence: cognitionRow ? [ev(cognitionRow.page, "Assessment Summary", cognitionRow.text.split("\n")[0])] : [] },
    reasonForTherapy: {
      text: reasonForTherapyText,
      evidence: reasonForTherapyText !== NOT_FOUND ? [ev(findEvidencePage(evaluationPages, "Clinical Impressions"), "Assessment Summary", `Clinical Impressions/Reason for Skilled Services: ${reasonForTherapyText}`)] : [],
    },
    complexities: {
      text: complexitiesText,
      evidence: complexitiesRow ? [ev(complexitiesRow.page, "Assessment Summary", complexitiesRow.text.replace(/\n/g, " "))] : [],
    },
    evaluationBoundaryPages: {
      start: evaluationPages[0]?.pageNumber ?? 0,
      end: evaluationPages[evaluationPages.length - 1]?.pageNumber ?? 0,
    },
  };
}

function findEvidencePage(pages: PageText[], needle: string): number | NotFound {
  for (const p of pages) {
    if (p.rawText.includes(needle)) return p.pageNumber;
  }
  return NOT_FOUND;
}
