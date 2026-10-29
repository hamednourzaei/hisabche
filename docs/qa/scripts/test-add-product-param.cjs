const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.goto('https://hisabche.com/en/warehouse?add=true', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  const modalInfo = await page.evaluate(() => {
    const nameInput = document.querySelector('#product-name')
    return {
      nameInputFound: !!nameInput,
      dialogTitle: document.querySelector('[role="dialog"] h2')?.innerText,
      allInputs: [...document.querySelectorAll('input')].map((i) => ({
        id: i.id,
        name: i.name,
        placeholder: i.placeholder,
      })),
    }
  })

  console.log('Modal Info:', modalInfo)
  await page.screenshot({ path: 'docs/qa/screenshots/batch2-add-product-modal-open.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch2-add-product-modal-open.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
