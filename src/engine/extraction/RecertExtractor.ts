import type { PageText } from "../pdf/PDFParser";
import { NOT_FOUND } from "../../types/audit";
import { detectDisciplineFromHeading } from "../pdf/DocumentClassifier";
import { parseRawGoals } from "./GoalBlockParser";
import { extractOriginalSignature, extractBoundedNarrative, findEvidencePage, notFound } from "./sharedExtraction";
import type { ExtractedRecert } from "./extractionTypes";

/**
 * RecertExtractor
 * =================
 * UNVALIDATED AGAINST REAL DATA. No Recertification document exists in the
 * James Askew fixture (the episode discharged on 5/25/2026, well before
 * either discipline's certification period — 6/11/2026 PT, ~6/10/2026 OT —
 * came due), so this extractor's field patterns follow the same vendor-
 * family conventions observed in Evaluation/Progress/Discharge (frequency
 * on a "Frequency:" line, a "Reason for Skilled Services:"-style continued-
 * skill narrative, the same goal-table format) but have NEVER been checked
 * against an actual Recertification PDF from this vendor. Before this
 * extractor is relied on for a real audit, obtain one real Recertification
 * sample and verify these patterns the same way every other extractor in
 * this app was verified (see scripts/dev-dump-batch.ts).
 */
export function extractRecert(pages: PageText[]): ExtractedRecert {
  const fullText = pages.map((p) => p.rawText).join("\n");
  const discipline = detectDisciplineFromHeading(pages) ?? NOT_FOUND;

  const dos = notFound(fullText.match(/Date of Service:\s*([\d/]+)/i)?.[1] ?? fullText.match(/Recertification Date:\s*([\d/]+)/i)?.[1]);
  const frequency = notFound(fullText.match(/Frequency:\s*(.+?)\n/i)?.[1]);
  const rawGoals = parseRawGoals(pages);

  const continuedSkillText = extractBoundedNarrative(
    fullText,
    /Reason for Skilled Services:\s*/i,
    /\n(?:Intervention Modes|Plan of Tx Focus|Original Signature)/i,
  );
  const continuedSkillPage = findEvidencePage(pages, "Reason for Skilled Services:");

  const originalSignature = extractOriginalSignature(fullText);
  const originalSignaturePage = findEvidencePage(pages, "Original Signature:");

  return {
    discipline,
    dos,
    rawGoals,
    frequency,
    continuedSkillNarrative: {
      text: notFound(continuedSkillText),
      evidence: continuedSkillText ? [{ page: continuedSkillPage, section: "Justification for Continued Skilled Services", text: `Reason for Skilled Services: ${continuedSkillText}` }] : [],
    },
    originalSignature: originalSignature ? { ...originalSignature, page: originalSignaturePage } : null,
    boundaryPages: { start: pages[0]?.pageNumber ?? 0, end: pages[pages.length - 1]?.pageNumber ?? 0 },
  };
}
