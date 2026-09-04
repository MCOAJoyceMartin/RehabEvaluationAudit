import type { GoalAnalysis, GoalRecord } from "../types/audit";

interface Props {
  goalAnalysis: GoalAnalysis;
}

function GoalTable({ goals, kind }: { goals: GoalRecord[]; kind: "STG" | "LTG" }) {
  if (goals.length === 0) return <p className="muted">No {kind === "STG" ? "short-term" : "long-term"} goals identified.</p>;
  return (
    <div className="goal-grid">
      {goals.map((g) => (
        <div className="goal-card" key={g.id}>
          <div className="goal-card__id">{g.id}</div>
          <p className="goal-card__statement">{g.statement}</p>
          <dl>
            <dt>Baseline</dt><dd>{g.baseline}</dd>
            <dt>Target</dt><dd>{g.target}</dd>
            <dt>Target Date</dt><dd>{g.targetDate}</dd>
            <dt>Functional Area</dt><dd>{g.functionalArea}</dd>
            <dt>Measurable</dt><dd>{g.measurable ? "Yes" : "No"}</dd>
            <dt>Above CLOF</dt><dd>{String(g.aboveClof)}</dd>
            <dt>Attainability</dt><dd>{g.attainable}</dd>
          </dl>
          <p className="goal-card__finding">{g.finding}</p>
        </div>
      ))}
    </div>
  );
}

export function GoalAnalysisPanel({ goalAnalysis }: Props) {
  return (
    <section className="panel">
      <h2>Plan of Care — Goal Analysis</h2>

      <details open>
        <summary>Long-Term Goals ({goalAnalysis.longTermGoals.length})</summary>
        <GoalTable goals={goalAnalysis.longTermGoals} kind="LTG" />
      </details>

      <details open>
        <summary>Short-Term Goals ({goalAnalysis.shortTermGoals.length})</summary>
        <GoalTable goals={goalAnalysis.shortTermGoals} kind="STG" />
      </details>

      <details open>
        <summary>STG → LTG Mapping</summary>
        {goalAnalysis.goalMapping.length === 0 ? (
          <p className="muted">No mapping available.</p>
        ) : (
          <ul className="mapping-list">
            {goalAnalysis.goalMapping.map((m) => (
              <li key={m.stgId}>
                <strong>{m.stgId}</strong> → <strong>{m.ltgId ?? "Unmapped"}</strong>
                <span className={`badge badge--confidence-${m.confidence.toLowerCase()}`}>{m.confidence}</span>
                <div className="muted small">{m.basis}</div>
              </li>
            ))}
          </ul>
        )}
      </details>

      {goalAnalysis.logicFindings.length > 0 && (
        <details>
          <summary>Goal Logic Checks ({goalAnalysis.logicFindings.length}) — non-scored</summary>
          <ul className="findings-list">
            {goalAnalysis.logicFindings.map((f, idx) => (
              <li key={idx}>
                <strong>{f.goalId}</strong> — {f.issue}: {f.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
