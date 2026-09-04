import { extractPageTexts } from "../src/engine/pdf/PDFParser";
import { extractRows } from "../src/engine/extraction/rowExtraction";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const pdf = await loadPdfNode("fixtures/sample-evaluation-arlington.pdf");
  const pages = await extractPageTexts(pdf as any);
  const evalPages = pages.slice(0, 5); // pages 1-5 per boundary detection
  const rows = extractRows(evalPages);
  for (const r of rows) {
    console.log(`--- p${r.page} [${r.section}] ${r.rowLabel} ---`);
    console.log(r.text);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
