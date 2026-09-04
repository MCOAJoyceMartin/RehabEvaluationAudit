import { extractPageTexts } from "../src/engine/pdf/PDFParser";
import { parseRawGoals } from "../src/engine/extraction/GoalBlockParser";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const pdf = await loadPdfNode("fixtures/sample-evaluation-arlington.pdf");
  const pages = await extractPageTexts(pdf as any);
  const goals = parseRawGoals(pages.slice(0, 5));
  console.log(JSON.stringify(goals, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
