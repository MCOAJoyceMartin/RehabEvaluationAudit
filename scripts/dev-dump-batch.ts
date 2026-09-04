import { extractPageTexts } from "../src/engine/pdf/PDFParser";
import { classifyDocumentPages } from "../src/engine/pdf/DocumentClassifier";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const file = process.argv[2] ?? "fixtures/james-askew-nethealth-batch.pdf";
  const pageRange = process.argv[3]; // e.g. "22-31"
  const pdf = await loadPdfNode(file);
  const pages = await extractPageTexts(pdf as any);
  const classification = classifyDocumentPages(pages);

  let filtered = pages;
  if (pageRange) {
    const [start, end] = pageRange.split("-").map(Number);
    filtered = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= (end ?? start));
  }

  for (const page of filtered) {
    const cls = classification.find((c) => c.page === page.pageNumber);
    console.log(`\n===== PAGE ${page.pageNumber} [${cls?.documentType}] =====`);
    console.log(page.rawText);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
