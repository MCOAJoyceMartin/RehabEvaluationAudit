import type { GoalLifecycleRecord } from "../types/audit";

interface Props {
  goalLifecycle: GoalLifecycleRecord[];
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  Met: "pass",
  "Partially Met": "partial",
  "Not Met": "fail",
  Discontinued: "na",
  "Not Addressed": "fail",
  Continuing: "na",
  Unknown: "na",
};

/**
 * GoalLifecyclePanel — "Goal Lifecycle"
 * =========================================
 * Follows each goal set at Evaluation across every Progress Report / Daily
 * Note / Discharge Summary that later references it, so a reviewer can see
 * the full arc (baseline → progress entries → terminal status) for one
 * goal in one place instead of hunting across documents. Also flags the
 * "treated after goal met without a documented modification" case, which
 * feeds the Daily Notes "Discontinued When Goal Met" criterion.
 */
export function GoalLifecyclePanel({ goalLifecycle }: Props) {
  if (goalLifecycle.length === 0) {
    return (
      <section className="panel">
        <h2>Goal Lifecycle</h2>
        <p className="muted">No goals could be traced across the episode.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Goal Lifecycle</h2>
      <div className="goal-lifecycle-list">
        {goalLifecycle.map((g) => (
          <details className="goal-lifecycle-card" key={g.goalId}>
            <summary>
              <span className="goal-lifecycle-card__id">{g.goalId}</span>
              <span className="badge">{g.kind}</span>
              <span className={`badge badge--status-${STATUS_BADGE_CLASS[g.dischargeStatus] ?? "na"}`}>{g.dischargeStatus}</span>
              {g.treatmentAfterGoalMetFlag && (
                <span className="badge badge--risk-high" title="CPT billing continued targeting this goal after it was documented as met, with no documented modification.">
                  Treated after met
                </span>
              )}
              <span className="goal-lifecycle-card__text">{g.goalText}</span>
            </summary>
            <div className="goal-lifecycle-card__body">
              <dl>
                <dt>Baseline</dt><dd>{g.baseline}</dd>
                <dt>Target</dt><dd>{g.target}</dd>
                <dt>Target Date</dt><dd>{g.targetDate}</dd>
                <dt>Evaluation Status</dt><dd>{g.evaluationStatus}</dd>
                <dt>Met Date</dt><dd>{g.metDate}</dd>
                <dt>Modified Date</dt><dd>{g.modifiedDate}</dd>
                <dt>Discontinued Date</dt><dd>{g.discontinuedDate}</dd>
              </dl>
              {g.progressStatuses.length > 0 && (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Source</th><th>Status</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {g.progressStatuses.map((p, idx) => (
                        <tr key={idx}>
                          <td>{p.date}</td>
                          <td>{p.sourceDocument.replace(/_/g, " ")}</td>
                          <td>{p.status}</td>
                          <td>{p.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
