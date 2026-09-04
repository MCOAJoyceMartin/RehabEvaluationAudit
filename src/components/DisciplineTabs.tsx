import type { Discipline, NotFound } from "../types/audit";

interface Props {
  disciplines: (Discipline | NotFound)[];
  active: Discipline | NotFound;
  onSelect: (discipline: Discipline | NotFound) => void;
}

const DISCIPLINE_LABEL: Record<string, string> = {
  PT: "Physical Therapy",
  OT: "Occupational Therapy",
  SLP: "Speech-Language Pathology",
};

/**
 * DisciplineTabs
 * ================
 * Each discipline found in the batch (PT/OT/SLP) gets its own fully
 * independent audit — never blended into a single score or a single list of
 * criteria (see PRE_BUILD_RUBRIC_ANALYSIS.md principle #6). This tab strip
 * is the only thing that switches which discipline's RehabAuditResult the
 * rest of the dashboard renders; it never merges data across the tabs.
 * Hidden entirely when only one discipline is present, so a single
 * -discipline batch looks exactly as simple as it did in v1.
 */
export function DisciplineTabs({ disciplines, active, onSelect }: Props) {
  if (disciplines.length <= 1) return null;
  return (
    <div className="discipline-tabs" role="tablist" aria-label="Discipline">
      {disciplines.map((d) => (
        <button
          key={d}
          type="button"
          role="tab"
          aria-selected={d === active}
          className={`discipline-tab ${d === active ? "discipline-tab--active" : ""}`}
          onClick={() => onSelect(d)}
        >
          {DISCIPLINE_LABEL[d] ?? d}
        </button>
      ))}
    </div>
  );
}
