import { NOT_FOUND, type NotFound } from "../types/audit";

/** Parses the vendor's "M/D/YYYY" (optionally with a trailing time/timezone)
 *  date formats into a calendar-date-only Date (midnight local), so
 *  timeliness comparisons use whole calendar days, not elapsed hours —
 *  matching how the Key's examples were scored (see EVAL_COMPLETED_TIMELY
 *  rubric comment / dev validation report). Returns null if unparseable. */
export function parseCalendarDate(raw: string | NotFound | null | undefined): Date | null {
  if (!raw || raw === NOT_FOUND) return null;
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const [, mo, d, y] = m;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(year, Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calendarDayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}
