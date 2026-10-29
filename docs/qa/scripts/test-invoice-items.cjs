const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  await page.goto('https://hisabche.com/en/invoices/new', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  // 1. Select Customer
  console.log('[1] Selecting customer QA-2026-10-29-Cust1...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const custBtn = btns.find((b) => b.innerText.includes('Select customer'))
    if (custBtn) custBtn.click()
  })
  await new Promise((r) => setTimeout(r, 1000))

  const searchInput = await page.$('input[placeholder="Search..."]')
  if (searchInput) {
    await searchInput.type('QA-2026-10-29-Cust1', { delay: 30 })
    await new Promise((r) => setTimeout(r, 1000))

    // Click the matching customer item
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('*')]
      const item = items.find(
        (el) => el.children.length === 0 && (el.innerText || '').includes('QA-2026-10-29-Cust1'),
      )
      if (item) {
        ;(item.closest('button') || item.closest('div') || item).click()
      }
    })
  }
  await new Promise((r) => setTimeout(r, 1500))

  // 2. Select Product
  console.log('[2] Selecting product QA-2026-10-29-Prod1...')
  const prodInput = await page.$('input[placeholder*="pick from stock"]')
  if (prodInput) {
    await prodInput.click()
    await prodInput.type('QA-2026-10-29-Prod1', { delay: 30 })
    await new Promise((r) => setTimeout(r, 1000))

    // Click the matching dropdown item
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('*')]
      const item = items.find(
        (el) => el.children.length === 0 && (el.innerText || '').includes('QA-2026-10-29-Prod1'),
      )
      if (item) {
        ;(item.closest('button') || item.closest('li') || item).click()
      }
    })
  }
  await new Promise((r) => setTimeout(r, 1500))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-03-items-entered.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-03-items-entered.png')

  // Check current invoice calculations in DOM
  const invoiceData = await page.evaluate(() => {
    return {
      text: document.body.innerText.slice(0, 1500),
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
    }
  })
  console.log('Invoice text:', invoiceData.text.slice(0, 500))

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
