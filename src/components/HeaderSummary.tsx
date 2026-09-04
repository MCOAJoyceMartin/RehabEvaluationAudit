import { useMemo } from "react";
import type { RehabAuditResult } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { computeEffectiveTotals, totalsWereAdjusted } from "../engine/audit/recalculateTotals";

interface Props {
  result: RehabAuditResult;
  overrides: Record<string, ReviewerOverride>;
}

const DISCIPLINE_LABEL: Record<string, string> = {
  PT: "Physical Therapy",
  OT: "Occupational Therapy",
  SLP: "Speech-Language Pathology",
};

export function HeaderSummary({ result, overrides }: Props) {
  const { patient, therapyEpisode } = result;
  const aiTotals = result.totals;
  const totals = useMemo(() => computeEffectiveTotals(result, overrides), [result, overrides]);
  const adjusted = useMemo(() => totalsWereAdjusted(aiTotals, totals), [aiTotals, totals]);
  const passCount = totals.passed;
  const partialCount = totals.partial;
  const failCount = totals.failed;
  const utvCount = totals.unableToValidate;
  const pendingCount = totals.pendingRubricConfirmationCriteriaCount;

  return (
    <section className="panel header-summary">
      <div className="header-summary__title-row">
        <h1>Rehab Evaluator Audit</h1>
        <span className="badge badge--module">
          {DISCIPLINE_LABEL[therapyEpisode.discipline] ?? therapyEpisode.discipline} — Full Episode
        </span>
      </div>

      <div className="header-summary__grid">
        <Field label="Patient" value={patient.name} />
        <Field label="MRN" value={patient.mrn} />
        <Field label="Facility" value={patient.facility} />
        <Field label="Discipline" value={therapyEpisode.discipline} />
        <Field label="Evaluator" value={therapyEpisode.evaluator} />
        <Field label="Evaluation DOS" value={therapyEpisode.evaluationDOS} />
        <Field label="Completed Date" value={therapyEpisode.completionDate} />
        <Field label="Start of Care" value={therapyEpisode.startOfCare} />
        <Field label="Certification Period" value={`${therapyEpisode.certificationStart} – ${therapyEpisode.certificationEnd}`} />
        <Field label="Payer" value={patient.payer} />
      </div>

      <div className="header-summary__score">
        <div className="score-circle">
          <span className="score-circle__value">{totals.percentage}%</span>
          <span className="score-circle__fraction">{totals.earned} / {totals.possible}</span>
        </div>
        <div className="score-status-cards">
          <div className="status-card status-card--pass"><span>{passCount}</span>Pass</div>
          <div className="status-card status-card--partial"><span>{partialCount}</span>Partial</div>
          <div className="status-card status-card--fail"><span>{failCount}</span>Fail</div>
          <div className="status-card status-card--unable"><span>{utvCount}</span>Unable to Validate</div>
          {pendingCount > 0 && (
            <div className="status-card status-card--pending"><span>{pendingCount}</span>Pending Rubric Confirmation</div>
          )}
        </div>
      </div>

      {adjusted && (
        <p className="header-summary__override-note">
          Recalculated after reviewer overrides. Original AI-computed score: {aiTotals.earned} / {aiTotals.possible} ({aiTotals.percentage}%),
          Pass {aiTotals.passed} · Partial {aiTotals.partial} · Fail {aiTotals.failed} · Unable to Validate {aiTotals.unableToValidate}.
        </p>
      )}

      {totals.externalValidationCriteriaCount > 0 && (
        <p className="header-summary__external-note">
          External Validation Pending: {totals.externalValidationCriteriaCount} criterion / {totals.externalValidationOpportunity} points —
          excluded from the score above so an incomplete upload is never read as a failed audit.
        </p>
      )}

      {pendingCount > 0 && (
        <p className="header-summary__pending-note">
          Pending Rubric Confirmation: {pendingCount} criterion / {totals.pendingRubricConfirmationOpportunity} points —
          the rubric rule itself is not yet defined for these, so no score was guessed; excluded from the score above.
        </p>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <span className="field__value">{value}</span>
    </div>
  );
}
