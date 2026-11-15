// ============================================
// apps/web/playwright.journey.config.ts
//
// The browser journeys (e2e/journey-industries.spec.ts) — LOCALHOST ONLY.
// Starts (or reuses) two servers:
//   - the journey backend: the real Fastify app on a real PostgreSQL that carries every
//     docs/ migration (backend/src/__tests__/helpers/journey-server.ts). Needs either the
//     embedded-postgres binary or PGLITE_DIR (a folder with @electric-sql/pglite);
//   - the web app (`next dev`) pointed at it.
// Nothing here can reach production: the backend never reads backend/.env, and the web
// app's API URL is overridden to the local backend.
//
//   PGLITE_DIR=<pglite folder> npx playwright test -c playwright.journey.config.ts
// ============================================
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

const API_PORT = process.env.JOURNEY_API_PORT ?? '4100'

export default defineConfig({
  testDir: './e2e',
  testMatch: /journey-industries\.spec\.ts$/,
  // Outside the repository: acceptance reads `git status` AFTER the run, and screenshots or
  // .last-run.json left in apps/web/test-results would make the evidence «dirty».
  outputDir: join(tmpdir(), 'hisabche-journey-results'),
  timeout: 600_000,
  retries: 0,
  workers: Number(process.env.JOURNEY_WORKERS ?? 4),
  reporter: [['line'], ['json', { outputFile: join(tmpdir(), 'hisabche-journey-results.json') }]],
  use: {
    channel: 'chrome',
    headless: true,
    locale: 'fa-IR',
    // An Afghan shop owner's clock. The machine running the tests may sit anywhere (one was
    // UTC-6, where «today» in the report ended before the server's UTC date of the sale).
    timezoneId: 'Asia/Kabul',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { channel: 'chrome' } }],
  webServer: [
    {
      command: 'npx tsx src/__tests__/helpers/journey-server.ts',
      cwd: '../../backend',
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: {
        JOURNEY_API_PORT: API_PORT,
        ...(process.env.PGLITE_DIR ? { PGLITE_DIR: process.env.PGLITE_DIR } : {}),
      },
      timeout: 300_000,
      reuseExistingServer: true,
    },
    {
      command: 'npx next dev -p 3039 -H 127.0.0.1',
      url: 'http://localhost:3039/fa/signup',
      env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}/api` },
      timeout: 300_000,
      reuseExistingServer: true,
    },
  ],
})
