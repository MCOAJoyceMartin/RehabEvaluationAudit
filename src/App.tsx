import { useCallback, useMemo, useState } from "react";
import { PDFUpload } from "./components/PDFUpload";
import { PDFViewer } from "./components/PDFViewer";
import { AuditDashboard } from "./components/AuditDashboard";
import { loadPdfDocumentFromFile } from "./engine/pdf/loadPdfBrowser";
import { runRehabEvaluatorAudit } from "./engine/RehabAuditPipeline";
import type { Discipline, EpisodeAuditReport, NotFound } from "./types/audit";
import { useReviewerOverrides } from "./state/reviewerOverrides";
import "./App.css";

type PdfHandle = Awaited<ReturnType<typeof loadPdfDocumentFromFile>>;

export default function App() {
  const [pdfHandle, setPdfHandle] = useState<PdfHandle | null>(null);
  const [report, setReport] = useState<EpisodeAuditReport | null>(null);
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline | NotFound | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overridesState = useReviewerOverrides();

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const handle = await loadPdfDocumentFromFile(file);
      setPdfHandle(handle);
      const { report: auditReport, validations } = await runRehabEvaluatorAudit(handle.doc);
      for (const [discipline, validation] of Object.entries(validations)) {
        if (validation && !validation.success) {
          console.error(`Schema validation failed for ${discipline}`, validation.errors);
        }
      }
      setReport(auditReport);
      const firstDiscipline = auditReport.disciplineAudits[0] ?? null;
      setActiveDiscipline(firstDiscipline?.discipline ?? null);
      const firstEval = firstDiscipline?.episodeBoundaries.find((b) => b.documentType === "EVALUATION");
      setPage(firstEval?.startPage ?? 1);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to analyze this PDF.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleNewAudit = useCallback(() => {
    setPdfHandle(null);
    setReport(null);
    setActiveDiscipline(null);
    setPage(1);
    setError(null);
  }, []);

  const activeResult = useMemo(
    () => report?.disciplineAudits.find((d) => d.discipline === activeDiscipline) ?? report?.disciplineAudits[0] ?? null,
    [report, activeDiscipline],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Rehab Evaluator Audit</h1>
        <span className="app-header__subtitle">AI-assisted, full-episode therapy documentation audit</span>
      </header>

      {!report || !activeResult ? (
        <main className="app-main app-main--upload">
          <PDFUpload onFileSelected={handleFile} busy={busy} />
          {error && <p className="error-banner">{error}</p>}
        </main>
      ) : (
        <main className="app-main app-main--split">
          <div className="app-main__left">
            <PDFViewer pdfHandle={pdfHandle} page={page} onPageChange={setPage} />
          </div>
          <div className="app-main__right">
            <AuditDashboard
              report={report}
              activeDiscipline={activeResult.discipline}
              onSelectDiscipline={setActiveDiscipline}
              overrides={overridesState.overrides}
              onOverrideScore={overridesState.setOverrideScore}
              onReviewerNote={overridesState.setReviewerNote}
              onMarkReviewed={overridesState.setMarked}
              onViewEvidence={(p) => { if (p !== "Not Found") setPage(p); }}
              onJumpToPage={setPage}
              onNewAudit={handleNewAudit}
            />
          </div>
        </main>
      )}
    </div>
  );
}
