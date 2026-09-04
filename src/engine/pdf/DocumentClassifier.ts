import type { PageText } from "./PDFParser";
import type { DocumentClassificationEntry, DocumentType, Discipline } from "../../types/audit";

/**
 * DocumentClassifier
 * ===================
 * Classifies each page of an uploaded PDF into one of the document types the
 * spec requires (EVALUATION / PROGRESS_REPORT / DAILY_TREATMENT_NOTE /
 * RECERTIFICATION / DISCHARGE / OTHER). Classification is heading-driven and
 * discipline-agnostic (matches "PT", "OT", or "Speech-Language
 * Pathology"/"SLP" evaluation headers alike) so the same classifier serves
 * all three supported disciplines.
 *
 * Pages inherit the most recently seen heading until a new one appears —
 * this vendor export repeats the document title on every page, but some
 * continuation pages (e.g. a lone signature block or blank ID header) don't
 * repeat the full title. Carrying the last classification forward avoids
 * mis-classifying a continuation page as OTHER.
 */

interface HeadingRule {
  pattern: RegExp;
  documentType: DocumentType;
}

const HEADING_RULES: HeadingRule[] = [
  { pattern: /\b(PT|OT|Physical Therapy|Occupational Therapy|Speech[- ]Language Pathology|SLP)\b[^\n]*\bEvaluation\s*&?\s*Plan of Treatment\b/i, documentType: "EVALUATION" },
  { pattern: /\bEvaluation\s*&\s*Plan of Treatment\b/i, documentType: "EVALUATION" },
  { pattern: /\bRe-?certification\b/i, documentType: "RECERTIFICATION" },
  { pattern: /\bTherapy Progress Report\b/i, documentType: "PROGRESS_REPORT" },
  { pattern: /\bProgress (Report|Note)\b/i, documentType: "PROGRESS_REPORT" },
  { pattern: /\bTreatment Encounter Note/i, documentType: "DAILY_TREATMENT_NOTE" },
  { pattern: /\bDaily (Treatment )?Note/i, documentType: "DAILY_TREATMENT_NOTE" },
  { pattern: /\bDischarge Summary\b/i, documentType: "DISCHARGE" },
];

function classifyHeading(headingText: string): DocumentType | null {
  for (const rule of HEADING_RULES) {
    if (rule.pattern.test(headingText)) return rule.documentType;
  }
  return null;
}

const DISCIPLINE_RULES: { pattern: RegExp; discipline: Discipline }[] = [
  { pattern: /\bPhysical Therapy\b|\bPT\b/i, discipline: "PT" },
  { pattern: /\bOccupational Therapy\b|\bOT\b/i, discipline: "OT" },
  { pattern: /\bSpeech[- ]Language Pathology\b|\bSLP\b|\bSpeech Therapy\b/i, discipline: "SLP" },
];

export function detectDisciplineFromText(text: string): Discipline | null {
  for (const rule of DISCIPLINE_RULES) {
    if (rule.pattern.test(text)) return rule.discipline;
  }
  return null;
}

/**
 * Discipline detection anchored to the document HEADING only (the first few
 * lines of each page — this vendor repeats "Physical Therapy" / "Occupational
 * Therapy" at the top of every page, see the module docstring above), never
 * the full body text. Every discipline's narrative uses "Pt" as a patient
 * abbreviation throughout ("Pt will...", "Pt engaged..."), which
 * case-insensitively false-matches the PT discipline pattern (\bPT\b) on
 * every page regardless of the document's actual discipline — scanning only
 * the heading lines avoids that entirely. This is the correct call for every
 * per-document/per-boundary discipline detection in this app; the raw
 * `detectDisciplineFromText` above is kept only for internal reuse by this
 * function and by DISCIPLINE_RULES-adjacent callers that already pass in a
 * heading-scoped string themselves.
 */
export function detectDisciplineFromHeading(pages: PageText[]): Discipline | null {
  const headingText = pages.map((p) => p.lines.slice(0, 3).join(" ")).join("\n");
  return detectDisciplineFromText(headingText);
}

export function classifyDocumentPages(pages: PageText[]): DocumentClassificationEntry[] {
  const results: DocumentClassificationEntry[] = [];
  let lastType: DocumentType = "OTHER";
  let lastHeading = "";

  for (const page of pages) {
    // Heading candidates: the first few non-empty lines of the page (this
    // vendor template always puts the document title in the first 1-2 lines).
    const headingCandidate = page.lines.slice(0, 3).join(" ");
    const detected = classifyHeading(headingCandidate) ?? classifyHeading(page.rawText);

    let documentType: DocumentType;
    let confidence: "HIGH" | "MEDIUM" | "LOW";
    let heading: string;

    if (detected) {
      documentType = detected;
      heading = headingCandidate.trim() || lastHeading;
      confidence = "HIGH";
      lastType = detected;
      lastHeading = heading;
    } else if (page.rawText.trim().length < 200 && lastType !== "OTHER") {
      // Sparse continuation page (e.g. a trailing ID-header-only page) —
      // carry forward, but mark lower confidence since we didn't re-detect
      // the heading ourselves.
      documentType = lastType;
      heading = lastHeading;
      confidence = "MEDIUM";
    } else if (lastType !== "OTHER" && page.rawText.trim().length > 0) {
      // Non-trivial content but no heading match — still likely a
      // continuation of the same document (multi-page sections), but flag
      // as medium confidence for reviewer awareness.
      documentType = lastType;
      heading = lastHeading;
      confidence = "MEDIUM";
    } else {
      documentType = "OTHER";
      heading = headingCandidate.trim() || "(no heading detected)";
      confidence = "LOW";
    }

    results.push({ page: page.pageNumber, documentType, heading, confidence });
  }

  return results;
}
