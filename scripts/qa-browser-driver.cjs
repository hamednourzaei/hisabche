const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

const ROUTES = [
  { path: '/en/dashboard', name: 'dashboard' },
  { path: '/en/invoices', name: 'invoices' },
  { path: '/en/invoices/new', name: 'invoices-new' },
  { path: '/en/customers', name: 'customers' },
  { path: '/en/till', name: 'till' },
  { path: '/en/warehouse', name: 'warehouse' },
  { path: '/en/stock-count', name: 'stock-count' },
  { path: '/en/accounting', name: 'accounting' },
  { path: '/en/team-and-payroll', name: 'team-and-payroll' },
  { path: '/en/data-and-sync', name: 'data-and-sync' },
  { path: '/en/sync-center', name: 'sync-center' },
  { path: '/en/operations', name: 'operations' },
  { path: '/en/marketplace', name: 'marketplace' },
  { path: '/en/manufacturing', name: 'manufacturing' },
  { path: '/en/analysis', name: 'analysis' },
  { path: '/en/billing', name: 'billing' },
  { path: '/en/developers', name: 'developers' },
  { path: '/en/governance', name: 'governance' },
  { path: '/en/settings', name: 'settings' },
  { path: '/en/activities', name: 'activities' },
  { path: '/en/approvals', name: 'approvals' },
  { path: '/en/assistant', name: 'assistant' },
  { path: '/en/market-seller', name: 'market-seller' },
]

const MOBILE_ROUTES = ['dashboard', 'invoices', 'customers', 'till', 'warehouse']

async function runAudit() {
  console.log('--- STARTING COMPREHENSIVE QA AUDIT ---')
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
  await page.setViewport({ width: 1280, height: 800 })

  const auditResults = {
    timestamp: new Date().toISOString(),
    routesChecked: [],
    mobileChecked: [],
    i18nChecked: [],
  }

  // Hook console & network errors
  let currentLogs = []
  let currentErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      currentLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    currentErrors.push(err.message)
  })
  page.on('response', (resp) => {
    if (
      resp.status() >= 400 &&
      !resp.url().includes('google-analytics') &&
      !resp.url().includes('favicon')
    ) {
      currentErrors.push(`HTTP ${resp.status()} on ${resp.url()}`)
    }
  })

  // 1. Desktop Route Audits
  for (const item of ROUTES) {
    console.log(`\nAuditing [Desktop]: ${item.path} (${item.name})...`)
    currentLogs = []
    currentErrors = []

    const startTime = Date.now()
    try {
      await page.goto(`https://hisabche.com${item.path}`, {
        waitUntil: 'networkidle2',
        timeout: 20000,
      })
    } catch (e) {
      console.warn(`Navigation timeout or error for ${item.path}:`, e.message)
    }

    // Wait for content settling
    await new Promise((r) => setTimeout(r, 1500))
    const loadDuration = Date.now() - startTime

    const actualUrl = page.url()
    const title = await page.title()

    // Take desktop screenshot
    const shotPath = path.resolve(`docs/qa/screenshots/desktop-${item.name}.png`)
    try {
      await page.screenshot({ path: shotPath, fullPage: true })
    } catch (err) {
      console.warn('Screenshot error:', err.message)
    }

    // Inspect page specifics
    const pageMetrics = await page.evaluate(() => {
      const h1Elements = Array.from(document.querySelectorAll('h1')).map((h) =>
        h.textContent.trim(),
      )
      const breadcrumbEl =
        document.querySelector('nav[aria-label="Breadcrumb"], [data-testid="breadcrumb"]') ||
        document.querySelector('.breadcrumb')
      const breadcrumbText = breadcrumbEl ? breadcrumbEl.textContent.trim() : null

      // Persian digits / Arabic percent inside English UI check
      const bodyText = document.body.innerText || ''
      const persianDigitsMatches = bodyText.match(/[۰-۹]/g) || []
      const persianPercentMatches = bodyText.match(/٪/g) || []
      const rawKeyMatches = []

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
          rawKeyMatches.push(val)
        }
      }

      // Disabled buttons and their reasons
      const disabledButtons = Array.from(
        document.querySelectorAll('button:disabled, [aria-disabled="true"]'),
      ).map((b) => ({
        text: b.textContent.trim().slice(0, 50),
        title: b.getAttribute('title') || b.getAttribute('aria-label') || '',
      }))

      // Form inputs aria-labels
      const inputAriaLabels = Array.from(document.querySelectorAll('input, select, textarea'))
        .map((i) => ({
          name: i.getAttribute('name') || i.getAttribute('id') || '',
          ariaLabel: i.getAttribute('aria-label') || '',
          placeholder: i.getAttribute('placeholder') || '',
        }))
        .filter((i) => i.ariaLabel || i.placeholder)

      return {
        h1Count: h1Elements.length,
        h1s: h1Elements,
        breadcrumbText,
        persianDigitsCount: persianDigitsMatches.length,
        persianPercentCount: persianPercentMatches.length,
        rawKeys: rawKeyMatches,
        disabledButtonsCount: disabledButtons.length,
        disabledButtonsSample: disabledButtons.slice(0, 5),
        inputAriaLabelsSample: inputAriaLabels.slice(0, 10),
        textSnippet: bodyText.slice(0, 200).replace(/\n+/g, ' | '),
      }
    })

    const record = {
      name: item.name,
      requestedPath: item.path,
      actualUrl,
      title,
      loadDurationMs: loadDuration,
      ...pageMetrics,
      errors: currentErrors,
      warnLogs: currentLogs.slice(0, 5),
    }

    auditResults.routesChecked.push(record)
    console.log(`  ✓ Landed on: ${actualUrl} (Title: ${title}, Load: ${loadDuration}ms)`)
    if (pageMetrics.h1Count !== 1) {
      console.log(
        `  ⚠️ H1 issue: Found ${pageMetrics.h1Count} H1s: ${JSON.stringify(pageMetrics.h1s)}`,
      )
    }
    if (pageMetrics.rawKeys.length > 0) {
      console.log(`  ⚠️ Raw Keys: ${JSON.stringify(pageMetrics.rawKeys)}`)
    }
    if (currentErrors.length > 0) {
      console.log(`  ⚠️ Errors: ${JSON.stringify(currentErrors)}`)
    }
  }

  // 2. Mobile Responsive Audits (390x844 iPhone 14 / standard modern mobile)
  console.log('\n--- STARTING MOBILE RESPONSIVE AUDIT ---')
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })

  for (const name of MOBILE_ROUTES) {
    const route = ROUTES.find((r) => r.name === name)
    if (!route) continue

    console.log(`Auditing [Mobile 390px]: ${route.path}...`)
    try {
      await page.goto(`https://hisabche.com${route.path}`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
    } catch (e) {
      console.warn(`Mobile navigation timeout: ${e.message}`)
    }

    await new Promise((r) => setTimeout(r, 1500))

    const shotPath = path.resolve(`docs/qa/screenshots/mobile-${name}.png`)
    try {
      await page.screenshot({ path: shotPath, fullPage: true })
    } catch (err) {
      console.warn('Mobile screenshot error:', err.message)
    }

    const mobileMetrics = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth
      const clientWidth = document.documentElement.clientWidth
      const hasHorizontalOverflow = scrollWidth > clientWidth

      // Check small touch targets (< 36px)
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

      // Check bottom nav bar
      const bottomNav = document.querySelector(
        'nav[class*="bottom"], nav[class*="Bottom"], [data-testid="bottom-nav"]',
      )
      const hasBottomNav = !!bottomNav

      return {
        clientWidth,
        scrollWidth,
        hasHorizontalOverflow,
        smallTargetsCount: smallTargets.length,
        smallTargetsSample: smallTargets.slice(0, 5),
        hasBottomNav,
      }
    })

    auditResults.mobileChecked.push({
      name,
      path: route.path,
      ...mobileMetrics,
    })

    console.log(
      `  ✓ Mobile: Overflow: ${mobileMetrics.hasHorizontalOverflow} (${mobileMetrics.scrollWidth}px vs ${mobileMetrics.clientWidth}px), Small targets: ${mobileMetrics.smallTargetsCount}`,
    )
  }

  // Restore desktop viewport
  await page.setViewport({ width: 1280, height: 800 })

  // 3. i18n & RTL Audits (Persian & Dari)
  console.log('\n--- STARTING I18N & RTL AUDIT ---')
  const i18nLocales = [
    { lang: 'fa', path: '/fa/dashboard' },
    { lang: 'af', path: '/af/dashboard' },
  ]

  for (const loc of i18nLocales) {
    console.log(`Auditing [i18n]: ${loc.path}...`)
    try {
      await page.goto(`https://hisabche.com${loc.path}`, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      })
    } catch (e) {
      console.warn(`i18n navigation timeout: ${e.message}`)
    }

    await new Promise((r) => setTimeout(r, 1500))

    const shotPath = path.resolve(`docs/qa/screenshots/${loc.lang}-dashboard.png`)
    try {
      await page.screenshot({ path: shotPath, fullPage: true })
    } catch (err) {
      console.warn('i18n screenshot error:', err.message)
    }

    const locMetrics = await page.evaluate(() => {
      const htmlDir = document.documentElement.getAttribute('dir')
      const bodyDir = document.body.getAttribute('dir')
      const effectiveDir = window.getComputedStyle(document.body).direction

      const h1 = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : ''
      const sampleText = document.body.innerText.slice(0, 300).replace(/\n+/g, ' | ')

      // Check raw keys
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

    auditResults.i18nChecked.push({
      lang: loc.lang,
      path: loc.path,
      ...locMetrics,
    })

    console.log(
      `  ✓ ${loc.lang}: Direction: ${locMetrics.effectiveDir}, Title H1: ${locMetrics.h1}, Raw keys: ${locMetrics.rawKeys.length}`,
    )
  }

  // Save audit results
  const outputPath = path.resolve('docs/qa/qa-run-results.json')
  fs.writeFileSync(outputPath, JSON.stringify(auditResults, null, 2), 'utf-8')
  console.log(`\nAudit finished! Results written to: ${outputPath}`)

  await browser.disconnect()
}

runAudit().catch((err) => {
  console.error('Audit run failed:', err)
  process.exit(1)
})
