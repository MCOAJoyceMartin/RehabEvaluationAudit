/**
 * Browser-only PDF loading. Kept separate from PDFParser.ts so that the
 * pure text-reconstruction logic has no dependency on pdfjs-dist's worker
 * bootstrapping, which only makes sense in a browser bundle.
 *
 * PHI NOTE: the file is read and parsed entirely client-side (ArrayBuffer
 * in memory). Nothing here uploads the PDF or its extracted text anywhere.
 */
import * as pdfjsLib from "pdfjs-dist";
// Vite ?url import gives us a hashed, servable URL for the worker script
// without needing a separate static-asset copy step.
// eslint-disable-next-line import/no-unresolved
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfDocumentLike } from "./PDFParser";

let workerConfigured = false;

function ensureWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    workerConfigured = true;
  }
}

export async function loadPdfDocumentFromFile(file: File): Promise<{
  doc: PdfDocumentLike;
  numPages: number;
  getPageViewport: (pageNumber: number, scale: number) => Promise<{ width: number; height: number }>;
  renderPageToCanvas: (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
}> {
  ensureWorker();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  return {
    doc: pdf as unknown as PdfDocumentLike,
    numPages: pdf.numPages,
    async getPageViewport(pageNumber: number, scale: number) {
      const page = await pdf.getPage(pageNumber);
      return page.getViewport({ scale });
    },
    async renderPageToCanvas(pageNumber: number, canvas: HTMLCanvasElement, scale: number) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      await page.render({ canvasContext: context, viewport }).promise;
    },
  };
}
