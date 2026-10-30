const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function takeSnapshot() {
  console.log('Connecting to browser on port 63311...')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  if (!target) {
    console.error('Hisabche target not found')
    process.exit(1)
  }

  const page = await target.page()
  await page.setViewport({ width: 1280, height: 800 })

  const snapshot = {
    timestamp: new Date().toISOString(),
    workspace: 'lolokhan',
    workspaceId: '3f19d3ca-b024-4565-b5e3-47a078585c72',
    baseCurrency: 'AFN',
    dashboard: {},
    customers: [],
    warehouse: {},
    till: {},
    accounting: {},
  }

  // 1. Dashboard snapshot
  console.log('Reading /en/dashboard...')
  await page.goto('https://hisabche.com/en/dashboard', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  snapshot.dashboard = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('div, section, article')].filter((el) => {
      const text = el.innerText || ''
      return (
        text.includes('Total Sales') ||
        text.includes('Customer Debt') ||
        text.includes('Warehouse Value')
      )
    })
    return {
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      bodyTextSnippet: document.body.innerText.slice(0, 500),
    }
  })

  // 2. Customers snapshot
  console.log('Reading /en/customers...')
  await page.goto('https://hisabche.com/en/customers', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  snapshot.customers = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr, [role="row"], li')]
      .map((r) => r.innerText.trim())
      .filter(Boolean)
    return {
      rowCount: rows.length,
      sampleRows: rows.slice(0, 10),
      hasAddButton: !!document.querySelector('button'),
    }
  })

  // 3. Warehouse snapshot
  console.log('Reading /en/warehouse...')
  await page.goto('https://hisabche.com/en/warehouse', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  snapshot.warehouse = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr, [role="row"], li')]
      .map((r) => r.innerText.trim())
      .filter(Boolean)
    return {
      rowCount: rows.length,
      sampleRows: rows.slice(0, 10),
      bodyTextSnippet: document.body.innerText.slice(0, 400),
    }
  })

  // 4. Till snapshot
  console.log('Reading /en/till...')
  await page.goto('https://hisabche.com/en/till', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  snapshot.till = await page.evaluate(() => {
    return {
      bodyTextSnippet: document.body.innerText.slice(0, 400),
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
    }
  })

  // 5. Accounting snapshot
  console.log('Reading /en/accounting...')
  await page.goto('https://hisabche.com/en/accounting', { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  snapshot.accounting = await page.evaluate(() => {
    return {
      bodyTextSnippet: document.body.innerText.slice(0, 400),
      buttons: [...document.querySelectorAll('button')]
        .map((b) => b.innerText.trim())
        .filter(Boolean),
    }
  })

  fs.writeFileSync('docs/qa/starting-state-snapshot.json', JSON.stringify(snapshot, null, 2))
  console.log('Snapshot written to docs/qa/starting-state-snapshot.json')
  console.log(JSON.stringify(snapshot, null, 2))
}

takeSnapshot().catch((err) => {
  console.error('Snapshot failed:', err)
  process.exit(1)
})
