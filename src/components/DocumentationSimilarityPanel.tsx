import type { DocumentationSimilarityFinding } from "../types/audit";

interface Props {
  findings: DocumentationSimilarityFinding[];
}

const CLASSIFICATION_CLASS: Record<string, string> = {
  "Patient-specific": "pass",
  "Template-heavy": "partial",
  "Near duplicate": "fail",
  "Exact duplicate": "fail",
};

/**
 * DocumentationSimilarityPanel — "Documentation Similarity"
 * ==============================================================
 * Flags narrative text (response-to-treatment, treatment narrative,
 * caregiver education language) that is copy-pasted or near-identical
 * across dates of service — a common documentation-quality/audit-risk
 * finding independent of any single criterion's pass/fail score.
 */
export function DocumentationSimilarityPanel({ findings }: Props) {
  if (findings.length === 0) {
    return (
      <section className="panel">
        <h2>Documentation Similarity</h2>
        <p className="muted">No templated or duplicated narrative patterns were flagged.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Documentation Similarity</h2>
      <div className="similarity-list">
        {findings.map((f, idx) => (
          <div className="similarity-card" key={idx}>
            <div className="similarity-card__header">
              <strong>{f.dimension.replace(/([a-z])([A-Z])/g, "$1 $2")}</strong>
              <span className={`badge badge--status-${CLASSIFICATION_CLASS[f.classification] ?? "na"}`}>{f.classification}</span>
            </div>
            <p className="muted small">Dates compared: {f.datesCompared.join(", ")}</p>
            {f.sampleText && <blockquote>&ldquo;{f.sampleText}&rdquo;</blockquote>}
            <p>{f.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
