// ============================================
// E2E: invoice creation, online and offline.
// ============================================

import { by, device, element, expect, waitFor } from 'detox'

describe('invoice creation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: false })
    await element(by.id('tab-invoices')).tap()
  })

  it('opens the create screen from the floating button', async () => {
    await element(by.id('fab-new-invoice')).tap()
    await expect(element(by.id('invoice-save'))).toBeVisible()
  })

  it('refuses to submit without line items', async () => {
    await element(by.id('invoice-save')).tap()
    await expect(element(by.id('invoice-save'))).toBeVisible()
  })

  it('adds a product through the picker sheet', async () => {
    await element(by.id('add-item')).tap()
    await waitFor(element(by.id('product-picker')))
      .toBeVisible()
      .withTimeout(8_000)

    await element(by.id('product-option-0')).tap()
    await element(by.id('confirm-item')).tap()

    await expect(element(by.id('line-item-0'))).toBeVisible()
  })
})

describe('offline sync', () => {
  it('queues an invoice while offline and drains it on reconnect', async () => {
    await device.setStatusBar({ dataNetwork: 'hide' })
    await device.disableSynchronization()

    await element(by.id('invoice-save')).tap()

    await element(by.id('tab-more')).tap()
    await element(by.id('nav-settings')).tap()
    await element(by.id('open-sync')).tap()
    await expect(element(by.id('sync-entry-0'))).toBeVisible()

    await device.enableSynchronization()
    await element(by.id('sync-now')).tap()

    await waitFor(element(by.id('sync-empty')))
      .toBeVisible()
      .withTimeout(20_000)
  })
})
