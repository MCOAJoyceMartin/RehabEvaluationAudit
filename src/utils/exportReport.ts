import type { EpisodeAuditReport, RehabAuditResult } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { overrideKey } from "../state/reviewerOverrides";
import { computeEffectiveTotals, getEffectiveCriterion, totalsWereAdjusted } from "../engine/audit/recalculateTotals";

function esc(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function disciplineSection(result: RehabAuditResult, overrides: Record<string, ReviewerOverride>): string {
  const { patient, therapyEpisode } = result;
  const aiTotals = result.totals;
  const totals = computeEffectiveTotals(result, overrides);
  const adjusted = totalsWereAdjusted(aiTotals, totals);

  const criteriaRows = result.audit
    .map((a) => {
      const ov = overrides[overrideKey(result.discipline, a.criterionId)];
      const eff = getEffectiveCriterion(a, ov);
      return `<tr>
        <td>${esc(a.section)}</td>
        <td>${esc(a.criterion)}</td>
        <td>${a.score ?? "—"} / ${a.maxPoints}</td>
        <td>${esc(a.status.replace(/_/g, " "))}</td>
        <td>${esc(a.auditorComment)}</td>
        <td>${esc(a.recommendation)}</td>
        <td>${
          ov
            ? `${esc(eff.score ?? "—")}${eff.isOverridden ? ` — ${esc(eff.status.replace(/_/g, " "))}` : ""}${ov.reviewerNote ? ` — ${esc(ov.reviewerNote)}` : ""}${ov.marked ? " (Reviewed)" : ""}`
            : "—"
        }</td>
      </tr>`;
    })
    .join("\n");

  const strengthsList = result.strengths.map((s) => `<li>${esc(s.description)}</li>`).join("") || "<li>None documented.</li>";
  const additionalFindingsList =
    result.additionalFindings.map((f) => `<li><strong>${esc(f.category)}:</strong> ${esc(f.description)}</li>`).join("") || "<li>None.</li>";
  const correctiveActionsList = result.correctiveActions.map((c) => `<li>${esc(c)}</li>`).join("") || "<li>None.</li>";
  const externalValidationList = result.externalValidationNeeded.map((e) => `<li>${esc(e)}</li>`).join("") || "<li>None.</li>";
  const pendingRubricList =
    result.rubricConfirmationNeeded
      .map((r) => `<li><strong>${esc(r.section)} — ${esc(r.criterion)}</strong> (${r.potentialPoints} pt${r.potentialPoints === 1 ? "" : "s"}): ${esc(r.factualFinding)}</li>`)
      .join("") || "<li>None.</li>";

  const timelineRows = result.timeline
    .map(
      (t) => `<tr>
        <td>${esc(t.documentType.replace(/_/g, " "))}</td>
        <td>${esc(t.dos)}${t.dosEnd !== "Not Found" && t.dosEnd !== t.dos ? ` – ${esc(t.dosEnd)}` : ""}</td>
        <td>${esc(t.completionDate)}</td>
        <td>${esc(t.clinician)}</td>
        <td>p.${t.pages.start}–${t.pages.end}</td>
      </tr>`,
    )
    .join("");

  const goalLifecycleRows = result.goalLifecycle
    .map(
      (g) => `<tr>
        <td>${esc(g.goalId)}</td>
        <td>${esc(g.kind)}</td>
        <td>${esc(g.goalText)}</td>
        <td>${esc(g.dischargeStatus)}</td>
        <td>${g.treatmentAfterGoalMetFlag ? "Yes" : "No"}</td>
      </tr>`,
    )
    .join("");

  const frequencyRows = result.frequencyAnalysis
    .flatMap((f) =>
      f.rows.map(
        (r) => `<tr>
        <td>${esc(f.orderedFrequencyRaw)}</td>
        <td>${esc(r.weekLabel)}</td>
        <td>${esc(r.orderedFrequency)}</td>
        <td>${esc(r.actualUniqueDOS.join(", "))}</td>
        <td>${esc(r.variance)}</td>
        <td>${esc(r.finding)}</td>
      </tr>`,
      ),
    )
    .join("");

  const similarityRows = result.documentationSimilarity
    .map(
      (s) => `<tr>
        <td>${esc(s.dimension)}</td>
        <td>${esc(s.classification)}</td>
        <td>${esc(s.datesCompared.join(", "))}</td>
        <td>${esc(s.note)}</td>
      </tr>`,
    )
    .join("");

  return `
  <h1>${esc(therapyEpisode.discipline)} Audit</h1>
  <table class="header-table">
    <tr>
      <td><strong>Patient:</strong> ${esc(patient.name)}</td>
      <td><strong>MRN:</strong> ${esc(patient.mrn)}</td>
      <td><strong>Facility:</strong> ${esc(patient.facility)}</td>
    </tr>
    <tr>
      <td><strong>Discipline:</strong> ${esc(therapyEpisode.discipline)}</td>
      <td><strong>Evaluator:</strong> ${esc(therapyEpisode.evaluator)}</td>
      <td><strong>Evaluation DOS:</strong> ${esc(therapyEpisode.evaluationDOS)}</td>
    </tr>
    <tr>
      <td><strong>Completed:</strong> ${esc(therapyEpisode.completionDate)}</td>
      <td><strong>Certification Period:</strong> ${esc(therapyEpisode.certificationStart)} – ${esc(therapyEpisode.certificationEnd)}</td>
      <td><strong>Payer:</strong> ${esc(patient.payer)}</td>
    </tr>
  </table>

  <h2>Overall Score</h2>
  <p class="score">${totals.earned} / ${totals.possible} (${totals.percentage}%)</p>
  <p>Pass: ${totals.passed} · Partial: ${totals.partial} · Fail: ${totals.failed} · Unable to Validate: ${totals.unableToValidate}${totals.pendingRubricConfirmationCriteriaCount > 0 ? ` · Pending Rubric Confirmation: ${totals.pendingRubricConfirmationCriteriaCount}` : ""}</p>
  ${adjusted ? `<p class="override-note">Recalculated after reviewer overrides. Original AI-computed score: ${aiTotals.earned} / ${aiTotals.possible} (${aiTotals.percentage}%), Pass ${aiTotals.passed} · Partial ${aiTotals.partial} · Fail ${aiTotals.failed} · Unable to Validate ${aiTotals.unableToValidate}.</p>` : ""}
  ${totals.externalValidationCriteriaCount > 0 ? `<p>External Validation Pending: ${totals.externalValidationCriteriaCount} criterion / ${totals.externalValidationOpportunity} points (excluded from the score above).</p>` : ""}
  ${totals.pendingRubricConfirmationCriteriaCount > 0 ? `<p>Pending Rubric Confirmation: ${totals.pendingRubricConfirmationCriteriaCount} criterion / ${totals.pendingRubricConfirmationOpportunity} points (excluded from the score above; the rubric rule itself is not yet defined).</p>` : ""}

  <h2>Episode Timeline</h2>
  <table>
    <thead><tr><th>Document</th><th>Date of Service</th><th>Completed</th><th>Clinician</th><th>Pages</th></tr></thead>
    <tbody>${timelineRows || `<tr><td colspan="5">No dated documents identified.</td></tr>`}</tbody>
  </table>

  <h2>Audit Criteria</h2>
  <table>
    <thead><tr>
      <th style="width:9%">Section</th>
      <th style="width:11%">Criterion</th>
      <th style="width:6%">Score</th>
      <th style="width:9%">Status</th>
      <th style="width:29%">Auditor Comment</th>
      <th style="width:24%">Recommendation</th>
      <th style="width:12%">Reviewer Override</th>
    </tr></thead>
    <tbody>${criteriaRows}</tbody>
  </table>

  <h2>Goal Lifecycle</h2>
  <table>
    <thead><tr><th>Goal ID</th><th>Kind</th><th>Goal Text</th><th>Discharge Status</th><th>Treated After Met</th></tr></thead>
    <tbody>${goalLifecycleRows || `<tr><td colspan="5">No goals traced.</td></tr>`}</tbody>
  </table>

  <h2>Treatment Frequency Analysis</h2>
  <table>
    <thead><tr><th>Ordered Frequency</th><th>Week</th><th>Ordered</th><th>Actual DOS</th><th>Variance</th><th>Finding</th></tr></thead>
    <tbody>${frequencyRows || `<tr><td colspan="6">No period had both an ordered frequency and daily notes to compare.</td></tr>`}</tbody>
  </table>

  <h2>Documentation Similarity</h2>
  <table>
    <thead><tr><th>Dimension</th><th>Classification</th><th>Dates Compared</th><th>Note</th></tr></thead>
    <tbody>${similarityRows || `<tr><td colspan="4">No templated or duplicated narrative patterns flagged.</td></tr>`}</tbody>
  </table>

  <h2>Corrective Actions</h2>
  <ul>${correctiveActionsList}</ul>

  <h2>What Was Done Well</h2>
  <ul>${strengthsList}</ul>

  <h2>Additional Documentation Findings</h2>
  <ul>${additionalFindingsList}</ul>

  <h2>External Validation Needed</h2>
  <ul>${externalValidationList}</ul>

  <h2>Pending Rubric Confirmation</h2>
  <ul>${pendingRubricList}</ul>
  `;
}

/** Builds a self-contained, printable HTML report covering every discipline
 *  in the episode. Only the fields the spec explicitly requires appear here
 *  (internal engine plumbing — rubric config internals, unfiltered
 *  extraction rows, etc. — is deliberately left out: "no hidden AI
 *  reasoning"). Each discipline's audit is rendered as its own fully
 *  separate section — never blended into one score or one table. */
export function buildExportHtml(report: EpisodeAuditReport, overrides: Record<string, ReviewerOverride>): string {
  const disciplineSections = report.disciplineAudits.map((r) => disciplineSection(r, overrides)).join("\n<hr/>\n");

  const consistencyRows = report.documentationConsistency
    .map(
      (c) => `<tr>
        <td>${esc(c.field)}</td>
        <td>${c.discipline !== "Not Found" ? esc(c.discipline) : "—"}</td>
        <td>${c.values.map((v) => `${esc(v.date)}: ${esc(v.value)} (${esc(v.sourceDocType.replace(/_/g, " "))})`).join("<br/>")}</td>
        <td>${esc(c.note)}</td>
      </tr>`,
    )
    .join("");

  const patientName = report.batchPatient.name;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Rehab Evaluator Audit — ${esc(patientName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.4rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem; }
  /* table-layout: fixed + break-word keeps every column strictly inside
     the table's own 100%-of-page width — without it, a long unbroken
     run of text (a paragraph-length Auditor Comment, say) can force the
     browser to render the table wider than its container, which silently
     runs the rightmost column(s) off the edge of the PDF page. */
  table { border-collapse: collapse; table-layout: fixed; width: 100%; margin-top: 0.5rem; font-size: 0.85rem; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; overflow-wrap: break-word; }
  th { background: #f0f0f0; }
  /* A plain <table>, not CSS Grid/Flexbox — html2canvas (used for the PDF
     export) has known, longstanding issues rendering grid/flex layouts
     (rows collapsing to zero height or overlapping each other), but
     renders ordinary tables reliably. Don't switch this back to a div
     grid without testing the PDF output, not just the on-screen view. */
  .header-table { font-size: 0.9rem; margin-top: 0.5rem; }
  .header-table td { border: none; padding: 2px 1.5rem 2px 0; }
  .score { font-size: 2rem; font-weight: bold; }
  .override-note { font-size: 0.8rem; color: #444; background: #f0eefc; padding: 0.5rem 0.7rem; border-radius: 6px; }
  .disclaimer { font-size: 0.8rem; font-style: italic; color: #444; border: 1px solid #ccc; padding: 0.6rem; margin-top: 1rem; }
  hr { margin: 2.5rem 0; border: none; border-top: 3px double #999; }
  @media print { body { margin: 0; } hr { page-break-after: always; border: none; } }
</style>
</head>
<body>
  <p style="font-size:0.85rem;color:#555;">Batch patient: <strong>${esc(patientName)}</strong> · MRN ${esc(report.batchPatient.mrn)} · ${report.disciplineAudits.length} discipline${report.disciplineAudits.length === 1 ? "" : "s"} audited independently below.</p>

  ${disciplineSections}

  <hr/>
  <h1>Documentation Consistency (Cross-Discipline)</h1>
  ${
    report.documentationConsistency.length === 0
      ? `<p>${report.disciplineAudits.length > 1 ? "No cross-discipline inconsistencies were flagged." : "Only one discipline was present in this batch — nothing to compare."}</p>`
      : `<table>
    <thead><tr><th>Field</th><th>Discipline</th><th>Values Found</th><th>Note</th></tr></thead>
    <tbody>${consistencyRows}</tbody>
  </table>`
  }

  <p class="disclaimer">${esc(report.disclaimer)}</p>
  <p style="font-size:0.75rem;color:#777;">Generated ${esc(new Date(report.generatedAt).toLocaleString())}</p>
</body>
</html>`;
}
