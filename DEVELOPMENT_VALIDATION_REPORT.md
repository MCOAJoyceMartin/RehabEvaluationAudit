# Development Validation Report — Rehab Evaluator Audit v2

**Patient / episode:** James Askew, PT documentation, 5/13/2026–5/25/2026 (Certification Period 5/13/2026–6/11/2026), evaluated against `fixtures/dallas-evaluator-audit.xlsx` tab **"Evaluator Audit 2"** — the human-scored reference for this episode's **PT** documentation only.

**OT is intentionally excluded from this comparison.** Per Ambiguity E.1 (`PRE_BUILD_RUBRIC_ANALYSIS.md`), no human-scored OT baseline exists for this episode — the app's OT audit (40/67 scored = 59.7%) runs and validates against schema correctly, but has nothing to be validated against here.

**Source data note:** the human audit sheet documents the therapist as "Maurice Chua, PT (eval, DC, and most TENs); Samuel Wogaman, PTA and Shan Su, PTA (TENs)" — consistent with the PT boundary set the app extracted (pages 1–7 Evaluation, 18–21 Progress Report, 22–27 Daily Notes, 28–31 Discharge).

## Summary

**Figures below are as originally generated.** Two of the 8 "criteria requiring review" (Plan of Care/LTG Justification and Plan of Care/STG Appropriate) were resolved by a goal-analysis parser fix made after this report was first produced — see **Update — goal-analysis parser fixes** below for the current, re-run numbers. The table and tallies in this section are left as originally generated (not silently edited) so the record of what was found and what was fixed stays intact; the two now-resolved rows are marked inline.

| Metric | Value (as originally generated) |
|---|---|
| Human total (Evaluator Audit 2) | 59 / 73 = 80.8% |
| AI total (scored criteria only) | 45 / 64 = 70.3% |
| Exact Score Agreement (33 criteria, N/A-vs-N/A counted as agreement) | 25 / 33 = **75.8%** |
| Pass/Fail Agreement (21 criteria where both sides render a pass/fail-type judgment) | 17 / 21 = **81.0%** |
| Criteria Requiring Review | **8** (now **6** — see Update section) |

The human total and AI total are not directly comparable point-for-point: the AI's scored denominator (64) excludes 3 criteria the human scored numerically but which the app deliberately reports as UNABLE_TO_VALIDATE (2, external PCC evidence not obtainable from a PDF) or PENDING_RUBRIC_CONFIRMATION (1, no Key threshold exists) rather than inventing a score — see rows 7, 32, 33 below.

## Full Criterion Comparison

| Section | Criterion | Human Score | AI Score | Match? | AI Evidence (brief) | Difference Reason |
|---|---|---|---|---|---|---|
| Evaluation Medical Review | Contains Medical History | 3/3 | 3/3 PASS | ✅ | Medical history documented in evaluation | — |
| Evaluation Medical Review | Contains Medications List | 3/3 | 3/3 PASS | ✅ | Named medication(s) documented | — |
| Evaluation Medical Review | Completed Timely | 3/3 ("5/13 – same day") | 3/3 PASS | ✅ | Eval DOS and therapist signature both 5/13/2026, 0-day gap | — |
| Evaluation | Health Status / Reason for Referral | 3/3 | 3/3 PASS | ✅ | Change documented, corresponds to diagnosis on file | — |
| Evaluation | Objective Tests / Standardized Test | 3/3 ("Sitting Balance, Elderly Mobility") | 3/3 PASS | ✅ | Elderly Mobility Scale, completed, discipline-appropriate | — |
| Evaluation | Therapist Assessment | 3/3 | 2/3 PARTIAL | ❌ | PLOF→CLOF change across 13 areas documented, but pain is noted with correlation to goals/diagnosis "not clearly stated" per the app's text-correlation check | **CLINICAL_INTERPRETATION_DIFFERENCE** — the app applies a documented penalty rule (pain noted without an explicit stated correlation) that the human reviewer did not apply here; a reviewer should confirm whether the pain/goal connection is implicit enough to warrant full credit |
| Evaluation | Orders in PCC | 3/3 | UNABLE_TO_VALIDATE | ❌ | No PCC system access from a PDF upload alone | **EXTERNAL_EVIDENCE_UNAVAILABLE** — confirmed design decision: a physician's Plan of Treatment certification within the PDF is never treated as proof of a matching PCC order (Decision, PRE_BUILD_RUBRIC_ANALYSIS.md). The human reviewer had direct PCC access; the app does not and never guesses. |
| Evaluation | Medical Necessity | 3/3 ("supportive dx and documented change of functional status") | 3/3 PASS | ✅ | Diagnosis/decline/risk-without-treatment chain documented | — |
| Evaluation | Assessment Summary | 4/4 | 4/4 PASS | ✅ | All 4 expected elements synthesized | — |
| Plan of Care/Treatment | LTG Justification | 3/3 | 2/3 PARTIAL (originally) → **3/3 PASS, fixed** | ❌→✅ **RESOLVED** | 2 of 5 LTGs (targets stated as assistance-level phrases) confirmed above baseline; 3 (LTG#1/2/5 — Elderly Mobility Scale score target, a distance+device target, a stair-count target) use free-text targets the app's assistance-level/distance parser cannot mechanically confirm exceed baseline | **RUBRIC_INTERPRETATION_DIFFERENCE** (extraction-limited) — a reviewer confirming these 3 targets do exceed baseline (they appear to, on manual read) would raise this to 3/3; the app intentionally reports "Unknown" rather than assume. **Fixed** — see Update section: the free-text comparison now also handles standardized-test scores ("15/20") and stair/step counts, and the assistance-level token extractor now recognizes "Setup or Clean-up Assistance" and "Partial/Moderate Assistance" as whole phrases; all 5 LTGs now confirm above baseline. |
| Plan of Care/Treatment | STG Appropriate and within LTG | 3/3 | 1/3 PARTIAL (originally) → **3/3 PASS, fixed** | ❌→✅ **RESOLVED** | 4 of 5 STGs map to an LTG by shared functional area; STG#1.0 (Elderly Mobility Scale score target) has no functional-area keyword match and falls back to "no LTG" rather than a same-domain guess | **RUBRIC_INTERPRETATION_DIFFERENCE** — STG#1.0's functional area ("balance," via the Elderly Mobility Scale) is clinically the same domain as LTG#1.0 (also an Elderly Mobility Scale target), but the app's keyword-based `classifyFunctionalArea` doesn't recognize a bare "enhance balance abilities" goal statement strongly enough to link it; a config/keyword refinement could close this gap. **Fixed** — see Update section: `classifyFunctionalArea` now recognizes named standardized balance measures (Elderly Mobility Scale, Berg, Tinetti, POMA, etc.) and falls back from an unrecognized sub-item label to the goal's own statement text; STG#1.0 now maps to LTG#1.0 with HIGH confidence. |
| Progress Notes | Completed Timely | 3/3 ("5/20 – completed same day") | 3/3 PASS | ✅ | Progress period end 5/20/2026, signature 5/20/2026, 0-day gap | — |
| Progress Notes | Patient's Response to Treatment | 1/3 ("canned/drop-down phrase, no barrier summary") | 1/3 PARTIAL | ✅ | Generic response narrative, goal(s) without progress lack barrier explanation | — |
| Progress Notes | Modifications in the POC | 3/3 | 3/3 PASS | ✅ | Goal status tracked with baseline-vs-current at each Progress Report | — |
| Progress Notes | Treatment Frequency | 0/3 ("POC 5x/wk, pt seen 7x 5/13–5/19") | 0/3 FAIL | ✅ | Week 1: 7 unique DOS vs. 5 ordered — over-frequency | — |
| Daily Notes | Patient response to treatment | 1/3 ("repetitive drop-downs, lacks patient specifics") | 1/3 PARTIAL | ✅ | Exact-duplicate response text on 7 of 11 documented dates | — |
| Daily Notes | Treatment Strategies reflect progression/skill | 2/3 ("majority state what patient did, not skilled justification") | 2/3 PARTIAL | ✅ | 40–70% of billed CPT entries include measurable/skilled-cueing language | — |
| Daily Notes | Reflects attendance/Compliance | 0/3 ("treated 7x, POC written for 5x") | 0/3 FAIL | ✅ | Week 1 over-frequency, no missed-visit entry | — |
| Daily Notes | Caregiver Education | 1/3 ("nothing beyond 'verbal instruction'") | 0/3 FAIL | ❌ | No content matching genuine education framing (educat*/caregiver/family-train/HEP) identified | **HUMAN_JUDGMENT_DIFFERENCE** — the human credited the bare "verbal instruction" language actually present with minimal partial credit (1/3) as *some* attempt; the app's rubric config requires content that reads as actual education (a topic, technique, or barrier) to earn any credit at all, and treats routine instructional cueing during an exercise as a distinct, non-education skilled-service element (see `DN_TREATMENT_PROGRESSION`) rather than double-counting it here |
| Daily Notes | Linked to specific Goals | 3/3 | 2/3 PARTIAL | ❌ | 16 of 22 billed CPT interventions (72.7%) map to an active goal's functional area by CPT→area lookup; the app's full-credit threshold is 80% | **CLINICAL_INTERPRETATION_DIFFERENCE** — the 6 unlinked entries are plausibly still goal-directed but use CPT codes (e.g. 97110, 97112 in contexts the lookup table maps to a narrower area than the goal addressed) the app's `cptGoalMapping.ts` table doesn't associate with the specific goal's functional area; a reviewer confirming the narrative support for those 6 would raise this to 3/3 |
| Daily Notes | Discontinued when goal met | N/A ("no goals met") | N/A | ✅ | No PT goal has a documented met-date this episode | — |
| Recertification | LTGs are Justified | x (N/A) | N/A | ✅ | No Recertification document; discharge preceded the recert due date | — |
| Recertification | STGs are appropriate | x (N/A) | N/A | ✅ | (same) | — |
| Recertification | Treatment/Modifications Relevant to Impairment | x (N/A) | N/A | ✅ | (same) | — |
| Recertification | Treatment Related to Goals | x (N/A) | N/A | ✅ | (same) | — |
| Recertification | Amount/Frequency/Duration | x (N/A) | N/A | ✅ | (same) | — |
| Recertification | Justification for Continued Services | x (N/A) | N/A | ✅ | (same) | — |
| Recertification | Orders in PCC | x (N/A) | N/A | ✅ | (same) | — |
| Recertification | Completed Timely | x (N/A) | N/A | ✅ | (same) | — |
| Discharge Summary | All Goals Addressed | 3/3 | 3/3 PASS | ✅ | All carried goals appear in the discharge table with a terminal status | — |
| Discharge Summary | Reason for Discharge | 3/3 ("reached max potential, education/training documented") | 3/3 PASS | ✅ | Specific reason with supporting discharge-recommendations context | — |
| Discharge Summary | Completed Timely | 2/3 ("5/25 – completed 5/27") | PENDING_RUBRIC_CONFIRMATION (factual: 2-day gap) | ❌ | Discharge DOS 5/25/2026, signature 5/27/2026 — 2 calendar days (fact matches the human's own note exactly) | **TIMING_RULE_AMBIGUITY** — confirmed Decision #1: the Key defines no timeliness tiers for this criterion at all ("document completed timely" only); the app reports the same 2-day gap as fact but declines to invent the 3/2/1/0-point tier scale the human reviewer applied from unstated personal judgment. Pending MCOA supplying the actual organizational threshold. |
| Discharge Summary | Orders in PCC | 3/3 ("Home with HH") | UNABLE_TO_VALIDATE | ❌ | Discharge recommends "Home with HH" | **HUMAN_JUDGMENT_DIFFERENCE / EXTERNAL_EVIDENCE_UNAVAILABLE** — confirmed Decision #2: a home-health-referral/discharge-disposition statement alone is not treated as proof of a matching PCC order under the same strict standard used at Evaluation; the human reviewer accepted the disposition language itself as sufficient evidence, which the app's confirmed rubric explicitly does not replicate |

## Classification tally (8 criteria requiring review, as originally generated)

| Category | Count | Criteria |
|---|---|---|
| EXTERNAL_EVIDENCE_UNAVAILABLE | 2 | Evaluation/Orders in PCC, Discharge/Orders in PCC (the second also carries a Human Judgment Difference) |
| TIMING_RULE_AMBIGUITY | 1 | Discharge/Completed Timely |
| HUMAN_JUDGMENT_DIFFERENCE | 2 | Daily Notes/Caregiver Education, Discharge/Orders in PCC |
| CLINICAL_INTERPRETATION_DIFFERENCE | 2 | Evaluation/Therapist Assessment, Daily Notes/Linked to specific Goals |
| RUBRIC_INTERPRETATION_DIFFERENCE (extraction-limited) | 2 → **0, both fixed** | ~~Plan of Care/LTG Justification, Plan of Care/STG Appropriate~~ — see Update section below |

No disagreement was force-resolved to match the human total — each is reported with its actual cause. Three of the eight (both Orders-in-PCC rows and Discharge Completed Timely) are **by design**: they reflect confirmed rubric decisions to never fabricate PCC evidence or an undefined timeliness threshold, not app defects. Of the remaining five genuine scoring gaps, the two RUBRIC_INTERPRETATION_DIFFERENCE (extraction-limited) rows have since been fixed (see below), leaving **3** open: Evaluation/Therapist Assessment, Daily Notes/Caregiver Education, Daily Notes/Linked to specific Goals.

## Update — goal-analysis parser fixes (this session)

The two RUBRIC_INTERPRETATION_DIFFERENCE (extraction-limited) rows above were closed by tightening `GoalAnalysisEngine.ts`, without touching any scoring rule or rubric threshold — same rubric, same evidence, better parsing of the same free text:

1. **Functional-area classification** (`classifyFunctionalArea` → `classifyGoalFunctionalArea`) now recognizes named standardized balance measures (Elderly Mobility Scale, Berg, Tinetti, POMA, Sitting Balance Scale, Functional Reach) as "Balance," and falls back from an unrecognized sub-item label (e.g. "Elderly Mobility Scale" alone matches nothing) to the goal's own free-text statement when the label itself doesn't classify.
2. **Target-vs-baseline comparison** (`compareQuantifiedTarget`, new) now also handles a standardized-test score pair ("15/20" target vs. "8/20" baseline) and a stair/step count pair ("4 stairs" vs. "0 steps"), alongside the existing distance-in-feet comparison — tried in order, only returning an answer when the *same* kind of quantity parses on both sides.
3. **Assistance-level token extraction** (`LEVEL_TOKEN_RE`) now captures "Setup or Clean-up Assistance," "Partial/Moderate Assistance," and "Supervision or Touching Assistance" as whole multi-word phrases (previously only abbreviated forms like "Mod A" or bare "Supervision" were recognized, and a bare "Supervision" token doesn't actually normalize to anything on its own in `ClinicalNormalizer`) so these NetHealth-style phrases resolve to a real assistance-level rank instead of falling through to "Unknown."

Re-running the full pipeline against the same fixture (`fixtures/james-askew-nethealth-batch.pdf`) after the fix:

| Metric | Before | After |
|---|---|---|
| PT scored total | 45 / 64 = 70.3% | **48 / 64 = 75.0%** |
| Exact Score Agreement (33 criteria) | 25 / 33 = 75.8% | **27 / 33 = 81.8%** |
| LTG Justification | 2/3 PARTIAL | **3/3 PASS** (matches human) |
| STG Appropriate and within LTG | 1/3 PARTIAL | **3/3 PASS** (matches human) |
| All 5 PT LTGs' target-vs-baseline | 2 of 5 confirmed above baseline | **5 of 5** confirmed above baseline |
| STG#1.0 → LTG mapping | Unmapped ("no LTG") | **STG#1.0 → LTG#1.0, HIGH confidence** ("Both directly address Balance") |

Pass/Fail Agreement (the 21-criteria subset) was not re-tabulated to a new precise figure here — the original 17/21 predates this fix and should be re-derived in a future full validation pass rather than estimated. Verified via `npm run build` (clean) and `npx tsx scripts/dev-run-batch.ts` against the same fixture; OT's goal lifecycle/frequency findings were spot-checked and are unaffected (OT has no human baseline to compare against, per the exclusion noted at the top of this report).

## Bugs found and fixed during this validation pass

Two defects were caught and corrected while producing this report (both now reflected in the scores above):

1. **Discipline misdetection from "Pt" abbreviation** and **boundary-merging across a discipline change** — together these caused the entire OT portion of the batch (Evaluation, Progress Report, Daily Notes, Discharge) to be silently mis-tagged as PT and folded into the PT audit. Fixed in `DocumentClassifier.ts` (heading-only discipline detection) and `EpisodeDetector.ts` (boundaries now split on a discipline change, not only a documentType change). See `PRE_BUILD_RUBRIC_ANALYSIS.md` → BUILD STATUS for full detail.
2. **`DN_LINKED_TO_GOALS`** originally excluded every goal whose discharge status was "Discontinued" from the "active goal areas" set — since nearly every goal reaches some terminal status by discharge, this made the check fail almost universally regardless of actual CPT-to-goal linkage. Fixed to consider all Plan-of-Care goals active for this check, regardless of eventual discharge disposition.
3. **`DN_CAREGIVER_EDUCATION`** originally flagged any mention of the word "instruction"/"instructed" as caregiver education, which is also the normal language used for routine skilled-cueing during an exercise (a distinct, unrelated element already credited elsewhere). Tightened to require genuine education-framed content.

---
*Generated as part of the Rehab Evaluator Audit v2 build validation. See `PRE_BUILD_RUBRIC_ANALYSIS.md` for the full rubric-decision log this build implements.*
