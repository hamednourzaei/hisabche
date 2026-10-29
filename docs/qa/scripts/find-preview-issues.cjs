const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const details = await page.evaluate(() => {
    // Look for error alerts, warnings, or issue messages
    const alerts = [
      ...document.querySelectorAll('[role="alert"], .text-destructive, .text-amber-500, p, span'),
    ]
      .map((el) => el.innerText.trim())
      .filter((t) => t.length > 0 && t.length < 200)

    const allText = document.body.innerText

    return {
      alerts: [...new Set(alerts)].slice(0, 30),
      hasItemsTable: !!document.querySelector('table'),
      tableText: document.querySelector('table')?.innerText?.replace(/\s+/g, ' '),
      fullTextSnippet: allText.slice(0, 2000),
    }
  })

  console.log('Details:', JSON.stringify(details, null, 2))
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
