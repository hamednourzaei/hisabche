const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function clickAndInspectBell() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:60105',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  // Find the bell button
  const bellFound = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    const bellBtn = buttons.find(
      (b) =>
        b.querySelector('svg.lucide-bell') ||
        (b.getAttribute('aria-label') || '').toLowerCase().includes('notification') ||
        b.innerText.includes('8'),
    )
    if (bellBtn) {
      bellBtn.click()
      return true
    }
    return false
  })
  console.log('Bell button clicked:', bellFound)
  await new Promise((r) => setTimeout(r, 1000))

  const panelData = await page.evaluate(() => {
    // Look for notifications container
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, p, span, div')].filter((el) =>
      (el.innerText || '').includes('Notifications'),
    )
    return {
      text: document.body.innerText.slice(0, 1500),
    }
  })

  console.log('Text around Notifications:\n', panelData.text)
}

clickAndInspectBell().catch((err) => {
  console.error(err)
  process.exit(1)
})
