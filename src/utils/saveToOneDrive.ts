import type { EpisodeAuditReport } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { buildExportHtml } from "./exportReport";
import { htmlReportToPdfBlob } from "./reportToPdf";
import { ONEDRIVE_SAVE_EMAIL, SAVE_SCRIPT_SECRET, SAVE_SCRIPT_URL } from "../config/integrations";

export class SaveToOneDriveNotConfiguredError extends Error {
  constructor() {
    super("Save to OneDrive isn't set up for this deployment yet.");
    this.name = "SaveToOneDriveNotConfiguredError";
  }
}

function safeFileName(report: EpisodeAuditReport): string {
  const safe = (report.batchPatient.name || "patient").toString().replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return `rehab-evaluator-audit-${safe || "report"}.pdf`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is a data: URL ("data:application/pdf;base64,AAAA...") — strip the prefix.
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read PDF for upload."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the report as a PDF client-side and POSTs it to the configured
 * Google Apps Script Web App endpoint (see src/config/integrations.ts),
 * which emails it to ONEDRIVE_SAVE_EMAIL automatically — no download, no
 * email draft, no manual attach step. A Power Automate flow watching that
 * mailbox then files it into OneDrive (see docs/POWER_AUTOMATE_SETUP.md).
 *
 * The POST uses `Content-Type: text/plain` rather than `application/json`
 * on purpose: Apps Script Web Apps don't handle CORS preflight (OPTIONS)
 * requests, so a "simple request" content type (which browsers don't
 * preflight) is required to avoid the browser blocking the call outright.
 * The Apps Script side still receives valid JSON text and parses it itself
 * — see the doPost() script in docs/POWER_AUTOMATE_SETUP.md.
 */
export async function sendReportToOneDrive(
  report: EpisodeAuditReport,
  overrides: Record<string, ReviewerOverride>,
): Promise<void> {
  if (!SAVE_SCRIPT_URL.trim()) {
    throw new SaveToOneDriveNotConfiguredError();
  }

  const html = buildExportHtml(report, overrides);
  const pdfBlob = await htmlReportToPdfBlob(html);
  const contentBase64 = await blobToBase64(pdfBlob);
  const fileName = safeFileName(report);
  const patientName = report.batchPatient.name || "patient";

  const payload = {
    secret: SAVE_SCRIPT_SECRET,
    fileName,
    contentBase64,
    to: ONEDRIVE_SAVE_EMAIL,
    subject: `Rehab Audit Report — ${patientName}`,
    patientName,
    disciplines: report.disciplineAudits.map((d) => d.discipline),
    generatedAt: new Date().toISOString(),
  };

  const res = await fetch(SAVE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Save to OneDrive failed (HTTP ${res.status}). Check the Apps Script deployment.`);
  }

  let body: { ok?: boolean; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // Some Apps Script deployments/redirects can make the body hard to
    // read from the browser even on success — a non-throwing fetch with
    // an ok HTTP status is treated as success either way.
  }
  if (body.ok === false) {
    throw new Error(body.error || "Save to OneDrive failed for an unknown reason.");
  }
}
