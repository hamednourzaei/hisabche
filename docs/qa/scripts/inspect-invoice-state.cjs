const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const state = await page.evaluate(() => {
    return {
      inputs: [...document.querySelectorAll('input')].map((i) => ({
        placeholder: i.placeholder,
        value: i.value,
        className: i.className,
      })),
      openDialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => ({
        title: d.querySelector('h2')?.innerText,
        text: d.innerText.slice(0, 300),
      })),
    }
  })

  console.log('State:', JSON.stringify(state, null, 2))
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
