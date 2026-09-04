# Rehab Evaluator Audit

An AI-assisted clinical documentation audit tool for rehab therapy records (PT/OT/SLP). **This is not a PDF summarizer.** It classifies every document in an uploaded therapy record batch — Initial Evaluation, Plan of Treatment, Progress Notes, Daily/Treatment Encounter Notes, Recertification, Discharge Summary — reconstructs the full episode across those documents, extracts clinical evidence with page-level provenance, and scores it against your organization's 33-criterion, 100-point audit rubric — with an explicit, permanent distinction between "documentation is missing" and "documentation exists but cannot be validated from this upload alone."

> AI-assisted clinical documentation review. Findings are intended to support, not replace, qualified clinical review.

## What it does

- Parses a multi-page rehab therapy PDF batch (native text, not OCR), classifies every page by document type and discipline (PT/OT/SLP), and reconstructs document and episode boundaries — splitting on either a document-type change or a discipline change, so (for example) a PT Evaluation immediately followed by an OT Evaluation is never merged into one record.
- Scores the full 7-section, 33-criterion rubric — Evaluation Medical Review, Evaluation, Plan of Care/Treatment, Progress Notes, Daily Notes, Recertification, Discharge Summary — derived from the Key tab of `8.2026 Dallas Evaluator Audit.xlsx`. Every rubric decision is logged with reasoning in `PRE_BUILD_RUBRIC_ANALYSIS.md`.
- Returns one full result **per discipline** detected in the batch (never blended into a single score) inside a batch-level episode report, with a discipline switcher in the UI. Single-discipline batches look the same as before — the switcher only appears when more than one discipline is present.
- Extracts patient/episode identification, PLOF/CLOF functional status, standardized testing, medical necessity language, and STG/LTG goals — always citing the exact source page and verbatim source text, never fabricating or inferring a value that isn't present (`"Not Found"` is used explicitly instead of guessing).
- Runs episode-level analysis on top of the per-criterion scoring:
  - **Goal lifecycle** — tracks each goal from Evaluation → Progress → Discharge, flags billed treatment continuing after a goal's documented met date with no modification note.
  - **Treatment frequency** — ordered vs. actual unique treatment dates per certification period, grouped by rolling service-week from Start of Care, against a configurable zero-tolerance/variance-band rule.
  - **Documentation similarity** — flags templated/duplicated narrative (response-to-treatment, treatment narrative, caregiver education) across dates, and gives credit as a strength when documentation is consistently patient-specific instead.
  - **Documentation consistency** — batch-level, cross-discipline: flags mismatched Payer, onset date, or discharge disposition when 2+ disciplines' documentation disagrees.
- Applies the Key's scoring rules per criterion, computes an overall audit percentage that **excludes** N/A and Unable-to-Validate items from the denominator, and tracks Unable-to-Validate items separately as an "External Validation Opportunity" so an incomplete upload is never read as a failed audit. A distinct `PENDING_RUBRIC_CONFIRMATION` status/badge is used for criteria awaiting a rubric-owner decision rather than being force-scored.
- Lets a human reviewer override a score, add a note, and mark a criterion reviewed — the original AI score and analysis are always retained alongside the override, never overwritten. Overrides are in-memory only, cleared on refresh — exporting is the way to keep a permanent record (the app says so directly next to the override control).
- Exports/prints one report covering every discipline in the batch (patient header, scores, criteria, evidence, comments, recommendations, corrective actions, strengths, additional findings, timeline, goal lifecycle, frequency analysis, documentation similarity) plus the batch-level cross-discipline consistency findings — deliberately excluding internal AI reasoning/rubric plumbing. Optionally, "Save to OneDrive" sends that same report to a Power Automate flow that emails it to a purehlth.com mailbox and files it in OneDrive — see `docs/POWER_AUTOMATE_SETUP.md`.

See `DEVELOPMENT_VALIDATION_REPORT.md` for the full criterion-by-criterion comparison of this build's PT output against the human-scored "Evaluator Audit 2" tab (OT has no human baseline and is excluded from comparison, per spec).

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev       # start the dev server (Vite)
```

Open the printed local URL, then upload a rehab therapy PDF batch using the upload control. Processing happens entirely in the browser tab — see **PHI & security** below.

```bash
npm run build      # type-check (tsc -b) + production build
npm run preview    # serve the production build locally
npm run lint        # oxlint
```

To enable the "Save to OneDrive" button, see `docs/POWER_AUTOMATE_SETUP.md` and `.env.example` — it's optional and the button simply doesn't render if unconfigured.

### Dev/validation scripts (Node-side, no browser)

These were used to build and validate the extraction and scoring engine directly against sample PDFs and are kept for future module development and regression checking:

| Script | Purpose |
|---|---|
| `scripts/dev-check-parse.ts` | Raw page text extraction + document classification + episode boundary detection |
| `scripts/dev-check-rows.ts` | Label/value row extraction |
| `scripts/dev-check-goals.ts` | STG/LTG goal-block parsing |
| `scripts/dev-check-extract.ts` | Full `ExtractedEvaluation` object |
| `scripts/dev-run-pipeline.ts` | Backward-compatible single-discipline pipeline (first discipline found only) |
| `scripts/dev-run-batch.ts` | **Primary** dev script — full batch pipeline: parse → extract → audit → schema-validate, per discipline, printing audit/goal-lifecycle/frequency/similarity/timeline/findings/strengths/corrective-actions for each, plus the cross-discipline consistency table |
| `scripts/dev-dump-batch.ts` / `scripts/dev-inspect.ts` | Ad hoc inspection helpers used during development |

Run any of them with `npx tsx scripts/<name>.ts [path-to-pdf]` (defaults vary by script — check each script's `process.argv[2] ??` fallback; `dev-run-batch.ts` defaults to `fixtures/james-askew-nethealth-batch.pdf`).

## Architecture

Strict separation of concerns, so extraction, clinical interpretation, scoring, and presentation can each change independently:

```
src/
  types/audit.ts                  Contract types shared by engine + UI (RehabAuditResult, EpisodeAuditReport, etc.)
  audit-rubrics/
    rubricTypes.ts                 Shape of a rubric (criteria, scoring rules, PCC dependency config)
    evaluatorAuditRubric.ts        DATA, not code: the 33-criterion, 7-section rubric from the Key tab
  engine/
    pdf/                           PDFParser (isomorphic text extraction), loadPdfBrowser (browser-only loading),
                                    DocumentClassifier, EpisodeDetector
    extraction/                    rowExtraction, GoalBlockParser, ClinicalNormalizer, sharedExtraction, and one
                                    extractor per document type: EvaluationExtractor, ProgressReportExtractor,
                                    DailyNoteExtractor, RecertExtractor, DischargeExtractor
                                    (all extraction is PDF → structured data; zero scoring logic lives here)
    audit/                         AuditEngine (all 33 evaluators + rubric application), FunctionalComparisonEngine,
                                    GoalAnalysisEngine, GoalLifecycleEngine, TreatmentFrequencyEngine,
                                    DocumentationSimilarityEngine, DocumentationConsistencyEngine, RiskEngine,
                                    FindingsEngine (additional findings / strengths / top opportunities /
                                    supplementary corrective actions), cptGoalMapping
    validate/schemaValidate.ts      Zod schema gate before anything reaches the UI
    RehabAuditPipeline.ts           Orchestrator: PDF → parse → extract → audit → totals → validated result, per
                                     discipline, assembled into a batch-level EpisodeAuditReport
  components/                      Presentation only — no scoring or clinical logic. Includes DisciplineTabs,
                                    AuditDashboard, TimelinePanel, GoalLifecyclePanel, FrequencyAnalysisPanel,
                                    DocumentationSimilarityPanel, DocumentationConsistencyPanel, FindingsSections,
                                    AuditCriterionCard (incl. PENDING_RUBRIC_CONFIRMATION status), ExportControls
  state/reviewerOverrides.ts       In-memory-only reviewer override state, keyed by `${discipline}:${criterionId}`
  config/integrations.ts           "Save to OneDrive" relay endpoint config (see docs/POWER_AUTOMATE_SETUP.md)
  utils/                           dates.ts (calendar-day timeliness logic), exportReport.ts (HTML export),
                                    onedriveRelay.ts (posts the export to the configured Power Automate flow)
```

The rubric — not the React components, not the audit engine's control flow — is the single source of truth for scoring rules. Adding or changing a criterion is a data change in `src/audit-rubrics/evaluatorAuditRubric.ts`, not a code change in the engine or UI (the engine's per-criterion clinical-logic functions still need to exist, since "how do I decide this criterion's score from the extracted evidence" is genuinely clinical logic, not data — but no UI or pipeline code changes).

## Two confirmed scope decisions (binding on all scoring logic)

These were explicitly decided with the product owner before the original build and apply to every section, present and future:

1. **PCC-dependent criteria are scored "Unable to Validate," never a failure**, when the uploaded PDF contains no PCC evidence. The physician's Plan of Treatment certification within the therapy record is never treated as proof that a matching PCC order exists. Unable-to-Validate criteria are excluded from the scored percentage and reported separately as "External Validation Opportunity."
2. **Partial credit is holistic, not a strict weighted checklist.** For a multi-part criterion, the engine applies the Key's general 0–3 (or 0–4, where the Key specifies a different point opportunity) scale as one clinical judgment call, and reports the sub-elements it considered as supporting evidence in the auditor comment — it does not average or weight sub-checks into a score.

Treatment-frequency-dependent criteria (`PN_TREATMENT_FREQUENCY`, `DN_ATTENDANCE_COMPLIANCE`) share a third confirmed default: zero-tolerance variance, configurable per-criterion via `toleranceBand` in the rubric rather than hard-coded — see `PRE_BUILD_RUBRIC_ANALYSIS.md` Decision #3.

## PHI & security

- All PDF parsing and clinical extraction happens **client-side**, in the browser tab, using `pdfjs-dist`. No uploaded file or its extracted text is sent to a server, third-party API, or analytics/telemetry endpoint by this application.
- Uploaded PDFs are **not persisted** anywhere (no localStorage, no IndexedDB, no backend) — the file lives only in browser memory for the duration of the session and is discarded on refresh/close.
- Reviewer overrides (score override, note, "reviewed" flag) are also **in-memory only** (see `src/state/reviewerOverrides.ts`) and are lost on refresh by design, to avoid any risk of PHI landing in browser storage. If your organization needs overrides to persist across sessions, that requires a deliberate, separately-reviewed storage design (e.g., an authenticated backend with an audit trail) — do not add `localStorage`/`sessionStorage` persistence of clinical findings without that review.
- No PHI is ever placed in `console.log`, thrown errors, URLs/query strings, or any analytics/telemetry call. If you add logging or monitoring in a future deployment, audit it against this rule before shipping.
- This build has no server component and no network calls other than loading the app's own static assets, **unless you configure "Save to OneDrive"** (see `docs/POWER_AUTOMATE_SETUP.md`), which POSTs the report (containing PHI — name, MRN, DOB, diagnoses) to a URL you control. Before enabling it, confirm with your compliance team that the destination (mailbox, OneDrive account, and the Power Automate/Microsoft 365 environment it runs under) is appropriate for PHI — see the security note at the bottom of that doc, since the relay URL and its shared secret are both visible in this app's public client-side bundle.
- Before any production deployment, have your security team review hosting, transport (HTTPS), authentication, and audit-logging requirements — none of that is in scope for this client-side prototype.

## Adding future audit modules / disciplines

The engine was built so a new module or discipline is primarily a **data** addition, following the existing pattern in `evaluatorAuditRubric.ts`:

1. **Extend the rubric.** Add or adjust rows in `src/audit-rubrics/evaluatorAuditRubric.ts` using the `AuditRubric`/`RubricCriterion` shape in `rubricTypes.ts`, sourced from the Key tab.
2. **Write the per-criterion clinical logic** in `AuditEngine.ts`, reusing the existing extraction primitives (`ExtractedRow`, `EvidenceRef`, the normalization/goal utilities) wherever the same clinical concepts apply.
3. **Extend document-section extraction if needed.** `DocumentClassifier.ts`/`EpisodeDetector.ts` already identify page ranges per document type and discipline — a new extractor should pull structured data from its own document type's boundary pages only, the same way the existing extractors are scoped strictly to their own document type.
4. **Preserve the never-retroactive rule.** A later document type must never be used to fill in or "pass" a criterion that belongs to an earlier one (e.g., a Progress Report can't retroactively justify a missing Evaluation LTG). Each section scores only its own document type's own criteria.
5. **Reuse, don't fork, the shared engine pieces:** `PDFParser`, `DocumentClassifier`, `EpisodeDetector`, `ClinicalNormalizer`, `GoalAnalysisEngine`, `GoalLifecycleEngine`, `TreatmentFrequencyEngine`, `DocumentationSimilarityEngine`, `RiskEngine`, `schemaValidate.ts`'s pattern, and the UI components (`AuditCriterionCard`, `DisciplineTabs`, evidence viewer/jump-to-page) are all module-agnostic already.
6. **`RehabAuditPipeline.ts`** already runs every module's extractor + evaluators per discipline and merges results into the shared `RehabAuditResult`/`EpisodeAuditReport` shape — a new discipline just needs discipline detection (`DocumentClassifier.ts`) and, if its clinical vocabulary differs meaningfully from PT/OT, discipline-specific row labels/objective-test names in `rowExtraction.ts`.
7. **Apply the same PCC and holistic-scoring decisions** (see above) to any new criterion that depends on PCC or has multiple sub-parts — these are binding across all sections, not just Evaluation.

## Known limitations

- Recert (`RecertExtractor.ts`) is **unvalidated against real data** — no recertification document exists in the only fixture currently available (`fixtures/james-askew-nethealth-batch.pdf`). Treat its output as unverified until tested against a real sample.
- OT is scored but has **no human-scored baseline** to compare against (per spec) — SLP is likewise present as an extensibility path but unvalidated against a real SLP evaluation.
- STG→LTG goal mapping falls back to a clinical-domain keyword heuristic when the source document has no explicit link between a short-term and long-term goal; this is reported as `MEDIUM` confidence with the basis stated in the finding, not asserted as a certainty.
- `physicianSignatureRequired` reflects only whether signature *text* was found in the extracted PDF text — pdf.js text extraction cannot determine whether an on-page checkbox is actually checked, so this is reported as `"Unknown"` rather than guessed.
- Two low-risk, non-blocking scoring gaps are tracked in `DEVELOPMENT_VALIDATION_REPORT.md`: the STG↔LTG functional-area keyword linkage, and the LTG target-vs-baseline free-text parser.
