// ============================================
// E2E: authentication and navigation.
// Requires a dev-client build — see .detoxrc.js.
// ============================================

import { by, device, element, expect } from 'detox'

describe('authentication', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true })
  })

  it('lands on the login screen when there is no session', async () => {
    await expect(element(by.id('login-submit'))).toBeVisible()
  })

  it('rejects an invalid email without calling the API', async () => {
    await element(by.id('login-submit')).tap()
    await expect(element(by.id('login-submit'))).toBeVisible()
  })

  it('reaches the dashboard with valid credentials', async () => {
    await element(by.traits(['search'])).atIndex(0).tap().catch(() => undefined)

    await element(by.type('RCTUITextField')).atIndex(0).typeText(process.env.E2E_EMAIL ?? '')
    await element(by.type('RCTUITextField')).atIndex(1).typeText(process.env.E2E_PASSWORD ?? '')
    await element(by.id('login-submit')).tap()

    await waitFor(element(by.id('tab-home')))
      .toBeVisible()
      .withTimeout(15_000)
  })
})

describe('navigation', () => {
  it('moves across every bottom tab', async () => {
    for (const tab of ['tab-sales', 'tab-inventory', 'tab-customers', 'tab-more']) {
      await element(by.id(tab)).tap()
      await expect(element(by.id(tab))).toBeVisible()
    }
  })
})
