# Save to OneDrive — Power Automate setup

The app has no backend of its own (it's a static site on GitHub Pages), so
"Save to OneDrive" doesn't talk to Microsoft directly. Instead it POSTs the
same report the "Export Audit" button downloads to a Power Automate flow
you build once, running under your own Microsoft 365 connection. That flow
emails the report to a purehlth.com mailbox and saves it to OneDrive.

This only has to be built once. After that, set two values in the app's
deployment (see the bottom of this doc) and the button appears automatically.

## 1. What the app sends

A JSON POST body:

```json
{
  "secret": "whatever you set as VITE_ONEDRIVE_RELAY_SECRET",
  "fileName": "rehab-evaluator-audit-james_askew.html",
  "contentType": "text/html",
  "contentBase64": "<the report, base64-encoded>",
  "patientName": "James Askew",
  "disciplines": ["PT", "OT"],
  "generatedAt": "2026-09-04T18:22:00.000Z"
}
```

`contentBase64` decodes to the exact same self-contained HTML report the
"Export Audit" button downloads — same criteria, evidence, findings, goal
lifecycle, frequency analysis, everything.

## 2. Build the flow

1. Go to [make.powerautomate.com](https://make.powerautomate.com) → **Create** → **Instant cloud flow** → choose **"When an HTTP request is received"** as the trigger. Name it something like `Rehab Audit — Save to OneDrive`.
2. In the trigger's **Request Body JSON Schema**, paste:
   ```json
   {
     "type": "object",
     "properties": {
       "secret": { "type": "string" },
       "fileName": { "type": "string" },
       "contentType": { "type": "string" },
       "contentBase64": { "type": "string" },
       "patientName": { "type": "string" },
       "disciplines": { "type": "array", "items": { "type": "string" } },
       "generatedAt": { "type": "string" }
     }
   }
   ```
3. Add a **Condition** step right after the trigger: `secret` `is equal to` `<the same random string you'll put in VITE_ONEDRIVE_RELAY_SECRET>`. Put every following step inside the **Yes** branch — this is what stops random hits on the public URL from doing anything (see the security note below).
4. Inside the **Yes** branch, add a **Compose** step (optional but handy for debugging) or go straight to:
   - **Send an email (V2)** (Office 365 Outlook connector, authenticated as you or a shared mailbox):
     - **To:** the purehlth.com address you want these landing in
     - **Subject:** something like `Rehab Audit Report — @{triggerBody()?['patientName']}`
     - **Body:** whatever context is useful (patient name, disciplines, generated-at)
     - **Attachments — Name:** `@{triggerBody()?['fileName']}`
     - **Attachments — Content:** `@{base64ToBinary(triggerBody()?['contentBase64'])}`
   - **Create file** (OneDrive for Business connector) to save it directly to a folder, instead of or in addition to the email:
     - **Folder Path:** wherever you want these filed, e.g. `/Rehab Audits`
     - **File Name:** `@{triggerBody()?['fileName']}`
     - **File Content:** `@{base64ToBinary(triggerBody()?['contentBase64'])}`

   Using **Create file** directly means you don't need a second flow watching the mailbox for attachments — the same HTTP-triggered flow can both email a copy *and* save straight to OneDrive in one step each. If you'd rather keep the "email lands, then a mailbox-watching flow saves it to OneDrive" two-flow setup you described, that works too — just point the **Send an email (V2)** step at the mailbox your existing/second flow is already watching.
5. In the **Yes** branch's last step, add a **Response** action returning HTTP 200 so the app knows it succeeded (an empty 200 is fine). If you skip this and leave the **No** branch (or the whole flow) without a Response, Power Automate's default is a 200 anyway, but an explicit one on the **No** branch too (e.g. 403) means a bad/missing secret shows up in the app as an error message instead of a false "Sent" message.
6. Save the flow. Open the **"When an HTTP request is received"** trigger card again — after the first save, it shows the **HTTP POST URL**. Copy it.

## 3. Wire it into the app

You'll set two values — the URL from step 6, and a secret string you make up yourself (used only for the Condition check in step 3, not a Microsoft credential):

- **For your local dev copy** (`npm run dev`): create a file named `.env.local` in the project root (it's gitignored — never committed) with:
  ```
  VITE_ONEDRIVE_RELAY_URL=<the HTTP POST URL from step 6>
  VITE_ONEDRIVE_RELAY_SECRET=<a random string you choose>
  ```
  (`.env.example` in the repo shows the same two lines blank, as a template.) Restart `npm run dev` after adding it.
- **For the live GitHub Pages deployment**: in the GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add `ONEDRIVE_RELAY_URL` and `ONEDRIVE_RELAY_SECRET` with the same two values. The deploy workflow (`.github/workflows/deploy.yml`) already reads these and bakes them into the build — no other repo changes needed. The next push to `main` (or a manual re-run from the Actions tab) picks them up.

Once either is set, the **Save to OneDrive** button appears next to Export/Print automatically — no code change needed to turn it on.

## Security note (read this before turning it on)

This app is a public, unauthenticated static site. Both values above end up
readable in the deployed JavaScript by anyone who opens their browser's dev
tools — there's no way to hide a secret in a client-only app without a real
backend. The Condition-step check in step 3 is a basic deterrent against
someone stumbling onto the URL and triggering the flow by accident or
curiosity, not real security against someone who deliberately reads the
bundle and copies the secret. If that risk matters to you (the flow does
handle PHI-bearing report content), a few options if you want to tighten it
later: rotate the secret periodically, add rate-limiting or an IP allowlist
on the flow's trigger (Power Automate / Azure API Management support this),
or move to a real backend with proper auth. None of that is required to use
the feature — it's a "know before you flip it on" note, not a blocker.
