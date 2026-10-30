const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

async function runPhase1() {
  console.log('--- EXECUTING PHASE 1: WORKSPACE & DATA-SOURCE INVENTORY ---')
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

  // 1. Inspect Workspaces
  const workspaceData = await page.evaluate(() => {
    const rawWorkspace = localStorage.getItem('hisabche-workspace')
    const rawAuth = localStorage.getItem('hisabche-auth')
    let parsedWorkspace = null
    try {
      parsedWorkspace = JSON.parse(rawWorkspace)
    } catch (e) {}

    return {
      activeWorkspace: parsedWorkspace?.state?.workspaceName || 'Unknown',
      workspaceId: parsedWorkspace?.state?.workspaceId || 'Unknown',
      membersCount: parsedWorkspace?.state?.members?.length || 0,
      members: parsedWorkspace?.state?.members || [],
    }
  })

  console.log('\n[Workspace Inventory]:')
  console.log('  Active Workspace:', workspaceData.activeWorkspace)
  console.log('  Workspace ID:', workspaceData.workspaceId)
  console.log('  Members Count:', workspaceData.membersCount)
  console.log(
    '  Members:',
    workspaceData.members.map((m) => `${m.fullName} (${m.role})`).join(', '),
  )

  // 2. Intercept Network calls on key hubs to map data sources
  const networkMap = {}

  page.on('response', async (resp) => {
    const url = resp.url()
    if (url.includes('/api/')) {
      const cleanPath = url.replace(/https?:\/\/[^/]+/, '')
      const status = resp.status()
      const method = resp.request().method()
      networkMap[cleanPath] = { method, status }
    }
  })

  // Navigate to Dashboard and capture network
  console.log('\nCapturing Data Sources for Dashboard...')
  await page.goto('https://hisabche.com/en/dashboard', {
    waitUntil: 'networkidle2',
    timeout: 20000,
  })
  await new Promise((r) => setTimeout(r, 2000))

  const dashboardMetrics = await page.evaluate(() => {
    // Extract KPI numbers from Dashboard DOM
    const cards = Array.from(
      document.querySelectorAll('.rounded-2xl, .rounded-xl, [class*="card"]'),
    )
    const kpiTexts = cards
      .map((c) => c.innerText.trim())
      .filter(
        (t) =>
          t.includes('\n') &&
          (t.includes('Sales') || t.includes('Debt') || t.includes('Warehouse')),
      )
    return {
      snippet: document.body.innerText.slice(0, 800).replace(/\n+/g, ' | '),
    }
  })

  console.log('Dashboard Data Snippet:', dashboardMetrics.snippet.slice(0, 300))

  // Output Inventory Results
  const results = {
    workspaceData,
    networkEndpointsSample: Object.keys(networkMap).slice(0, 20),
  }

  fs.writeFileSync('docs/qa/phase1-inventory.json', JSON.stringify(results, null, 2), 'utf-8')
  console.log('✓ Phase 1 Inventory saved to docs/qa/phase1-inventory.json')

  await browser.disconnect()
}

runPhase1().catch((err) => {
  console.error('Fatal in Phase 1:', err)
  process.exit(1)
})
