const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  console.log('Filling Edit item dialog...')

  // Find the dialog and its inputs
  const filled = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return { success: false, reason: 'No dialog' }

    const inputs = [...dialog.querySelectorAll('input')].filter(
      (i) => i.placeholder !== 'Search products…',
    )
    // Typically inputs: [item name, qty, price]
    if (inputs.length >= 3) {
      // qty input
      const qtyInput = inputs[1]
      qtyInput.value = '2'
      qtyInput.dispatchEvent(new Event('input', { bubbles: true }))
      qtyInput.dispatchEvent(new Event('change', { bubbles: true }))

      // price input
      const priceInput = inputs[2]
      priceInput.value = '80'
      priceInput.dispatchEvent(new Event('input', { bubbles: true }))
      priceInput.dispatchEvent(new Event('change', { bubbles: true }))

      return { success: true, qty: qtyInput.value, price: priceInput.value }
    }
    return { success: false, inputsCount: inputs.length }
  })

  console.log('Fill result:', filled)
  await new Promise((r) => setTimeout(r, 800))

  // Click Done button
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const doneBtn = [...(dialog?.querySelectorAll('button') || [])].find(
      (b) => b.innerText.trim() === 'Done',
    )
    if (doneBtn) doneBtn.click()
  })
  await new Promise((r) => setTimeout(r, 1500))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-05-line-item-configured.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-05-line-item-configured.png')

  // Click "Preview and confirm"
  console.log('Clicking Preview and confirm...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find(
      (b) =>
        b.innerText.includes('Preview and confirm') || b.innerText.includes('Preview and continue'),
    )
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-06-preview-screen.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-06-preview-screen.png')

  const nextInfo = await page.evaluate(() => {
    return {
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
      text: document.body.innerText.slice(0, 1000),
    }
  })
  console.log('Buttons on preview screen:', nextInfo.buttons)

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
