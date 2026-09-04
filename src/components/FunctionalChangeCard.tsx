import type { FunctionalChangeRow } from "../types/audit";

interface Props {
  rows: FunctionalChangeRow[];
}

const CHANGE_ICON: Record<string, string> = {
  Improved: "▲",
  Declined: "▼",
  Unchanged: "▶",
  "Not Assessed": "?",
};

/**
 * FunctionalChangeCard — "FUNCTIONAL CHANGE AT EVALUATION"
 * ==========================================================
 * A dedicated, prominent PLOF -> CLOF comparison. Per spec this supports
 * (but never substitutes for) the Reason for Referral, Medical Necessity,
 * Therapist Assessment, and Goal Appropriateness criteria — each of those
 * is still scored independently elsewhere.
 */
export function FunctionalChangeCard({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <section className="panel">
        <h2>Functional Change at Evaluation</h2>
        <p className="muted">No comparable prior-level-of-function / current-level-of-function pairs were identified.</p>
      </section>
    );
  }

  return (
    <section className="panel functional-change">
      <h2>Functional Change at Evaluation</h2>
      <p className="muted">Prior Level of Function (PLOF) vs. current level at evaluation (CLOF). Supporting context only — each audit criterion below is still evaluated independently.</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Functional Area</th>
              <th>PLOF</th>
              <th>Evaluation CLOF</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className={`change-row change-row--${r.change.toLowerCase().replace(/\s+/g, "-")}`}>
                <td>{r.area}</td>
                <td>{r.plof}</td>
                <td>{r.clof}</td>
                <td>
                  <span className="change-pill">{CHANGE_ICON[r.change]} {r.change}</span>
                  {r.notes && <div className="muted small">{r.notes}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
