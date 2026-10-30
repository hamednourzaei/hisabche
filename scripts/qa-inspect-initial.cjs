const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const targets = browser.targets()
  const hisabcheTarget = targets.find((t) => t.url().includes('hisabche.com'))

  if (!hisabcheTarget) {
    console.error('No Hisabche webview target found!')
    process.exit(1)
  }

  const page = await hisabcheTarget.page()
  if (!page) {
    console.error('Could not get page from target!')
    process.exit(1)
  }

  console.log('Attached to Hisabche page successfully!')
  console.log('Current URL:', page.url())

  // Capture console logs
  const logs = []
  page.on('console', (msg) => {
    logs.push(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    logs.push(`[PAGE ERROR] ${err.message}`)
  })

  // Wait 2 seconds for settling
  await new Promise((r) => setTimeout(r, 2000))

  const title = await page.title()
  console.log('Page Title:', title)

  // Take screenshot of current state
  const screenshotPath = path.resolve('docs/qa/screenshots/initial-dashboard.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log('Saved screenshot to:', screenshotPath)

  // Inspect page content
  const pageInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => ({
      tag: h.tagName,
      text: h.textContent.trim(),
    }))

    const navItems = Array.from(
      document.querySelectorAll('nav a, aside a, [role="navigation"] a'),
    ).map((a) => ({
      text: a.textContent.trim(),
      href: a.getAttribute('href'),
    }))

    const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({
      text: b.textContent.trim(),
      disabled: b.disabled,
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className.slice(0, 50),
    }))

    // Look for raw translation keys
    const rawKeys = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    const keyRegex = /^[a-z0-9]+(\.[a-z0-9_-]+){1,5}$/i
    while ((node = walker.nextNode())) {
      const val = node.nodeValue.trim()
      if (
        val &&
        keyRegex.test(val) &&
        !val.includes(' ') &&
        !val.includes('http') &&
        val.length < 50
      ) {
        rawKeys.push(val)
      }
    }

    return {
      url: window.location.href,
      headings,
      navItemsCount: navItems.length,
      sampleNav: navItems.slice(0, 10),
      buttonsCount: buttons.length,
      sampleButtons: buttons.slice(0, 10),
      rawKeys,
      bodyTextSnippet: document.body.innerText.slice(0, 500).replace(/\n+/g, ' | '),
    }
  })

  console.log('\n--- PAGE INFO ---')
  console.log('Headings:', pageInfo.headings)
  console.log('Nav items count:', pageInfo.navItemsCount)
  console.log('Sample Nav:', pageInfo.sampleNav)
  console.log('Buttons count:', pageInfo.buttonsCount)
  console.log('Raw Translation Keys detected:', pageInfo.rawKeys)
  console.log('Body Text Snippet:', pageInfo.bodyTextSnippet)

  if (logs.length > 0) {
    console.log('\n--- CONSOLE LOGS ---')
    logs.forEach((l) => console.log(l))
  }

  await browser.disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
