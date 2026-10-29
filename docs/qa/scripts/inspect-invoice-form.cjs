const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.goto('https://hisabche.com/en/invoices/new', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  const formInfo = await page.evaluate(() => {
    return {
      title: document.title,
      inputs: [...document.querySelectorAll('input')].map((i) => ({
        id: i.id,
        placeholder: i.placeholder,
        name: i.name,
        type: i.type,
      })),
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
    }
  })

  console.log('Title:', formInfo.title)
  console.log('Inputs:', formInfo.inputs)
  console.log('Buttons:', formInfo.buttons)

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-01-new-invoice-page.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-01-new-invoice-page.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
