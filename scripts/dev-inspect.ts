import { runRehabEvaluatorAudit } from "../src/engine/RehabAuditPipeline";
// @ts-expect-error
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const path = process.argv[2] ?? "fixtures/james-askew-nethealth-batch.pdf";
  const ids = process.argv.slice(3);
  const pdf = await loadPdfNode(path);
  const { report } = await runRehabEvaluatorAudit(pdf as any);
  for (const result of report.disciplineAudits) {
    console.log(`\n########## ${result.discipline} ##########`);
    for (const a of result.audit) {
      if (ids.length && !ids.includes(a.criterionId)) continue;
      console.log(`\n[${a.criterionId}] score=${a.score}/${a.maxPoints} status=${a.status}`);
      console.log(`comment: ${a.auditorComment}`);
      console.log(`recommendation: ${a.recommendation}`);
      console.log("evidence:", JSON.stringify(a.evidence, null, 2));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
