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
  const buttons = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].map((b) => ({
      text: b.innerText.trim(),
      disabled: b.disabled,
      visible: b.offsetParent !== null,
    }))
  })

  console.log(
    'Buttons:',
    buttons.filter((b) => b.text.length > 0),
  )
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
