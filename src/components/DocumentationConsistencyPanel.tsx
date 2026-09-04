import type { DocumentationConsistencyFinding } from "../types/audit";

interface Props {
  findings: DocumentationConsistencyFinding[];
  onJumpToPage: (page: number) => void;
}

/**
 * DocumentationConsistencyPanel — "Documentation Consistency"
 * =================================================================
 * Batch-level (cross-discipline), not scoped to any one discipline tab —
 * checks fields like Payer, per-diagnosis Onset Date, and Discharge
 * Disposition for agreement across every discipline's documentation in the
 * batch. Only rendered when there is more than one discipline to compare
 * (see RehabAuditPipeline.buildCrossDisciplineConsistency), so a single
 * -discipline batch shows nothing here rather than a trivially-empty panel.
 */
export function DocumentationConsistencyPanel({ findings, onJumpToPage }: Props) {
  if (findings.length === 0) return null;

  return (
    <section className="panel">
      <h2>Documentation Consistency (Cross-Discipline)</h2>
      <div className="consistency-list">
        {findings.map((f, idx) => (
          <div className="consistency-card" key={idx}>
            <div className="consistency-card__header">
              <strong>{f.field}</strong>
              {f.discipline !== "Not Found" && <span className="badge">{f.discipline}</span>}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Value</th><th>Source</th><th>Page</th></tr>
                </thead>
                <tbody>
                  {f.values.map((v, vIdx) => (
                    <tr key={vIdx}>
                      <td>{v.date}</td>
                      <td>{v.value}</td>
                      <td>{v.sourceDocType.replace(/_/g, " ")}</td>
                      <td>
                        {v.page !== "Not Found" ? (
                          <button type="button" className="link-button" onClick={() => onJumpToPage(v.page as number)}>p.{v.page}</button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{f.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
