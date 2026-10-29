const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function inspectWarehouse() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  await page.goto('https://hisabche.com/en/warehouse', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))

  // Click on Products tab
  console.log('Clicking Products tab...')
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const tab = tabs.find((t) => t.innerText === 'Products')
    if (tab) tab.click()
  })
  await new Promise((r) => setTimeout(r, 1500))

  const productsButtons = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean)
  })
  console.log('Buttons on Products tab:', productsButtons)

  // Check Warehouses tab
  console.log('Clicking Warehouses tab...')
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')]
    const tab = tabs.find((t) => t.innerText === 'Warehouses')
    if (tab) tab.click()
  })
  await new Promise((r) => setTimeout(r, 1500))
  const warehousesButtons = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean)
  })
  console.log('Buttons on Warehouses tab:', warehousesButtons)
}

inspectWarehouse().catch((err) => {
  console.error(err)
  process.exit(1)
})
