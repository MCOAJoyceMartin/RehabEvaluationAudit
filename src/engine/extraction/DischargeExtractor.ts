import type { PageText } from "../pdf/PDFParser";
import { NOT_FOUND } from "../../types/audit";
import { detectDisciplineFromHeading } from "../pdf/DocumentClassifier";
import { parseRawGoals } from "./GoalBlockParser";
import { extractDiagnoses, extractOriginalSignature, extractBoundedNarrative, findEvidencePage, notFound } from "./sharedExtraction";
import type { ExtractedDischarge } from "./extractionTypes";

/**
 * DischargeExtractor
 * =====================
 * The Discharge Summary shares its goal-table format with Evaluation/
 * Progress Report (see ProgressReportExtractor header comment) and its
 * period header appears in two different shapes depending on discipline
 * instance observed in the fixture: a PT discharge states "Patient was
 * seen for N day(s) during the START - END progress period"; an OT
 * discharge instead states "Progress Period: START - END" with no
 * self-reported day count. Both are handled; DOS falls back to the
 * document-level "Dates of Service:" end date when neither period line is
 * present, since that always exists.
 */
export function extractDischarge(pages: PageText[]): ExtractedDischarge {
  const fullText = pages.map((p) => p.rawText).join("\n");
  const discipline = detectDisciplineFromHeading(pages) ?? NOT_FOUND;

  const docDatesMatch = fullText.match(/Dates of Service:\s*([\d/]+)\s*-\s*([\d/]+)/i);
  const progressPeriodMatch =
    fullText.match(/during the\s+([\d/]+)\s*-\s*([\d/]+)\s+progress period/i) ??
    fullText.match(/Progress Period:\s*([\d/]+)\s*-\s*([\d/]+)/i);

  const periodStart = notFound(progressPeriodMatch?.[1] ?? docDatesMatch?.[1]);
  const periodEnd = notFound(progressPeriodMatch?.[2] ?? docDatesMatch?.[2]);

  const dcReason = notFound(fullText.match(/D\/C Reason:\s*(.+?)\n/i)?.[1]);
  const dcLocation = notFound(fullText.match(/Discharge Location\s*=\s*(.+?)\.\s*\n/i)?.[1] ?? fullText.match(/Discharge Location\s*=\s*(.+?)\n/i)?.[1]);

  const diagnoses = extractDiagnoses(pages);
  const rawGoals = parseRawGoals(pages);

  const dcRecsText = extractBoundedNarrative(
    fullText,
    /Discharge Recommendations:\s*/i,
    /\n(?:Target Heart Rate|Restorative|Functional\s+Maintenance|Prognosis|Original Signature)/i,
  );
  const dcRecsPage = findEvidencePage(pages, "Discharge Recommendations:");

  const originalSignature = extractOriginalSignature(fullText);
  const originalSignaturePage = findEvidencePage(pages, "Original Signature:");

  return {
    discipline,
    periodStart,
    periodEnd,
    dcReason,
    dcLocation,
    diagnoses,
    rawGoals,
    dcRecommendations: {
      text: notFound(dcRecsText),
      evidence: dcRecsText ? [{ page: dcRecsPage, section: "Discharge Recommendations and Status", text: `Discharge Recommendations: ${dcRecsText}` }] : [],
    },
    originalSignature: originalSignature ? { ...originalSignature, page: originalSignaturePage } : null,
    boundaryPages: { start: pages[0]?.pageNumber ?? 0, end: pages[pages.length - 1]?.pageNumber ?? 0 },
  };
}
