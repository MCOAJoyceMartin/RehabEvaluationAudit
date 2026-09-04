# Pre-Build Rubric Analysis — Rehab Evaluator Audit v2

Prepared per the "FIRST RESPONSE REQUIRED" instruction in `UpdatedRehabEvalPrompt.txt`.
**No application code has been written or modified.** This is the analysis-only
deliverable, followed by a STOP POINT.

Reference files used:
- Key rubric: `8.2026 Dallas Evaluator Audit.xlsx`, tab **"key"**
- Human validation example: same workbook, tab **"Evaluator Audit 2"** (patient James Askew)
- Clinical evidence: `JamesAskew.pdf` (43-page NetHealth batch report)
- Implementation reference only: `JamesAskewClaudeAudit.pdf` (current app's output for this patient)

---

## A. Complete Rubric Extracted from the Key

All 33 criteria, 7 sections, 100 points total. "Special Scoring Logic" quotes the Key's own comment where it exists.

### A.1 Evaluation Medical Review (9 pts)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 1 | Contains Medical History | 3 | Binary-ish (present/quality) | Must contain actual history content | No | No | "See chart" or an equivalent deferral is **not acceptable** — automatic 0 |
| 2 | Contains Medications List | 3 | Binary-ish | Must contain actual medication content | No | No | "See MAR" is **not acceptable** — automatic 0 |
| 3 | Completed Timely | 3 | 4-tier | Therapist eval completion/signature vs. DOS | No (internal timestamps only) | No | Same day = 3; next day = 2; 2 days = 1; >48 hrs = 0. **Physician signature date is a separate, distinct concept — never substituted for therapist completion.** |

### A.2 Evaluation (19 pts)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 4 | Health Status / Reason for Referral | 3 | Quality | Referral reason documented and consistent with diagnosis | Yes, conditionally | No | "Falls reported must be in PCC, and must coincide with diagnosis used" — a stated fall history triggers a PCC cross-check flag |
| 5 | Objective Tests / Standardized Test | 3 | Binary | An appropriate, discipline-relevant standardized test was administered | No | No | "Appropriate test = 3, everything else = 0" — **no partial credit** |
| 6 | Therapist Assessment | 3 | Quality | PLOF→CLOF functional change + pain correlation to goals/diagnosis + cross-reference to PCC nursing documentation | Yes (PCC nursing) | No | External-validation piece scored/tracked separately from the functional-change piece |
| 7 | Orders in PCC | 3 | Binary | A matching therapy order exists in PCC | Yes — inherently external | No | "Yes = 3, no = 0" — but **absence of uploaded PCC evidence is UNABLE TO VALIDATE, not a scored 0** |
| 8 | Medical Necessity | 3 | Quality | Diagnosis→impairment→functional limitation→skilled need→benefit/risk chain | No | No | Boilerplate "skilled therapy is medically necessary" does not qualify |
| 9 | Assessment Summary | 4 | Quality (multi-element) | Clinical impression, reason for skilled services, risk factors, recent falls (if in PCC), change in functional level | Yes, conditionally (falls/PCC) | No | Only 4-point criterion in the entire rubric |

### A.3 Plan of Care / Treatment (6 pts)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 10 | LTG Justification | 3 | Quality | Target > CLOF, supported by CPT/diagnosis codes and reason for referral | No | No | — |
| 11 | STG Appropriate and within LTG | 3 | Quality | Each STG measurably nests under a documented LTG | No | No | — |

### A.4 Progress Notes (12 pts)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 12 | Completed Timely | 3 | 4-tier (different tiers than A.1) | Progress note completion/signature vs. period end DOS | No | No | Same day = 3; within 24 hrs = 2; same week = 1; anything greater = 0 |
| 13 | Patient's Response to Treatment | 3 | Quality | Patient-specific response; comments required for any goal without progress; barriers summarized | No | No | — |
| 14 | Modifications in the POC | 3 | Quality | Goal/plan changes tracked with baseline→current | No | No | — |
| 15 | Treatment Frequency | 3 | Deviation-based | Actual unique treatment DOS vs. ordered frequency (per original eval, recert, or addendum); refusals entered | No | No | Key gives no explicit tolerance band — see Section E/F |

### A.5 Daily Notes / Treatment Encounter Notes (18 pts)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 16 | Patient Response to Treatment | 3 | Pattern-based | Dropdowns must be supported by patient-specific narrative, not repetitive | No | No | Never label "repetitive" from common therapy terminology alone |
| 17 | Treatment Strategies Reflect Progression/Skill | 3 | Quality | Measurable/objective info + specific clinician strategies, not patient-activity description alone | No | No | Distinguish patient activity from skilled clinician intervention |
| 18 | Reflects Attendance/Compliance | 3 | Deviation-based | Missed visits documented with a communication/reschedule attempt | No | No | Same frequency-deviation ambiguity as #15 |
| 19 | Caregiver Education | 3 | Quality | Non-repetitive, addresses barriers/discharge readiness | No | No | "Verbal instruction" alone does not auto-qualify |
| 20 | Linked to Specific Goals | 3 | Quality | CPT code ties to an active STG/LTG via impairment | No | No | CPT code alone does not prove skilled linkage |
| 21 | Discontinued When Goal Met | 3 | Quality | CPT billing stops targeting a goal once that goal is met | No | Yes | N/A when no goal has been met yet |

### A.6 Recertification (24 pts — applies only when a recert falls within the episode)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 22 | LTGs Are Justified | 3 | Quality | — | No | Yes | N/A if discharged before recert due |
| 23 | STGs Are Appropriate | 3 | Quality | — | No | Yes | same |
| 24 | Treatment/Modifications Relevant to Impairment | 3 | Quality | — | No | Yes | same |
| 25 | Treatment Related to Goals | 3 | Quality | — | No | Yes | same |
| 26 | Amount/Frequency/Duration | 3 | Quality | Frequency changes require justification in the continued-skill section | No | Yes | same |
| 27 | Justification for Continued Services | 3 | Quality | — | No | Yes | same |
| 28 | Orders in PCC | 3 | Binary | — | Yes | Yes | "Yes = 3, no = 0"; UNABLE TO VALIDATE if not uploaded |
| 29 | Completed Timely | 3 | 4-tier (a *third*, different tier set) | — | No | Yes | Same day = 3; within 24 hrs = 2; within 48 hrs = 1; all greater = 0 |

### A.7 Discharge Summary (12 pts)

| # | Criterion | Max | Scoring Method | Key Definition | External Evidence? | N/A Allowed? | Special Scoring Logic |
|---|---|---|---|---|---|---|---|
| 30 | All Goals Addressed | 3 | Quality | Every STG/LTG accounted for at discharge | No | No | — |
| 31 | Reason for Discharge | 3 | Quality | — | No | No | — |
| 32 | **Completed Timely** | 3 | **Undefined** | Key comment is only *"document completed timely"* | No | No | **No thresholds defined anywhere in the Key. See RUBRIC DECISION REQUIRED #1.** |
| 33 | Orders in PCC | 3 | Binary | — | Yes | No | "Yes = 3, no = 0"; UNABLE TO VALIDATE if not uploaded |

**Total: 100 points across 33 criteria.**

---

## B. Mapping of Evaluator Audit 2 to the Key

Patient: James Askew. Documenting clinicians named in the tab: Maurice Chua, PT (eval, discharge, most TENs); Samuel Wogaman, PTA and Shan Su, PTA (some TENs). **No OT clinician is named anywhere in this tab** — see Ambiguity E.1; the human validation example scores the PT episode only.

Reported total: **59/73 (80.8%)**.

| Key Criterion | Human Score | Human Comment | Supporting NetHealth Evidence |
|---|---|---|---|
| Eval Med Review – Completed Timely | 3/3 | "5/13 - same day" | PT Eval signed 5/13/2026 12:01:49 PM, same day as SOC 5/13 |
| Evaluation – Objective Tests/Standardized Test | 3/3 | "Sitting Balance, Elderly Mobility" | PT Eval: Sitting Balance Scale 37/44, Elderly Mobility Scale 8/20 (30-Sec Sit-to-Stand marked unable) |
| Progress Notes – Completed Timely | 3/3 | "5/20 - completed same day" | PT Progress Report (5/13–5/20) signed by PTA Wogaman 5/20/2026 3:18 PM |
| Progress Notes – Treatment Frequency | **0/3** | "POC written 5x/wk - pt seen 7x between 5/13-5/19" | PT Progress Report states "seen for 8 day(s)" during 5/13–5/20 vs. ordered 5x/wk |
| Daily Notes – Reflects Attendance/Compliance | **0/3** | "Scheduled and treated 7x during first week - POC written for 5x" | Same over-frequency pattern as above |
| Daily Notes – Patient Response to Treatment | 1/3 | "Repetitive use of drop downs from NH EMR - lacks patient specific responses to interventions." | PT TENs show recurring phrases ("compliant with adaptations," "actively participates with skilled interventions") across multiple dates |
| Daily Notes – Treatment Strategies Reflect Progression/Skill | 2/3 | Distinguishes 2 TENs with skilled language ("adjustment of center of mass over base of support," "facilitation") from the remainder, which lack it | PT TENs 5/13–5/25 |
| Daily Notes – Caregiver Education | 1/3 | "TENs don't support patient or caregiver education other than 'verbal instruction' during therex." | PT TENs |
| Daily Notes – Discontinued When Goal Met | x/x (N/A) | "NA - no goals met" | No PT goal marked "Met" prior to discharge (all 5 STG/LTG pairs marked "Discontinue on 05/25/2026," not "Met") |
| Recertification – all 8 criteria | x/x (N/A), all 8 | Not applicable — discharged before recert due | Cert period 5/13–6/11; discharged 5/25, well before recert would fall due |
| Discharge – Orders in PCC | 3/3 | "Home with HH" | PT D/C Recs: "Home exercise program and Home health services" — **this is discharge-disposition language, not confirmed PCC order evidence** — see Ambiguity E.3 |
| Discharge – Completed Timely | **2/3** | "5/25 - completed 5/27" | PT Discharge Summary: DOS through 5/25, signed 5/27/2026 7:57:57 AM — 2 days |

*(Remaining Key criteria — Medical History, Medications List, Health Status/Referral, Therapist Assessment, Orders in PCC [Evaluation], Medical Necessity, Assessment Summary, LTG Justification, STG Appropriate, Modifications in POC, Patient Response to Treatment [Progress], Linked to Goals — also have scored rows in the tab; they are omitted here only because they carry no ambiguity signal. Full row-by-row detail is available on request before build.)*

**Two scores above do not cleanly fit any timing scale elsewhere in the Key** (Discharge 2-day gap → 2/3; a hypothetical same tier applied to Progress Notes' 3-tier scale would give 1/3 for "same week," and Eval Medical Review's 4-tier scale would give 1/3 for "2 days") — reinforcing that Discharge timeliness is running on an implicit, undocumented rule, not a documented one. This is exactly the spec's own worked "RUBRIC DECISION REQUIRED" example, confirmed present in real data.

---

## C. NetHealth Batch Document Inventory and Episode Timeline

Patient: askew, James · DOB 9/28/1936 · MRN 6744 · Facility: PH OPS OF DALLAS.

Page ranges below are my best classification from the rendered pages, not a byte-exact parser index — the actual build should re-derive exact boundaries from the parser's own page-break detection rather than these hand-counted ranges.

| Discipline | Document Type | DOS / Period | Completion/Signature | Pages (approx.) |
|---|---|---|---|---|
| PT | Evaluation & Plan of Treatment | 5/13/2026 | Maurice Chua, PT — 5/13/2026 12:01:49 PM (physician signature blank) | 1–7 |
| OT | Evaluation & Plan of Treatment | 5/13/2026 | Tiffany Simmons, OT — 5/14/2026 11:55:01 AM (physician signature blank) | 8–13 |
| OT | Progress Report #1 | 5/13–5/19/2026 (5 days seen) | Nicole Bardsley, COTA 5/21 → cosign Tiffany Simmons, OT 5/22 | 14–17 |
| PT | Progress Report | 5/13–5/20/2026 (8 days seen vs. 5x/wk ordered) | Samuel Wogaman, PTA 5/20 → cosign Maurice Chua, PT 5/21 | 18–21 |
| PT | Treatment Encounter Notes (11 dated entries: 5/13, 5/15–5/22, 5/25) | daily | Mix of direct Chua signatures and PTA-signed/PT-cosigned; one entry (5/19) carries a later "Revision Signature" dated 5/29 adding co-treatment fields | ~22–31 |
| PT | Discharge Summary | 5/13–5/25/2026 (progress period 5/21–5/25, 3 days seen) | Maurice Chua, PT — 5/27/2026 7:57:57 AM (2-day gap from 5/25) | ~30–31 |
| OT | Treatment Encounter Notes (9+ dated entries: 5/13–5/22, 5/25) | daily | Mix of COTA-signed/OT-cosigned and direct OT signatures; one entry (5/20) carries a later "Revision Signature" dated 5/29 | ~32–39 |
| OT | Progress Report #2 | 5/20–5/25/2026 (4 days seen) | Leon King, COTA 5/25 → cosign Anita Joy, OT 5/27 | ~40 |
| OT | Discharge Summary | 5/13–5/25/2026 (progress period 5/25–5/25) | Anita Joy, OT — 5/28/2026 2:47:54 PM (3-day gap from 5/25) | 41–43 |

**No SLP documentation and no Recertification document exist in this batch** — consistent with an episode entirely inside its initial 4–8 week certification window.

**Structural asymmetry worth flagging in Section D/F**: PT produced one Progress Report and folded its final treatment period into the Discharge Summary; OT produced two Progress Reports plus a separate Discharge Summary. The Key does not say whether "Completed Timely"/"Treatment Frequency" should be scored per Progress-Report-instance or once per discipline-episode — see Ambiguity E.6.

### Episode timeline (constructed, both disciplines interleaved by DOS)

5/13 Eval (PT+OT, SOC) → 5/13 PT TEN → 5/13 OT TEN → 5/14 OT TEN → 5/15 PT TEN → 5/15 OT TEN → 5/16 PT TEN → 5/17 PT TEN → 5/18 OT TEN → 5/18 PT TEN → 5/19 PT TEN → 5/19 OT TEN → 5/19 OT Progress Report #1 closes (5/13–5/19) → 5/20 PT TEN → 5/20 OT TEN → 5/20 PT Progress Report closes (5/13–5/20) → 5/21 PT TEN → 5/21 OT TEN → 5/22 PT TEN → 5/22 OT TEN → 5/25 PT TEN (final) → 5/25 OT TEN (final) → 5/25 PT Discharge (DOS) → 5/25 OT Progress Report #2 closes (5/20–5/25) → 5/25 OT Discharge (DOS) → 5/27 PT Discharge signed → 5/27 OT Progress Report #2 cosigned → 5/28 OT Discharge signed → 5/29 two TEN "Revision Signatures" (PT 5/19 note, OT 5/20 note) add co-treatment fields after the fact.

---

## D. Gap Analysis of the Current Claude Audit

`JamesAskewClaudeAudit.pdf` (4 pages) is the only artifact reviewed for this section, used strictly as an implementation-reference snapshot of what the existing app already does — not as a scoring source of truth.

**What it currently covers:** PT discipline only. Sections shown: Evaluation Medical Review (3/3 criteria), Evaluation (6/6 criteria), Plan of Care/Treatment (2/2 criteria visible before the file is cut off by its own pagination) — i.e., exactly the 3 sections and 11 criteria that were in the V1 scope, worth 34 raw points, 31 after excluding "Orders in PCC" as Unable to Validate. Reported overall: 26/31 (83.9%), Pass 7 / Partial 3 / Fail 0 / Unable to Validate 1, with "External Validation Pending: 1 criterion / 3 points (excluded from the score)."

**What's already correct and should be preserved, not rebuilt:**
- The PASS/PARTIAL/FAIL/UNABLE TO VALIDATE status vocabulary and the "excluded from denominator" scoring rule already exist and already work exactly as the new spec wants (source: the 26/31 excludes the 3-point PCC criterion).
- The PCC-evidence-sufficiency policy is already correctly implemented and is exactly right per the new spec: *"The uploaded therapy documentation does not contain PCC order evidence. The physician's Plan of Treatment certification within this document is not, by itself, treated as proof of a matching PCC order."* This is a deliberate, already-approved design decision (documented in `PROMPT_TEMPLATE.md` §6) and should not be silently loosened — see Ambiguity E.3, where Evaluator Audit 2's own Discharge scoring appears to contradict this policy.
- Evidence citation, "Reviewer Override" column, "Corrective Actions," "What Was Done Well," and "Additional Documentation Findings" (e.g., its own PLOF/CLOF gap flag) already exist as first-class dashboard sections and match the new spec's requirements almost exactly — these are extension points, not rebuilds.
- "External Validation Needed" as its own labeled section, separate from scored criteria, already exists — this is the same design pattern the new spec now asks to extend into "External Validation Pending" and a new sibling "Rubric Confirmation Pending."

**What's entirely missing (net-new build, not modification):**
- **OT audit — zero coverage.** Despite the batch containing a full OT Evaluation, two OT Progress Reports, 9+ OT Treatment Encounter Notes, and an OT Discharge Summary, the current app produced no OT output at all. Discipline-segregated auditing is a wholly new capability.
- **4 of 7 required sections are unbuilt**: Progress Notes, Daily/Treatment Encounter Notes, Recertification, Discharge Summary — 66 of the Key's 100 points have no corresponding extraction or scoring logic today.
- **No Therapy Episode Timeline construction.**
- **No Goal Lifecycle Engine** (longitudinal goal status across Eval→Progress→Daily→Discharge).
- **No Treatment Frequency Engine** (ordered vs. actual unique DOS by week).
- **No Documentation Similarity/Repetitive-Template Engine.**
- **No Documentation Consistency Engine** (the diagnosis-onset, payer, and discharge-disposition discrepancies found by hand in Section C would all need this).
- **No `PENDING RUBRIC CONFIRMATION` status** — the current type system only has PASS/PARTIAL/FAIL/UNABLE TO VALIDATE; a 4th, distinct status must be added without collapsing into the other three.
- App name and header still say "Rehab Evaluation Audit" / "Overall Score" — spec requires "Rehab Evaluator Audit" / "Overall Evaluator Audit Score."

**Net conclusion:** the existing app is a correct, working implementation of roughly one-third of the new spec (the Evaluation-only, PT-only slice), with its core architectural decisions (data-driven rubric, evidence citation, override system, denominator-exclusion math, UNABLE TO VALIDATE discipline) already sound and reusable. The remaining two-thirds is genuinely new capability, not a fix to existing capability. This confirms "extend/refactor" is the right instruction to follow, and a from-scratch rebuild would in fact discard code that already does what's being asked of it.

---

## E. Ambiguities and Conflicts Found

**E.1 — Evaluator Audit 2 validates PT only, not OT.** No OT clinician appears anywhere in the tab's header or rows. The spec requires discipline-segregated audits (PT and OT scored and shown separately), but there is no human-scored ground truth for OT at all in this workbook. Any OT-specific scoring logic (e.g., what counts as an "appropriate" OT standardized test, OT timeliness tiers) will ship unvalidated against a human example. This isn't fixable by re-reading the files — it's a genuine gap in the reference material.

**E.2 — Discharge "Completed Timely" has no defined thresholds** (Key comment: *"document completed timely"* only). Two real same-episode data points exist and disagree in shape: PT closed a 2-day gap (5/25→5/27), scored 2/3 by the human; OT closed a 3-day gap (5/25→5/28), never scored by the human at all. Applying the same 2/3 to the OT case, or inventing a scale from one PT data point, would be exactly the fabrication the spec prohibits. → **RUBRIC DECISION REQUIRED #1** (below).

**E.3 — PCC evidence sufficiency conflicts between the existing app's policy and Evaluator Audit 2's actual scoring.** The current app (and V1's approved design) treats "Orders in PCC" as UNABLE TO VALIDATE whenever no direct PCC evidence is uploaded, and explicitly refuses to treat a physician's POC certification as proxy evidence. But Evaluator Audit 2 scores Discharge "Orders in PCC" 3/3 based only on the comment *"Home with HH"* — a discharge-disposition note, not confirmed PCC order evidence. If the app followed the human's apparent standard here, it would contradict its own already-built, already-correct policy for the Evaluation-section version of the identical criterion. → **RUBRIC DECISION REQUIRED #2**.

**E.4 — Treatment frequency / attendance-compliance appears to have zero tolerance, but only one data point exists.** The one observed case is *over*-frequency (7–8 visits vs. 5 ordered), scored a full 0 — not partial credit for "close but over." There is no way to tell from this single example whether a 1-visit variance would also be a full 0, or whether some tolerance band exists that the Key just never had occasion to state. → **RUBRIC DECISION REQUIRED #3**.

**E.5 — The spec's own illustrative list of "appropriate" standardized tests doesn't match what the human actually accepted.** The spec names TUG, Berg, Tinetti/POMA, 5×Sit-to-Stand, 30-Second Chair Stand, 6MWT, 10-Meter Walk, Functional Reach, Gait Speed as PT-appropriate measures. The PT eval in this episode used Sitting Balance Scale and Elderly Mobility Scale — neither of which is on that list — and the human scored it 3/3 anyway. Treating the spec's list as exhaustive would have produced a false 0 here. → **RUBRIC DECISION REQUIRED #4**.

**E.6 — Progress Report scoring unit is undefined when a discipline has more than one Progress Report per episode.** PT had one; OT had two. The Key doesn't say whether "Completed Timely" and "Treatment Frequency" should be scored once per discipline-episode or once per Progress-Report instance (which would give OT two data points and PT one, an uneven comparison). → recommend scoring per-instance and rolling up with the worst-case (most conservative) result per discipline, but this is a judgment call, not something the Key states.

**E.7 (informational, not scoring-blocking) — three cross-document inconsistencies found by hand, all candidates for the new Documentation Consistency Engine, none of which affect any Key score:**
- M62.81 (muscle weakness) onset date: 5/9 on the PT eval vs. 5/13 on the OT eval and OT discharge.
- Payer: "Medicare Part A" on both evaluations vs. "UHC Navi (MGA)" on every progress report, TEN, and discharge summary in both disciplines — consistent enough across many documents that it reads as a real mid-episode payer change or a system default, not a one-off typo.
- Discharge disposition: both evaluations planned "home w/support"; both actual discharge summaries (PT and OT) show "discharged to ALF" — consistent across both disciplines, most likely a legitimate clinical outcome change, not an error.

None of these are Key criteria, so per the spec's own instruction they should surface only as "Potential inconsistency — reviewer validation recommended" findings, never as score deductions. I recommend confirming that disposition rather than silently building it in, since it's a judgment call about scope (should the Documentation Consistency Engine even look across disciplines, e.g. PT-vs-OT diagnosis lists, or only within one discipline's own document set?).

**E.8 — Whether the Objective Test rule truly allows zero partial credit for OT.** The OT eval shows the Sitting Balance Scale as "NT" (not tested) at intake — under a strict binary reading of the Key this scores 0/3 for OT, with no human example to confirm since Evaluator Audit 2 never scored OT. Flag as unvalidated inference, not blocking, since it follows directly from the Key's own explicit binary language ("appropriate test=3, everything else=0").

I did not find any conflict between the Key and the current app's own prior design decisions beyond E.3 above — the rest of the existing implementation is consistent with everything the new spec asks for.

---

## F. Rubric Decisions Required From You

Per the spec's own instruction, none of these have been resolved — they are extracted as factual findings only, tracked separately from the scored total, pending your decision.

**RUBRIC DECISION REQUIRED #1 — Discharge Summary "Completed Timely" thresholds**
- Key states: only "document completed timely." No tiers defined.
- Key does NOT define: any hour/day thresholds.
- Evaluator Audit 2 appears to do: score a 2-day gap as 2/3 (PT); no OT data point exists at all (3-day gap, unscored).
- Is one example sufficient to establish a universal rule? **No** — a single 2-day→2/3 data point cannot responsibly generalize to a full tier scale, especially with a second same-episode instance (3-day gap) that was never human-scored to check against.
- Recommended configuration options: (a) reuse the Progress Notes 3-tier scale (same day=3/within 24h=2/same week=1/else=0) — under this, the PT 2-day gap would score 1, not 2, so it would *not* match the human example; (b) reuse the Recertification 4-tier scale (same day=3/24h=2/48h=1/else=0) — under this, the PT 2-day gap (>48h) scores 0, also not matching; (c) build a new, independent Discharge-specific tier scale calibrated to match the one PT data point (arbitrary, and exactly the kind of invention the spec prohibits); (d) do not score a numeric tier at all — report elapsed time as a factual finding, set status to PENDING RUBRIC CONFIRMATION, exclude from the denominator, and track potential points separately until you supply the actual organizational threshold.
- **Decision needed from you:** which option, or supply the actual thresholds your organization uses for Discharge timeliness. Recommendation: (d), since it's the only option that doesn't either contradict the one data point we have or invent a scale to match it.

**RUBRIC DECISION REQUIRED #2 — PCC evidence standard for Discharge "Orders in PCC"**
- Key states: "yes=3, no=0" for a matching order in PCC.
- Key does NOT define: what counts as sufficient evidence of "yes" when no PCC export is uploaded.
- Evaluator Audit 2 appears to do: score 3/3 based on a discharge-disposition comment ("Home with HH"), not confirmed PCC order text.
- Is this sufficient to establish a rule? **No** — it directly conflicts with the already-built, already-correct UNABLE TO VALIDATE policy used elsewhere in the same app for the identical criterion type.
- Recommended configuration options: (a) keep the existing stricter policy everywhere (UNABLE TO VALIDATE absent direct PCC evidence, including at Discharge) — the human's one Discharge score would then not be reproduced by the app, and that should be reported honestly in the eventual validation report as a "Human Judgment Difference," not silently matched; (b) treat home-health/discharge-disposition language as a defined proxy for PCC orders at Discharge specifically (a new, narrower rule that would only apply to this one criterion); (c) something else you specify.
- **Decision needed from you:** (a) or (b), or your own rule. Recommendation: (a), to keep one consistent PCC-evidence standard across the whole app rather than a special case at Discharge.

**RUBRIC DECISION REQUIRED #3 — Treatment frequency / attendance tolerance band**
- Key states: treatment must match ordered frequency (per eval/recert/addendum), refusals entered.
- Key does NOT define: any tolerance for near-misses (e.g., is 6 visits vs. 5 ordered also a 0, or does partial credit exist above some threshold?).
- Evaluator Audit 2 appears to do: score a 7–8-vs-5 over-frequency as a flat 0 for both the Progress Notes and Daily Notes versions of this concept.
- Is this sufficient to establish a rule? **Only for large deviations** — we have no data point near the boundary.
- Recommended configuration options: (a) zero-tolerance — any deviation from ordered frequency (over or under) scores 0, matching the only example we have; (b) a configurable tolerance band (e.g., ±1 visit/week = full credit) with 0 credit beyond it; (c) proportional/partial credit scaled to the size of the deviation.
- **Decision needed from you:** which option, and if (b), what band. Recommendation: ship (a) as the default (matches the only evidence available) but make it a config value, not a hard-coded rule, so it can be loosened later without a code change.

**RUBRIC DECISION REQUIRED #4 — Master list of "appropriate" standardized tests per discipline**
- Key states: "appropriate test = 3, everything else = 0," no list.
- Spec's own illustrative examples (TUG, Berg, Tinetti/POMA, etc. for PT) do not include Sitting Balance Scale or Elderly Mobility Scale, both of which the human scored as fully appropriate (3/3) in this exact episode.
- Is either list sufficient to establish a rule? **No** — the two examples in hand (spec's list, human's actual acceptance) already disagree with each other.
- Recommended configuration options: (a) build an extensible, configurable per-discipline list seeded with the spec's named examples plus every measure confirmed accepted in Evaluator Audit 2 (Sitting Balance Scale, Elderly Mobility Scale) and easily extendable by you later without a code change; (b) accept any named, scored standardized outcome measure as sufficient, with no fixed list at all (more permissive, less protective against a fabricated-sounding but non-standard "test").
- **Decision needed from you:** which approach, and whether you want to supply MCOA's actual approved test list per discipline (PT/OT/SLP) now rather than let me seed it from these two partial sources.

No other item rises to the level of a rubric decision — E.7's three cross-document findings and E.6's per-instance-vs-per-episode Progress Report question are lower-stakes judgment calls where I've stated a recommendation above; I'll proceed on those recommendations unless you tell me otherwise, since they don't change any point value.

---

## G. Recommended Application Architecture Changes

**Do not fork a new app.** Continue directly in `/root/rehab-audit-app/`. The `-v2` fixtures directory was scratch space for this analysis only; once you confirm the decisions in Section F, the three new fixture files should move into `/root/rehab-audit-app/fixtures/` alongside the existing V1 fixtures, and the `-v2` folder can be deleted. This matches your explicit instruction and is also simply true on the evidence: Section D shows the existing architecture (data-driven rubric, evidence citation, override system, denominator math, UNABLE TO VALIDATE handling) is already correct for a third of the new scope and directly extensible for the rest.

Concretely, once decisions are confirmed:

1. **Rubric config**: replace `src/audit-rubrics/evaluationAuditRubric.ts` with a new `src/audit-rubrics/evaluatorAuditRubric.ts` covering all 7 sections/33 criteria, each entry carrying `ruleStatus: 'CONFIRMED' | 'NEEDS_CONFIRMATION'`, `applicableDisciplines`, `externalValidation`, `allowNA`, and (for the 3 timing criteria) a `timingRules` array populated only once Decision #1 is resolved for Discharge — Progress Notes and Recertification timing tiers are already fully defined by the Key and can be confirmed immediately.
2. **Types**: extend the audit status union to add `'PENDING_RUBRIC_CONFIRMATION'` as a 4th distinct value alongside `FAIL/N_A/UNABLE_TO_VALIDATE`, and add a parallel `rubricConfirmationNeeded[]` array and `pendingRubricConfirmation` total, mirroring how `externalValidationNeeded[]` already works today.
3. **Document classification**: extend `DocumentClassifier.ts`/`EpisodeDetector.ts` (currently Evaluation-only) to recognize Progress Report, Daily/Treatment Encounter Note, Recertification, and Discharge Summary document types, and to tag each with discipline.
4. **New extractors** (parallel to the existing `EvaluationExtractor.ts`): `ProgressNoteExtractor.ts`, `DailyNoteExtractor.ts`, `RecertExtractor.ts`, `DischargeExtractor.ts`.
5. **New engines** under `src/engine/audit/`: `GoalLifecycleEngine.ts`, `TreatmentFrequencyEngine.ts`, `DocumentationSimilarityEngine.ts`, `DocumentationConsistencyEngine.ts` — all additive alongside the existing `FunctionalComparisonEngine.ts`, `GoalAnalysisEngine.ts`, `RiskEngine.ts`, `FindingsEngine.ts`.
6. **Pipeline**: `RehabAuditPipeline.ts` needs to run once per discipline detected in a batch (currently implicitly PT-only) and produce a separate audit object per discipline, plus an optional combined interdisciplinary summary view — this is the single largest structural change, everything else is additive.
7. **Dashboard**: extend navigation to the spec's 8 sections (Evaluation / Progress Notes / Daily Notes / Recertification / Discharge / Timeline / Goal Lifecycle / Corrective Actions); the existing "Corrective Actions" and "What Was Done Well" sections already match #8 and can be reused as-is, just fed by more engines.
8. **Rename**: "Rehab Evaluation Audit" → "Rehab Evaluator Audit"; "Overall Score" → "Overall Evaluator Audit Score" (`App.tsx`, `index.html` title, README).
9. **Validation**: a new script/report that runs the James Askew PT episode through the rebuilt pipeline and diffs every applicable criterion against Evaluator Audit 2, producing the required Section/Criterion/Human Score/AI Score/Match?/AI Evidence/Difference Reason table — OT criteria have no human baseline to diff against (see E.1), so the OT audit's validation status should read "no human validation example available" rather than silently being marked as agreeing.

None of this touches the yourpureai.com portal card or the GitHub Pages deployment thread from earlier — both are unrelated and untouched by this work.

---

## Challenges to the spec (per its own "challenge any requirement that would create unreliable scoring" instruction)

- The spec's illustrative PT standardized-test list (E.5) and its illustrative Discharge-timeliness thresholds (E.2, the spec's own "same-day=3/1-day=2/2-days=1" worked example) should both be treated as **examples only, not defaults** — the spec itself says this about the Discharge example, but the same caution applies to the test list, since real data in this very episode already contradicts it. I'd rather ship both as empty/needs-confirmation than seed them from a spec example that's already been shown wrong once.
- Scoring Progress Report timeliness/frequency per-instance vs. per-episode (E.6) isn't addressed anywhere in the spec; I've made a recommendation but flag that it changes how many data points feed a percentage, which is worth your explicit sign-off even though it's not formally a "RUBRIC DECISION REQUIRED" item.
- I did not find any point where following the Key would produce scoring I consider unreliable, unsafe, or likely to generate false findings, once Decisions #1–#4 are resolved — the underlying rubric design (evidence-based, disciplined about UNABLE TO VALIDATE vs. FAIL) is sound.

---

## Confirmed Rubric Decisions Log

Decisions land here as you resolve them. Nothing in this log has been built yet — it's the confirmed spec the build will follow once all open items are closed.

### Decision (confirmed 9/1/2026) — EVAL_MEDICAL_HISTORY: cross-section satisfaction

This criterion wasn't one of my 4 flagged items — the Key's rule read as fairly deterministic already — but you found a real gap in it I'd missed: the Key never says whether content has to live specifically in a "Medical History" field, or whether equivalent content documented elsewhere in the same evaluation (Reason for Referral, History of Present Illness, etc.) can satisfy it.

**Resolution: yes, cross-section content satisfies the criterion**, for the reason you gave — the criterion is asking whether patient-specific medical history *exists in the document*, not which field it was typed into. Scoring a blank field as a 0 when the identical content sits one section up would be scoring form over substance, and would produce a false FAIL against documentation that's clinically complete. Your rule text's own caveat ("do not infer from diagnosis codes alone... unless the Key explicitly allows") already draws the correct line for me: a bare ICD-10 code sitting in the diagnosis table, with no narrative anywhere in the document, still scores 0 — only actual narrative content (diagnoses named in prose, comorbidities, hospitalization, surgical history, falls/injuries, or a relevant system-specific condition) counts, regardless of which section it's in.

Confirmed config (your JSON, with `ruleStatus` and the cross-section rule added):

```ts
{
  id: "EVAL_MEDICAL_HISTORY",
  section: "Evaluation Medical Review",
  title: "Contains Medical History",
  maxPoints: 3,
  scoringType: "binary",
  allowedScores: [0, 3],
  ruleStatus: "CONFIRMED",
  allowNA: false,
  externalValidation: false,
  zeroIfDeferralOnly: true,
  prohibitedDeferralExamples: [
    "see chart",
    "see medical record",
    "refer to chart",
    "see H&P",
    "see hospital records"
  ],
  // Content anywhere in the SAME evaluation document can satisfy this criterion —
  // not only a dedicated "Medical History" field. Accepted source sections include
  // (non-exhaustive, extend as needed): Medical History, Reason for Referral /
  // Current Illness, History of Present Illness/Condition, or an equivalent
  // narrative context section.
  crossSectionSatisfaction: true,
  acceptableSourceSections: [
    "Medical History",
    "Reason for Referral",
    "Health Status / Reason for Referral",
    "History of Present Illness",
    "Current Illness"
  ],
  // A bare diagnosis/ICD code with no accompanying narrative, anywhere in the
  // document, does NOT satisfy this criterion even under crossSectionSatisfaction.
  diagnosisCodeAloneInsufficient: true,
  passRule:
    "Patient-specific relevant medical history is documented anywhere in the therapy evaluation.",
  failRule:
    "Medical history is absent everywhere in the evaluation, or consists only of deferral language / bare diagnosis codes with no actual patient-specific narrative."
}
```

Note for the eventual validation run: in James Askew's PT eval, the dedicated "Prior Medical History" field is itself populated ("Inclusive but not limited to DM, HTN, Anemia, Back Surgery, L Knee Surgery"), so this particular episode doesn't actually exercise the cross-section path — it'll validate against future episodes where the dedicated field is blank.

### Decision (confirmed 9/1/2026) — EVAL_MEDICATIONS_LIST

Fully deterministic as written — no open question to flag back. Confirmed as given, no changes needed to your rule text.

Confirmed config:

```ts
{
  id: "EVAL_MEDICATIONS_LIST",
  section: "Evaluation Medical Review",
  title: "Contains Medications List",
  maxPoints: 3,
  scoringType: "binary",
  allowedScores: [0, 3],
  ruleStatus: "CONFIRMED",
  allowNA: false,
  externalValidation: false,
  zeroIfDeferralOnly: true,
  prohibitedDeferralExamples: [
    "see MAR",
    "refer to MAR",
    "see medication list",
    "see chart",
    "refer to chart",
    "per facility MAR"
  ],
  // At least one specific, clinically relevant medication (or a medication
  // class where the actual medication is otherwise clearly identifiable)
  // is sufficient for full credit. Do not require a complete MAR/med-rec.
  // Do not reduce score for additional un-mentioned medications.
  minimumMedicationsForFullCredit: 1,
  inferMedicationsFromDiagnosis: false,
  // Cross-section satisfaction, same rule as EVAL_MEDICAL_HISTORY: content
  // anywhere in the SAME evaluation document counts. Content appearing only
  // in a Progress Note, Daily/TEN, Recertification, or Discharge Summary
  // does NOT retroactively satisfy this Evaluation Medical Review criterion.
  crossSectionSatisfaction: true,
  crossDocumentSatisfaction: false,
  // Deferral language ("See MAR") plus actual named medication content in
  // the same evaluation still scores 3 — the automatic 0 applies only when
  // deferral is the ONLY content present.
  deferralWithActualContentStillPasses: true,
  // A named medication with no explanation of its clinical significance
  // still scores 3 under this criterion; that gap may surface as a separate
  // documentation-quality finding but must not change this score.
  clinicalSignificanceExplanationRequired: false,
  passRule:
    "At least one actual, patient-specific, clinically relevant medication is documented anywhere in the therapy evaluation.",
  failRule:
    "No medication is documented, or only deferral language (e.g. 'See MAR') is present with no actual medication identified."
}
```

### Decision (confirmed 9/1/2026) — EVAL_COMPLETED_TIMELY

Confirmed as given. Worth noting: the Key's own original phrasing ("same day=3/next day=2/2 days=1/>48hrs=0") actually mixed two different units — day-count tiers for the first three rows, an hour-count cutoff for the last — which could disagree with each other right at the boundary (e.g. DOS 5/13 5:00 PM, signed 5/15 10:00 AM is a 2-calendar-day difference but only ~41 elapsed hours, under the ">48hrs" cutoff). Your confirmed rule resolves that cleanly by using calendar-day difference throughout, including for the 3+ tier, so there's no seam left in the logic. Also keeping your two safeguards as written: a missing/unreliable therapist completion date returns UNABLE TO VALIDATE (never a guessed 0), and conflicting dates return REVIEWER VALIDATION REQUIRED rather than picking one — both consistent with the spec's "never invent, never guess" principle.

Confirmed config:

```ts
{
  id: "EVAL_COMPLETED_TIMELY",
  section: "Evaluation Medical Review",
  title: "Completed Timely",
  maxPoints: 3,
  scoringType: "calendar_day_timeliness",
  ruleStatus: "CONFIRMED",
  allowedScores: [0, 1, 2, 3],
  allowNA: false,
  externalValidation: false,
  thresholds: [
    { calendarDays: 0, points: 3 },
    { calendarDays: 1, points: 2 },
    { calendarDays: 2, points: 1 },
    { calendarDaysMin: 3, points: 0 }
  ],
  dateSource: "evaluating_therapist_completion_signature",
  prohibitedDateSources: [
    "physician_signature",
    "physician_certification",
    "physician_order",
    "progress_note_signature",
    "discharge_signature",
    "batch_report_date",
    "pdf_creation_date",
    "certification_period_end_date"
  ],
  // Identify the clinician responsible for the evaluation itself; a later
  // cosignature never overrides an earlier evaluating-therapist completion
  // date. All signature dates are preserved as evidence/metadata regardless.
  useEarliestResponsibleTherapistDate: true,
  ignoreCosignatureForTimeliness: true,
  missingDatePolicy: "UNABLE_TO_VALIDATE",
  conflictingDatePolicy: "REVIEWER_VALIDATION_REQUIRED",
  requiredAuditOutputFields: [
    "evaluationDOS",
    "therapistCompletionDate",
    "calendarDayDifference",
    "score",
    "status",
    "evidencePage",
    "evidence",
    "confidence",
    "physicianCertificationDate_displayOnly_notUsedForScore"
  ]
}
```

Applying this to James Askew's PT eval as a sanity check (not a build step, just confirming the rule reads correctly against real data): DOS 5/13/2026, Maurice Chua PT signed 5/13/2026 12:01:49 PM — 0 calendar days → 3/3, matching the human's own score. OT eval: DOS 5/13/2026, Tiffany Simmons OT signed 5/14/2026 11:55:01 AM — 1 calendar day → 2/3 (no human OT baseline to compare against, per the earlier note that Evaluator Audit 2 never scored OT).

### Decision (confirmed 9/1/2026) — EVAL_HEALTH_STATUS_REFERRAL

Confirmed as given. This one does real work the current app doesn't do yet — worth being explicit about what's genuinely new versus what's already covered.

The separation of the 0–3 quality score from the PCC Fall Validation status (never double-penalizing the same gap in two places) is the same design principle already built and working for the plain "Orders in PCC" criterion — good that it's applied consistently here rather than as a special case. The "no fall reported → NOT TRIGGERED, don't go looking for one just because weakness/balance/gait/fall-risk language is present" rule is an important guardrail against the model manufacturing a fall that was never actually documented.

Sanity check against James Askew's own data (not a build step): the PT eval's Reason for Referral explicitly documents a ground-level fall ("recent hospitalization due to recent GLF at home resulting to R Distal Clavicular Fx, L Leg Pain and Swelling") — so the Fall Trigger fires for the PT episode. Under the new rule this should produce: Health Status/Reason for Referral quality score 3/3 (clear patient-specific referral, clinically consistent with the Cellulitis/Difficulty-Walking diagnoses), Fall Reported: YES, and — since no PCC documentation was included in this batch — Fall Documented in PCC: UNABLE TO VALIDATE, Fall Coincides With Diagnosis Used: UNABLE TO VALIDATE — PCC REQUIRED, PCC Fall Validation: UNABLE TO VALIDATE — PCC REQUIRED, External Validation: REQUIRED. I checked Evaluator Audit 2 directly: the human scored this criterion 3/3 with no comment recorded, so the 3/3 quality score matches, but the tab gives no signal either way on a separate PCC-fall-validation output — confirming this is genuinely new structured output, not something the human audit format even attempted to capture. I also confirmed the current app's existing PT audit already scores this criterion 3/3 with reasoning that reads correctly under the new quality tiers, but it emits no Fall Reported / PCC Fall Validation fields at all today — so that half of this decision is real new logic to build, not a hidden duplicate.

Confirmed config:

```ts
{
  id: "EVAL_HEALTH_STATUS_REFERRAL",
  section: "Evaluation",
  title: "Health Status / Reason for Referral",
  maxPoints: 3,
  scoringType: "quality_clinical_consistency",
  ruleStatus: "CONFIRMED",
  allowedScores: [0, 1, 2, 3],
  allowNA: false,
  externalValidation: "conditional",
  qualityLevels: {
    3: "Clear patient-specific reason for referral with a meaningful health/functional change and clinical consistency with the diagnosis used and therapy need.",
    2: "Patient-specific referral reason is generally supported, but one important clinical connection is insufficiently developed.",
    1: "Limited or vague referral information requiring substantial inference to establish why therapy began.",
    0: "No meaningful referral reason, no supported health/functional change, generic documentation only, or clear unexplained inconsistency with diagnosis."
  },
  diagnosisConsistency: {
    exactWordingRequired: false,
    evaluateClinicalRelationship: true,
    uncertainRelationshipStatus: "REVIEWER_VALIDATION_REQUIRED"
  },
  // Cross-section evidence within the SAME evaluation is allowed (e.g. PLOF/CLOF
  // fields supporting a Reason-for-Referral narrative). Direct vs. cross-referenced
  // evidence must be labeled distinctly; nothing may be manufactured.
  crossSectionSatisfaction: true,
  distinguishDirectFromCrossReferencedEvidence: true,
  conditionalExternalValidation: {
    trigger: "documented_fall_or_fall_related_event",
    triggerSources: ["health_status", "reason_for_referral", "medical_history", "current_condition", "functional_decline", "other_referral_relevant_documentation"],
    doNotInferFallFrom: ["weakness", "balance_impairment", "gait_impairment", "unsteadiness", "fall_risk_flag", "assistive_device_use"],
    sourceRequired: "PCC",
    requiredChecks: [
      { id: "FALL_DOCUMENTED_IN_PCC", requirement: "Verify the fall reported in the therapy evaluation is documented in PCC." },
      { id: "FALL_COINCIDES_WITH_DIAGNOSIS", requirement: "Verify the reported fall coincides with the diagnosis used." }
    ],
    bothChecksRequired: true,
    perCheckStatuses: ["YES", "NO", "REVIEWER_VALIDATION_REQUIRED", "UNABLE_TO_VALIDATE"],
    missingEvidenceStatus: "UNABLE_TO_VALIDATE_PCC_REQUIRED",
    overallStatuses: ["SUPPORTED", "NOT_SUPPORTED", "REVIEWER_VALIDATION_REQUIRED", "UNABLE_TO_VALIDATE_PCC_REQUIRED"],
    affectsReasonForReferralScoreWhenPCCMissing: false,
    affectsReasonForReferralScoreWhenPCCFails: false,
    reportSeparatelyFromCriterionScore: true,
    noFallReportedStatus: "NOT_TRIGGERED"
  },
  requiredAuditOutputFields: [
    "healthStatusReasonForReferral", "documentedChange", "functionalImpact", "relevantDiagnosis",
    "diagnosisConsistency", "score", "status", "evidencePages", "evidenceType", "confidence",
    "fallReported", "fallEvidence", "fallDocumentedInPCC", "fallCoincidesWithDiagnosis",
    "pccFallValidation", "externalValidationStatus"
  ]
}
```

### Decisions (confirmed 9/1/2026) — original Rubric Decisions Required #1–#4, resolved per stated recommendations

**DC_COMPLETED_TIMELY (Discharge Summary — Completed Timely)**
```ts
{
  id: "DC_COMPLETED_TIMELY",
  section: "Discharge Summary",
  title: "Completed Timely",
  maxPoints: 3,
  scoringType: "calendar_day_timeliness_pending",
  ruleStatus: "NEEDS_CONFIRMATION",
  allowNA: false,
  externalValidation: false,
  timingRules: null, // DO NOT invent thresholds
  ambiguityNote: "Key defines no thresholds ('document completed timely' only). Two same-episode data points disagree in shape (PT 2-day gap human-scored 2/3; OT 3-day gap never scored). Report elapsed calendar-day difference as fact; do not assign a numeric score until MCOA supplies actual thresholds.",
  pendingBehavior: {
    status: "PENDING_RUBRIC_CONFIRMATION",
    excludeFromDenominator: true,
    trackPotentialPointsSeparately: true,
    displayFields: ["dischargeDOS", "completionSignatureDate", "calendarDayDifference"]
  },
  dateSource: "discharge_therapist_completion_signature",
  observationalHumanExample: {
    discipline: "PT", calendarDayDifference: 2, humanScore: 2,
    note: "Shown as observational evidence only — never converted into a scoring rule."
  }
}
```

**DC_ORDERS_IN_PCC (Discharge Summary — Orders in PCC)**
```ts
{
  id: "DC_ORDERS_IN_PCC",
  section: "Discharge Summary",
  title: "Orders in PCC",
  maxPoints: 3,
  scoringType: "binary",
  allowedScores: [0, 3],
  ruleStatus: "CONFIRMED",
  allowNA: false,
  externalValidation: true,
  pccEvidenceStandard: "direct_pcc_order_evidence_required",
  acceptableProxyEvidence: false, // discharge-disposition/HH-referral language ("Home with HH") alone is NOT sufficient
  missingEvidenceStatus: "UNABLE_TO_VALIDATE",
  note: "Same PCC-evidence standard already used for the Evaluation-section Orders in PCC criterion — one standard everywhere, no Discharge-only exception. Evaluator Audit 2 scored this 3/3 off discharge-disposition language alone; that will be reported as a Human Judgment Difference in the Development Validation Report, not replicated."
}
```

**PN_TREATMENT_FREQUENCY (Progress Notes) / DN_ATTENDANCE_COMPLIANCE (Daily Notes)**
```ts
{
  id: "PN_TREATMENT_FREQUENCY",
  section: "Progress Notes",
  title: "Treatment Frequency",
  maxPoints: 3,
  scoringType: "frequency_deviation",
  ruleStatus: "CONFIRMED",
  allowedScores: [0, 3],
  allowNA: false,
  externalValidation: false,
  toleranceBand: { type: "zero_tolerance", varianceVisitsAllowed: 0 },
  appliesToOverAndUnderFrequency: true,
  configOnlyChangeRequired: true,
  note: "Only observed data point is an over-frequency case (7–8 visits vs. 5 ordered, scored 0). Zero-tolerance shipped as the default and made a config value, not a hard-coded rule, so it can be loosened without a code change if MCOA later defines a tolerance band."
},
{
  id: "DN_ATTENDANCE_COMPLIANCE",
  section: "Daily Notes",
  title: "Reflects Attendance/Compliance",
  maxPoints: 3,
  scoringType: "frequency_deviation",
  ruleStatus: "CONFIRMED",
  sharesEngineWith: "PN_TREATMENT_FREQUENCY",
  toleranceBand: { type: "zero_tolerance", varianceVisitsAllowed: 0 },
  configOnlyChangeRequired: true
}
```

**EVAL_OBJECTIVE_TESTS (Evaluation — Objective Tests / Standardized Test)**
```ts
{
  id: "EVAL_OBJECTIVE_TESTS",
  section: "Evaluation",
  title: "Objective Tests / Standardized Test",
  maxPoints: 3,
  scoringType: "binary",
  allowedScores: [0, 3],
  ruleStatus: "CONFIRMED",
  allowNA: false,
  externalValidation: false,
  approvedTestsByDiscipline: {
    PT: ["TUG", "Berg Balance Scale", "Tinetti/POMA", "5x Sit-to-Stand", "30-Second Chair Stand", "6-Minute Walk Test", "10-Meter Walk Test", "Functional Reach", "Gait Speed", "Sitting Balance Scale", "Elderly Mobility Scale"],
    OT: ["Barthel Index", "Self-Care Function Score", "Mobility Function Score"],
    SLP: []
  },
  listExtensible: true,
  configOnlyChangeRequired: true,
  note: "Spec's own illustrative PT list omitted Sitting Balance Scale and Elderly Mobility Scale, both accepted 3/3 by the human in this episode — seeded here from the spec's examples plus every measure actually confirmed accepted. OT and SLP lists are only lightly seeded (no OT human validation exists, no SLP documentation at all in this batch) — recommend MCOA supply the authoritative per-discipline list when convenient; until then this is the operative list."
}
```

All 8 rubric decisions are now resolved. Proceeding to the build.

**Still open — none.** (Discharge timeliness thresholds, PCC evidence standard at Discharge, treatment-frequency tolerance, and the standardized-test list) remain unresolved. You appear to be working through the full A.1–A.7 criterion list in order rather than only my 4 flagged items — that's fine and more thorough; I'll keep logging each as it's confirmed. No code changes yet.

---

## STOP POINT

This is the required stop. No code has been written or modified in `/root/rehab-audit-app/`. I'm waiting on your answers to Rubric Decisions #1–#4 above (or your own thresholds/lists in place of my recommendations) before extending the application.

*(Superseded — see BUILD STATUS below. All 8 decisions above were confirmed and the build was authorized and completed.)*

---

## BUILD STATUS

The full v2 build (types, rubric, 5 new extractors, 4 new engines, 33-criterion `AuditEngine`, multi-discipline `RehabAuditPipeline`, schema validation) is complete and compiles clean (`npm run build`).

### Critical bug found and fixed during end-to-end validation: discipline segregation

Running the full pipeline against the James Askew batch initially produced only **one** discipline (`PT`) instead of the expected `PT` + `OT`, with OT's Progress Report / Daily Notes / Discharge documents silently folded into the PT audit — a direct violation of the "never blend disciplines" principle. Root-caused to two compounding bugs, both now fixed:

1. **`detectDisciplineFromText` matched the wrong discipline.** `DISCIPLINE_RULES`' PT pattern (`\bPT\b`, case-insensitive) matches the ubiquitous "Pt" abbreviation for *patient* that appears in every discipline's narrative body text ("Pt will...", "Pt engaged..."). Since this function was being called on each document's/boundary's full concatenated body text, PT was returned for the *first* discipline whose pattern matched anywhere in the text — nearly always PT, regardless of the document's actual discipline. **Fix:** added `detectDisciplineFromHeading(pages)` (`DocumentClassifier.ts`), which detects discipline only from each page's repeated title heading (the first few lines — "Physical Therapy" / "Occupational Therapy" — which never contains the "Pt" abbreviation). Every discipline-detection call site (`EpisodeDetector.ts` and all 5 extractors: Evaluation/ProgressReport/DailyNote/Discharge/Recert) now uses this instead of the raw full-text version.

2. **Boundary grouping only broke on a documentType change, not a discipline change.** The James Askew batch places an OT Evaluation immediately after the PT Evaluation (pages 1–7 PT, 8–13 OT — both classified `documentType: "EVALUATION"`), and similarly an OT Progress Report immediately before a PT one. `detectEpisodeBoundaries` grouped contiguous pages of the *same documentType* into one boundary regardless of discipline, merging two different disciplines' documents into a single boundary. **Fix:** `detectEpisodeBoundaries` now detects discipline per-page (from its own heading) and starts a new boundary whenever either documentType *or* discipline changes, carrying a discipline forward only across pages whose own heading didn't yield one (a sparse continuation page) — the same forward-carry convention `DocumentClassifier` already uses for documentType.

After both fixes: `detectDisciplinesInBatch` correctly returns `['PT', 'OT']`, 9 boundaries are produced (2 Evaluation, 2 Progress Report, 2 Daily Treatment Note, 2 Discharge — no Recertification, consistent with discharge occurring before either discipline's recert fell due), each discipline gets its own fully independent `RehabAuditResult` (PT: 46/64 scored = 71.9%; OT: 40/67 scored = 59.7%, both schema-valid), and the batch-level Documentation Consistency check correctly surfaces one genuine cross-discipline finding: the two evaluations' "Muscle weakness (generalized)" diagnosis carries a different onset date (5/9/2026 on the PT eval vs. 5/13/2026 on the OT eval) — flagged for reviewer validation, never asserted as an error.

### Remaining work (tracked, not yet started)
- `FindingsEngine.ts` — not yet extended to read the new v2 fields (goal lifecycle, frequency, documentation similarity/consistency) into corrective actions / top opportunities.
- UI layer (`App.tsx` and all `components/`) — still the v1 single-discipline single-section UI. `RehabAuditPipeline.ts` keeps a backward-compatible `runRehabEvaluationAudit()` wrapper (returns the first discipline found) so the existing UI keeps compiling and functioning in the meantime; the new primary API is `runRehabEvaluatorAudit()`, returning the full multi-discipline `EpisodeAuditReport`.
- Development Validation Report (PT vs. "Evaluator Audit 2" tab in the Dallas xlsx) — not yet generated.
- README / setup instructions — not yet updated for v2 scope.
