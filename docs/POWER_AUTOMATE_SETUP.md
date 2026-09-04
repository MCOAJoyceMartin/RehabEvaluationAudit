# Save to OneDrive — setup (Google Apps Script relay + Power Automate)

The app has no backend of its own (it's a static site on GitHub Pages). Clicking
**"Save to OneDrive"** builds a PDF of the report client-side and POSTs it to a
Google Apps Script "Web App" endpoint you deploy once, under the
**puresponseai@gmail.com** account. That script emails the PDF to
**joyce@purehlth.com** automatically — no download, no email draft, no manual
attach step. A Power Automate flow you build (or already have) watches that
mailbox and files the attachment into OneDrive.

Two things to set up, once: the Apps Script (this doc, section 1–2), and the
Power Automate flow (section 3).

## Why Apps Script instead of Power Automate's HTTP trigger

Power Automate was tried first. Joyce's Power Platform environment only offers
the newer HTTP-trigger type (`*.environment.api.powerplatform.com` URLs), which
requires Azure AD sign-in for every caller — there's no anonymous option, so a
plain client-side POST from this static site can't authenticate to it. Google
Apps Script, deployed as a Web App with **"Who has access: Anyone,"** *can*
expose a truly anonymous public endpoint under a Google account, which is
exactly what a backend-free static site needs.

## 1. Create the Apps Script

1. Sign into **script.google.com** as **puresponseai@gmail.com**.
2. **New project**. Name it something like `Rehab Audit Relay`.
3. Delete the placeholder code and paste this in:

```javascript
// Rehab Audit Relay — receives a PDF from the Rehab Evaluator Audit app and
// emails it to the configured recipient. Deployed as a Web App under
// puresponseai@gmail.com so GmailApp.sendEmail() sends from that address.

const SHARED_SECRET = "PASTE_THE_SAME_RANDOM_STRING_YOU_PUT_IN_VITE_SAVE_SCRIPT_SECRET_HERE";

function doPost(e) {
  try {
    // The app sends Content-Type: text/plain on purpose (to dodge a CORS
    // preflight browsers would otherwise block, since Apps Script doesn't
    // answer OPTIONS requests) — the body text itself is still JSON.
    const data = JSON.parse(e.postData.contents);

    if (data.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: "Bad secret" });
    }
    if (!data.contentBase64 || !data.fileName || !data.to) {
      return jsonResponse({ ok: false, error: "Missing required fields" });
    }

    const bytes = Utilities.base64Decode(data.contentBase64);
    const blob = Utilities.newBlob(bytes, "application/pdf", data.fileName);

    const bodyLines = [
      `Patient: ${data.patientName || "(unknown)"}`,
      `Disciplines: ${(data.disciplines || []).join(", ")}`,
      `Generated: ${data.generatedAt || ""}`,
      "",
      "Attached: " + data.fileName,
    ];

    GmailApp.sendEmail(data.to, data.subject || "Rehab Audit Report", bodyLines.join("\n"), {
      attachments: [blob],
      name: "Rehab Audit Relay",
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

4. Replace `PASTE_THE_SAME_RANDOM_STRING_...` with a random string you make up
   (it just needs to match what you put in `VITE_SAVE_SCRIPT_SECRET` in step 2
   below — it's not a Google/Microsoft credential, just a shared password
   between the app and this script).
5. **Deploy → New deployment → gear icon → Web app.**
   - **Execute as:** Me (puresponseai@gmail.com)
   - **Who has access:** Anyone
6. Click **Deploy**. The first time, Google will ask you to authorize the
   script to send email as puresponseai@gmail.com — approve it (you're
   authorizing your own script to use your own Gmail account).
7. Copy the **Web app URL** it gives you (ends in `/exec`). That's your
   `VITE_SAVE_SCRIPT_URL`.

## 2. Wire it into the app

- **For local dev** (`npm run dev`): create `.env.local` in the project root
  (gitignored — never committed):
  ```
  VITE_SAVE_SCRIPT_URL=<the Web app URL from step 1.7>
  VITE_SAVE_SCRIPT_SECRET=<the same random string from step 1.4>
  ```
  (`.env.example` shows the same two lines blank, as a template.) Restart
  `npm run dev` after adding it.
- **For the live GitHub Pages deployment**: in the GitHub repo, go to
  **Settings → Secrets and variables → Actions → New repository secret** and
  add `SAVE_SCRIPT_URL` and `SAVE_SCRIPT_SECRET` with the same two values.
  `.github/workflows/deploy.yml` already reads these and bakes them into the
  build — no other repo changes needed. The next push to `main` (or a manual
  re-run from the Actions tab) picks them up.

Once either is set, the **Save to OneDrive** button appears next to
Export/Print automatically.

## 3. Power Automate — file the emailed PDF into OneDrive

1. Go to [make.powerautomate.com](https://make.powerautomate.com) → **Create**
   → **Automated cloud flow**. Name it `Rehab Audit — Save to OneDrive`.
2. Trigger: search for and choose **"When a new email arrives (V3)"** (Office
   365 Outlook connector).
3. In the trigger's settings:
   - **Folder:** Inbox (or wherever mail to joyce@purehlth.com lands)
   - **From:** `puresponseai@gmail.com` — this is the important filter now
     (rather than a subject filter), since every email from that address is
     one the app's relay sent
   - **Has Attachment:** Yes (advanced options)
4. Add **Apply to each** over `Attachments` (or skip straight to step 5 if
   there's normally exactly one attachment).
5. Inside the loop, add **Create file** (OneDrive for Business connector):
   - **Folder Path:** wherever you want these filed, e.g. `/Rehab Audits`
   - **File Name:** the attachment's `Name` (dynamic content — from inside the
     loop, not the email's Subject)
   - **File Content:** the attachment's `Content` (dynamic content — not "Has
     Attachment," which is a yes/no flag, not the file itself)
6. Save the flow.

## 4. Test it end-to-end

1. Run the app and click **Save to OneDrive** on any report.
2. Within a few seconds you should see "Sent — check the purehlth.com mailbox
   / OneDrive shortly" in the app.
3. Check the joyce@purehlth.com inbox for an email from puresponseai@gmail.com
   with a PDF attached.
4. Check the OneDrive folder from step 3.5 (Power Automate polls the mailbox
   on a short interval, so it's not instant — give it a minute or two).

If the email never arrives: open the Apps Script project, **Executions**
(left sidebar) — it logs every call and any error thrown. A `400`/error
response usually means a secret mismatch (check `.env.local` /
the GitHub Actions secret against the script's `SHARED_SECRET`) or a stale
deployment (re-deploy after editing the script — Apps Script Web Apps don't
auto-update from saved-but-undeployed code; use **Deploy → Manage deployments
→ Edit → New version**).

If the email arrives but the file never lands in OneDrive: check the Power
Automate flow's **Run history** — it'll show whether the trigger fired and,
if so, exactly which step failed.

## Notes

- The PDF is generated entirely in the browser (via `jspdf` + `html2canvas` —
  see `src/utils/reportToPdf.ts`), the same report data `Print Audit` uses.
  It's a rendered-to-image-then-paginated PDF, not a
  true vector/text PDF — good enough for a working document, but long tables
  can occasionally break across a page awkwardly.
- **Security tradeoff, same as before:** this is a public, unauthenticated
  static site, so `SAVE_SCRIPT_URL` and `SAVE_SCRIPT_SECRET` are both readable
  in the deployed JS bundle by anyone who opens dev tools. The secret is a
  basic deterrent against someone stumbling onto the URL by accident, not real
  security against someone who deliberately reads the bundle. The reports
  contain PHI (name, MRN, DOB, diagnoses) — before relying on this for real
  patient data, confirm with your compliance team that Google Apps Script /
  Gmail (puresponseai@gmail.com), and the OneDrive/Power Automate side, are
  appropriate destinations for PHI in transit and at rest.
