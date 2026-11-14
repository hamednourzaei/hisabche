// apps/web/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3000',
    channel: 'chrome',
    headless: true, // ✅ بدون باز کردن پنجره
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { channel: 'chrome' } }],
})
