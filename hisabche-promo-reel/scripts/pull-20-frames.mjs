// ============================================
// Hisabche 20-Frame High-Resolution Visual Inspection Rig
// Captures exactly 20 key editorial frames (1080x1920) across Reel 01
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

function getChromeExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const SAMPLE_POINTS = [
  { idx: 1, time: 0.5, name: 'frame_01_hook_opening', desc: 'Scene 1 Hook Opening Headline' },
  {
    idx: 2,
    time: 2.0,
    name: 'frame_02_hook_dual_cards',
    desc: 'Scene 1 Dual Cards: Cloud vs Desktop',
  },
  { idx: 3, time: 3.6, name: 'frame_03_hook_settled', desc: 'Scene 1 Hook Settled Visual Hold' },
  {
    idx: 4,
    time: 4.8,
    name: 'frame_04_branch_cards_elevate',
    desc: 'Scene 2 Branch Cards Elevate',
  },
  {
    idx: 5,
    time: 6.4,
    name: 'frame_05_branch_bezier_draw',
    desc: 'Scene 2 Branch Dual Neon Beziers',
  },
  {
    idx: 6,
    time: 8.2,
    name: 'frame_06_branch_resolution',
    desc: 'Scene 2 Branch Badge & Resolution',
  },
  {
    idx: 7,
    time: 10.2,
    name: 'frame_07_stagger_entrance',
    desc: 'Scene 3 Stagger Single Invoice Card',
  },
  {
    idx: 8,
    time: 12.8,
    name: 'frame_08_stagger_auto_entries',
    desc: 'Scene 3 Stagger Auto Entries Active',
  },
  {
    idx: 9,
    time: 15.2,
    name: 'frame_09_stagger_complete',
    desc: 'Scene 3 Stagger 6 Entries Complete',
  },
  {
    idx: 10,
    time: 17.5,
    name: 'frame_10_hub_core_pulse',
    desc: 'Scene 4 Hub Central Core & Pulse',
  },
  {
    idx: 11,
    time: 20.0,
    name: 'frame_11_hub_radial_nodes',
    desc: 'Scene 4 Hub 8 Radial Network Nodes',
  },
  {
    idx: 12,
    time: 23.0,
    name: 'frame_12_hub_data_pulses',
    desc: 'Scene 4 Hub Traveling Data Stream',
  },
  {
    idx: 13,
    time: 25.5,
    name: 'frame_13_compare_table_enter',
    desc: 'Scene 5 Compare 3-Column Table',
  },
  {
    idx: 14,
    time: 29.0,
    name: 'frame_14_compare_mid_marks',
    desc: 'Scene 5 Compare Capability Marks',
  },
  {
    idx: 15,
    time: 33.0,
    name: 'frame_15_compare_verdict',
    desc: 'Scene 5 Compare Complete Table & Verdict',
  },
  {
    idx: 16,
    time: 35.5,
    name: 'frame_16_bridge_cards_approach',
    desc: 'Scene 6 Bridge Cards Move to Center',
  },
  {
    idx: 17,
    time: 38.0,
    name: 'frame_17_bridge_merged_core',
    desc: 'Scene 6 Bridge Merged Central Card',
  },
  {
    idx: 18,
    time: 41.5,
    name: 'frame_18_bridge_dual_summary',
    desc: 'Scene 6 Bridge Manager vs Accountant Summary',
  },
  {
    idx: 19,
    time: 46.5,
    name: 'frame_19_cta_box_free',
    desc: 'Scene 7 CTA Box 1: Comment «رایگان»',
  },
  {
    idx: 20,
    time: 54.5,
    name: 'frame_20_cta_box_brand_hold',
    desc: 'Scene 7 CTA Box 2: Comment «حسابچه» & Brand',
  },
]

export async function capture20Frames(targetReelId = '01') {
  console.log(`\n======================================================`)
  console.log(`📸 Capturing 20 Editorial Review Frames — Reel #${targetReelId} (1080x1920)`)
  console.log(`======================================================\n`)

  const chromePath = getChromeExecutablePath()
  if (!chromePath) throw new Error('No Chrome or Edge browser found.')

  const server = await createServer({
    root: ROOT,
    server: { port: 5182, host: '127.0.0.1' },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.httpServer.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  const outputDir = path.resolve(ROOT, '.tmp', 'review-frames', `reel-${targetReelId}`)
  fs.mkdirSync(outputDir, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=2',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })

  const results = []

  for (const sample of SAMPLE_POINTS) {
    const url = `${baseUrl}/?reel=${targetReelId}&t=${sample.time}&frame&exact`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => globalThis.document.fonts.ready)
    await new Promise((r) => setTimeout(r, 60))

    const fileName = `${String(sample.idx).padStart(2, '0')}_${sample.name}.png`
    const filePath = path.resolve(outputDir, fileName)
    await page.screenshot({ path: filePath, type: 'png' })

    const stats = fs.statSync(filePath)
    console.log(
      `  ✓ Frame ${String(sample.idx).padStart(2, '0')}/20 [t = ${sample.time.toFixed(1)}s]: ${fileName} (${(stats.size / 1024).toFixed(1)} KB) — ${sample.desc}`,
    )

    results.push({
      idx: sample.idx,
      time: sample.time,
      name: sample.name,
      fileName,
      filePath,
      sizeKB: Number((stats.size / 1024).toFixed(1)),
      desc: sample.desc,
    })
  }

  await browser.close()
  await server.close()

  console.log(`\n✅ 20 Frames Captured in: ${outputDir}\n`)
  return results
}

capture20Frames('01').catch((err) => {
  console.error('❌ Capture failed:', err)
  process.exit(1)
})
