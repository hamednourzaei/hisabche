const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  console.log('Focusing Qty input and typing 2...')
  await page.evaluate(() => {
    const table = document.querySelector('table')
    const row0 = table.querySelectorAll('tbody tr')[0]
    const inputs = row0.querySelectorAll('input')
    inputs[1].focus()
  })
  await page.keyboard.press('2')
  await new Promise((r) => setTimeout(r, 600))

  console.log('Focusing Price input and typing 80...')
  await page.evaluate(() => {
    const table = document.querySelector('table')
    const row0 = table.querySelectorAll('tbody tr')[0]
    const inputs = row0.querySelectorAll('input')
    inputs[2].focus()
  })
  await page.keyboard.type('80', { delay: 30 })
  await new Promise((r) => setTimeout(r, 800))

  const tableSummary = await page.evaluate(() => {
    const table = document.querySelector('table')
    return table?.innerText.replace(/\s+/g, ' ')
  })
  console.log('Table text after native typing:', tableSummary)

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-09-native-typed.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-09-native-typed.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
