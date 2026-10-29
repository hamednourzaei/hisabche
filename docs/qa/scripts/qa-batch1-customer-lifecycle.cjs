const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function runBatch1() {
  console.log('=== BATCH 1: CUSTOMER & SUPPLIER LIFECYCLE ===')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  if (!target) {
    console.error('Target not found')
    process.exit(1)
  }

  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  const results = {
    step: 'BATCH_1_CUSTOMER_LIFECYCLE',
    date: '2026-10-29',
    validations: [],
    createdRecords: [],
    searchResults: {},
    editResults: {},
    detailResults: {},
    deleteResults: {},
    screenshots: [],
  }

  // 1. Navigate to /en/customers
  console.log('[1.1] Navigating to /en/customers...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  await page.screenshot({ path: 'docs/qa/screenshots/batch1-01-customers-list.png' })
  results.screenshots.push('batch1-01-customers-list.png')

  // 2. Open Add Customer Modal
  console.log('[1.2] Opening Add Customer dialog...')
  const addBtnClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find(
      (b) => b.innerText.includes('Add New Customer') || b.innerText.includes('Add party'),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  console.log('Add button clicked:', addBtnClicked)
  await new Promise((r) => setTimeout(r, 1200))

  await page.screenshot({ path: 'docs/qa/screenshots/batch1-02-modal-opened.png' })
  results.screenshots.push('batch1-02-modal-opened.png')

  // 3. Validation: Empty required name
  console.log('[1.3] Testing empty required name validation...')
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  await new Promise((r) => setTimeout(r, 800))

  const emptyErr = await page.evaluate(() => {
    const alert = document.querySelector('[role="dialog"] [role="alert"]')
    return alert ? alert.innerText.trim() : ''
  })
  console.log('Validation Error (Empty):', emptyErr)
  results.validations.push({
    field: 'name',
    rule: 'required',
    input: '',
    observedError: emptyErr,
    status:
      emptyErr.includes('Required') ||
      emptyErr.includes('required') ||
      emptyErr.includes('nameRequired')
        ? 'PASS'
        : 'FAIL',
  })
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-03-validation-empty.png' })
  results.screenshots.push('batch1-03-validation-empty.png')

  // 4. Validation: Whitespace only
  console.log('[1.4] Testing whitespace-only name...')
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const nameInput = modal?.querySelector('input[name="name"]')
    if (nameInput) {
      nameInput.value = '   '
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
      nameInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  await new Promise((r) => setTimeout(r, 800))

  const whitespaceErr = await page.evaluate(() => {
    const alert = document.querySelector('[role="dialog"] [role="alert"]')
    return alert ? alert.innerText.trim() : ''
  })
  console.log('Validation Error (Whitespace):', whitespaceErr)
  results.validations.push({
    field: 'name',
    rule: 'non-empty-string',
    input: '   ',
    observedError: whitespaceErr,
    status: whitespaceErr ? 'PASS' : 'FAIL',
  })

  // 5. Create Customer: QA-2026-10-29-Cust1
  console.log('[1.5] Submitting valid customer: QA-2026-10-29-Cust1...')
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const nameInput = modal?.querySelector('input[name="name"]')
    if (nameInput) {
      nameInput.value = 'QA-2026-10-29-Cust1'
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
      nameInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const telInput = modal?.querySelector('input[type="tel"]')
    if (telInput) {
      telInput.value = '0701234567'
      telInput.dispatchEvent(new Event('input', { bubbles: true }))
      telInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  await new Promise((r) => setTimeout(r, 3000))

  await page.screenshot({ path: 'docs/qa/screenshots/batch1-04-customer-submitted.png' })
  results.screenshots.push('batch1-04-customer-submitted.png')

  // Reload page to verify persistence
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  const cust1Found = await page.evaluate(() => {
    return document.body.innerText.includes('QA-2026-10-29-Cust1')
  })
  console.log('Customer QA-2026-10-29-Cust1 visible after reload:', cust1Found)
  results.createdRecords.push({
    type: 'Customer',
    id: 'QA-2026-10-29-Cust1',
    phone: '0701234567',
    role: 'buyer',
    persisted: cust1Found,
  })

  // 6. Create Supplier: QA-2026-10-29-Supp1
  console.log('[1.6] Opening dialog to create Supplier...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find(
      (b) => b.innerText.includes('Add New Customer') || b.innerText.includes('Add party'),
    )
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 1200))

  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    // Click supplier / seller tab
    const buttons = [...(modal?.querySelectorAll('button') || [])]
    const sellerBtn = buttons.find(
      (b) =>
        b.innerText.toLowerCase().includes('supplier') ||
        b.innerText.toLowerCase().includes('seller'),
    )
    if (sellerBtn) sellerBtn.click()

    const nameInput = modal?.querySelector('input[name="name"]')
    if (nameInput) {
      nameInput.value = 'QA-2026-10-29-Supp1'
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
      nameInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const telInput = modal?.querySelector('input[type="tel"]')
    if (telInput) {
      telInput.value = '0709876543'
      telInput.dispatchEvent(new Event('input', { bubbles: true }))
      telInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  await new Promise((r) => setTimeout(r, 3000))

  await page.screenshot({ path: 'docs/qa/screenshots/batch1-05-supplier-submitted.png' })
  results.screenshots.push('batch1-05-supplier-submitted.png')

  // Check Supplier tab
  console.log('[1.7] Checking Supplier tab...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const suppTab = tabs.find((t) => t.innerText === 'Supplier')
    if (suppTab) suppTab.click()
  })
  await new Promise((r) => setTimeout(r, 1500))

  const suppFound = await page.evaluate(() => {
    return document.body.innerText.includes('QA-2026-10-29-Supp1')
  })
  console.log('Supplier QA-2026-10-29-Supp1 visible in Supplier tab:', suppFound)
  results.createdRecords.push({
    type: 'Supplier',
    id: 'QA-2026-10-29-Supp1',
    phone: '0709876543',
    role: 'seller',
    persisted: suppFound,
  })
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-06-supplier-tab.png' })
  results.screenshots.push('batch1-06-supplier-tab.png')

  // 7. Search & Filter test
  console.log('[1.8] Testing search filter...')
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const allTab = tabs.find((t) => t.innerText === 'All')
    if (allTab) allTab.click()
  })
  await new Promise((r) => setTimeout(r, 1000))

  const searchTested = await page.evaluate(() => {
    const searchInput = document.querySelector('input[placeholder*="Search"]')
    if (searchInput) {
      searchInput.value = 'QA-2026-10-29-Cust1'
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      searchInput.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return false
  })
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: 'docs/qa/screenshots/batch1-07-search-filtered.png' })
  results.screenshots.push('batch1-07-search-filtered.png')
  results.searchResults = {
    searchFieldFound: searchTested,
    query: 'QA-2026-10-29-Cust1',
  }

  fs.writeFileSync('docs/qa/batch1-results.json', JSON.stringify(results, null, 2))
  console.log('=== BATCH 1 COMPLETED. Results written to docs/qa/batch1-results.json ===')
}

runBatch1().catch((err) => {
  console.error('Batch 1 error:', err)
  process.exit(1)
})
