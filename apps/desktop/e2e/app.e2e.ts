// ============================================
// Playwright Electron E2E.
// Run after `npm run build` — it launches the compiled main process.
// ============================================

import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(__dirname, '..', 'out', 'main', 'index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  })
  page = await app.firstWindow()
})

test.afterAll(async () => {
  await app.close()
})

test('opens a window with the login screen', async () => {
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.getByRole('button', { name: /ورود|Sign in/ })).toBeVisible()
})

test('renderer has no Node access', async () => {
  const exposure = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    bridge: typeof (window as unknown as { hisabche?: unknown }).hisabche,
  }))

  expect(exposure.require).toBe('undefined')
  expect(exposure.process).toBe('undefined')
  expect(exposure.bridge).toBe('object')
})

test('rejects an IPC payload that fails validation', async () => {
  const rejected = await page.evaluate(async () => {
    try {
      // `secrets` is not in the allow-listed table enum.
      await (window as unknown as {
        hisabche: { db: { query: (input: unknown) => Promise<unknown> } }
      }).hisabche.db.query({ table: 'secrets' })
      return false
    } catch {
      return true
    }
  })

  expect(rejected).toBe(true)
})

test('reports app info through the bridge', async () => {
  const info = await page.evaluate(async () =>
    (window as unknown as {
      hisabche: { app: { info: () => Promise<{ version: string; platform: string }> } }
    }).hisabche.app.info()
  )

  expect(info.version).toMatch(/\d+\.\d+\.\d+/)
  expect(info.platform.length).toBeGreaterThan(0)
})
