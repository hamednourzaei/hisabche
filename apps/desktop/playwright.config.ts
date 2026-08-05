import { defineConfig } from '@playwright/test'

/** Electron E2E. Requires `npm run build` first — it launches out/main. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
})
