import type { TimelineEntry } from "../types/audit";

interface Props {
  timeline: TimelineEntry[];
  onJumpToPage: (page: number) => void;
}

const DOC_LABEL: Record<string, string> = {
  EVALUATION: "Evaluation",
  PROGRESS_REPORT: "Progress Report",
  DAILY_TREATMENT_NOTE: "Daily / Treatment Note",
  RECERTIFICATION: "Recertification",
  DISCHARGE: "Discharge",
  OTHER: "Other",
};

/**
 * TimelinePanel — "Episode Timeline"
 * =====================================
 * Chronological view of every document in this discipline's episode (one
 * row per Evaluation / Progress Report / Daily Note / Recertification /
 * Discharge), so a reviewer can see the whole course of care at a glance
 * before drilling into individual criteria below.
 */
export function TimelinePanel({ timeline, onJumpToPage }: Props) {
  if (timeline.length === 0) {
    return (
      <section className="panel">
        <h2>Episode Timeline</h2>
        <p className="muted">No dated documents were identified for this discipline.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Episode Timeline</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Date of Service</th>
              <th>Completed</th>
              <th>Signed</th>
              <th>Clinician</th>
              <th>Pages</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((t, idx) => (
              <tr key={idx}>
                <td>{DOC_LABEL[t.documentType] ?? t.documentType}</td>
                <td>{t.dos}{t.dosEnd !== "Not Found" && t.dosEnd !== t.dos ? ` – ${t.dosEnd}` : ""}</td>
                <td>{t.completionDate}</td>
                <td>{t.signatureDate}</td>
                <td>{t.clinician}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => onJumpToPage(t.pages.start)}>
                    p.{t.pages.start}–{t.pages.end}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
