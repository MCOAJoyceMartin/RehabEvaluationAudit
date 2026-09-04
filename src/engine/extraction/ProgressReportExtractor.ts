import type { PageText } from "../pdf/PDFParser";
import { NOT_FOUND } from "../../types/audit";
import { detectDisciplineFromHeading } from "../pdf/DocumentClassifier";
import { parseRawGoals } from "./GoalBlockParser";
import { extractDiagnoses, extractOriginalSignature, extractCosignature, extractBoundedNarrative, findEvidencePage, notFound } from "./sharedExtraction";
import type { ExtractedProgressReport } from "./extractionTypes";

/**
 * ProgressReportExtractor
 * =========================
 * Turns one PROGRESS_REPORT boundary's pages into a structured model. The
 * goal table header line ("STG/LTG #N - <status>" ... "PLOF Baseline
 * Previous Current" ...) is byte-for-byte the same format the Evaluation
 * uses (just with two extra columns GoalBlockParser doesn't need to read —
 * see that module's header comment), so `parseRawGoals` is reused as-is.
 */
export function extractProgressReport(pages: PageText[]): ExtractedProgressReport {
  const fullText = pages.map((p) => p.rawText).join("\n");
  const discipline = detectDisciplineFromHeading(pages) ?? NOT_FOUND;

  const periodMatch = fullText.match(/Dates of Service:\s*([\d/]+)\s*-\s*([\d/]+)/i);
  const periodStart = notFound(periodMatch?.[1]);
  const periodEnd = notFound(periodMatch?.[2]);

  const daysSeenMatch = fullText.match(/Patient was seen for\s+(\d+)\s+day\(s\)/i);
  const selfReportedDaysSeen = daysSeenMatch ? Number(daysSeenMatch[1]) : null;

  const diagnoses = extractDiagnoses(pages);
  const rawGoals = parseRawGoals(pages);

  const patientProgressText = extractBoundedNarrative(
    fullText,
    /Progress\s*&\s*Response to Treatment:\s*/i,
    /\n(?:Balance\s|Test\/|Purpose\s|Supervision\s|Communication\s|Justification for Continued|Intervention Modes|Plan of Tx Focus|Original Signature)/i,
  );
  const patientProgressPage = findEvidencePage(pages, "Progress & Response to Treatment:");

  const originalSignature = extractOriginalSignature(fullText);
  const cosignature = extractCosignature(fullText);
  const originalSignaturePage = findEvidencePage(pages, "Original Signature:");
  const cosignaturePage = findEvidencePage(pages, "Cosignature:");

  return {
    discipline,
    periodStart,
    periodEnd,
    selfReportedDaysSeen,
    diagnoses,
    rawGoals,
    patientProgress: {
      text: notFound(patientProgressText),
      evidence: patientProgressText ? [{ page: patientProgressPage, section: "Assessment and Summary of Skilled Services", text: `Progress & Response to Treatment: ${patientProgressText}` }] : [],
    },
    originalSignature: originalSignature ? { ...originalSignature, page: originalSignaturePage } : null,
    cosignature: cosignature ? { ...cosignature, page: cosignaturePage } : null,
    boundaryPages: { start: pages[0]?.pageNumber ?? 0, end: pages[pages.length - 1]?.pageNumber ?? 0 },
  };
}
