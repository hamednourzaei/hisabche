const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
    protocolTimeout: 60000,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  // 1. Customer detail page
  console.log('Checking customer detail page...')
  await page.goto('https://hisabche.com/en/customers/2e39f4a3-329b-4993-a433-2ae59de40746', {
    waitUntil: 'domcontentloaded',
  })
  await new Promise((r) => setTimeout(r, 2000))
  const custText = await page.evaluate(() => document.body.innerText.slice(0, 1000))
  console.log('Customer page text snippet:', custText.slice(0, 400))

  // 2. Till page
  console.log('Checking till page...')
  await page.goto('https://hisabche.com/en/till', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2000))
  const tillText = await page.evaluate(() => document.body.innerText.slice(0, 1000))
  console.log('Till page text snippet:', tillText.slice(0, 400))

  // 3. Notification drawer
  console.log('Checking notification bell...')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const bellBtn = btns.find((b) => b.innerText.trim() === '9')
    if (bellBtn) bellBtn.click()
  })
  await new Promise((r) => setTimeout(r, 1500))

  const notifItems = await page.evaluate(() => {
    return [...document.querySelectorAll('*')]
      .filter((el) => (el.innerText || '').includes('INV-000101'))
      .map((el) => el.innerText.replace(/\s+/g, ' ').slice(0, 150))
      .slice(0, 5)
  })
  console.log('Notification items with INV-000101:', notifItems)

  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
