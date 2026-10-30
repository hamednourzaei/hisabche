const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

const MOBILE_ROUTES = [
  { path: '/en/dashboard', name: 'dashboard' },
  { path: '/en/invoices', name: 'invoices' },
  { path: '/en/customers', name: 'customers' },
  { path: '/en/till', name: 'till' },
  { path: '/en/warehouse', name: 'warehouse' },
]

const I18N_LOCALES = [
  { lang: 'fa', path: '/fa/dashboard' },
  { lang: 'af', path: '/af/dashboard' },
]

async function runMobileAndI18n() {
  console.log('--- STARTING MOBILE & I18N AUDIT ---')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  if (!target) {
    console.error('Target not found')
    process.exit(1)
  }

  const page = await target.page()
  const results = {
    mobile: [],
    i18n: [],
  }

  // 1. Mobile Audit with CDP Emulation
  console.log('\n--- MOBILE VIEWPORT (390x844) ---')
  const client = await target.createCDPSession()

  for (const item of MOBILE_ROUTES) {
    console.log(`Auditing Mobile: ${item.path}...`)
    try {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      })

      await page.goto(`https://hisabche.com${item.path}`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
      await new Promise((r) => setTimeout(r, 1500))

      const shotPath = path.resolve(`docs/qa/screenshots/mobile-${item.name}.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      const metrics = await page.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth
        const clientWidth = document.documentElement.clientWidth
        const hasHorizontalOverflow = scrollWidth > clientWidth

        const interactive = Array.from(document.querySelectorAll('button, a, input, select'))
        const smallTargets = interactive
          .filter((el) => {
            const rect = el.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0 && (rect.width < 36 || rect.height < 36)
          })
          .map((el) => ({
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 30),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
          }))

        const bottomNav = document.querySelector(
          'nav[class*="bottom"], nav[class*="Bottom"], [data-testid="bottom-nav"]',
        )
        const hasBottomNav = !!bottomNav

        return {
          clientWidth,
          scrollWidth,
          hasHorizontalOverflow,
          overflowDelta: scrollWidth - clientWidth,
          smallTargetsCount: smallTargets.length,
          smallTargetsSample: smallTargets.slice(0, 5),
          hasBottomNav,
        }
      })

      results.mobile.push({
        name: item.name,
        path: item.path,
        ...metrics,
      })
      console.log(
        `  ✓ Mobile ${item.name}: Overflow=${metrics.hasHorizontalOverflow} (+${metrics.overflowDelta}px), SmallTargets=${metrics.smallTargetsCount}, BottomNav=${metrics.hasBottomNav}`,
      )
    } catch (err) {
      console.error(`  ❌ Error on mobile ${item.name}:`, err.message)
    }
  }

  // Clear device override
  try {
    await client.send('Emulation.clearDeviceMetricsOverride')
  } catch (e) {}

  // 2. i18n & RTL Audit
  console.log('\n--- I18N & RTL AUDIT ---')
  for (const item of I18N_LOCALES) {
    console.log(`Auditing i18n [${item.lang}]: ${item.path}...`)
    try {
      await page.goto(`https://hisabche.com${item.path}`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
      await new Promise((r) => setTimeout(r, 1500))

      const shotPath = path.resolve(`docs/qa/screenshots/${item.lang}-dashboard.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      const locMetrics = await page.evaluate(() => {
        const htmlDir = document.documentElement.getAttribute('dir')
        const bodyDir = document.body.getAttribute('dir')
        const effectiveDir = window.getComputedStyle(document.body).direction

        const h1 = document.querySelector('h1')
          ? document.querySelector('h1').textContent.trim()
          : ''
        const sampleText = document.body.innerText.slice(0, 300).replace(/\n+/g, ' | ')

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
          htmlDir,
          bodyDir,
          effectiveDir,
          h1,
          sampleText,
          rawKeys,
        }
      })

      results.i18n.push({
        lang: item.lang,
        path: item.path,
        ...locMetrics,
      })
      console.log(
        `  ✓ [${item.lang}]: Dir=${locMetrics.effectiveDir}, H1="${locMetrics.h1}", RawKeys=${locMetrics.rawKeys.length}`,
      )
    } catch (err) {
      console.error(`  ❌ Error on i18n [${item.lang}]:`, err.message)
    }
  }

  // Save results
  fs.writeFileSync(
    path.resolve('docs/qa/mobile-i18n-results.json'),
    JSON.stringify(results, null, 2),
    'utf-8',
  )
  console.log('\nMobile & i18n audit completed and saved to docs/qa/mobile-i18n-results.json')

  // Return browser to /en/dashboard
  try {
    await page.goto('https://hisabche.com/en/dashboard', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    })
  } catch (e) {}

  await browser.disconnect()
}

runMobileAndI18n().catch((err) => {
  console.error('Fatal in mobile & i18n:', err)
  process.exit(1)
})
