import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base must match the GitHub Pages URL path: mcoajoycemartin.github.io/RehabEvaluationAudit/
// (a repo-page site, not a user/org root site) — otherwise the built JS/CSS/worker
// assets 404 because they'd be requested from the domain root instead of the subpath.
export default defineConfig({
  base: '/RehabEvaluationAudit/',
  plugins: [react()],
})
