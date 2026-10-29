const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.goto('https://hisabche.com/en/warehouse', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  // Click Products tab
  console.log('Clicking Products tab...')
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const tab = tabs.find((t) => t.innerText.trim() === 'Products')
    if (tab) tab.click()
  })
  await new Promise((r) => setTimeout(r, 2000))

  const info = await page.evaluate(() => {
    return {
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
      headings: [...document.querySelectorAll('h1, h2, h3, h4')].map((h) => h.innerText.trim()),
      tableRows: [...document.querySelectorAll('tr')].map((tr) =>
        tr.innerText.replace(/\s+/g, ' ').trim(),
      ),
    }
  })

  console.log('Buttons on Products tab:', info.buttons)
  console.log('Headings:', info.headings)
  console.log('Table rows count:', info.tableRows.length)
  console.log('First 5 rows:', info.tableRows.slice(0, 5))

  await page.screenshot({ path: 'docs/qa/screenshots/batch2-products-tab.png' })
  console.log('Screenshot saved: docs/qa/screenshots/batch2-products-tab.png')

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
