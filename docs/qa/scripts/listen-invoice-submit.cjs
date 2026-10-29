const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()))
  page.on('response', (res) => {
    if (res.url().includes('/api/') || res.url().includes('/invoices')) {
      console.log('HTTP RESPONSE:', res.status(), res.url())
    }
  })

  console.log('Clicking the green confirm button...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter(
      (b) => b.innerText.includes('Confirm and create invoice') && !b.disabled,
    )
    // Click the bottom primary button
    const btn = btns[btns.length - 1]
    if (btn) btn.click()
  })

  await new Promise((r) => setTimeout(r, 6000))
  console.log('Current URL after click:', page.url())

  const toasts = await page.evaluate(() => {
    return [
      ...document.querySelectorAll('[role="status"], [role="alert"], [data-sonner-toast]'),
    ].map((t) => t.innerText)
  })
  console.log('Toasts/alerts:', toasts)

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
