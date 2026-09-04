import type { PageText } from "../pdf/PDFParser";
import type { ExtractedRow } from "./extractionTypes";

/**
 * Generic "label / value" row extraction for the vendor's therapy
 * documentation table layout: a bold left-column label (e.g. "Medical Hx")
 * followed by inline prompt/value content that may wrap across several
 * physical PDF lines before the next labeled row begins.
 *
 * This is deliberately data-driven (SECTION_HEADERS / ROW_LABELS below) so
 * it is not tied to one patient's content, and can be extended for other
 * vendor export layouts or OT/SLP-specific row labels without touching the
 * parsing algorithm itself.
 */

export const SECTION_HEADERS: string[] = [
  "Identification Information",
  "Diagnoses",
  "Plan of Treatment",
  "Objective Progress / Short-Term Goals",
  "Objective Progress / Long-Term Goals",
  "Initial Assessment / Current Level of Function & Underlying Impairments",
  "Patient Referral and History",
  "Fall Risk Assessment",
  "Functional Mobility Assessment",
  "Musculoskeletal System Assessment",
  "Other System/Condition Assessment",
  "Objective Tests and Measures",
  "Assessment Summary",
  "Exercise Prescription",
];

// Ordered longest-first within groups so a longer, more specific label
// (e.g. "Prior Level(s) of Function") is tried before a shorter one that
// could otherwise false-match a prefix.
export const ROW_LABELS: string[] = [
  "Transition/DC",
  "Prior Level(s) of Function",
  "Current Referral",
  "Oxygen",
  "Weight Bearing",
  "Medical Factors",
  "Medical Hx",
  "Medications",
  "Labs",
  "Prior Therapy",
  "Prior Living",
  "Prior Equipment",
  "Prior Assistance",
  "History of Falls",
  "Steadiness",
  "Fear of Falling",
  "Bed Mobility",
  "Transfers",
  "Ambulation",
  "Curbs/Stairs",
  "W/C Mobility",
  "Mobility Score",
  "Other",
  "LE ROM",
  "RLE Strength",
  "LLE Strength",
  "Contracture",
  "Balance",
  "Cardiovascular",
  "Pain",
  "Communication",
  "Cognition",
  "Reason for Therapy",
  "Complexities",
  "Intervention Modes",
  "Purpose",
  "Method",
  "Resistance",
  "Strength",
  // Extensibility placeholders for OT/SLP vendor exports of the same family
  // (unvalidated against a real sample — added so the row-extraction step
  // recognizes them if/when an OT or SLP evaluation of this template is
  // uploaded, rather than silently dropping the row).
  "Feeding",
  "Grooming",
  "Dressing",
  "Bathing",
  "Toileting",
  "Upper Extremity Function",
  "Functional Cognition",
  "Swallowing",
  "Diet Consistency",
  "Aspiration Risk",
  "Speech/Language",
  "Memory",
  "Problem Solving",
  "Safety Awareness",
];

const IGNORED_LINE_PATTERNS: RegExp[] = [
  /^Physical Therapy$/i,
  /^Occupational Therapy$/i,
  /^Speech[- ]Language Pathology$/i,
  /^PT (Evaluation|Therapy|Discharge)/i,
  /^OT (Evaluation|Therapy|Discharge)/i,
  /^(PT|OT|SLP) Evaluation\s*&\s*Plan of Treatment$/i,
  /^Provider:/i,
  /^NPI:/i,
  /^Patient:/i,
  /^Payer:/i,
  /^MRN:/i,
  /^Page \d+ of \d+$/i,
  /^Type\s+Code\s+Description\s+Onset$/i, // diagnoses table header
];

function isIgnoredLine(line: string): boolean {
  return IGNORED_LINE_PATTERNS.some((p) => p.test(line.trim()));
}

function matchSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  const hit = SECTION_HEADERS.find((h) => h.toLowerCase() === trimmed.toLowerCase());
  return hit ?? null;
}

function matchRowLabel(line: string): { label: string; remainder: string } | null {
  const sorted = [...ROW_LABELS].sort((a, b) => b.length - a.length);
  for (const label of sorted) {
    const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s?(.*)$`);
    const m = line.match(re);
    if (m) return { label, remainder: m[1] ?? "" };
  }
  return null;
}

export function extractRows(pages: PageText[]): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  let currentSection = "";
  let activeRow: { page: number; section: string; rowLabel: string; lines: string[] } | null = null;

  const flush = () => {
    if (activeRow) {
      rows.push({
        page: activeRow.page,
        section: activeRow.section,
        rowLabel: activeRow.rowLabel,
        text: activeRow.lines.join("\n"),
      });
      activeRow = null;
    }
  };

  for (const page of pages) {
    for (const rawLine of page.lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (isIgnoredLine(line)) continue;

      const section = matchSectionHeader(line);
      if (section) {
        flush();
        currentSection = section;
        continue;
      }

      const rowMatch = matchRowLabel(line);
      if (rowMatch) {
        flush();
        activeRow = {
          page: page.pageNumber,
          section: currentSection,
          rowLabel: rowMatch.label,
          lines: rowMatch.remainder ? [rowMatch.remainder] : [],
        };
        continue;
      }

      // Objective test rows carry an ad-hoc label naming whichever
      // standardized measure was administered (e.g. "Test/Sit Balance",
      // "Test/Berg"), so they can't be enumerated in ROW_LABELS up front —
      // any "Label = Value" line in this section starts its own row.
      if (/^Objective Tests and Measures$/i.test(currentSection)) {
        const adHoc = line.match(/^(.{1,40}?)\s+(.+?=.*)$/) ?? line.match(/^(.{1,40}?)=(.*)$/);
        if (adHoc) {
          flush();
          activeRow = { page: page.pageNumber, section: currentSection, rowLabel: adHoc[1].trim(), lines: [adHoc[2].trim()] };
          continue;
        }
      }

      if (activeRow) {
        activeRow.lines.push(line);
      }
      // else: unattached narrative line outside any recognized row (e.g. a
      // free-text continuation before any row label has been seen on this
      // page) — intentionally dropped rather than guessed into a row.
    }
  }
  flush();
  return rows;
}

/** Splits a row's accumulated text into "Prompt = Value" / "Prompt: Value"
 *  sub-items. Rows that are pure narrative (no internal prompts) simply
 *  yield zero sub-items — callers fall back to the full row text. */
export function parseInlineKeyValues(text: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const fragments = text
    .split("\n")
    .flatMap((line) => line.split(/;\s*/))
    .map((f) => f.trim())
    .filter(Boolean);

  for (const fragment of fragments) {
    const eq = fragment.match(/^(.{1,60}?)\s*=\s*(.+)$/);
    if (eq) {
      out.push({ label: eq[1].trim(), value: eq[2].trim() });
      continue;
    }
  }
  return out;
}
