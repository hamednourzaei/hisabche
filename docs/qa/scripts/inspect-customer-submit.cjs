const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function inspectCustomerSubmit() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('response', async (res) => {
    if (res.url().includes('/api/customers')) {
      console.log('API RESPONSE:', res.status(), res.url())
      try {
        const body = await res.text()
        console.log('API BODY:', body)
      } catch (e) {}
    }
  })

  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  // Click Add
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find((b) => b.innerText.includes('Add New Customer'))
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 1000))

  // Fill
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const nameInput = modal?.querySelector('input[name="name"]')
    if (nameInput) {
      nameInput.value = 'QA-2026-10-29-Cust1'
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
      nameInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 500))

  // Click Save
  console.log('Clicking Save...')
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  await new Promise((r) => setTimeout(r, 3000))

  const modalStillOpen = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const err = modal?.querySelector('[role="alert"]')?.innerText || ''
    return { open: !!modal, error: err }
  })
  console.log('Modal status after save:', modalStillOpen)
}

inspectCustomerSubmit().catch((err) => {
  console.error(err)
  process.exit(1)
})
