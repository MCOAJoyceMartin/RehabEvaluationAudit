/**
 * integrations.ts
 * =================
 * Configuration for the "Save to OneDrive" relay (see docs/POWER_AUTOMATE_SETUP.md).
 *
 * This app is a static site (GitHub Pages) with no backend of its own, so it
 * cannot call the Microsoft Graph API directly without a real OAuth app
 * registration. Instead, "Save to OneDrive" POSTs the export report to a
 * Power Automate flow's HTTP-trigger URL. That flow (built and owned by
 * Joyce, running under her own already-authorized Microsoft 365 connection)
 * is responsible for emailing the report to a purehlth.com mailbox and/or
 * saving it directly to OneDrive — this app never talks to Microsoft
 * directly and never handles any Microsoft credentials.
 *
 * IMPORTANT — this is a public, unauthenticated static site:
 * Both values below are baked into the built JS bundle at build time (via
 * Vite's `import.meta.env`) and are therefore visible to anyone who opens
 * browser dev tools or views the deployed source — there is no way to hide
 * a secret in a client-only app without adding a real backend.
 * `RELAY_SHARED_SECRET` is a *lightweight abuse deterrent* (checked by a
 * Condition step in the Power Automate flow before it does anything), not
 * real security — it stops casual/accidental hits, not a motivated attacker
 * who reads the bundle. Do not rely on it to keep PHI safe; the flow itself
 * is the safety boundary.
 *
 * Set these at build time via a `.env.local` file (gitignored — see
 * `.env.example`) for local builds, or via GitHub Actions repository
 * secrets (`ONEDRIVE_RELAY_URL` / `ONEDRIVE_RELAY_SECRET`) for the
 * GitHub Pages deploy, wired into `.github/workflows/deploy.yml`.
 */

export const ONEDRIVE_RELAY_URL: string = import.meta.env.VITE_ONEDRIVE_RELAY_URL ?? "";
export const ONEDRIVE_RELAY_SECRET: string = import.meta.env.VITE_ONEDRIVE_RELAY_SECRET ?? "";

export function isOneDriveRelayConfigured(): boolean {
  return ONEDRIVE_RELAY_URL.trim().length > 0;
}
