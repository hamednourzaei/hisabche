const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()
  await page.goto('https://hisabche.com/en/dashboard', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  const statCards = await page.evaluate(() => {
    // Find all cards with metric values
    const elements = [...document.querySelectorAll('*')]
    const cards = []
    for (const el of elements) {
      if (el.children.length === 0 && el.innerText && el.innerText.includes('AFN')) {
        cards.push({ text: el.innerText, parent: el.parentElement?.innerText?.replace(/\n/g, ' ') })
      }
    }
    return cards
  })

  console.log('Cards with AFN:', statCards)
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
