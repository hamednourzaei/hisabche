const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-14-invoice-detail-live.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-14-invoice-detail-live.png')

  const invoiceDetails = await page.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.slice(0, 2000),
    }
  })

  console.log('Invoice Details Title:', invoiceDetails.title)
  console.log('Invoice URL:', invoiceDetails.url)
  console.log('Invoice Text:', invoiceDetails.text)

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
