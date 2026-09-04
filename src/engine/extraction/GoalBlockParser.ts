import type { PageText } from "../pdf/PDFParser";
import { positionedLinesFromPageItems, type PositionedLine } from "../pdf/PDFParser";
import type { RawGoal } from "./extractionTypes";

/**
 * GoalBlockParser
 * ================
 * The vendor template renders each STG/LTG as a small two-column table:
 *
 *   STG #1.0 - New Goal
 *   Pt will improve bed mobility to Ind with good safety awareness (Target: 5/27/2025)
 *   PLOF                    Baseline
 *   (prior to onset)        (5/14/2025)
 *   Ind                     Min A
 *
 * Flattening this to plain text loses which column ("Ind" vs "Min A")
 * belongs to PLOF vs Baseline. This parser works directly against
 * positioned text items so column membership is determined by actual x
 * coordinates, not by guessing at whitespace.
 */

const GOAL_HEADER_RE = /^(STG|LTG)\s*#\s*(\d+(?:\.\d+)?)\s*-\s*(.+)$/i;
const PLOF_BASELINE_HEADER_RE = /^PLOF\b.*\bBaseline\b/i;
const TARGET_DATE_RE = /\(Target:\s*([^)]+)\)/i;

const X_TOLERANCE = 6;

function bucketValueLine(line: PositionedLine, xPlof: number, xBaseline: number) {
  const plofParts: string[] = [];
  const baselineParts: string[] = [];
  const labelParts: string[] = [];
  for (const item of line.items) {
    if (Math.abs(item.x - xPlof) <= X_TOLERANCE) plofParts.push(item.str);
    else if (Math.abs(item.x - xBaseline) <= X_TOLERANCE) baselineParts.push(item.str);
    else if (item.x < xPlof - X_TOLERANCE) labelParts.push(item.str);
  }
  return {
    plofValue: plofParts.join(" ").trim() || "Not Found",
    baselineValue: baselineParts.join(" ").trim() || "Not Found",
    subItemLabel: labelParts.join(" ").trim() || null,
  };
}

export function parseRawGoals(pages: PageText[]): RawGoal[] {
  const goals: RawGoal[] = [];

  for (const page of pages) {
    const positionedLines = positionedLinesFromPageItems(page.items).sort((a, b) => b.y - a.y);

    let i = 0;
    while (i < positionedLines.length) {
      const headerMatch = positionedLines[i].text.match(GOAL_HEADER_RE);
      if (!headerMatch) {
        i++;
        continue;
      }
      const kind = headerMatch[1].toUpperCase() as "STG" | "LTG";
      const num = headerMatch[2];
      const statusWord = headerMatch[3].trim();

      // Collect statement lines until the PLOF/Baseline header line.
      let j = i + 1;
      const statementParts: string[] = [];
      let plofHeaderLine: PositionedLine | null = null;
      while (j < positionedLines.length) {
        if (PLOF_BASELINE_HEADER_RE.test(positionedLines[j].text)) {
          plofHeaderLine = positionedLines[j];
          break;
        }
        // Stop if we hit the next goal header without ever finding a
        // PLOF/Baseline table (malformed/unsupported layout) — bail safely.
        if (GOAL_HEADER_RE.test(positionedLines[j].text)) break;
        statementParts.push(positionedLines[j].text);
        j++;
      }

      if (!plofHeaderLine) {
        // No recognizable table for this goal — record what we can without
        // fabricating baseline/PLOF values.
        goals.push({
          id: `${kind}#${num}`,
          kind,
          statusWord,
          statement: statementParts.join(" ").trim(),
          targetDate: statementParts.join(" ").match(TARGET_DATE_RE)?.[1]?.trim() ?? "Not Found",
          plofValue: "Not Found",
          baselineValue: "Not Found",
          subItemLabel: null,
          page: page.pageNumber,
        });
        i = j;
        continue;
      }

      const plofItem = plofHeaderLine.items.find((it) => /^PLOF$/i.test(it.str));
      const baselineItem = plofHeaderLine.items.find((it) => /^Baseline$/i.test(it.str));
      const xPlof = plofItem?.x ?? plofHeaderLine.items[0]?.x ?? 0;
      const xBaseline = baselineItem?.x ?? plofHeaderLine.items[plofHeaderLine.items.length - 1]?.x ?? xPlof + 100;

      // Next line: "(prior to onset) (date)" subheader — skip.
      const subHeaderIdx = j + 1;
      // Next line after that: the value row.
      const valueIdx = j + 2;
      const valueLine = positionedLines[valueIdx];

      let bucketed = { plofValue: "Not Found" as string, baselineValue: "Not Found" as string, subItemLabel: null as string | null };
      if (valueLine && !GOAL_HEADER_RE.test(valueLine.text) && !PLOF_BASELINE_HEADER_RE.test(valueLine.text)) {
        bucketed = bucketValueLine(valueLine, xPlof, xBaseline);
      }

      const statement = statementParts.join(" ").trim();
      goals.push({
        id: `${kind}#${num}`,
        kind,
        statusWord,
        statement,
        targetDate: statement.match(TARGET_DATE_RE)?.[1]?.trim() ?? "Not Found",
        plofValue: bucketed.plofValue,
        baselineValue: bucketed.baselineValue,
        subItemLabel: bucketed.subItemLabel,
        page: page.pageNumber,
      });

      i = valueIdx + 1;
      void subHeaderIdx;
    }
  }

  return goals;
}
