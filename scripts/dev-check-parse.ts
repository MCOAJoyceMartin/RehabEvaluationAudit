import { extractPageTexts } from "../src/engine/pdf/PDFParser";
import { classifyDocumentPages } from "../src/engine/pdf/DocumentClassifier";
import { detectEpisodeBoundaries, findInitialEvaluationBoundary } from "../src/engine/pdf/EpisodeDetector";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const path = process.argv[2] ?? "fixtures/sample-evaluation-arlington.pdf";
  const pdf = await loadPdfNode(path);
  const pages = await extractPageTexts(pdf as any);
  const classification = classifyDocumentPages(pages);
  const boundaries = detectEpisodeBoundaries(classification);
  const evalBoundary = findInitialEvaluationBoundary(boundaries);

  console.log("=== CLASSIFICATION ===");
  for (const c of classification) {
    console.log(`page ${c.page}: ${c.documentType} (${c.confidence}) — "${c.heading}"`);
  }
  console.log("\n=== BOUNDARIES ===");
  console.log(boundaries);
  console.log("\n=== INITIAL EVALUATION BOUNDARY ===");
  console.log(evalBoundary);

  console.log("\n=== SAMPLE LINES (page 2) ===");
  console.log(pages[1].lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
