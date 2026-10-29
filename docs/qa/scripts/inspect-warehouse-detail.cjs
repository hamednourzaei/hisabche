const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  if (!target) {
    console.error('Target not found')
    await browser.disconnect()
    process.exit(1)
  }

  const page = await target.page()
  await page.goto('https://hisabche.com/en/warehouse', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  const info = await page.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      buttons: [...document.querySelectorAll('button')].map((b) => ({
        text: b.innerText.trim(),
        role: b.getAttribute('role'),
        type: b.getAttribute('type'),
        className: b.className,
      })),
      inputs: [...document.querySelectorAll('input')].map((i) => ({
        placeholder: i.placeholder,
        name: i.name,
        type: i.type,
      })),
    }
  })

  console.log('Page URL:', info.url)
  console.log('Buttons:', info.buttons.map((b) => b.text).filter(Boolean))
  await page.screenshot({ path: 'docs/qa/screenshots/batch2-warehouse-initial.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch2-warehouse-initial.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
