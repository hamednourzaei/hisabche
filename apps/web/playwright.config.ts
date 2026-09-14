// apps/web/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'https://hisabche.com',
    channel: 'chrome',
    headless: true, // ✅ بدون باز کردن پنجره
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { channel: 'chrome' } }],
})
