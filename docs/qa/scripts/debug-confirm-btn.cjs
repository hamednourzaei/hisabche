const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const debugInfo = await page.evaluate(() => {
    // Look at button attributes
    const btns = [...document.querySelectorAll('button')].filter((b) =>
      b.innerText.includes('Confirm and create invoice'),
    )
    return btns.map((b) => ({
      text: b.innerText,
      disabled: b.disabled,
      attributes: [...b.attributes].map((a) => `${a.name}="${a.value}"`),
    }))
  })

  console.log('Confirm buttons:', debugInfo)
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
