import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
// legacy build is CJS-friendly and doesn't assume DOM/worker globals
const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

export async function loadPdfNode(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  return pdf;
}
