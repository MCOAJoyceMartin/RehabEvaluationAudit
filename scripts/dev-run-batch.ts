import { runRehabEvaluatorAudit } from "../src/engine/RehabAuditPipeline";
// @ts-expect-error - plain JS loader, no types
import { loadPdfNode } from "./lib/loadPdfNode.mjs";

async function main() {
  const path = process.argv[2] ?? "fixtures/james-askew-nethealth-batch.pdf";
  const pdf = await loadPdfNode(path);
  const { report, validations } = await runRehabEvaluatorAudit(pdf as any);

  console.log("=== DISCIPLINES FOUND ===", report.disciplineAudits.map((d) => d.discipline));
  for (const result of report.disciplineAudits) {
    console.log(`\n\n########## ${result.discipline} ##########`);
    const v = validations[result.discipline as keyof typeof validations];
    console.log("VALIDATION:", v?.success ? "VALID" : "INVALID:\n" + v?.errors.join("\n"));
    console.log("TOTALS:", result.totals);
    console.log(`\n--- AUDIT (${result.audit.length} criteria) ---`);
    for (const a of result.audit) {
      console.log(`[${a.criterionId}] ${a.criterion}: score=${a.score}/${a.maxPoints} status=${a.status} risk=${a.risk}`);
    }
    console.log(`\n--- GOAL LIFECYCLE (${result.goalLifecycle.length}) ---`);
    for (const g of result.goalLifecycle) {
      console.log(`${g.goalId} (${g.kind}): evalStatus="${g.evaluationStatus}" metDate=${g.metDate} dischargeStatus=${g.dischargeStatus} treatmentAfterMet=${g.treatmentAfterGoalMetFlag}`);
    }
    console.log(`\n--- FREQUENCY ANALYSIS (${result.frequencyAnalysis.length} periods) ---`);
    for (const fa of result.frequencyAnalysis) {
      for (const row of fa.rows) console.log(`  ${row.weekLabel}: ${row.finding}`);
    }
    console.log(`\n--- DOC SIMILARITY (${result.documentationSimilarity.length}) ---`);
    for (const s of result.documentationSimilarity) console.log(`  ${s.dimension}: ${s.classification} — ${s.note}`);
    console.log(`\n--- TIMELINE (${result.timeline.length}) ---`);
    for (const t of result.timeline) console.log(`  ${t.documentType} ${t.dos} - ${t.dosEnd} (pages ${t.pages.start}-${t.pages.end})`);
    console.log(`\n--- ADDITIONAL FINDINGS (${result.additionalFindings.length}) ---`);
    for (const f of result.additionalFindings) console.log(`  [${f.category}] ${f.description}`);
    console.log(`\n--- STRENGTHS (${result.strengths.length}) ---`);
    for (const s of result.strengths) console.log(`  ${s.description}`);
    console.log(`\n--- CORRECTIVE ACTIONS (${result.correctiveActions.length}) ---`);
    for (const c of result.correctiveActions) console.log(`  - ${c}`);
  }
  console.log("\n\n=== CROSS-DISCIPLINE DOCUMENTATION CONSISTENCY ===");
  console.log(JSON.stringify(report.documentationConsistency, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
