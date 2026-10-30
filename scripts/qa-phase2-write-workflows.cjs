const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function runWriteWorkflows() {
  console.log('--- STARTING QA PHASE 2 WRITE WORKFLOWS ---')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
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
    timestamp: new Date().toISOString(),
    workflows: [],
  }

  // ==========================================
  // WORKFLOW 1: Customer & Supplier Lifecycle
  // ==========================================
  console.log('\n[WF1] Starting Customer & Supplier Lifecycle...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  // Find Add Customer button
  console.log('[WF1] Looking for Add Customer button...')
  const addBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')]
    return btns.find(
      (b) =>
        b.innerText.includes('Add party') ||
        b.innerText.includes('Add Customer') ||
        b.innerText.includes('افزودن طرف حساب'),
    )
  })

  if (addBtn && (await addBtn.evaluate((b) => !!b))) {
    console.log('[WF1] Clicking Add Customer button...')
    await addBtn.click()
    await new Promise((r) => setTimeout(r, 1500))

    // Check modal opened
    const modalInfo = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]')
      if (!modal) return { open: false }
      const nameInput = modal.querySelector('input[name="name"]')
      const telInput = modal.querySelector('input[type="tel"]')
      const submitBtn = modal.querySelector('button[type="submit"]')
      return {
        open: true,
        title: modal.querySelector('h2, [class*="DialogTitle"]')?.innerText || '',
        hasName: !!nameInput,
        hasTel: !!telInput,
        hasSubmit: !!submitBtn,
      }
    })
    console.log('[WF1] Modal info:', modalInfo)

    if (modalInfo.open && modalInfo.hasName) {
      // 1. Safe validation test: empty submit
      console.log('[WF1] Testing empty submit validation...')
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]')
        const submitBtn = modal.querySelector('button[type="submit"]')
        submitBtn.click()
      })
      await new Promise((r) => setTimeout(r, 800))

      const valError = await page.evaluate(() => {
        return document.querySelector('[role="dialog"] [role="alert"]')?.innerText || ''
      })
      console.log('[WF1] Validation error on empty submit:', valError)

      // 2. Safe validation test: whitespace only
      console.log('[WF1] Testing whitespace validation...')
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]')
        const nameInput = modal.querySelector('input[name="name"]')
        nameInput.value = '   '
        nameInput.dispatchEvent(new Event('input', { bubbles: true }))
        modal.querySelector('button[type="submit"]').click()
      })
      await new Promise((r) => setTimeout(r, 800))

      // 3. Fill valid customer data: QA-2026-10-28-Cust1
      console.log('[WF1] Entering valid customer data: QA-2026-10-28-Cust1...')
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]')
        const nameInput = modal.querySelector('input[name="name"]')
        nameInput.value = 'QA-2026-10-28-Cust1'
        nameInput.dispatchEvent(new Event('input', { bubbles: true }))
        nameInput.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await new Promise((r) => setTimeout(r, 500))

      // Submit
      console.log('[WF1] Submitting customer form...')
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]')
        const submitBtn = modal.querySelector('button[type="submit"]')
        submitBtn.click()
      })
      await new Promise((r) => setTimeout(r, 3000))

      // Check if created
      const customerCreated = await page.evaluate(() => {
        const bodyText = document.body.innerText
        return bodyText.includes('QA-2026-10-28-Cust1')
      })
      console.log('[WF1] Customer QA-2026-10-28-Cust1 appears in table:', customerCreated)
      await page.screenshot({ path: 'docs/qa/screenshots/wf1-customer-created.png' })

      results.workflows.push({
        id: 'WF1_CUSTOMER',
        name: 'Customer Creation',
        record: 'QA-2026-10-28-Cust1',
        type: 'customer',
        created: customerCreated,
        validationTested: valError,
        screenshot: 'wf1-customer-created.png',
      })

      // Now create Supplier: QA-2026-10-28-Supp1
      console.log('[WF1] Re-opening dialog to create Supplier...')
      const addBtn2 = await page.evaluateHandle(() => {
        const btns = [...document.querySelectorAll('button')]
        return btns.find(
          (b) =>
            b.innerText.includes('Add party') ||
            b.innerText.includes('Add Customer') ||
            b.innerText.includes('افزودن طرف حساب'),
        )
      })
      if (addBtn2) {
        await addBtn2.click()
        await new Promise((r) => setTimeout(r, 1500))

        // Select 'seller' role
        await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]')
          const buttons = [...modal.querySelectorAll('button')]
          const sellerBtn = buttons.find(
            (b) =>
              b.innerText.toLowerCase().includes('seller') ||
              b.innerText.toLowerCase().includes('supplier') ||
              b.innerText.includes('فروشنده'),
          )
          if (sellerBtn) sellerBtn.click()

          const nameInput = modal.querySelector('input[name="name"]')
          nameInput.value = 'QA-2026-10-28-Supp1'
          nameInput.dispatchEvent(new Event('input', { bubbles: true }))
          nameInput.dispatchEvent(new Event('change', { bubbles: true }))
        })
        await new Promise((r) => setTimeout(r, 500))

        await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]')
          modal.querySelector('button[type="submit"]').click()
        })
        await new Promise((r) => setTimeout(r, 3000))

        const supplierCreated = await page.evaluate(() => {
          return document.body.innerText.includes('QA-2026-10-28-Supp1')
        })
        console.log('[WF1] Supplier QA-2026-10-28-Supp1 appears in table:', supplierCreated)
        await page.screenshot({ path: 'docs/qa/screenshots/wf1-supplier-created.png' })

        results.workflows.push({
          id: 'WF1_SUPPLIER',
          name: 'Supplier Creation',
          record: 'QA-2026-10-28-Supp1',
          type: 'supplier',
          created: supplierCreated,
          screenshot: 'wf1-supplier-created.png',
        })
      }
    }
  } else {
    console.warn('[WF1] Add Customer button not found on /en/customers')
  }

  fs.writeFileSync('docs/qa/wf1-results.json', JSON.stringify(results, null, 2))
  console.log('[WF1] Finished. Results saved to docs/qa/wf1-results.json')
}

runWriteWorkflows().catch((err) => {
  console.error('WF Error:', err)
  process.exit(1)
})
