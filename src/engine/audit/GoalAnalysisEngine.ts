import type { ExtractedEvaluation } from "../extraction/extractionTypes";
import type { GoalAnalysis, GoalRecord, GoalMappingEntry, GoalLogicFinding, Confidence } from "../../types/audit";
import { normalizeAssistanceLevel, assistanceRank } from "../extraction/ClinicalNormalizer";
import { NOT_FOUND } from "../../types/audit";

/**
 * GoalAnalysisEngine
 * ===================
 * Converts the raw STG/LTG table records pulled by GoalBlockParser into the
 * analysis the Plan of Care section needs: per-goal attributes (baseline,
 * measurability, whether the target exceeds CLOF), an STG->LTG mapping, and
 * a set of NON-SCORED logic-check flags for reviewer attention.
 *
 * Target-level parsing: the goal statement is free text ("...to Ind with
 * good safety awareness", "...150ft WW MI on level surfaces...", "...with
 * Independence...", "...with Setup or Clean-up Assistance..."), so there's
 * no single reliable pattern for "the target level." We scan for known
 * assistance-level tokens (including multi-word phrases like "Setup or
 * Clean-up Assistance" and "Standby Assist", captured whole so
 * normalizeAssistanceLevel's own multi-word rules can recognize them —
 * grabbing only a bare "Setup" would not) anywhere in the statement and use
 * the last one found. When nothing recognizable is found, we report
 * "Unknown" rather than guessing — this only affects the non-scored
 * goal-logic flags, never the official Key score.
 */

// Two alternatives: word-like tokens (safe with \b on both sides) and
// symbol-suffixed grades like "F+"/"P-" where a trailing \b never matches
// (no word/non-word transition between a symbol and following whitespace),
// so those use explicit lookaround instead.
const LEVEL_TOKEN_RE =
  /\b(Independent|Independence|Ind|Modified Independent|Mod\s*I|MI|Set-?up\s+(?:or\s+)?Clean-?up\s+Assistance|Set-?up\/Clean-?up\s*Assistance|Supervision(?:\s+or\s+Touching\s+Assistance)?|SUP|SPV|Standby Assist|SBA|Contact Guard(?: Assist)?|CGA|Min(?:imal)?\s*A(?:ssist)?|Partial\/?Mod(?:erate)?\s*Assistance|Mod(?:erate)?\s*A(?:ssist)?|Max(?:imum)?\s*A(?:ssist)?|Dependent|Dep)\b|(?<![A-Za-z0-9])(F\+|F-|P\+|P-|G\+|G-)(?![A-Za-z0-9])/gi;

function stripTargetDateSuffix(statement: string): string {
  return statement.replace(/\(Target:[^)]*\)/i, "").trim();
}

function extractTargetLevel(statement: string): string | null {
  const cleaned = stripTargetDateSuffix(statement);
  const matches = [...cleaned.matchAll(LEVEL_TOKEN_RE)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][0];
}

const FUNCTIONAL_AREA_KEYWORDS: { area: string; pattern: RegExp }[] = [
  { area: "Bed Mobility", pattern: /\bbed mobility\b|\broll(ing)?\b|\bsit to lying\b|\blying to sit/i },
  { area: "Transfers", pattern: /\btransfer/i },
  { area: "Ambulation/Gait", pattern: /\bambulat|\bgait\b|\bwalk/i },
  // Includes named standardized balance measures, not just the bare word
  // "balance" — a goal whose sub-item is scored on the Elderly Mobility
  // Scale (or another balance-specific instrument) is a balance goal even
  // when its own free-text statement talks about "functional mobility"
  // rather than saying "balance" outright.
  { area: "Balance", pattern: /\bbalance\b|\belderly mobility scale\b|\bberg\b|\btinetti\b|\bPOMA\b|\bsitting balance scale\b|\bfunctional reach\b/i },
  { area: "Stairs", pattern: /\bstairs?\b|\bsteps?\b|\bcurb/i },
  { area: "Wheelchair Mobility", pattern: /\bwheelchair\b|\bw\/c\b/i },
  { area: "Strength", pattern: /\bstrength\b/i },
  { area: "Endurance", pattern: /\bendurance\b|\bactivity tolerance\b/i },
  { area: "ADL/IADL", pattern: /\bADL\b|\bIADL\b|\bpick(ing)? up\b|\bdressing\b|\bbathing\b|\bfeeding\b|\bgrooming\b|\btoileting\b/i },
  { area: "Cognition/Safety", pattern: /\bcognit|\bsafety awareness\b|\bmemory\b|\bproblem solving\b/i },
  { area: "Communication/Speech", pattern: /\bcommunicat|\bspeech\b|\blanguage\b/i },
  { area: "Swallowing", pattern: /\bswallow|\bdysphagia\b|\bdiet consistency\b|\baspiration\b/i },
];

export function classifyFunctionalArea(statement: string): string {
  for (const { area, pattern } of FUNCTIONAL_AREA_KEYWORDS) {
    if (pattern.test(statement)) return area;
  }
  return "Unclassified";
}

/**
 * A goal's `subItemLabel` (e.g. "Elderly Mobility Scale", "Gait") is often a
 * terser, more reliable functional-area signal than the free-text
 * statement — but not always a recognized one on its own. Try it first;
 * only fall back to classifying the full goal statement when the sub-item
 * label itself doesn't match anything, so a label that already classifies
 * correctly (e.g. "Gait") is never overridden by statement text that could
 * point elsewhere.
 */
function classifyGoalFunctionalArea(subItemLabel: string | null | undefined, statement: string): string {
  if (subItemLabel) {
    const bySubItem = classifyFunctionalArea(subItemLabel);
    if (bySubItem !== "Unclassified") return bySubItem;
  }
  return classifyFunctionalArea(statement);
}

/**
 * STG->LTG mapping needs a coarser grouping than the functional-area labels
 * themselves: clinically, a "Bed Mobility" STG and a "Transfers" STG are
 * both foundational building blocks toward an "Ambulation/Gait" LTG, not
 * unrelated goals. Domains group the areas the way a rehab clinician
 * actually would when deciding whether an STG "functions inside" an LTG.
 */
const AREA_TO_DOMAIN: Record<string, string> = {
  "Bed Mobility": "Functional Mobility",
  Transfers: "Functional Mobility",
  "Ambulation/Gait": "Functional Mobility",
  Balance: "Functional Mobility",
  Stairs: "Functional Mobility",
  "Wheelchair Mobility": "Functional Mobility",
  Strength: "Functional Mobility",
  Endurance: "Functional Mobility",
  "ADL/IADL": "ADL/IADL",
  "Cognition/Safety": "Cognition/Safety",
  "Communication/Speech": "Communication/Speech",
  Swallowing: "Swallowing",
  Unclassified: "Unclassified",
};

function domainOf(area: string): string {
  return AREA_TO_DOMAIN[area] ?? "Unclassified";
}

function isMeasurable(statement: string, target: string | null): boolean {
  // Measurable = has a quantifiable target: a named assistance level, a
  // distance/rep count, a standardized-test score ("13/20"), a stair/step
  // count, or a specific % / time.
  if (target) return true;
  return /\d+\s?(ft|feet|reps?|sets?|minutes?|min|%|seconds?|sec|stairs?|steps?)\b|\b\d+\s*\/\s*\d+\b/i.test(statement);
}

/**
 * When neither side normalizes to a recognized assistance level, fall back
 * to comparing a quantified value pulled directly from the free text: a
 * distance ("150ft" vs "25ft"), a standardized-test score ("15/20" vs
 * "8/20"), or a stair/step count ("4 stairs" vs "0 steps"). Tried in order;
 * only returns a real answer when the SAME kind of quantity parses on both
 * the target statement and the baseline value — never mixes kinds (e.g. a
 * distance target against a step-count baseline), and never guesses when
 * only one side has a number.
 */
function compareQuantifiedTarget(statement: string, baselineText: string): boolean | "Unknown" {
  const targetDist = statement.match(/(\d+)\s?ft\b/i);
  const baselineDist = baselineText.match(/(\d+)\s?ft\b/i);
  if (targetDist && baselineDist) return Number(targetDist[1]) > Number(baselineDist[1]);

  const targetScore = statement.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  const baselineScore = baselineText.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (targetScore && baselineScore) return Number(targetScore[1]) > Number(baselineScore[1]);

  const targetCount = statement.match(/(\d+)\s*(?:stairs?|steps?)\b/i);
  const baselineCount = baselineText.match(/(\d+)\s*(?:stairs?|steps?)\b/i);
  if (targetCount && baselineCount) return Number(targetCount[1]) > Number(baselineCount[1]);

  return "Unknown";
}

function buildGoalRecord(
  raw: ExtractedEvaluation["rawGoals"][number],
  diagnosisContext: string,
  cptContext: string,
): GoalRecord {
  const target = extractTargetLevel(raw.statement);
  const baselineLevel = normalizeAssistanceLevel(raw.baselineValue === NOT_FOUND ? undefined : raw.baselineValue);
  const targetLevel = target ? normalizeAssistanceLevel(target) : "Unknown";
  const baselineRank = assistanceRank(baselineLevel);
  const targetRank = assistanceRank(targetLevel);

  let aboveClof: boolean | "Unknown" = "Unknown";
  if (baselineRank !== null && targetRank !== null) {
    aboveClof = targetRank > baselineRank;
  } else if (raw.baselineValue !== NOT_FOUND) {
    aboveClof = compareQuantifiedTarget(raw.statement, String(raw.baselineValue));
  }

  const area = classifyGoalFunctionalArea(raw.subItemLabel, raw.statement);
  const measurable = isMeasurable(raw.statement, target);

  let attainable: GoalRecord["attainable"] = "Uncertain";
  if (aboveClof === true) attainable = "Likely";
  else if (aboveClof === false) attainable = "Unrealistic";

  const findings: string[] = [];
  if (aboveClof === false) findings.push("Target does not exceed the documented CLOF/baseline.");
  if (!measurable) findings.push("No measurable/quantifiable target identified.");
  if (raw.targetDate === NOT_FOUND) findings.push("No target date documented.");
  if (findings.length === 0) findings.push("Goal is measurable and targets improvement above the documented baseline.");

  return {
    id: raw.id,
    statement: raw.statement,
    baseline: raw.baselineValue,
    target: target ?? NOT_FOUND,
    targetDate: raw.targetDate,
    functionalArea: area,
    measurable,
    aboveClof,
    relatedImpairment: area !== "Unclassified" ? area : NOT_FOUND,
    relatedDiagnosis: diagnosisContext || NOT_FOUND,
    relatedTreatment: cptContext || NOT_FOUND,
    attainable,
    finding: findings.join(" "),
    page: raw.page,
  };
}

// (target fallback handled above via `target ?? NOT_FOUND` at the call site)

export function analyzeGoals(extracted: ExtractedEvaluation): GoalAnalysis {
  const diagnosisContext = [extracted.diagnoses.map((d) => d.description)].flat().join("; ");
  const cptContext = extracted.treatmentApproaches.map((t) => t.name).join(", ");

  const stgRaw = extracted.rawGoals.filter((g) => g.kind === "STG");
  const ltgRaw = extracted.rawGoals.filter((g) => g.kind === "LTG");

  const shortTermGoals = stgRaw.map((g) => buildGoalRecord(g, diagnosisContext, cptContext));
  const longTermGoals = ltgRaw.map((g) => buildGoalRecord(g, diagnosisContext, cptContext));

  // STG -> LTG mapping: prefer an exact functional-area match, then fall
  // back to the broader clinical domain (see AREA_TO_DOMAIN), then to "the
  // only LTG in the plan" as a last resort.
  const goalMapping: GoalMappingEntry[] = shortTermGoals.map((stg) => {
    const sameArea = longTermGoals.filter((ltg) => ltg.functionalArea === stg.functionalArea && stg.functionalArea !== "Unclassified");
    if (sameArea.length >= 1) {
      const confidence: Confidence = sameArea.length === 1 ? "HIGH" : "MEDIUM";
      return { stgId: stg.id, ltgId: sameArea[0].id, basis: `Both directly address ${stg.functionalArea}`, confidence };
    }

    const stgDomain = domainOf(stg.functionalArea);
    const sameDomain = longTermGoals.filter((ltg) => domainOf(ltg.functionalArea) === stgDomain && stgDomain !== "Unclassified");
    if (sameDomain.length >= 1) {
      const confidence: Confidence = sameDomain.length === 1 ? "MEDIUM" : "LOW";
      return {
        stgId: stg.id,
        ltgId: sameDomain[0].id,
        basis: `${stg.functionalArea} is a foundational component of the ${stgDomain} domain, which LTG ${sameDomain[0].id} (${sameDomain[0].functionalArea}) also addresses — not an explicit link in the source document`,
        confidence,
      };
    }

    // No area or domain match — fall back to the only LTG if there's
    // exactly one in the whole plan (small plans often have one
    // overarching mobility LTG).
    if (longTermGoals.length === 1) {
      return {
        stgId: stg.id,
        ltgId: longTermGoals[0].id,
        basis: "Only one LTG present in the plan of care; mapped by default, not an explicit link in the source document",
        confidence: "LOW" as Confidence,
      };
    }
    return { stgId: stg.id, ltgId: null, basis: "No functional-area or domain overlap found with any documented LTG", confidence: "LOW" as Confidence };
  });

  // Non-scored logic findings.
  const logicFindings: GoalLogicFinding[] = [];
  for (const goal of [...shortTermGoals, ...longTermGoals]) {
    if (goal.aboveClof === false) {
      logicFindings.push({ goalId: goal.id, issue: "Goal not above CLOF/baseline", detail: `Target "${goal.target}" does not appear to exceed the documented baseline "${goal.baseline}".` });
    }
    if (goal.targetDate === NOT_FOUND) {
      logicFindings.push({ goalId: goal.id, issue: "Missing target date", detail: "No target date could be identified for this goal." });
    }
    if (!goal.measurable) {
      logicFindings.push({ goalId: goal.id, issue: "Target not clearly measurable", detail: "No quantifiable target (assistance level, distance, reps, etc.) was identified in the goal statement." });
    }
    if (goal.relatedImpairment === NOT_FOUND) {
      logicFindings.push({ goalId: goal.id, issue: "Functional area not classified", detail: "Could not map this goal to a recognized functional area for impairment linkage — reviewer should confirm relevance to the referral diagnosis." });
    }
  }
  for (const mapping of goalMapping) {
    if (mapping.ltgId === null) {
      logicFindings.push({ goalId: mapping.stgId, issue: "STG not linked to any LTG", detail: mapping.basis });
    }
  }

  return { shortTermGoals, longTermGoals, goalMapping, logicFindings };
}
