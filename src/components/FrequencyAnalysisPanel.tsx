import type { FrequencyAnalysis } from "../types/audit";

interface Props {
  frequencyAnalysis: FrequencyAnalysis[];
}

/**
 * FrequencyAnalysisPanel — "Treatment Frequency Analysis"
 * ============================================================
 * Per certification-period comparison of the ordered frequency (from the
 * Plan of Care / Progress Report) against the actual unique dates of
 * service billed in that period, week by week, with the tolerance rule
 * applied shown explicitly so a reviewer can see exactly what counted as
 * "within tolerance" rather than trusting an opaque pass/fail.
 */
export function FrequencyAnalysisPanel({ frequencyAnalysis }: Props) {
  if (frequencyAnalysis.length === 0) {
    return (
      <section className="panel">
        <h2>Treatment Frequency Analysis</h2>
        <p className="muted">No certification period had both an ordered frequency and daily treatment notes to compare.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Treatment Frequency Analysis</h2>
      {frequencyAnalysis.map((f, idx) => (
        <div className="frequency-period" key={idx}>
          <div className="frequency-period__header">
            <strong>Ordered: {f.orderedFrequencyRaw}</strong>
            <span className="muted small">Source: {f.sourceDocument}</span>
            <span className="muted small">Tolerance: {f.toleranceApplied.type} (±{f.toleranceApplied.varianceVisitsAllowed} visits)</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Ordered</th>
                  <th>Actual DOS</th>
                  <th>Missed / Refused</th>
                  <th>Variance</th>
                  <th>Finding</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.map((r, rIdx) => (
                  <tr key={rIdx}>
                    <td>{r.weekLabel}</td>
                    <td>{r.orderedFrequency}</td>
                    <td>{r.actualUniqueDOS.length > 0 ? r.actualUniqueDOS.join(", ") : "—"}</td>
                    <td>{r.missedOrRefused.length > 0 ? r.missedOrRefused.join(", ") : "—"}</td>
                    <td>{r.variance}</td>
                    <td>{r.finding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
