import type { EpisodeAuditReport } from "../types/audit";
import type { ReviewerOverride } from "../state/reviewerOverrides";
import { buildExportHtml } from "./exportReport";
import { ONEDRIVE_RELAY_SECRET, ONEDRIVE_RELAY_URL, isOneDriveRelayConfigured } from "../config/integrations";

export class OneDriveRelayNotConfiguredError extends Error {
  constructor() {
    super("Save to OneDrive is not configured for this deployment (no relay URL set).");
    this.name = "OneDriveRelayNotConfiguredError";
  }
}

function toBase64(text: string): string {
  // btoa requires a Latin1 string; encode as UTF-8 bytes first so patient
  // names/notes with non-ASCII characters survive the round trip.
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function safeFileName(report: EpisodeAuditReport): string {
  const safe = (report.batchPatient.name || "patient").toString().replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return `rehab-evaluator-audit-${safe || "report"}.html`;
}

/**
 * POSTs the same self-contained HTML report that "Export Audit" downloads
 * to the configured Power Automate HTTP-trigger endpoint, as JSON:
 *   { secret, fileName, contentType, contentBase64, patientName, disciplines, generatedAt }
 * The receiving flow decodes `contentBase64` back into the attachment.
 * Throws OneDriveRelayNotConfiguredError if no relay URL is set, or an
 * Error with the flow's response text if the request itself fails.
 */
export async function sendReportToOneDrive(
  report: EpisodeAuditReport,
  overrides: Record<string, ReviewerOverride>,
): Promise<void> {
  if (!isOneDriveRelayConfigured()) throw new OneDriveRelayNotConfiguredError();

  const html = buildExportHtml(report, overrides);
  const fileName = safeFileName(report);

  const payload = {
    secret: ONEDRIVE_RELAY_SECRET,
    fileName,
    contentType: "text/html",
    contentBase64: toBase64(html),
    patientName: report.batchPatient.name,
    disciplines: report.disciplineAudits.map((d) => d.discipline),
    generatedAt: new Date().toISOString(),
  };

  const response = await fetch(ONEDRIVE_RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Save to OneDrive failed (HTTP ${response.status}).${detail ? ` ${detail}` : ""}`);
  }
}
