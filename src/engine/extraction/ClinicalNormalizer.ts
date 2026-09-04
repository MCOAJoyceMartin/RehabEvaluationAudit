import type { Discipline } from "../../types/audit";

/**
 * ClinicalNormalizer
 * ===================
 * Normalizes common rehab abbreviations/terminology for INTERNAL comparison
 * only. The original source text is always preserved and displayed as
 * evidence elsewhere — normalization never replaces what's shown to the
 * reviewer, it only powers change-detection (e.g. "was this Independent
 * before and Moderate Assistance now?").
 */

export type AssistanceLevel =
  | "Independent"
  | "Modified Independent"
  | "Setup/Cleanup Assistance"
  | "Supervision/Touching Assistance"
  | "Contact Guard Assistance"
  | "Minimal Assistance"
  | "Moderate Assistance"
  | "Maximum Assistance"
  | "Dependent"
  | "Not Attempted"
  | "Not Applicable"
  | "Unknown";

/**
 * Ordered worst(0)->best(N) so callers can compare levels positionally.
 * This is a configurable analysis aid, not an assumption that every
 * assessment maps cleanly onto it — callers should treat "Unknown" /
 * "Not Attempted" as non-comparable, not as a rung on the ladder.
 */
export const ASSISTANCE_HIERARCHY: AssistanceLevel[] = [
  "Dependent",
  "Maximum Assistance",
  "Moderate Assistance",
  "Minimal Assistance",
  "Contact Guard Assistance",
  "Supervision/Touching Assistance",
  "Setup/Cleanup Assistance",
  "Modified Independent",
  "Independent",
];

interface NormalizationRule {
  pattern: RegExp;
  level: AssistanceLevel;
}

// Order matters: more specific / longer phrases first so "Modified
// Independent" isn't swallowed by a bare "Independent" match, etc.
const NORMALIZATION_RULES: NormalizationRule[] = [
  { pattern: /\bnot attempted\b|\bNT\b(?!\w)/i, level: "Not Attempted" },
  { pattern: /\bnot applicable\b|\bN\/A\b/i, level: "Not Applicable" },
  { pattern: /\bmodified independent\b|\bmod\s*i\b|\bMI\b(?!\w)/i, level: "Modified Independent" },
  { pattern: /\bindependent(ly)?\b|\bindependence\b|\bind\b|\bI\b(?![a-z])/i, level: "Independent" },
  { pattern: /\bsetup\b.*\bclean.?up\b|\bsetup\/clean-?up assistance\b/i, level: "Setup/Cleanup Assistance" },
  { pattern: /\bsupervision\b.*\btouch(ing)?\b|\bSUP\b|\bSPV\b|\bstandby assist\b|\bSBA\b/i, level: "Supervision/Touching Assistance" },
  { pattern: /\bcontact guard\b|\bCGA\b/i, level: "Contact Guard Assistance" },
  { pattern: /\bmin(imal)?\s*a(ssist)?\b/i, level: "Minimal Assistance" },
  { pattern: /\bmod(erate)?\s*a(ssist)?\b|\bpartial\/?moderate assistance\b/i, level: "Moderate Assistance" },
  { pattern: /\bmax(imum)?\s*a(ssist)?\b/i, level: "Maximum Assistance" },
  { pattern: /\bdependent\b|\bdep\b/i, level: "Dependent" },
];

export function normalizeAssistanceLevel(raw: string | null | undefined): AssistanceLevel {
  if (!raw) return "Unknown";
  const trimmed = raw.trim();
  if (!trimmed) return "Unknown";
  if (/not attempted due to medical conditions or safety concerns/i.test(trimmed)) return "Not Attempted";
  for (const rule of NORMALIZATION_RULES) {
    if (rule.pattern.test(trimmed)) return rule.level;
  }
  return "Unknown";
}

export function assistanceRank(level: AssistanceLevel): number | null {
  const idx = ASSISTANCE_HIERARCHY.indexOf(level);
  return idx === -1 ? null : idx;
}

/** Mobility device / abbreviation normalization — display text is always
 *  kept verbatim; this only aids grouping "RW" vs "Rolling Walker" etc. */
const DEVICE_ALIASES: Record<string, string> = {
  rw: "Rolling Walker",
  "rolling walker": "Rolling Walker",
  "4ww": "4-Wheeled Walker",
  ww: "Wheeled Walker",
  fww: "Front-Wheeled Walker",
  sc: "Straight Cane",
  qc: "Quad Cane",
  wc: "Wheelchair",
};

export function normalizeDevice(raw: string): string {
  const key = raw.trim().toLowerCase();
  return DEVICE_ALIASES[key] ?? raw.trim();
}

/**
 * Discipline-appropriate standardized/objective test vocabulary, used by the
 * Objective Test criterion to recognize a "discipline-appropriate" measure
 * (as opposed to just a section heading). Purely a recognition aid — it
 * does NOT decide whether the test counts as completed; that depends on
 * whether a scored result is present (see AuditEngine / EVAL_OBJECTIVE_TEST).
 */
export const STANDARDIZED_TESTS: Record<Discipline, RegExp[]> = {
  // Confirmed 9/1/2026 (RUBRIC DECISION REQUIRED #4, PRE_BUILD_RUBRIC_ANALYSIS.md):
  // extensible per-discipline list, seeded from the spec's own illustrative
  // examples PLUS every measure actually accepted 3/3 in Evaluator Audit 2
  // (Sitting Balance Scale, Elderly Mobility Scale — neither was on the
  // spec's original list). Extend via config/edit here, not by inventing a
  // scoring rule elsewhere.
  PT: [
    /\bTUG\b|\bTimed Up (and|&) Go\b/i,
    /\bBerg\b/i,
    /\bTinetti\b|\bPOMA\b/i,
    /\b5x?\s*Sit.?to.?Stand\b/i,
    /\b30.?Second (Chair Stand|Sit.?to.?Stand)\b/i,
    /\b6\s*.?\s*Minute Walk\b|\b6MWT\b/i,
    /\b10.?Meter Walk\b/i,
    /\bFunctional Reach\b/i,
    /\bGait Speed\b/i,
    /\bSitting Balance Scale\b/i,
    /\bElderly Mobility Scale\b/i,
    /\bDynamic Gait Index\b|\bDGI\b/i,
    /\bMobility (Function|Performance) Score\b/i,
  ],
  OT: [
    /\bBarthel\b/i,
    /\bModified Barthel\b/i,
    /\bQuickDASH\b/i,
    /\bDASH\b/i,
    /\bGrip Strength\b/i,
    /\bDynamometry\b/i,
    /\bFunctional Cognitive\b/i,
    /\bKatz\b|\bLawton\b/i,
    /\bSelf.?Care (Function|Performance) Score\b/i,
    /\bMobility (Function|Performance) Score\b/i,
    /\bSitting Balance Scale\b/i,
  ],
  SLP: [
    /\bMoCA\b/i,
    /\bSLUMS\b/i,
    /\bMMSE\b/i,
    /\bMASA\b/i,
    /\bFOIS\b/i,
    /\bEAT-?10\b/i,
  ],
};

const NOT_COMPLETED_RESULT = /^(NT|Not Tested|Not Attempted|N\/A|Not Applicable|Pending|Declined|Refused)$/i;

export function isTestResultCompleted(result: string): boolean {
  const trimmed = result.trim();
  if (!trimmed) return false;
  return !NOT_COMPLETED_RESULT.test(trimmed);
}
