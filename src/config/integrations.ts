/**
 * integrations.ts
 * =================
 * Configuration for the "Save to OneDrive" button (see docs/POWER_AUTOMATE_SETUP.md).
 *
 * This app is a static site (GitHub Pages) with no backend of its own. Two
 * approaches were tried and rejected before this one:
 *   1. POSTing straight to a Power Automate HTTP-trigger flow — Joyce's
 *      Power Platform environment only offers the newer trigger type,
 *      which requires Azure AD sign-in for every caller (no anonymous
 *      option), so a plain client-side POST can't authenticate.
 *   2. A mailto: email draft the user attaches a file to by hand — works,
 *      but requires a manual "attach the file, then send" step every time,
 *      which is easy to forget (a mailto: link cannot include an
 *      attachment — that's a browser security restriction, not something
 *      any code change can work around).
 *
 * Final approach: the button builds a PDF client-side and POSTs it to a
 * Google Apps Script "Web App" endpoint that Joyce deploys once, under an
 * account she controls (puresponseai@gmail.com). Apps Script *can* expose
 * a truly anonymous, no-login HTTP endpoint (unlike Power Automate's newer
 * trigger type), and — running under that Google account — calls Gmail's
 * own send function to email the PDF to ONEDRIVE_SAVE_EMAIL automatically,
 * no draft, no manual attach step. A Power Automate flow Joyce owns then
 * watches that mailbox ("When a new email arrives (V3)", filtered to mail
 * from the script's Gmail account) and files the attachment into OneDrive.
 * See docs/POWER_AUTOMATE_SETUP.md for the full setup (both the Apps
 * Script side and the Power Automate side).
 *
 * IMPORTANT — this is a public, unauthenticated static site:
 * SAVE_SCRIPT_URL and SAVE_SCRIPT_SECRET are baked into the built JS bundle
 * at build time (via Vite's `import.meta.env`) and are therefore visible to
 * anyone who opens browser dev tools or views the deployed source — same
 * as any client-only app. SAVE_SCRIPT_SECRET is a lightweight abuse
 * deterrent (checked at the top of the Apps Script before it does
 * anything), not real security — it stops casual/accidental hits on a
 * guessed or leaked URL, not a motivated attacker who reads the bundle.
 *
 * Set these at build time via a `.env.local` file (gitignored — see
 * `.env.example`) for local builds, or via GitHub Actions repository
 * secrets (`SAVE_SCRIPT_URL` / `SAVE_SCRIPT_SECRET`) for the GitHub Pages
 * deploy, wired into `.github/workflows/deploy.yml`.
 */

export const ONEDRIVE_SAVE_EMAIL = "joyce@purehlth.com";

export const SAVE_SCRIPT_URL: string = import.meta.env.VITE_SAVE_SCRIPT_URL ?? "";
export const SAVE_SCRIPT_SECRET: string = import.meta.env.VITE_SAVE_SCRIPT_SECRET ?? "";

export function isSaveToOneDriveConfigured(): boolean {
  return SAVE_SCRIPT_URL.trim().length > 0;
}
