import type { PageText } from "../pdf/PDFParser";
import type { NotFound } from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";
import type { DiagnosisEntry, SignatureBlock } from "./extractionTypes";

/**
 * sharedExtraction
 * =================
 * Small helpers reused across the per-document-type extractors (Evaluation,
 * Progress Report, Daily/Treatment Encounter Note, Discharge, Recert). Every
 * one of these vendor documents renders diagnoses, signature blocks, and
 * date-of-service headers with the SAME literal formatting — factored out
 * here once rather than re-implemented per extractor.
 */

export function notFound(v: string | undefined | null): string | NotFound {
  return v && v.trim() ? v.trim() : NOT_FOUND;
}

export function findEvidencePage(pages: PageText[], needle: string): number | NotFound {
  for (const p of pages) {
    if (p.rawText.includes(needle)) return p.pageNumber;
  }
  return NOT_FOUND;
}

/** Matches "Type  Code  Description  Onset" diagnosis table rows, identical
 *  format across Evaluation / Progress Report / Discharge documents. */
export function extractDiagnoses(pages: PageText[]): DiagnosisEntry[] {
  const diagnoses: DiagnosisEntry[] = [];
  for (const page of pages) {
    for (const line of page.lines) {
      const m = line.match(/^(Med|Tx)\s+([A-Z0-9.]{3,10})\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/);
      if (m) diagnoses.push({ type: m[1], code: m[2], description: m[3].trim(), onset: m[4], page: page.pageNumber });
    }
  }
  return diagnoses;
}

const SIG_RE_PARTS = "(.+?),?\\s*(PT|OT|SLP|PTA|COTA|RPT)\\.?\\s+([\\d/]+\\s+[\\d:]+\\s*(?:AM|PM)?\\s*[A-Z]{2,4})";

function cleanName(raw: string): string {
  return raw.replace(/[;,]+$/, "").trim();
}

/** "Original Signature:  Electronically signed by Maurice Chua, PT  5/13/2026 12:01:49 PM EDT" */
export function extractOriginalSignature(fullText: string): SignatureBlock | null {
  const re = new RegExp(`Original Signature:\\s*Electronically signed by\\s+${SIG_RE_PARTS}`, "i");
  const m = fullText.match(re);
  if (!m) return null;
  return { name: cleanName(m[1]), credential: m[2].toUpperCase(), date: m[3] };
}

/** "Cosignature:  Electronically co-signed by Maurice Chua, PT  5/21/2026 08:16:50 AM EDT" */
export function extractCosignature(fullText: string): SignatureBlock | null {
  const re = new RegExp(`Cosignature:\\s*Electronically co-signed by\\s+${SIG_RE_PARTS}`, "i");
  const m = fullText.match(re);
  if (!m) return null;
  return { name: cleanName(m[1]), credential: m[2].toUpperCase(), date: m[3] };
}

/** "Revision Signature:  Electronically signed by Samuel Wogaman, PTA  5/29/2026 09:33:14 AM EDT" */
export function extractRevisionSignature(fullText: string): SignatureBlock | null {
  const re = new RegExp(`Revision Signature:\\s*Electronically signed by\\s+${SIG_RE_PARTS}`, "i");
  const m = fullText.match(re);
  if (!m) return null;
  return { name: cleanName(m[1]), credential: m[2].toUpperCase(), date: m[3] };
}

/** Bounded full-text narrative search, same technique as
 *  EvaluationExtractor's "Reason for Therapy" recovery — anchors on the
 *  literal inline content phrase (which is stable across document
 *  instances) rather than the row LABEL, which sometimes wraps across two
 *  physical lines in this vendor template and would otherwise be missed. */
export function extractBoundedNarrative(fullText: string, startRe: RegExp, stopRe: RegExp): string | undefined {
  const startMatch = fullText.match(startRe);
  if (!startMatch || startMatch.index === undefined) return undefined;
  const from = startMatch.index + startMatch[0].length;
  const rest = fullText.slice(from);
  const stopMatch = rest.match(stopRe);
  const raw = stopMatch && stopMatch.index !== undefined ? rest.slice(0, stopMatch.index) : rest;
  return raw.replace(/\s+/g, " ").trim();
}
