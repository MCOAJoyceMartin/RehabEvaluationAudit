import { useState } from "react";
import type { AuditCriterionResult } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { getEffectiveCriterion } from "../engine/audit/recalculateTotals";

interface Props {
  result: AuditCriterionResult;
  override?: ReviewerOverride;
  onOverrideScore: (score: number | null) => void;
  onReviewerNote: (note: string) => void;
  onMarkReviewed: (marked: boolean) => void;
  onViewEvidence: (page: number | "Not Found") => void;
}

const STATUS_LABEL: Record<string, string> = {
  PASS: "Pass",
  PARTIAL: "Partial",
  FAIL: "Fail",
  UNABLE_TO_VALIDATE: "Unable to Validate",
  PENDING_RUBRIC_CONFIRMATION: "Pending Rubric Confirmation",
  "N/A": "N/A",
};

export function AuditCriterionCard({ result, override, onOverrideScore, onReviewerNote, onMarkReviewed, onViewEvidence }: Props) {
  const [expanded, setExpanded] = useState(true);
  const effective = getEffectiveCriterion(result, override);
  const isOverridden = effective.isOverridden;

  return (
    <div className={`criterion-card criterion-card--${statusClass(effective.status)}`}>
      <button type="button" className="criterion-card__header" onClick={() => setExpanded((v) => !v)}>
        <span className="criterion-card__title">{result.criterion}</span>
        <span className="criterion-card__badges">
          <span className={`badge badge--status-${statusClass(effective.status)}`}>{STATUS_LABEL[effective.status]}</span>
          <span className="badge badge--risk">{result.risk}</span>
          {isOverridden && <span className="badge badge--overridden">Reviewer Override</span>}
          <span className="criterion-card__score">
            {effective.score === null ? "—" : effective.score}/{result.maxPoints}
          </span>
          <span className="criterion-card__chevron">{expanded ? "▾" : "▸"}</span>
        </span>
      </button>

      {expanded && (
        <div className="criterion-card__body">
          <div className="criterion-card__meta">
            <span>Confidence: <strong>{result.confidence}</strong></span>
            <span>Evidence type: <strong>{result.evidenceType.replace(/_/g, " ")}</strong></span>
          </div>

          <p className="criterion-card__comment">{result.auditorComment}</p>

          {result.status === "PENDING_RUBRIC_CONFIRMATION" && result.rubricConfirmation && (
            <div className="callout callout--pending">
              <strong>Pending Rubric Confirmation</strong>
              <p>{result.rubricConfirmation.reason}</p>
              <p><strong>Factual finding:</strong> {result.rubricConfirmation.factualFinding}</p>
              {result.rubricConfirmation.observationalHumanExample && (
                <p className="muted small">{result.rubricConfirmation.observationalHumanExample}</p>
              )}
              <p className="callout__action">
                This criterion&rsquo;s {result.maxPoints} point{result.maxPoints === 1 ? "" : "s"} are excluded from the score above
                until the rubric rule itself is confirmed by a human reviewer — no score was guessed.
              </p>
            </div>
          )}

          {result.externalValidation?.required && (
            <div className="callout callout--warning">
              <strong>External Validation Required</strong>
              <p>{result.externalValidation.reason}</p>
              <p className="callout__action">Recommended action: {result.externalValidation.recommendedAction}</p>
            </div>
          )}

          {result.evidence.length > 0 && (
            <div className="evidence-list">
              <h4>Evidence</h4>
              {result.evidence.map((ev, idx) => (
                <div className="evidence-item" key={idx}>
                  <div className="evidence-item__meta">
                    <span>Page {ev.page}</span>
                    <span>·</span>
                    <span>{ev.section}</span>
                    {ev.page !== "Not Found" && (
                      <button type="button" className="link-button" onClick={() => onViewEvidence(ev.page)}>
                        View Evidence
                      </button>
                    )}
                  </div>
                  <blockquote>&ldquo;{ev.text}&rdquo;</blockquote>
                </div>
              ))}
            </div>
          )}

          <p className="criterion-card__recommendation">
            <strong>Recommended action:</strong> {result.recommendation}
          </p>

          <details className="reviewer-override">
            <summary>Reviewer override</summary>
            <div className="reviewer-override__body">
              <p className="reviewer-override__disclaimer">
                Overrides and notes are kept only in this browser tab for the current session — refreshing the page or
                closing the tab clears them. Use <strong>Print Audit</strong> to keep a permanent record of any
                override before you close this session.
              </p>
              <label>
                Override score
                <select
                  value={override?.overriddenScore ?? ""}
                  onChange={(e) => onOverrideScore(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">No override (keep AI score)</option>
                  {Array.from({ length: result.maxPoints + 1 }, (_, n) => n).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Reviewer note
                <textarea
                  rows={2}
                  value={override?.reviewerNote ?? ""}
                  onChange={(e) => onReviewerNote(e.target.value)}
                  placeholder="Explain the override or add reviewer context…"
                />
              </label>
              <label className="reviewer-override__checkbox">
                <input type="checkbox" checked={override?.marked ?? false} onChange={(e) => onMarkReviewed(e.target.checked)} />
                Mark reviewed
              </label>
              {isOverridden && (
                <p className="reviewer-override__note">
                  Original AI {result.score === null ? `assessment (${STATUS_LABEL[result.status]})` : `score (${result.score})`} is
                  retained alongside this override — nothing is overwritten. The score above and the overall audit score now
                  reflect this override.
                </p>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "PASS": return "pass";
    case "PARTIAL": return "partial";
    case "FAIL": return "fail";
    case "UNABLE_TO_VALIDATE": return "unable";
    case "PENDING_RUBRIC_CONFIRMATION": return "pending";
    default: return "na";
  }
}
