const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const data = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 1500),
    }
  })

  console.log('DATA:', JSON.stringify(data, null, 2))
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
