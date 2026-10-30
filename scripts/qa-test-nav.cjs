const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function testWalk() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const targets = browser.targets()
  const hisabcheTarget = targets.find((t) => t.url().includes('hisabche.com'))
  if (!hisabcheTarget) {
    console.error('Target not found')
    process.exit(1)
  }

  const page = await hisabcheTarget.page()
  console.log('Connected. Current URL:', page.url())

  // Test navigating to /en/customers
  console.log('Navigating to /en/customers...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'networkidle2' })
  console.log('Landed on:', page.url())
  console.log('Page Title:', await page.title())

  await new Promise((r) => setTimeout(r, 2000))

  const screenshotPath = path.resolve('docs/qa/screenshots/desktop-customers.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log('Screenshot saved to:', screenshotPath)

  // Navigate back to /en/dashboard
  await page.goto('https://hisabche.com/en/dashboard', { waitUntil: 'networkidle2' })
  console.log('Back on:', page.url())

  await browser.disconnect()
}

testWalk().catch((err) => {
  console.error('Test walk failed:', err)
  process.exit(1)
})
