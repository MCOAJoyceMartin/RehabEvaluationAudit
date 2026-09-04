import { useState } from "react";
import type { EpisodeAuditReport } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { buildExportHtml } from "../utils/exportReport";
import { OneDriveRelayNotConfiguredError, sendReportToOneDrive } from "../utils/onedriveRelay";
import { isOneDriveRelayConfigured } from "../config/integrations";

interface Props {
  report: EpisodeAuditReport;
  overrides: Record<string, ReviewerOverride>;
  onNewAudit: () => void;
}

type SaveStatus = { state: "idle" } | { state: "sending" } | { state: "success" } | { state: "error"; message: string };

/**
 * ExportControls
 * ================
 * "Export Audit" downloads a single self-contained HTML report covering
 * every discipline in the episode (patient header, score, criteria,
 * evidence, comments, recommendations, corrective actions, strengths,
 * timeline, goal lifecycle, frequency, similarity, and the cross
 * -discipline consistency findings — no hidden AI reasoning/internal
 * engine state). "Print Audit" uses the browser print dialog against the
 * same report. "Save to OneDrive" sends that same report to a Power
 * Automate flow (see docs/POWER_AUTOMATE_SETUP.md) which emails it to a
 * purehlth.com mailbox and saves it to OneDrive — this app never talks to
 * Microsoft directly. "New Audit" resets the app for the next upload.
 */
export function ExportControls({ report, overrides, onNewAudit }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });

  const handleExport = () => {
    const html = buildExportHtml(report, overrides);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (report.batchPatient.name || "patient").toString().replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    a.href = url;
    a.download = `rehab-evaluator-audit-${safeName || "report"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const html = buildExportHtml(report, overrides);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleSaveToOneDrive = async () => {
    setSaveStatus({ state: "sending" });
    try {
      await sendReportToOneDrive(report, overrides);
      setSaveStatus({ state: "success" });
    } catch (err) {
      const message =
        err instanceof OneDriveRelayNotConfiguredError
          ? "Save to OneDrive isn't set up for this deployment yet."
          : err instanceof Error
            ? err.message
            : "Save to OneDrive failed for an unknown reason.";
      setSaveStatus({ state: "error", message });
    }
  };

  return (
    <div className="export-controls-wrap">
      <div className="export-controls">
        <button type="button" className="btn" onClick={handleExport}>Export Audit</button>
        <button type="button" className="btn" onClick={handlePrint}>Print Audit</button>
        {isOneDriveRelayConfigured() && (
          <button type="button" className="btn" onClick={handleSaveToOneDrive} disabled={saveStatus.state === "sending"}>
            {saveStatus.state === "sending" ? "Saving…" : "Save to OneDrive"}
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={onNewAudit}>New Audit</button>
      </div>
      {saveStatus.state === "success" && (
        <p className="export-status export-status--success">Sent — check the purehlth.com mailbox / OneDrive shortly.</p>
      )}
      {saveStatus.state === "error" && (
        <p className="export-status export-status--error">{saveStatus.message}</p>
      )}
    </div>
  );
}
