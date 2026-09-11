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

/** Result of a send attempt. `confirmed: true` means the browser actually
 *  read back a real response from the script (so a thrown error for a
 *  non-confirmed attempt is a genuine unknown, not a proven failure — see
 *  the CORS note below). */
export interface SendResult {
  confirmed: boolean;
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
 *
 * CORS reliability note: even with a correctly configured deployment (right
 * URL, right secret, "Anyone" access), Google's execution redirect
 * (script.google.com/.../exec -> script.googleusercontent.com/macros/echo)
 * has been observed to intermittently omit CORS headers on the final
 * response. When that happens the browser refuses to let JS read the
 * response at all and `fetch()` throws a generic network TypeError — this
 * is indistinguishable, from here, from the request never having reached
 * Google in the first place, and it can happen even when the exact same
 * URL/secret worked moments earlier from another attempt. Confirmed by
 * reproducing it directly: a normal ("cors") fetch to a known-good,
 * verified-correct deployment threw, while the identical request sent with
 * `mode: "no-cors"` completed (opaque response, unreadable but not
 * network-blocked) — proving the request did reach Google either way.
 *
 * So: try the normal request first (it lets us surface a REAL app-level
 * error — a bad secret, a missing field — with a specific message). Only
 * if that throws a generic (non-Error-subclass) failure do we retry once
 * with `no-cors` as a fire-and-forget — we can't read whether Apps Script
 * accepted it, so we report `confirmed: false` and the caller shows a
 * softer "sent, but couldn't confirm — check your inbox" message instead
 * of a scary HTTP-status error that isn't actually about the deployment.
 */
export async function sendReportToOneDrive(
  report: EpisodeAuditReport,
  overrides: Record<string, ReviewerOverride>,
): Promise<SendResult> {
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
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "text/plain;charset=utf-8" };

  let res: Response;
  try {
    res = await fetch(SAVE_SCRIPT_URL, { method: "POST", headers, body });
  } catch {
    // Generic network/CORS-layer failure — see the CORS reliability note
    // above. Retry once, fire-and-forget, so the email still has a chance
    // to send even though we can no longer confirm it from here.
    try {
      await fetch(SAVE_SCRIPT_URL, { method: "POST", mode: "no-cors", headers, body });
    } catch {
      throw new Error(
        "Save to OneDrive couldn't reach the Apps Script relay at all (a network-level failure, not a rejection from the script). Check your connection and try again.",
      );
    }
    return { confirmed: false };
  }

  if (!res.ok) {
    throw new Error(`Save to OneDrive failed (HTTP ${res.status}). Check the Apps Script deployment.`);
  }

  let responseBody: { ok?: boolean; error?: string } = {};
  try {
    responseBody = await res.json();
  } catch {
    // Some Apps Script deployments/redirects can make the body hard to
    // read from the browser even on success — a non-throwing fetch with
    // an ok HTTP status is treated as success either way.
  }
  if (responseBody.ok === false) {
    throw new Error(responseBody.error || "Save to OneDrive failed for an unknown reason.");
  }
  return { confirmed: true };
}
