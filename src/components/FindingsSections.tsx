import type { AdditionalFinding, RehabAuditResult, RubricConfirmationItem, StrengthFinding, TopOpportunity } from "../types/audit";

interface Props {
  result: RehabAuditResult;
  topOpportunities: TopOpportunity[];
  onViewEvidence: (page: number | "Not Found") => void;
}

export function FindingsSections({ result, topOpportunities, onViewEvidence }: Props) {
  return (
    <>
      <section className="panel">
        <h2>Top Documentation Opportunities</h2>
        {topOpportunities.length === 0 ? (
          <p className="muted">No high-priority opportunities identified.</p>
        ) : (
          <div className="opportunity-list">
            {topOpportunities.map((op, idx) => (
              <div className="opportunity-card" key={idx}>
                <div className="opportunity-card__header">
                  <strong>{op.finding}</strong>
                  <span className={`badge badge--risk-${op.riskLevel.toLowerCase()}`}>{op.riskLevel}</span>
                </div>
                <p>{op.whyItMatters}</p>
                <p className="muted"><strong>Recommended improvement:</strong> {op.recommendedImprovement}</p>
                {op.evidence.length > 0 && op.evidence[0].page !== "Not Found" && (
                  <button type="button" className="link-button" onClick={() => onViewEvidence(op.evidence[0].page)}>View Evidence</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Corrective Actions</h2>
        {result.correctiveActions.length === 0 ? (
          <p className="muted">No corrective actions identified for this record.</p>
        ) : (
          <ul className="findings-list">
            {result.correctiveActions.map((c, idx) => <li key={idx}>{c}</li>)}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>What Was Done Well</h2>
        <StrengthsList strengths={result.strengths} />
      </section>

      <section className="panel">
        <h2>Additional Documentation Findings</h2>
        <AdditionalFindingsList findings={result.additionalFindings} />
      </section>

      <section className="panel">
        <h2>External Validation Required</h2>
        {result.externalValidationNeeded.length === 0 ? (
          <p className="muted">No criteria required external (PCC) validation in this record.</p>
        ) : (
          <ul className="findings-list">
            {result.externalValidationNeeded.map((e, idx) => <li key={idx}>{e}</li>)}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Pending Rubric Confirmation</h2>
        <RubricConfirmationList items={result.rubricConfirmationNeeded} />
      </section>
    </>
  );
}

function StrengthsList({ strengths }: { strengths: StrengthFinding[] }) {
  if (strengths.length === 0) return <p className="muted">No specific strengths were flagged for this record.</p>;
  return (
    <ul className="findings-list findings-list--strengths">
      {strengths.map((s) => <li key={s.id}>{s.description}</li>)}
    </ul>
  );
}

function AdditionalFindingsList({ findings }: { findings: AdditionalFinding[] }) {
  if (findings.length === 0) return <p className="muted">No additional documentation findings.</p>;
  return (
    <ul className="findings-list">
      {findings.map((f) => (
        <li key={f.id}>
          <span className={`badge badge--confidence-${f.confidence.toLowerCase()}`}>{f.confidence}</span>{" "}
          <strong>{f.category}:</strong> {f.description}
        </li>
      ))}
    </ul>
  );
}

function RubricConfirmationList({ items }: { items: RubricConfirmationItem[] }) {
  if (items.length === 0) return <p className="muted">No criteria are awaiting rubric confirmation for this record.</p>;
  return (
    <ul className="findings-list">
      {items.map((item) => (
        <li key={item.criterionId}>
          <span className="badge badge--status-pending">{item.potentialPoints} pt{item.potentialPoints === 1 ? "" : "s"}</span>{" "}
          <strong>{item.section} — {item.criterion}:</strong> {item.factualFinding}
          {item.note && <div className="muted small">{item.note}</div>}
        </li>
      ))}
    </ul>
  );
}
