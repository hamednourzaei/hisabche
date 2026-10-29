const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  console.log('=== CREATING PRODUCT: QA-2026-10-29-Prod1 ===')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  await page.goto('https://hisabche.com/en/warehouse?add=true', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  await page.waitForSelector('#product-name', { visible: true })

  // Fill in form fields
  await page.click('#product-name')
  await page.type('#product-name', 'QA-2026-10-29-Prod1', { delay: 30 })

  await page.click('#product-barcode')
  await page.type('#product-barcode', 'QA-BAR-20261029-01', { delay: 30 })

  // Quantity: 20
  await page.click('#product-quantity')
  // Select all and replace
  await page.keyboard.down('Control')
  await page.keyboard.press('A')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type('#product-quantity', '20', { delay: 30 })

  // Buy Price: 50
  await page.click('#product-buy-price')
  await page.keyboard.down('Control')
  await page.keyboard.press('A')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type('#product-buy-price', '50', { delay: 30 })

  // Sell Price: 80
  await page.click('#product-sell-price')
  await page.keyboard.down('Control')
  await page.keyboard.press('A')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type('#product-sell-price', '80', { delay: 30 })

  await new Promise((r) => setTimeout(r, 500))
  await page.screenshot({ path: 'docs/qa/screenshots/batch2-01-form-filled.png' })
  console.log('Screenshot: batch2-01-form-filled.png')

  // Click Submit button inside the modal dialog
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const submitBtn = dialog?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })

  // Wait for submission response
  await new Promise((r) => setTimeout(r, 3500))
  await page.screenshot({ path: 'docs/qa/screenshots/batch2-02-after-submit.png' })
  console.log('Screenshot: batch2-02-after-submit.png')

  // Verify product in Products tab
  await page.goto('https://hisabche.com/en/warehouse', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const tab = tabs.find((t) => t.innerText.trim() === 'Products')
    if (tab) tab.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  const pageText = await page.evaluate(() => document.body.innerText)
  const productFound = pageText.includes('QA-2026-10-29-Prod1')
  console.log('Product in list:', productFound)

  await page.screenshot({ path: 'docs/qa/screenshots/batch2-03-product-verified-in-list.png' })
  console.log('Screenshot: batch2-03-product-verified-in-list.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
