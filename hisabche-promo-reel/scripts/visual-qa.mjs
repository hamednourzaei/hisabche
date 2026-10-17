// ============================================
// Hisabche Promo Reel Studio — Scene-Aware Automated Visual QA
//
// Dynamically samples exact scene-boundary frames from a target reel:
// 1. Frame 0 / Hook Arrest (start + 0.15s, start + 1.2s)
// 2. Per-Scene Peak & Hold State (mid-choreography & settled layout)
// 3. CTA switch state transitions
//
// Outputs 1080x1920 PNG snapshots to .tmp/visual-qa/<reel-id>/
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Chrome executable discovery
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

export async function runVisualQA(targetReelId = '52') {
  console.log(`\n======================================================`)
  console.log(`🎬 Hisabche Visual QA Studio — Reel #${targetReelId}`)
  console.log(`======================================================\n`)

  const chromePath = getChromeExecutablePath()
  if (!chromePath) {
    throw new Error('No system Chrome or Edge browser found in standard installation paths.')
  }

  // 1. Start local Vite server
  const server = await createServer({
    root: ROOT,
    server: { port: 5176, host: '127.0.0.1' },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.httpServer.address().port
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`✓ Headless Vite QA server active on ${baseUrl}`)

  // 2. Load Reel definition
  const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
  const reel = REELS.find(
    (r) => r.id === targetReelId || r.id === String(targetReelId).padStart(2, '0'),
  )
  if (!reel) {
    await server.close()
    throw new Error(`Reel ID '${targetReelId}' not found in REELS registry.`)
  }

  console.log(`✓ Loaded Reel: "${reel.title}" (${reel.duration}s, ${reel.scenes.length} scenes)`)

  // 3. Compute Dynamic Scene-Boundary Sampling Timestamps
  const samplePoints = []

  reel.scenes.forEach((scene, idx) => {
    const sceneNum = String(idx + 1).padStart(2, '0')
    const dur = scene.end - scene.start

    if (idx === 0) {
      // Scene 1: Hook Arrest
      samplePoints.push({
        time: Number((scene.start + 0.15).toFixed(2)),
        name: `scene_${sceneNum}_hook_arrest_t0.15`,
        desc: `Scene 1 Hook Initial Visual Impact (Frame 0 + 0.15s)`,
      })
      samplePoints.push({
        time: Number((scene.start + Math.min(1.2, dur * 0.6)).toFixed(2)),
        name: `scene_${sceneNum}_hook_conflict_t${(scene.start + Math.min(1.2, dur * 0.6)).toFixed(2)}`,
        desc: `Scene 1 Hook Conflict Explosion / Fracture`,
      })
      samplePoints.push({
        time: Number((scene.end - Math.min(0.3, dur * 0.1)).toFixed(2)),
        name: `scene_${sceneNum}_hook_hold_t${(scene.end - Math.min(0.3, dur * 0.1)).toFixed(2)}`,
        desc: `Scene 1 Hook Settled Hold State`,
      })
    } else {
      // Mid-Choreography Peak
      const midT = Number((scene.start + 0.45 * dur).toFixed(2))
      samplePoints.push({
        time: midT,
        name: `scene_${sceneNum}_${scene.spec.kind}_mid_t${midT}`,
        desc: `Scene ${idx + 1} (${scene.spec.kind}) Mid-Choreography Peak`,
      })

      // Settled Layout Hold
      const holdT = Number((scene.end - Math.min(0.25, dur * 0.1)).toFixed(2))
      samplePoints.push({
        time: holdT,
        name: `scene_${sceneNum}_${scene.spec.kind}_hold_t${holdT}`,
        desc: `Scene ${idx + 1} (${scene.spec.kind}) Fully Settled Layout Hold`,
      })
    }

    // Special case for CTA scene switch
    if (scene.spec.kind === 'cta' && scene.spec.switchAt) {
      const beforeSwitch = Number((scene.start + scene.spec.switchAt - 0.2).toFixed(2))
      const afterSwitch = Number((scene.start + scene.spec.switchAt + 0.4).toFixed(2))
      if (beforeSwitch > scene.start) {
        samplePoints.push({
          time: beforeSwitch,
          name: `scene_${sceneNum}_cta_box1_t${beforeSwitch}`,
          desc: `Scene ${idx + 1} CTA Box 1 Lead Offer`,
        })
      }
      if (afterSwitch < scene.end) {
        samplePoints.push({
          time: afterSwitch,
          name: `scene_${sceneNum}_cta_box2_t${afterSwitch}`,
          desc: `Scene ${idx + 1} CTA Box 2 Search Resolution`,
        })
      }
    }
  })

  // Ensure output directory exists
  const outputDir = path.resolve(ROOT, '.tmp', 'visual-qa', `reel-${reel.id}`)
  fs.mkdirSync(outputDir, { recursive: true })

  // 4. Launch Headless Chrome
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

  console.log(`\n📸 Capturing ${samplePoints.length} dynamic scene-boundary frames at 1080x1920...`)

  const capturedSnapshots = []

  for (const sample of samplePoints) {
    const url = `${baseUrl}/?reel=${reel.id}&t=${sample.time}&frame&exact`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    // ⚠️ Runs IN THE PAGE: `globalThis` there is the browser window.
    await page.evaluate(() => globalThis.document.fonts.ready)

    // Extra brief settling for DOM styles
    await new Promise((r) => setTimeout(r, 60))

    const filePath = path.resolve(outputDir, `${sample.name}.png`)
    await page.screenshot({ path: filePath, type: 'png' })

    const stats = fs.statSync(filePath)
    console.log(
      `  ✓ [t = ${sample.time}s] ${sample.name}.png (${(stats.size / 1024).toFixed(1)} KB) — ${sample.desc}`,
    )

    capturedSnapshots.push({
      time: sample.time,
      name: sample.name,
      filePath,
      sizeBytes: stats.size,
      desc: sample.desc,
    })
  }

  await browser.close()
  await server.close()

  console.log(`\n✅ Visual QA Capture Complete: ${capturedSnapshots.length} frames saved in:`)
  console.log(`   ${outputDir}\n`)

  return capturedSnapshots
}

// Direct CLI invocation
const targetId = process.argv[2] || '52'
runVisualQA(targetId).catch((err) => {
  console.error('❌ Visual QA Failed:', err)
  process.exit(1)
})
