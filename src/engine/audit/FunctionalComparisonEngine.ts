import type { ExtractedEvaluation } from "../extraction/extractionTypes";
import type { FunctionalChangeRow, FunctionalChangeDirection, EvidenceRef } from "../../types/audit";
import { normalizeAssistanceLevel, assistanceRank } from "../extraction/ClinicalNormalizer";

/**
 * FunctionalComparisonEngine
 * ===========================
 * Builds the "FUNCTIONAL CHANGE AT EVALUATION" (PLOF -> CLOF) table by
 * matching each documented current-level (CLOF) functional item to its
 * PLOF counterpart by functional-area label. This is descriptive/derived
 * evidence used to SUPPORT several audit criteria (reason for referral,
 * medical necessity, therapist assessment) — it is not itself a scored
 * criterion, and per the spec each criterion using it is still evaluated
 * independently rather than treating a decline as automatic credit.
 */
export function buildFunctionalChangeTable(extracted: ExtractedEvaluation): FunctionalChangeRow[] {
  const plofByLabel = new Map(extracted.plofFunctionalItems.map((i) => [normalizeLabel(i.label), i]));

  const rows: FunctionalChangeRow[] = [];
  for (const clof of extracted.clofFunctionalItems) {
    const key = normalizeLabel(clof.label);
    const plof = plofByLabel.get(key);
    const plofLevel = normalizeAssistanceLevel(plof?.value);
    const clofLevel = normalizeAssistanceLevel(clof.value);
    const plofRank = assistanceRank(plofLevel);
    const clofRank = assistanceRank(clofLevel);

    let change: FunctionalChangeDirection = "Not Assessed";
    if (plofRank !== null && clofRank !== null) {
      if (clofRank > plofRank) change = "Improved";
      else if (clofRank < plofRank) change = "Declined";
      else change = "Unchanged";
    } else if (/not attempted/i.test(clof.value) && plof && /independent/i.test(plof.value)) {
      // "Not attempted due to medical conditions or safety concerns" isn't on
      // the assistance ladder, but going from a documented Independent PLOF
      // to "not safe/able to attempt" at evaluation is itself a meaningful,
      // clinically real decline worth surfacing — flagged distinctly so it's
      // never confused with a ranked comparison.
      change = "Declined";
    }

    rows.push({
      area: clof.label,
      plof: plof?.value ?? "Not Found",
      clof: clof.value,
      change,
      notes: !plof ? "No matching PLOF item documented for this area" : undefined,
    });
  }

  return rows;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function functionalChangeEvidence(extracted: ExtractedEvaluation): EvidenceRef[] {
  const plofEv = extracted.plofFunctionalItems[0]?.evidence ?? [];
  const clofEv = extracted.clofFunctionalItems.flatMap((i) => i.evidence).slice(0, 1);
  return [...plofEv, ...clofEv];
}
