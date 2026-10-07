import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  { width: 375, height: 812, name: 'mobile-portrait' },
  { width: 768, height: 1024, name: 'tablet-portrait' },
  { width: 1024, height: 1366, name: 'tablet-landscape' },
  { width: 1440, height: 900, name: 'desktop' },
]

const PAGES_TO_TEST = [
  '/en/market',
  '/fa/market',
  // Normally we would test authenticated routes here, but since this is a static layout check on public pages or a mock setup:
]

test.describe('Responsive Global Horizontal Overflow', () => {
  for (const viewport of VIEWPORTS) {
    for (const pagePath of PAGES_TO_TEST) {
      test(`no horizontal overflow on ${pagePath} at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(pagePath)

        // Let animations settle
        await page.waitForTimeout(500)

        // Check horizontal overflow
        const overflowStatus = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }
        })

        expect(
          overflowStatus.scrollWidth,
          `Horizontal overflow detected on ${pagePath} at ${viewport.name}: scrollWidth (${overflowStatus.scrollWidth}) > clientWidth (${overflowStatus.clientWidth})`,
        ).toBeLessThanOrEqual(overflowStatus.clientWidth)
      })
    }
  }
})
