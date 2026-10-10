import { chromium } from 'playwright'

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'ipad', width: 820, height: 1180 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'desktop', width: 1920, height: 1080 },
  ]

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height })

    // Go to BEFORE
    await page.goto('http://localhost:3039/fa')
    // Assuming we have to click the BEFORE button.
    // Let's just click it based on text.
    await page.waitForTimeout(2000) // wait for load
    await page.click('button:has-text("BEFORE")').catch(() => {})
    await page.waitForTimeout(500)
    await page.screenshot({ path: `screenshots/before-${vp.name}.png`, fullPage: true })

    // Go to AFTER
    await page.click('button:has-text("AFTER")').catch(() => {})
    await page.waitForTimeout(500)
    await page.screenshot({ path: `screenshots/after-${vp.name}.png`, fullPage: true })

    // Go to SPLIT
    if (vp.width >= 820) {
      // Split doesn't make sense on tiny mobile
      await page.click('button:has-text("SPLIT")').catch(() => {})
      await page.waitForTimeout(500)
      await page.screenshot({ path: `screenshots/split-${vp.name}.png`, fullPage: true })
    }
  }

  await browser.close()
})()
