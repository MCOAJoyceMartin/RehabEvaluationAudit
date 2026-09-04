import type { Discipline, GoalLifecycleRecord, GoalProgressStatus, GoalTerminalStatus, NotFound } from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";
import type { RawGoal } from "../extraction/extractionTypes";
import type { DailyEncounter } from "../extraction/extractionTypes";
import { classifyFunctionalArea } from "./GoalAnalysisEngine";
import { areasForCpt } from "./cptGoalMapping";
import { parseCalendarDate } from "../../utils/dates";

/**
 * GoalLifecycleEngine
 * =====================
 * Tracks each goal (by its STG/LTG id) longitudinally across the whole
 * episode: New Goal at Evaluation -> Continue/Goal Met at each Progress
 * Report -> Met/Discontinued/etc. at Discharge. This is what Progress
 * Notes ("Modifications in the POC"), Daily Notes ("Discontinued When Goal
 * Met"), and Discharge ("All Goals Addressed") all read from, rather than
 * each re-deriving goal status independently.
 */

interface ProgressSnapshot {
  periodEnd: string | NotFound;
  page: number;
  goals: RawGoal[];
}

function parseStatusDate(statusWord: string): string | NotFound {
  const m = statusWord.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  return m ? m[1] : NOT_FOUND;
}

function terminalStatusFromWord(statusWord: string): GoalTerminalStatus {
  if (/^Met on/i.test(statusWord) || /^Goal Met/i.test(statusWord)) return "Met";
  if (/^Discontinue/i.test(statusWord)) return "Discontinued";
  if (/partially met/i.test(statusWord)) return "Partially Met";
  if (/^Continue/i.test(statusWord)) return "Continuing"; // discharge table showing "Continue" would be unusual but handled
  return "Unknown";
}

export function buildGoalLifecycle(
  discipline: Discipline | NotFound,
  evalGoals: RawGoal[],
  progressSnapshots: ProgressSnapshot[],
  dischargeGoals: RawGoal[] | null,
  dailyEncounters: DailyEncounter[],
): GoalLifecycleRecord[] {
  const ids = new Set<string>();
  for (const g of evalGoals) ids.add(g.id);
  for (const snap of progressSnapshots) for (const g of snap.goals) ids.add(g.id);
  if (dischargeGoals) for (const g of dischargeGoals) ids.add(g.id);

  const records: GoalLifecycleRecord[] = [];

  for (const id of ids) {
    const evalGoal = evalGoals.find((g) => g.id === id);
    const anyGoal = evalGoal ?? progressSnapshots.flatMap((s) => s.goals).find((g) => g.id === id) ?? dischargeGoals?.find((g) => g.id === id);
    if (!anyGoal) continue;

    const kind = anyGoal.kind;
    const goalText = anyGoal.statement;
    const baseline = evalGoal?.baselineValue ?? anyGoal.baselineValue;
    const target = anyGoal.plofValue !== NOT_FOUND ? anyGoal.plofValue : NOT_FOUND; // PLOF column repurposed for target display where a distinct target column isn't parsed (see module doc — Previous/Current columns aren't bucketed)
    void target;

    const progressStatuses: GoalProgressStatus[] = progressSnapshots
      .map((snap): GoalProgressStatus | null => {
        const g = snap.goals.find((x) => x.id === id);
        if (!g) return null;
        return {
          date: snap.periodEnd,
          sourceDocument: "PROGRESS_REPORT",
          status: g.statusWord,
          value: g.baselineValue,
          page: g.page,
        };
      })
      .filter((x): x is GoalProgressStatus => x !== null);

    const dischargeGoal = dischargeGoals?.find((g) => g.id === id) ?? null;
    let metDate: string | NotFound = NOT_FOUND;
    let discontinuedDate: string | NotFound = NOT_FOUND;
    let dischargeStatus: GoalTerminalStatus = "Unknown";

    if (dischargeGoal) {
      dischargeStatus = terminalStatusFromWord(dischargeGoal.statusWord);
      const statusDate = parseStatusDate(dischargeGoal.statusWord);
      if (dischargeStatus === "Met") metDate = statusDate;
      if (dischargeStatus === "Discontinued") discontinuedDate = statusDate;
    } else {
      // A goal that existed at Evaluation/Progress but has no discharge-table
      // entry at all was not addressed at discharge — flagged, never silently
      // dropped (spec: "flag goals disappearing without explanation").
      dischargeStatus = evalGoal || progressStatuses.length > 0 ? "Not Addressed" : "Unknown";
    }
    // A "Goal Met" status can also appear mid-episode in a Progress Report
    // (before any Discharge document exists) — capture that as metDate too
    // if Discharge didn't already give us one.
    if (metDate === NOT_FOUND) {
      const metInProgress = progressStatuses.find((p) => /goal met|^met on/i.test(p.status));
      if (metInProgress) metDate = parseStatusDate(metInProgress.status) !== NOT_FOUND ? parseStatusDate(metInProgress.status) : metInProgress.date;
    }

    // Treatment-after-goal-met check: does any daily encounter dated AFTER
    // metDate still bill a CPT code whose mapped functional area matches
    // this goal, with no documented modification/new-goal note in between?
    // Heuristic, conservative — flags only a clear area match after a firm
    // met-date, never from ambiguous/unclassified areas.
    let treatmentAfterGoalMetFlag = false;
    const metDateParsed = parseCalendarDate(metDate);
    if (metDateParsed) {
      const goalArea = classifyFunctionalArea(anyGoal.subItemLabel ?? goalText);
      if (goalArea !== "Unclassified") {
        for (const enc of dailyEncounters) {
          const encDate = parseCalendarDate(enc.dos === NOT_FOUND ? null : enc.dos);
          if (!encDate || encDate <= metDateParsed) continue;
          const hit = enc.cptEntries.some((c) => areasForCpt(c.code).includes(goalArea));
          if (hit) {
            treatmentAfterGoalMetFlag = true;
            break;
          }
        }
      }
    }

    records.push({
      goalId: id,
      discipline,
      kind,
      goalText,
      baseline,
      target: NOT_FOUND, // see note above — Previous/Current table columns are not precisely bucketed by GoalBlockParser; the terminal status word carries the scoring-relevant outcome instead
      targetDate: anyGoal.targetDate,
      evaluationStatus: evalGoal?.statusWord ?? "Not documented at Evaluation",
      progressStatuses,
      metDate,
      modifiedDate: NOT_FOUND,
      discontinuedDate,
      dischargeStatus,
      treatmentAfterGoalMetFlag,
    });
  }

  return records.sort((a, b) => (a.kind === b.kind ? a.goalId.localeCompare(b.goalId, undefined, { numeric: true }) : a.kind === "STG" ? -1 : 1));
}
