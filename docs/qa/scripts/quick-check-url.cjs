const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  console.log('Current URL:', page.url())
  console.log('Current Title:', await page.title())

  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1000))
  console.log('Page Text:', pageText)

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
