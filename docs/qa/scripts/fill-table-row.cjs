const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  console.log('Typing into table inputs for row 0...')
  const result = await page.evaluate(() => {
    const table = document.querySelector('table')
    const row0 = table.querySelectorAll('tbody tr')[0]
    const inputs = row0.querySelectorAll('input')

    const qtyInput = inputs[1]
    const priceInput = inputs[2]

    // Set qty
    qtyInput.focus()
    qtyInput.value = '2'
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }))
    qtyInput.dispatchEvent(new Event('change', { bubbles: true }))

    // Set price
    priceInput.focus()
    priceInput.value = '80'
    priceInput.dispatchEvent(new Event('input', { bubbles: true }))
    priceInput.dispatchEvent(new Event('change', { bubbles: true }))

    return { qty: qtyInput.value, price: priceInput.value }
  })

  console.log('Inputs updated:', result)
  await new Promise((r) => setTimeout(r, 1000))

  const tableSummary = await page.evaluate(() => {
    const table = document.querySelector('table')
    return table?.innerText.replace(/\s+/g, ' ')
  })
  console.log('Table text:', tableSummary)

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-08-table-filled.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-08-table-filled.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
