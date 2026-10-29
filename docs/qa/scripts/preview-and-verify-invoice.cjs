const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  console.log('=== PREPARING INVOICE DRAFT & PREVIEW ===')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  // 1. Set full draft state in localStorage
  await page.evaluate(() => {
    const raw = localStorage.getItem('hisabche-invoice-draft')
    if (!raw) return
    const parsed = JSON.parse(raw)
    parsed.state.rows = [
      {
        id: 'rmvsa71v91',
        values: {
          description: 'QA-2026-10-29-Prod1',
          quantity: '2',
          unit: 'piece',
          unitPrice: '80',
          lineTotal: '160',
        },
      },
    ]
    parsed.state.isPaid = false // Unpaid so we test customer debt delta!
    parsed.state.paidNow = '0'
    localStorage.setItem('hisabche-invoice-draft', JSON.stringify(parsed))
  })

  // 2. Navigate to /en/invoices/new/preview
  console.log('Navigating to /en/invoices/new/preview...')
  await page.goto('https://hisabche.com/en/invoices/new/preview', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-10-preview-rendered.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-10-preview-rendered.png')

  const previewData = await page.evaluate(() => {
    return {
      title: document.title,
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
      textSnippet: document.body.innerText.slice(0, 1500),
    }
  })

  console.log('Preview Page Title:', previewData.title)
  console.log('Buttons:', previewData.buttons)
  console.log('Text snippet:', previewData.textSnippet.slice(0, 500))

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
