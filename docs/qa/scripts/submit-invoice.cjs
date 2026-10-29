const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  console.log('=== SUBMITTING INVOICE ===')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  // 1. Screenshot before submit
  await page.screenshot({ path: 'docs/qa/screenshots/batch3-11-before-submit.png' })
  console.log('Screenshot: batch3-11-before-submit.png')

  // 2. Click "Confirm and create invoice"
  console.log('Clicking "Confirm and create invoice"...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter(
      (b) => b.innerText.includes('Confirm and create invoice') && !b.disabled,
    )
    if (btns.length > 0) {
      btns[0].click()
    }
  })

  // 3. Wait for navigation or response
  console.log('Waiting for creation response...')
  await new Promise((r) => setTimeout(r, 5000))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-12-invoice-created.png' })
  console.log('Screenshot: batch3-12-invoice-created.png')

  const postState = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      textSnippet: document.body.innerText.slice(0, 1500),
    }
  })

  console.log('Created URL:', postState.url)
  console.log('Created Title:', postState.title)
  console.log('Text snippet:', postState.textSnippet.slice(0, 500))

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
