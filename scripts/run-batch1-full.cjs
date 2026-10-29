const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')

async function runBatch1Full() {
  console.log('=== RUNNING FULL BATCH 1: CUSTOMER & SUPPLIER LIFECYCLE ===')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  const results = {
    step: 'BATCH_1_CUSTOMER_LIFECYCLE',
    date: '2026-10-29',
    customer: { id: '2e39f4a3-329b-4993-a433-2ae59de40746', name: 'QA-2026-10-29-Cust1' },
    supplier: null,
    searchVerified: false,
    detailVerified: false,
    editVerified: false,
    deleteOrArchiveChecked: false,
    screenshots: [],
  }

  // 1. Go to /en/customers and verify Cust1 in list
  console.log('[1.1] Checking customer list...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-cust1-in-table.png' })
  results.screenshots.push('batch1-cust1-in-table.png')

  // 2. Search & filter test
  console.log('[1.2] Testing search filter for QA-2026-10-29-Cust1...')
  const searchInput = await page.$('input[placeholder*="Search"]')
  if (searchInput) {
    await searchInput.click()
    await page.type('input[placeholder*="Search"]', 'QA-2026-10-29-Cust1', { delay: 30 })
    await new Promise((r) => setTimeout(r, 1200))
    await page.screenshot({ path: 'docs/qa/screenshots/batch1-search-filter.png' })
    results.screenshots.push('batch1-search-filter.png')
    results.searchVerified = await page.evaluate(() =>
      document.body.innerText.includes('QA-2026-10-29-Cust1'),
    )
    console.log('Search verified:', results.searchVerified)
  }

  // 3. Open Customer Detail Page
  console.log('[1.3] Opening Customer Detail page...')
  await page.goto(`https://hisabche.com/en/customers/${results.customer.id}`, {
    waitUntil: 'domcontentloaded',
  })
  await new Promise((r) => setTimeout(r, 2500))
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-customer-detail.png' })
  results.screenshots.push('batch1-customer-detail.png')

  results.detailVerified = await page.evaluate(() => {
    return document.body.innerText.includes('QA-2026-10-29-Cust1')
  })
  console.log('Detail page verified:', results.detailVerified)

  // 4. Create Supplier: QA-2026-10-29-Supp1
  console.log('[1.4] Creating Supplier QA-2026-10-29-Supp1...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.innerText.includes('Add New Customer'),
    )
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 1000))

  // Select Supplier role in segmented control
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const buttons = [...(modal?.querySelectorAll('button') || [])]
    const suppBtn = buttons.find(
      (b) =>
        b.innerText.toLowerCase().includes('supplier') ||
        b.innerText.toLowerCase().includes('seller'),
    )
    if (suppBtn) suppBtn.click()
  })
  await new Promise((r) => setTimeout(r, 500))

  await page.waitForSelector('input[name="name"]', { visible: true })
  await page.click('input[name="name"]')
  await page.type('input[name="name"]', 'QA-2026-10-29-Supp1', { delay: 40 })

  // Click Submit
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  await new Promise((r) => setTimeout(r, 3000))
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-supplier-created.png' })
  results.screenshots.push('batch1-supplier-created.png')

  // Check Supplier tab
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const suppTab = tabs.find((t) => t.innerText === 'Supplier')
    if (suppTab) suppTab.click()
  })
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-supplier-tab-verified.png' })
  results.screenshots.push('batch1-supplier-tab-verified.png')

  const suppFound = await page.evaluate(() =>
    document.body.innerText.includes('QA-2026-10-29-Supp1'),
  )
  console.log('Supplier verified in table:', suppFound)
  results.supplier = { name: 'QA-2026-10-29-Supp1', verified: suppFound }

  // 5. Check Delete/Archive behavior
  console.log('[1.5] Checking delete/archive button on customer...')
  await page.goto(`https://hisabche.com/en/customers/${results.customer.id}`, {
    waitUntil: 'domcontentloaded',
  })
  await new Promise((r) => setTimeout(r, 2000))

  const actionsAvailable = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
      .map((b) => b.innerText.trim())
      .filter(Boolean)
    return btns
  })
  console.log('Customer detail actions:', actionsAvailable)
  results.deleteOrArchiveChecked = actionsAvailable.some(
    (a) =>
      a.toLowerCase().includes('delete') ||
      a.toLowerCase().includes('archive') ||
      a.toLowerCase().includes('edit'),
  )

  fs.writeFileSync('docs/qa/batch1-final-results.json', JSON.stringify(results, null, 2))
  console.log('=== BATCH 1 FULL WORKFLOW COMPLETE ===')
}

runBatch1Full().catch((err) => {
  console.error(err)
  process.exit(1)
})
