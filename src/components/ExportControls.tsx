import { useState } from "react";
import type { EpisodeAuditReport } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { buildExportHtml } from "../utils/exportReport";
import { htmlReportToPdfBlob } from "../utils/reportToPdf";
import { SaveToOneDriveNotConfiguredError, sendReportToOneDrive } from "../utils/saveToOneDrive";
import { isSaveToOneDriveConfigured } from "../config/integrations";

interface Props {
  report: EpisodeAuditReport;
  overrides: Record<string, ReviewerOverride>;
  onNewAudit: () => void;
}

type PrintStatus = { state: "idle" } | { state: "building" } | { state: "error"; message: string };
type SaveStatus = { state: "idle" } | { state: "sending" } | { state: "success" } | { state: "error"; message: string };

function safeFileName(report: EpisodeAuditReport): string {
  return (report.batchPatient.name || "patient").toString().replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "report";
}

/**
 * ExportControls
 * ================
 * "Print Audit" builds a single self-contained PDF report covering every
 * discipline in the episode (patient header, score, criteria, evidence,
 * comments, recommendations, corrective actions, strengths, timeline,
 * goal lifecycle, frequency, similarity, and the cross-discipline
 * consistency findings — no hidden AI reasoning/internal engine state),
 * opens it in a new tab (the browser's built-in PDF viewer, with its own
 * print/save controls) *and* downloads the same file to the Downloads
 * folder in one click — no separate "Export Audit" button needed.
 * "Save to OneDrive" builds that same report as a PDF and sends it
 * automatically (no download, no email draft) to a Google Apps Script
 * endpoint (see docs/POWER_AUTOMATE_SETUP.md), which emails it and a
 * Power Automate flow files it into OneDrive — this app never talks to
 * Microsoft or Google's servers except for that one relay call. "New
 * Audit" resets the app for the next upload.
 */
export function ExportControls({ report, overrides, onNewAudit }: Props) {
  const [printStatus, setPrintStatus] = useState<PrintStatus>({ state: "idle" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });

  const handlePrint = async () => {
    setPrintStatus({ state: "building" });
    // Open the new tab synchronously, in direct response to the click —
    // browsers block window.open() called after an `await` because it no
    // longer looks like a user-triggered action. We redirect this blank
    // tab to the real PDF once it's built, a few lines down.
    const newTab = window.open("", "_blank");
    try {
      const html = buildExportHtml(report, overrides);
      const blob = await htmlReportToPdfBlob(html);
      const url = URL.createObjectURL(blob);

      if (newTab) {
        newTab.location.href = url;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = `rehab-evaluator-audit-${safeFileName(report)}.pdf`;
      a.click();

      // Delay revoking the blob URL — the new tab needs a moment to finish
      // loading it before the reference disappears.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPrintStatus({ state: "idle" });
    } catch (err) {
      newTab?.close();
      const message = err instanceof Error ? err.message : "Building the PDF failed for an unknown reason.";
      setPrintStatus({ state: "error", message });
    }
  };

  const handleSaveToOneDrive = async () => {
    setSaveStatus({ state: "sending" });
    try {
      await sendReportToOneDrive(report, overrides);
      setSaveStatus({ state: "success" });
    } catch (err) {
      const message =
        err instanceof SaveToOneDriveNotConfiguredError
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
        <button type="button" className="btn" onClick={handlePrint} disabled={printStatus.state === "building"}>
          {printStatus.state === "building" ? "Building PDF…" : "Print Audit"}
        </button>
        {isSaveToOneDriveConfigured() && (
          <button type="button" className="btn" onClick={handleSaveToOneDrive} disabled={saveStatus.state === "sending"}>
            {saveStatus.state === "sending" ? "Sending…" : "Save to OneDrive"}
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={onNewAudit}>New Audit</button>
      </div>
      {printStatus.state === "error" && (
        <p className="export-status export-status--error">{printStatus.message}</p>
      )}
      {saveStatus.state === "success" && (
        <p className="export-status export-status--success">Sent — check the purehlth.com mailbox / OneDrive shortly.</p>
      )}
      {saveStatus.state === "error" && (
        <p className="export-status export-status--error">{saveStatus.message}</p>
      )}
    </div>
  );
}
