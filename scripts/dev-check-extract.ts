import { extractPageTexts } from "../src/engine/pdf/PDFParser";
import { classifyDocumentPages } from "../src/engine/pdf/DocumentClassifier";
import { detectEpisodeBoundaries, findInitialEvaluationBoundary } from "../src/engine/pdf/EpisodeDetector";
import { extractEvaluation } from "../src/engine/extraction/EvaluationExtractor";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const pdf = await loadPdfNode("fixtures/sample-evaluation-arlington.pdf");
  const pages = await extractPageTexts(pdf as any);
  const classification = classifyDocumentPages(pages);
  const boundaries = detectEpisodeBoundaries(classification);
  const evalBoundary = findInitialEvaluationBoundary(boundaries);
  if (!evalBoundary) throw new Error("no eval boundary found");
  const evalPages = pages.filter((p) => p.pageNumber >= evalBoundary.startPage && p.pageNumber <= evalBoundary.endPage);
  const extracted = extractEvaluation(evalPages);
  console.log(JSON.stringify(extracted, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
