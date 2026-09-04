import fs from "node:fs";
import { runRehabEvaluationAudit } from "../src/engine/RehabAuditPipeline";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const path = process.argv[2] ?? "fixtures/sample-evaluation-arlington.pdf";
  const pdf = await loadPdfNode(path);
  const { result, validation } = await runRehabEvaluationAudit(pdf as any);

  console.log("=== SCHEMA VALIDATION ===");
  console.log(validation.success ? "VALID" : "INVALID:\n" + validation.errors.join("\n"));

  console.log("\n=== TOTALS ===");
  console.log(result.totals);

  console.log("\n=== AUDIT RESULTS ===");
  for (const a of result.audit) {
    console.log(`[${a.criterionId}] ${a.criterion}: score=${a.score}/${a.maxPoints} status=${a.status} risk=${a.risk} confidence=${a.confidence}`);
    console.log(`   comment: ${a.auditorComment}`);
  }

  console.log("\n=== FUNCTIONAL CHANGE ===");
  console.table(result.functionalChange);

  console.log("\n=== GOALS ===");
  console.log(JSON.stringify(result.goalAnalysis, null, 2));

  fs.writeFileSync("/tmp/pipeline_result.json", JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
