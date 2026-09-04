import type { Discipline, EpisodeBoundary, NotFound } from "../types/audit";

interface Props {
  boundaries: EpisodeBoundary[];
  activeDiscipline: Discipline | NotFound;
  onJumpToPage: (page: number) => void;
}

const LABELS: Record<string, string> = {
  EVALUATION: "Evaluation",
  PROGRESS_REPORT: "Progress Report",
  DAILY_TREATMENT_NOTE: "Daily / Treatment Note",
  RECERTIFICATION: "Recertification",
  DISCHARGE: "Discharge",
  OTHER: "Other",
};

/**
 * Shows how the uploaded PDF was classified into document types/pages
 * across the whole batch. The full episode is scored for every discipline
 * present (Evaluation, Progress Notes, Daily Notes, Recertification, and
 * Discharge Summary all have their own rubric sections) — this strip
 * highlights the chips that belong to the discipline currently selected in
 * the tabs above, so a reviewer can see at a glance which pages fed the
 * audit they're looking at.
 */
export function DocumentClassificationStrip({ boundaries, activeDiscipline, onJumpToPage }: Props) {
  return (
    <section className="panel doc-classification">
      <h2>Document Classification</h2>
      <div className="doc-classification__strip">
        {boundaries.map((b, idx) => (
          <button
            type="button"
            key={idx}
            className={`doc-chip doc-chip--${b.documentType.toLowerCase()} ${b.discipline === activeDiscipline ? "doc-chip--active" : ""}`}
            onClick={() => onJumpToPage(b.startPage)}
            title={`Pages ${b.startPage}-${b.endPage}`}
          >
            {LABELS[b.documentType] ?? b.documentType}
            {b.discipline !== "Not Found" && <span className="doc-chip__discipline">{b.discipline}</span>}
            <span className="doc-chip__pages">p.{b.startPage}–{b.endPage}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        Highlighted chips belong to the discipline selected above. Every document type shown here — Evaluation, Progress
        Notes, Daily Notes, Recertification, and Discharge Summary — is scored against the audit rubric.
      </p>
    </section>
  );
}
