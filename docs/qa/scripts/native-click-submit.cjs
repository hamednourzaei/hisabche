const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()))
  page.on('request', (req) => {
    if (req.url().includes('/api/')) console.log('HTTP REQUEST:', req.method(), req.url())
  })
  page.on('response', (res) => {
    if (res.url().includes('/api/')) console.log('HTTP RESPONSE:', res.status(), res.url())
  })

  // Find the button handle in puppeteer
  const buttons = await page.$$('button')
  let targetBtn = null
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.innerText, b)
    const disabled = await page.evaluate((el) => el.disabled, b)
    if (text.includes('Confirm and create invoice') && !disabled) {
      targetBtn = b
      break
    }
  }

  if (!targetBtn) {
    console.error('Target button not found or disabled')
    await browser.disconnect()
    return
  }

  console.log('Found enabled target button, clicking natively with Puppeteer...')
  await targetBtn.click()

  console.log('Waiting 10s for network...')
  await new Promise((r) => setTimeout(r, 10000))

  console.log('Current URL:', page.url())
  await page.screenshot({ path: 'docs/qa/screenshots/batch3-13-after-native-click.png' })

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
