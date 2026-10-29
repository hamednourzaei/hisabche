const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.goto('https://hisabche.com/en/invoices/new', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  // Find and click Select customer button
  console.log('Clicking Select customer button...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const custBtn = btns.find((b) => b.innerText.includes('Select customer'))
    if (custBtn) custBtn.click()
  })
  await new Promise((r) => setTimeout(r, 1500))

  const popover = await page.evaluate(() => {
    return {
      inputs: [...document.querySelectorAll('input')].map((i) => ({
        placeholder: i.placeholder,
        value: i.value,
      })),
      visibleText: document.body.innerText.slice(0, 1000),
    }
  })

  console.log('Popover Inputs:', popover.inputs)
  await page.screenshot({ path: 'docs/qa/screenshots/batch3-02-customer-picker.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-02-customer-picker.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
