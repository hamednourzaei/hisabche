const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const storeData = await page.evaluate(() => {
    const lsKeys = Object.keys(localStorage)
    const draftKeys = lsKeys.filter(
      (k) => k.toLowerCase().includes('invoice') || k.toLowerCase().includes('draft'),
    )
    const drafts = {}
    for (const k of draftKeys) {
      drafts[k] = localStorage.getItem(k)
    }
    return { lsKeys, drafts }
  })

  console.log('LocalStorage Keys:', storeData.lsKeys)
  console.log('Drafts:', storeData.drafts)

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
