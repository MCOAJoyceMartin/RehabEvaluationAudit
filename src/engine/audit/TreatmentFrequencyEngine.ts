import type { Discipline, FrequencyAnalysis, FrequencyWeekRow, NotFound } from "../../types/audit";
import { NOT_FOUND } from "../../types/audit";
import { parseCalendarDate, calendarDayDiff } from "../../utils/dates";

/**
 * TreatmentFrequencyEngine
 * ==========================
 * Compares ordered frequency (from the Plan of Treatment, or a documented
 * addendum/recert) against the ACTUAL count of unique treatment dates of
 * service, grouped by rolling service-week from Start of Care — never
 * counting a cosignature, a later revision signature, or a duplicate page
 * for the same DOS as a separate visit (dates are deduplicated before
 * counting). Feeds PN_TREATMENT_FREQUENCY and DN_ATTENDANCE_COMPLIANCE,
 * both of which share the same confirmed zero-tolerance default (see
 * PRE_BUILD_RUBRIC_ANALYSIS.md Decision #3) — configurable via
 * `toleranceBand` on the rubric criterion, not hard-coded here.
 */
export function analyzeFrequency(
  discipline: Discipline | NotFound,
  orderedFrequencyRaw: string | NotFound,
  startOfCare: string | NotFound,
  encounterDates: (string | NotFound)[],
  sourceDocument: string,
  varianceVisitsAllowed: number,
): FrequencyAnalysis {
  const uniqueDates = [...new Set(encounterDates.filter((d): d is string => d !== NOT_FOUND))];
  const socDate = parseCalendarDate(startOfCare);
  const orderedPerWeekMatch = orderedFrequencyRaw !== NOT_FOUND ? orderedFrequencyRaw.match(/(\d+)\s*time/i) : null;
  const orderedPerWeek = orderedPerWeekMatch ? Number(orderedPerWeekMatch[1]) : null;

  const byWeek = new Map<number, string[]>();
  for (const d of uniqueDates) {
    const dt = parseCalendarDate(d);
    if (!dt || !socDate) continue;
    const weekIndex = Math.floor(calendarDayDiff(socDate, dt) / 7);
    if (!byWeek.has(weekIndex)) byWeek.set(weekIndex, []);
    byWeek.get(weekIndex)!.push(d);
  }

  const rows: FrequencyWeekRow[] = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, dates]) => {
      const sortedDates = [...dates].sort((a, b) => (parseCalendarDate(a)?.getTime() ?? 0) - (parseCalendarDate(b)?.getTime() ?? 0));
      const actual = dates.length;
      const variance = orderedPerWeek !== null ? actual - orderedPerWeek : NOT_FOUND;
      let finding: string;
      if (orderedPerWeek === null) {
        finding = "Ordered frequency could not be parsed from the Plan of Treatment — variance not calculated.";
      } else if (variance === 0) {
        finding = `Actual unique treatment dates (${actual}) match the ordered frequency (${orderedPerWeek}/week).`;
      } else if (typeof variance === "number" && Math.abs(variance) <= varianceVisitsAllowed) {
        finding = `Actual unique treatment dates (${actual}) vary from ordered (${orderedPerWeek}/week) by ${variance > 0 ? "+" : ""}${variance}, within the confirmed tolerance.`;
      } else {
        finding = `Actual unique treatment dates (${actual}) vary from ordered (${orderedPerWeek}/week) by ${typeof variance === "number" ? (variance > 0 ? "+" : "") + variance : "an unknown amount"} — ${typeof variance === "number" && variance > 0 ? "over" : "under"}-frequency, no documented refusal/reschedule entry identified for the difference.`;
      }
      return {
        weekLabel: `Week ${weekIndex + 1} (${sortedDates[0]} – ${sortedDates[sortedDates.length - 1]})`,
        orderedFrequency: orderedFrequencyRaw,
        actualUniqueDOS: sortedDates,
        missedOrRefused: [],
        variance,
        finding,
      };
    });

  return {
    discipline,
    orderedFrequencyRaw,
    sourceDocument,
    rows,
    toleranceApplied: { type: "zero_tolerance", varianceVisitsAllowed },
  };
}
