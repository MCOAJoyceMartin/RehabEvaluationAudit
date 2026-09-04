import { useMemo } from "react";
import type { Discipline, EpisodeAuditReport, NotFound } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { overrideKey } from "../state/reviewerOverrides";
import { buildTopOpportunities } from "../engine/audit/FindingsEngine";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { DisciplineTabs } from "./DisciplineTabs";
import { HeaderSummary } from "./HeaderSummary";
import { DocumentClassificationStrip } from "./DocumentClassificationStrip";
import { TimelinePanel } from "./TimelinePanel";
import { FunctionalChangeCard } from "./FunctionalChangeCard";
import { AuditCriterionCard } from "./AuditCriterionCard";
import { GoalAnalysisPanel } from "./GoalAnalysisPanel";
import { GoalLifecyclePanel } from "./GoalLifecyclePanel";
import { FrequencyAnalysisPanel } from "./FrequencyAnalysisPanel";
import { DocumentationSimilarityPanel } from "./DocumentationSimilarityPanel";
import { DocumentationConsistencyPanel } from "./DocumentationConsistencyPanel";
import { FindingsSections } from "./FindingsSections";
import { ExportControls } from "./ExportControls";

interface Props {
  report: EpisodeAuditReport;
  activeDiscipline: Discipline | NotFound;
  onSelectDiscipline: (discipline: Discipline | NotFound) => void;
  overrides: Record<string, ReviewerOverride>;
  onOverrideScore: (discipline: Discipline | NotFound, criterionId: string, score: number | null) => void;
  onReviewerNote: (discipline: Discipline | NotFound, criterionId: string, note: string) => void;
  onMarkReviewed: (discipline: Discipline | NotFound, criterionId: string, marked: boolean) => void;
  onViewEvidence: (page: number | "Not Found") => void;
  onJumpToPage: (page: number) => void;
  onNewAudit: () => void;
}

/** All seven rubric sections, in the order the spec defines them. A batch
 *  missing a document type (e.g. no Recertification yet) simply produces
 *  no criteria for that section, and the section is hidden below — it is
 *  never rendered as a wall of "Unable to Validate" placeholders. */
const SECTION_ORDER = [
  "Evaluation Medical Review",
  "Evaluation",
  "Plan of Care/Treatment",
  "Progress Notes",
  "Daily Notes",
  "Recertification",
  "Discharge Summary",
] as const;

export function AuditDashboard({
  report,
  activeDiscipline,
  onSelectDiscipline,
  overrides,
  onOverrideScore,
  onReviewerNote,
  onMarkReviewed,
  onViewEvidence,
  onJumpToPage,
  onNewAudit,
}: Props) {
  const disciplines = useMemo(() => report.disciplineAudits.map((d) => d.discipline), [report.disciplineAudits]);
  const result = useMemo(
    () => report.disciplineAudits.find((d) => d.discipline === activeDiscipline) ?? report.disciplineAudits[0],
    [report.disciplineAudits, activeDiscipline],
  );

  const topOpportunities = useMemo(() => buildTopOpportunities(result.audit), [result.audit]);
  const bySection = useMemo(() => {
    const map = new Map<string, typeof result.audit>();
    for (const section of SECTION_ORDER) map.set(section, []);
    for (const a of result.audit) {
      if (!map.has(a.section)) map.set(a.section, []);
      map.get(a.section)!.push(a);
    }
    return map;
  }, [result.audit]);

  return (
    <div className="audit-dashboard">
      <DisclaimerBanner />
      <DisciplineTabs disciplines={disciplines} active={result.discipline} onSelect={onSelectDiscipline} />
      <HeaderSummary result={result} overrides={overrides} />
      <DocumentClassificationStrip boundaries={report.episodeBoundaries} activeDiscipline={result.discipline} onJumpToPage={onJumpToPage} />
      <TimelinePanel timeline={result.timeline} onJumpToPage={onJumpToPage} />
      <FunctionalChangeCard rows={result.functionalChange} />

      {Array.from(bySection.entries()).map(([section, items]) =>
        items.length === 0 ? null : (
          <section className="panel" key={section}>
            <h2>{section}</h2>
            <div className="criterion-list">
              {items.map((a) => {
                const key = overrideKey(result.discipline, a.criterionId);
                return (
                  <AuditCriterionCard
                    key={a.criterionId}
                    result={a}
                    override={overrides[key]}
                    onOverrideScore={(score) => onOverrideScore(result.discipline, a.criterionId, score)}
                    onReviewerNote={(note) => onReviewerNote(result.discipline, a.criterionId, note)}
                    onMarkReviewed={(marked) => onMarkReviewed(result.discipline, a.criterionId, marked)}
                    onViewEvidence={onViewEvidence}
                  />
                );
              })}
            </div>
          </section>
        ),
      )}

      <GoalAnalysisPanel goalAnalysis={result.goalAnalysis} />
      <GoalLifecyclePanel goalLifecycle={result.goalLifecycle} />
      <FrequencyAnalysisPanel frequencyAnalysis={result.frequencyAnalysis} />
      <DocumentationSimilarityPanel findings={result.documentationSimilarity} />
      <DocumentationConsistencyPanel findings={report.documentationConsistency} onJumpToPage={onJumpToPage} />
      <FindingsSections result={result} topOpportunities={topOpportunities} onViewEvidence={onViewEvidence} />

      <ExportControls report={report} overrides={overrides} onNewAudit={onNewAudit} />
    </div>
  );
}
