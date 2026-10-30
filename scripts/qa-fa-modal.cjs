const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function testFaModal() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  console.log('Navigating to /fa/customers...')
  await page.goto('https://hisabche.com/fa/customers', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  })
  await new Promise((r) => setTimeout(r, 2000))

  const addBtnClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const btn = btns.find(
      (b) => b.innerText && (b.innerText.includes('مشتری جدید') || b.innerText.includes('افزودن')),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })

  console.log('Add Customer button clicked:', addBtnClicked)
  if (addBtnClicked) {
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: path.resolve('docs/qa/screenshots/fa-add-customer-modal.png') })

    const formDetails = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') || document.body
      const direction = window.getComputedStyle(modal).direction
      const labels = Array.from(modal.querySelectorAll('label')).map((l) =>
        (l.innerText || '').trim(),
      )
      const inputs = Array.from(modal.querySelectorAll('input, select, textarea')).map((i) => ({
        placeholder: i.getAttribute('placeholder') || '',
        name: i.getAttribute('name') || i.getAttribute('id') || '',
      }))

      // Click save to trigger Persian validation
      const save = Array.from(modal.querySelectorAll('button')).find(
        (b) => b.innerText && b.innerText.includes('ذخیره'),
      )
      if (save) save.click()

      return { direction, labels, inputs }
    })

    await new Promise((r) => setTimeout(r, 1000))
    await page.screenshot({
      path: path.resolve('docs/qa/screenshots/fa-customer-modal-validation.png'),
    })

    const errors = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          '[class*="error"], [class*="destructive"], [role="alert"], p.text-red-500, span.text-red-500',
        ),
      )
      return elements.map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean)
    })

    console.log('✓ Persian Modal Direction:', formDetails.direction)
    console.log('✓ Persian Modal Labels:', formDetails.labels)
    console.log('✓ Persian Validation Errors on Empty Submit:', errors)

    // Close modal
    await page.evaluate(() => {
      const cancel = Array.from(document.querySelectorAll('button')).find(
        (b) => b.innerText && b.innerText.includes('انصراف'),
      )
      if (cancel) cancel.click()
    })
  }

  await browser.disconnect()
}

testFaModal().catch((err) => {
  console.error('Fatal in testFaModal:', err)
  process.exit(1)
})
