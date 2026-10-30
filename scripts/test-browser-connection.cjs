const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const targets = browser.targets()
  console.log(`Connected! Found ${targets.length} targets.`)
  for (const t of targets) {
    console.log(`- Type: ${t.type()} | URL: ${t.url()}`)
    if (t.url().includes('hisabche.com')) {
      const page = await t.page()
      if (page) {
        console.log(`  ==> Attached to Hisabche page! Title: ${await page.title()}`)
        const heading = await page.$eval('h1, h2', (el) => el.textContent).catch(() => 'no heading')
        console.log(`  ==> Heading: ${heading}`)
      }
    }
  }

  await browser.disconnect()
}

run().catch(console.error)
