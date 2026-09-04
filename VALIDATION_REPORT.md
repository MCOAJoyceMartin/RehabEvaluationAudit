# Development Validation Report — Rehab Evaluation Audit (V1)

**Module:** Initial Evaluation & Plan of Treatment audit
**Test record:** `PH OPS OF ARLINGTON_8132026_337PM_DW.pdf` (patient: Doris Whitlock, PT, Initial Evaluation dated 5/14/2025, pages 1–5 of 16)
**Human comparison source:** `7.2025 Evaluator_Arlington.xlsx`, tab **"Evaluator Audit 3"** (rows 7–17 — the 11 rows corresponding to the Initial Evaluation & Plan of Treatment)
**Scoring authority:** `key` tab of the same workbook, as implemented in `src/audit-rubrics/evaluationAuditRubric.ts`

This report exists to answer one question directly: **does the software correctly apply the audit methodology from the Key** — not whether it reproduces one human auditor's judgment call-for-call. Every place the AI and the human diverge is categorized by cause below rather than quietly reconciled. Nothing in the AI's scoring logic was adjusted after the fact merely to force a match with this human-scored example.

## Summary

| Metric | Result |
|---|---|
| Criteria compared | 11 of 11 |
| Exact score agreement | **10 / 11 (90.9%)** |
| Pass/Fail agreement (ignoring point-value differences within the same status) | 10 / 11 (90.9%) |
| Criteria requiring reviewer attention | 1 (`Orders in PCC`) — by design, not by defect |

## Criterion-by-criterion comparison

| Criterion | Human Score | AI Score | Match? | AI Evidence (abridged) | Difference Explanation |
|---|---|---|---|---|---|
| Contains medical history | 3/3 | 3/3 | ✅ | p2: "Prior Medical History: cervical CA, HTN, left shoulder fracture, ER visit in December 2024 after a fall" | — |
| Contains Medications list | 3/3 | 3/3 | ✅ | p2: "Medications Impacting Condition/Treatment: verapamil" | — |
| Completed Timely | 2/3 | 2/3 | ✅ | p1: Start of Care 5/14/2025; p2: therapist signature 5/15/2025 03:30:31 PM EDT (next-day completion) | — |
| Health Status/Reason for Referral | 3/3 | 3/3 | ✅ | p2: "84 y/o female who went to hospital with AMS and poor PO intake... found on floor at ILF" correlated to diagnosis (Metabolic encephalopathy; Muscle wasting and atrophy) | — |
| Objective Tests/Standardized Test | 0/3 | 0/3 | ✅ | p4: "Test/Sit Balance Sitting Balance Scale = NT" (Not Tested) | — |
| Therapist Assessment | 3/3 | 3/3 | ✅ | p3: 12 functional areas with documented PLOF→CLOF change (e.g., Bed Mobility: Roll left/right, Independent → Partial/moderate assistance) | — |
| **Orders in PCC** | **3/3** | **Unable to Validate** (excluded from scored %) | ❌ (by design) | p1: "Frequency: 6x/week; Duration: 30 days; Certification Period 5/14–6/12/2025" (Plan of Treatment only — no PCC order evidence present in this PDF) | **External PCC evidence unavailable to the AI.** The uploaded record is a therapy note/eval PDF; it does not, and cannot, contain a screenshot or export of the PCC ordering system. The human auditor evidently had independent PCC system access when scoring this 3/3. Per your confirmed decision, the AI treats "no PCC evidence in the uploaded document" as **Unable to Validate**, not as a failure, and does not treat the physician's Plan of Treatment certification as proof that a matching PCC order exists. This is an intentional, user-approved scope boundary, not an extraction or logic defect. |
| Medical Necessity | 3/3 | 3/3 | ✅ | p4: "Clinical Impressions/Reason for Skilled Services: Pt would benefit from Continued skilled PT treatment... to increase strength, balance, activity tolerance and safety awareness" chained to diagnosis + 12 declined functional areas | — |
| Assessment Summary | 4/4 | 4/4 | ✅ | p4: Clinical impression, risk factors, barriers/complexities, and functional-level change all present (4 of 4 expected elements) | — |
| LTG Justification | 3/3 | 3/3 | ✅ | p1/p2: both LTGs target above documented baseline, tied to diagnosis + planned CPT codes | — |
| STG Appropriate and within LTG | 3/3 | 3/3 | ✅ | p1: all 3 STGs measurable and mapped to LTG#1.0 (functional-domain-based mapping, since the source document has no explicit STG→LTG link) | — |

## Agreement statistics

- **Exact score agreement:** 10/11 = 90.9%
- **Pass/Fail (categorical) agreement:** 10/11 = 90.9% — the one divergence is a status category the human's workflow doesn't have available to it (the human tool has no "Unable to Validate" outcome, only a numeric score), so it is not comparable as a same-scale disagreement.
- **Criteria with a legitimate, documented reason for divergence:** 1 of 1 (100% of divergences are explained, none are unexplained)

## Divergence category taxonomy (as required)

Every AI/human difference is assigned to exactly one of the following categories. Only one criterion diverges, and it falls in category (5):

1. Incorrect extraction — none observed.
2. Incorrect Key interpretation — none observed.
3. Missing source documentation — none observed (the medical record's Evaluation & Plan of Treatment section is complete for this patient).
4. Ambiguous human judgment — none observed.
5. **External PCC evidence unavailable to the AI** — `Orders in PCC` (see above). This is the one confirmed, user-approved scope boundary of the current build: the AI cannot see the PCC ordering system, so it reports "Unable to Validate — PCC Required" with a recommended action (reviewer confirms the order exists in PCC) instead of asserting a score it cannot support with in-document evidence.
6. Legitimate clinical interpretation difference — none observed.

## What this report intentionally does NOT do

Per your explicit instruction, no scoring logic was adjusted to chase a 11/11 match. The `Orders in PCC` divergence stands as documented evidence that the software is applying the audit methodology (score only what the uploaded record can support) rather than mirroring one auditor's session in a system the AI cannot access. If your organization later provides a way to feed PCC order data into the AI (e.g., an export or API), this is the one criterion that would need a new evidence source — no scoring-logic change — to close the gap.

## Notes on scope of this comparison

- Only the 11 rows in "Evaluator Audit 3" tagged `Evaluation medical review`, `Evaluation`, and `Plan of Care/ Treatment` were used, matching the V1 scope (Initial Evaluation & Plan of Treatment only). The `Progress Notes`, `Daily Notes`, `Recertification`, and `Discharge Summary` rows in that tab are out of scope for this module and were not compared — they belong to future modules (see `README.md`).
- The `key` tab remained the sole source of scoring rules throughout development; "Evaluator Audit 3" was used only as a validation example, never as a rule source, consistent with the source-of-truth hierarchy (Key > Evaluator Audit 3 > Therapy PDF).
