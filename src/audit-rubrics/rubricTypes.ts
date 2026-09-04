import type { Discipline } from "../types/audit";

/**
 * Rubric configuration contract.
 *
 * IMPORTANT: This is the ONLY place audit scoring rules should live.
 * The AuditEngine consumes these configs; UI components never encode
 * scoring logic. This is what lets thresholds/lists/tolerance bands change
 * via a config edit rather than a code change (see `timingRules`,
 * `toleranceBand`, `approvedTestsByDiscipline` below — this is the exact
 * mechanism PRE_BUILD_RUBRIC_ANALYSIS.md's confirmed decisions plug into).
 *
 * v2 note: extended (not replaced) for the full 7-section, 33-criterion
 * scope. Every v1 field is unchanged; new fields are additive/optional.
 */

export type ScoringType =
  | "holistic-0-3" // Key's general fallback scale: 0 not present / 1 limited / 2 typically present / 3 always present
  | "holistic-0-4" // Same idea, 4-point scale (Assessment Summary)
  | "binary-0-3" // yes/appropriate = max, everything else = 0 (no partial credit)
  | "timeliness-0-3" // same day=3, next day=2, 2 days=1, >48h=0 (or whatever `timingRules` says)
  | "automatic-zero-phrase-0-3" // holistic-0-3 EXCEPT specific disqualifying phrases force 0
  | "frequency-deviation-0-3" // deviation from ordered frequency, per `toleranceBand`
  | "timeliness-pending"; // Key defines no thresholds — see ruleStatus/timingRules below

/** CONFIRMED = the Key (or an explicit, logged decision from the audit
 *  program owner — see PRE_BUILD_RUBRIC_ANALYSIS.md) fully determines this
 *  criterion's scoring. NEEDS_CONFIRMATION = the rule itself is
 *  underspecified; the engine must return PENDING_RUBRIC_CONFIRMATION
 *  rather than invent a threshold. Defaults to CONFIRMED when absent (all
 *  v1 criteria pre-date this field and are fully determined by the Key). */
export type RuleStatus = "CONFIRMED" | "NEEDS_CONFIRMATION";

export interface AutomaticZeroRule {
  /** Case-insensitive phrases that, if they constitute the entirety (or substantial entirety)
   *  of the response for this field, force a score of 0 regardless of anything else found. */
  phrases: string[];
  reason: string;
}

export interface PccDependency {
  /** True if this criterion (or part of it) requires confirmation from an external
   *  system (PCC) that a PDF alone cannot supply. */
  dependent: boolean;
  /** true = the ENTIRE criterion is unable-to-validate without PCC evidence.
   *  false = only a sub-element is PCC-dependent; the criterion is still scored
   *  from PDF-visible evidence, and the PCC sub-element is raised as a separate,
   *  non-scored "external validation needed" flag instead of reducing the score. */
  entireCriterion: boolean;
  reasonTemplate: string;
  recommendedAction: string;
  /** When true, discharge-disposition/home-health-referral language alone is
   *  NOT sufficient evidence of a matching PCC order — direct PCC evidence is
   *  required (see RUBRIC DECISION REQUIRED #2 in PRE_BUILD_RUBRIC_ANALYSIS.md). */
  acceptableProxyEvidence?: false;
}

/** One tier of a calendar-day timeliness scale. Exactly one of
 *  `calendarDays` / `calendarDaysMin` is set per row. */
export interface TimingRule {
  calendarDays?: number;
  calendarDaysMin?: number;
  points: number;
}

export interface ToleranceBand {
  type: "zero_tolerance" | "band";
  varianceVisitsAllowed: number;
  appliesToOverAndUnderFrequency?: boolean;
}

export interface RubricCriterion {
  id: string;
  section:
    | "Evaluation Medical Review"
    | "Evaluation"
    | "Plan of Care/Treatment"
    | "Progress Notes"
    | "Daily Notes"
    | "Recertification"
    | "Discharge Summary";
  title: string;
  keyComment: string;
  maxPoints: number;
  scoringType: ScoringType;
  applicableDisciplines: Discipline[];
  ruleStatus?: RuleStatus;
  allowNA?: boolean;
  automaticZero?: AutomaticZeroRule;
  pcc?: PccDependency;
  /** Populated only for timeliness criteria with a CONFIRMED tier scale.
   *  Left null/absent when ruleStatus is NEEDS_CONFIRMATION — the engine
   *  must not invent tiers to fill this in. */
  timingRules?: TimingRule[] | null;
  /** Which signature date this criterion's timeliness compares against —
   *  never substitute a physician/cosign/unrelated-document date for it. */
  dateSource?: string;
  prohibitedDateSources?: string[];
  toleranceBand?: ToleranceBand;
  /** Discipline-keyed list of standardized/objective measures accepted as
   *  "appropriate" for EVAL_OBJECTIVE_TEST — extensible, not a closed list
   *  baked into code (see RUBRIC DECISION REQUIRED #4). */
  approvedTestsByDiscipline?: Partial<Record<Discipline, string[]>>;
  /** Free-text note documenting why a NEEDS_CONFIRMATION criterion is
   *  pending, or context on how a CONFIRMED decision was reached. Surfaced
   *  to reviewers, never silently dropped. */
  ambiguityNote?: string;
  /** Field name(s) in the extracted model this criterion draws evidence from.
   *  Used by the AuditEngine to know what to look at and by the UI to explain traceability. */
  evidenceTargets: string[];
  /** Human-readable description of what "always present / fully meets" looks like,
   *  used to generate auditor comments and to guide the scoring functions. */
  fullCreditDescription: string;
}

export interface AuditRubric {
  id: string;
  module: string;
  version: string;
  sourceOfTruth: string;
  criteria: RubricCriterion[];
}
