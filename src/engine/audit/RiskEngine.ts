import type { AuditStatus, RiskLevel } from "../../types/audit";

/**
 * RiskEngine
 * ===========
 * Risk classification is deliberately kept SEPARATE from the official Key
 * score (spec principle #11). A criterion can score 0 under the Key's
 * rules while still only being a LOW/MODERATE documentation risk, and vice
 * versa. CRITICAL is reserved for compound situations (see AuditEngine)
 * and is never assigned from a single criterion in isolation here.
 */

const HIGH_STAKES_CRITERIA = new Set([
  "EVAL_MEDICAL_NECESSITY",
  "EVAL_MEDICAL_HISTORY",
  "EVAL_MEDICATIONS",
  "EVAL_OBJECTIVE_TEST",
]);

export function classifyRisk(criterionId: string, status: AuditStatus, score: number | null, maxPoints: number): RiskLevel {
  if (status === "N/A") return "SUPPORTED";
  if (status === "UNABLE_TO_VALIDATE") return "MODERATE";
  if (status === "PASS") return "SUPPORTED";
  if (status === "FAIL") return HIGH_STAKES_CRITERIA.has(criterionId) ? "HIGH" : "MODERATE";
  // PARTIAL
  if (score === null) return "MODERATE";
  const ratio = score / maxPoints;
  return ratio <= 0.5 ? "MODERATE" : "LOW";
}
