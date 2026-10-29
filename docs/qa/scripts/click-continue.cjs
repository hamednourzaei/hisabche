const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  console.log('Clicking "Preview and continue"...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const btn = btns.find((b) => b.innerText.trim() === 'Preview and continue')
    if (btn) btn.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  await page.screenshot({ path: 'docs/qa/screenshots/batch3-07-after-preview-continue.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch3-07-after-preview-continue.png')

  const state = await page.evaluate(() => {
    return {
      url: window.location.href,
      text: document.body.innerText.slice(0, 1500),
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
    }
  })

  console.log('Current URL:', state.url)
  console.log('Buttons:', state.buttons)
  console.log('Text snippet:', state.text.slice(0, 600))

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
