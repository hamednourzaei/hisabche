import puppeteer from 'C:/Users/hamed/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js'

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const pages = await browser.pages()
  console.log(`Connected! Found ${pages.length} targets.`)
  for (const page of pages) {
    console.log(`- ${page.url()} | Title: ${await page.title()}`)
  }

  // Find the target page
  const targetPage = pages.find((p) => p.url().includes('hisabche.com'))
  if (targetPage) {
    console.log('Found Hisabche target page!')
    console.log('Current URL:', targetPage.url())
    console.log('Current Title:', await targetPage.title())
  } else {
    console.log('Could not find hisabche.com in browser.pages(), trying targets...')
    const targets = browser.targets()
    for (const t of targets) {
      console.log(`Target: ${t.type()} | ${t.url()}`)
      if (t.url().includes('hisabche.com')) {
        const page = await t.page()
        if (page) {
          console.log('Got page from target:', await page.title())
        }
      }
    }
  }

  await browser.disconnect()
}

run().catch(console.error)
