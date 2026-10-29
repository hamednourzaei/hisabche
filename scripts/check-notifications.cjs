const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function checkNotifications() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const data = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/notifications')
      return { status: res.status, body: await res.json() }
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('Notifications API data:', JSON.stringify(data, null, 2))
}

checkNotifications().catch((err) => {
  console.error(err)
  process.exit(1)
})
