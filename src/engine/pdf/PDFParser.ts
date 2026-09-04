/**
 * PDFParser
 * =========
 * Page-aware text extraction. This module is intentionally isomorphic: it
 * accepts an already-constructed pdfjs-dist "PDFDocumentProxy"-shaped object
 * (browser code constructs one via loadPdfDocumentBrowser(); the dev
 * validation script constructs one via pdfjs-dist's legacy Node build) and
 * reconstructs line-based, page-numbered text from the raw positioned text
 * items pdf.js returns.
 *
 * Why not just flatten the whole PDF to one string? Every downstream
 * extraction step needs to cite a page number as evidence. Losing page
 * provenance here would make every "evidence.page" in the app a guess —
 * which the spec explicitly forbids.
 */

// Minimal structural typing so this file has no hard compile-time dependency
// on pdfjs-dist's type exports (keeps it usable from both the Vite bundle and
// a plain Node script without fighting two different module resolutions).
export interface PdfTextItemLike {
  str: string;
  transform: number[]; // [a, b, c, d, e, f] — e = x, f = y
  width: number;
  height?: number;
}

export interface PdfPageLike {
  getTextContent(): Promise<{ items: PdfTextItemLike[] }>;
  getViewport(opts: { scale: number }): { width: number; height: number };
}

export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

export interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

export interface PageText {
  pageNumber: number;
  /** Reconstructed visual lines, top-to-bottom, left-to-right within a line. */
  lines: string[];
  rawText: string;
  /** Raw positioned items (reading order), for column-aware parsing (e.g. the
   *  PLOF / Baseline two-column goal tables) where flattening to plain text
   *  loses which column a value belongs to. */
  items: PositionedItem[];
}

export const Y_TOLERANCE = 2.5; // pdf points; items within this band are the same visual line

export interface PositionedLine {
  y: number;
  text: string;
  items: PositionedItem[];
}

/**
 * Groups raw positioned text items into visual lines using y-coordinate
 * clustering (pdf.js gives text bottom-left origin coordinates; page
 * coordinate space has y increasing upward, so we sort descending).
 *
 * Exported (not just used internally to build plain-string lines) because
 * column-aware parsers — the PLOF / Baseline two-column goal tables in
 * particular — need each line's constituent items with their x positions,
 * not just a flattened string.
 */
export function groupIntoPositionedLines(items: PdfTextItemLike[]): PositionedLine[] {
  const withPos = items
    .filter((it) => it.str.trim().length > 0)
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width || Math.max(it.str.length * 4, 1),
    }));

  withPos.sort((a, b) => (b.y - a.y === 0 ? a.x - b.x : b.y - a.y));

  const lines: { y: number; parts: { x: number; str: string; width: number }[] }[] = [];
  for (const item of withPos) {
    let line = lines.find((l) => Math.abs(l.y - item.y) <= Y_TOLERANCE);
    if (!line) {
      line = { y: item.y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x: item.x, str: item.str, width: item.width });
  }

  return lines.map((l) => {
    l.parts.sort((a, b) => a.x - b.x);
    // Join adjacent fragments; insert a space when there's a visual gap so
    // "PLOF" + "Baseline" (two columns) doesn't glue into "PLOFBaseline",
    // using each item's own reported render width (not an estimate) to
    // decide whether a gap actually exists between fragments.
    let out = "";
    let lastEnd: number | null = null;
    for (const part of l.parts) {
      const gap = lastEnd !== null ? part.x - lastEnd : 0;
      if (lastEnd !== null && gap > 0.3 && !out.endsWith(" ") && out.length > 0) {
        out += gap > 8 ? "  " : " ";
      }
      out += part.str;
      lastEnd = part.x + part.width;
    }
    // NOTE: deliberately NOT collapsing all whitespace runs here — the
    // double-space we just inserted for a large visual gap is a meaningful
    // "different table column" signal that several field extractors rely
    // on (e.g. separating "Provider: X" from a same-line "Certification
    // Period: Y" column). Only trim leading/trailing space and normalize
    // any accidental 3+ run down to exactly two.
    const text = out.replace(/ {3,}/g, "  ").trim();
    return { y: l.y, text, items: l.parts.map((p) => ({ str: p.str, x: p.x, y: l.y, width: p.width })) };
  });
}

export async function extractPageTexts(pdfDoc: PdfDocumentLike): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    const page = await pdfDoc.getPage(pageNumber);
    const content = await page.getTextContent();
    const positionedLines = groupIntoPositionedLines(content.items);
    const lines = positionedLines.map((l) => l.text);
    const items: PositionedItem[] = content.items
      .filter((it) => it.str.trim().length > 0)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }))
      .sort((a, b) => (Math.abs(b.y - a.y) < Y_TOLERANCE ? a.x - b.x : b.y - a.y));
    pages.push({ pageNumber, lines, rawText: lines.join("\n"), items });
  }
  return pages;
}

/** Convenience: positioned lines for a single page's already-extracted items
 *  (re-groups from PageText.items, avoiding re-fetching from pdf.js). Used by
 *  GoalBlockParser for column-aware PLOF/Baseline extraction. */
export function positionedLinesFromPageItems(items: PositionedItem[]): PositionedLine[] {
  return groupIntoPositionedLines(items.map((it) => ({ str: it.str, transform: [1, 0, 0, 1, it.x, it.y], width: it.width })));
}
