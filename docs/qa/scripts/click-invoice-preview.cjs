const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  console.log('Clicking "Next: preview and confirm"...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const nextBtn = btns.find(
      (b) =>
        b.innerText.includes('Next: preview and confirm') ||
        b.innerText.includes('preview and confirm') ||
        b.innerText.includes('Preview and confirm'),
    )
    if (nextBtn) nextBtn.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-04-preview-step.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-04-preview-step.png')

  const previewInfo = await page.evaluate(() => {
    return {
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
      text: document.body.innerText.slice(0, 1500),
    }
  })

  console.log('Buttons on preview step:', previewInfo.buttons)
  console.log('Preview text snippet:', previewInfo.text.slice(0, 500))

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
