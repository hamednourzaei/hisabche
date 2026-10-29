const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function testReactType() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

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

  // Open modal
  const addBtn = await page.$('button ::-p-text(Add New Customer)')
  if (addBtn) await addBtn.click()
  else {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((btn) =>
        btn.innerText.includes('Add New Customer'),
      )
      if (b) b.click()
    })
  }
  await new Promise((r) => setTimeout(r, 1000))

  // Focus and type into input
  const nameSelector = 'input[name="name"]'
  await page.waitForSelector(nameSelector, { visible: true })
  await page.click(nameSelector)
  await page.type(nameSelector, 'QA-2026-10-29-Cust1', { delay: 50 })
  console.log('Typed QA-2026-10-29-Cust1')
  await new Promise((r) => setTimeout(r, 500))

  // Click submit
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const submitBtn = modal?.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.click()
  })
  console.log('Clicked Save!')
  await new Promise((r) => setTimeout(r, 3000))

  const status = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    const alert = modal?.querySelector('[role="alert"]')?.innerText || ''
    const text = document.body.innerText
    return {
      modalOpen: !!modal,
      error: alert,
      foundInTable: text.includes('QA-2026-10-29-Cust1'),
    }
  })
  console.log('Result:', status)
}

testReactType().catch((err) => {
  console.error(err)
  process.exit(1)
})
