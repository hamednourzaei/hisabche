const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.goto('https://hisabche.com/en/dashboard', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  const metrics = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('div')]
    const text = document.body.innerText
    return {
      textSample: text.slice(0, 1500),
    }
  })

  console.log('Dashboard text sample:', metrics.textSample)
  await page.screenshot({ path: 'docs/qa/screenshots/batch2-04-dashboard-after-product.png' })
  console.log('Screenshot: batch2-04-dashboard-after-product.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
