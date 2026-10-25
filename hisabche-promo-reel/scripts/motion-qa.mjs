// scripts/motion-qa.mjs
// Motion QA — multi-dimensional, output-driven.
//
//   TECHNICAL  : NaN-free markup, camera really moves, readable window, frame bounds (DOM)
//   COVERAGE   : camera / primary motion / metaphor on every scene
//   SEMANTIC   : metaphor matches role + content (unknown → shake, versus → opposition…)
//   VARIETY    : transitions, camera curves, metaphor mix, and a real comparison
//                against archived reels (identical motion path = FAIL)
//   PIXEL      : unique-frame signal (limited — never accepted on its own)
//
// Usage: node scripts/motion-qa.mjs [reelId=75]
// Exit code 1 when any hard check FAILs.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const reelId = process.argv[2] || '75'

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

const server = await createServer({
  root: ROOT,
  server: { port: 0, host: '127.0.0.1' },
  logLevel: 'error',
})
await server.listen()

const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
const { SceneView } = await server.ssrLoadModule('/src/scenes/index.tsx')
const { runPlanAudit } = await server.ssrLoadModule('/src/engine/motion-qa.ts')
const { planSceneMotion } = await server.ssrLoadModule('/src/engine/motion-plan.ts')

const reel = REELS.find((r) => r.id === reelId)
if (!reel) {
  console.error(`Reel ${reelId} not found`)
  await server.close()
  process.exit(1)
}

const archive = REELS.filter((r) => Number(r.id) < Number(reelId)).slice(-3)

const render = (scene, t) =>
  renderToString(React.createElement(SceneView, { scene, t, scenes: reel.scenes }))

const scaleOf = (html) => {
  const m = html.match(/scale\(([\d.]+)\)/)
  return m ? Number(m[1]) : null
}

const domChecks = []

for (const scene of reel.scenes) {
  const dur = scene.end - scene.start
  const plan = planSceneMotion(scene, reel.scenes)
  const tag = `${scene.spec.kind}@${scene.start.toFixed(1)}s`

  const samples = [0.05, dur * 0.5, Math.max(0.2, dur - 0.05)]
  const htmls = samples.map((t) => render(scene, t))

  const nan = htmls.some((h) => h.includes('NaN') || h.includes('undefinedpx'))
  domChecks.push({
    category: 'technical',
    id: `technical.nan:${tag}`,
    status: nan ? 'FAIL' : 'PASS',
    detail: nan ? 'NaN/undefined in rendered style' : 'clean markup',
  })

  const scaleStart = scaleOf(htmls[0])
  const scaleEnd = scaleOf(htmls[2])
  const cameraMoves = scaleStart !== null && scaleEnd !== null && scaleEnd > scaleStart
  domChecks.push({
    category: 'technical',
    id: `technical.camera-moves:${tag}`,
    status: cameraMoves ? 'PASS' : 'FAIL',
    detail: `scale ${scaleStart} → ${scaleEnd} (plan ${plan.camera.from.toFixed(2)} → ${plan.camera.to.toFixed(2)})`,
  })

  if (plan.metaphor) {
    const rendered = htmls.some((h) => h.includes(`data-metaphor="${plan.metaphor}"`))
    domChecks.push({
      category: 'coverage',
      id: `coverage.metaphor-rendered:${tag}`,
      status: rendered ? 'PASS' : 'FAIL',
      detail: `data-metaphor="${plan.metaphor}" ${rendered ? 'present in output' : 'MISSING from output'}`,
    })
  }

  // Post-entrance motion: two frames 0.35s apart after the entrance must differ.
  const t1 = Math.max(2.5, dur * 0.6)
  const t2 = t1 + 0.35
  const after1 = render(scene, Math.min(t1, dur - 0.05))
  const after2 = render(scene, Math.min(t2, dur - 0.05))
  const movesAfterEntrance = after1 !== after2
  domChecks.push({
    category: 'technical',
    id: `technical.post-entrance:${tag}`,
    status: movesAfterEntrance ? 'PASS' : 'FAIL',
    detail: movesAfterEntrance
      ? 'frame changes after entrance (no static slide)'
      : 'STATIC after entrance — slide-like',
  })
}

const audit = runPlanAudit(reel, archive)

// ── PIXEL stage (limited signal, never a pass on its own) ──────────────────
let pixelCheck = {
  category: 'technical',
  id: 'technical.pixel-variance',
  status: 'UNVERIFIED',
  detail: 'Chrome not found — pixel stage skipped',
}
const chromePath = CHROME_PATHS.find((p) => fs.existsSync(p))
if (chromePath) {
  try {
    const puppeteer = (await import('puppeteer')).default
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: ['--no-sandbox'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
    const sizes = []
    const frames = 12
    for (let i = 0; i < frames; i++) {
      const t = (i / (frames - 1)) * Math.min(8, reel.duration)
      await page
        .goto(`${await serverUrl()}/?reel=${reelId}&t=${t.toFixed(3)}&exact`, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        })
        .catch(() => {})
      const shot = await page.screenshot({ type: 'png' })
      sizes.push(shot.length)
    }
    await browser.close()
    const unique = new Set(sizes).size
    pixelCheck = {
      category: 'technical',
      id: 'technical.pixel-variance',
      status: unique >= frames * 0.5 ? 'PASS' : unique > 2 ? 'FAIL' : 'FAIL',
      detail: `${unique}/${frames} unique frame sizes (limited signal — not a quality proof)`,
    }
  } catch (err) {
    pixelCheck = {
      category: 'technical',
      id: 'technical.pixel-variance',
      status: 'UNVERIFIED',
      detail: `pixel stage failed: ${String(err).slice(0, 120)}`,
    }
  }
}

function serverUrl() {
  const addr = server.httpServer.address()
  return `http://127.0.0.1:${addr.port}`
}

await server.close()

const checks = [...audit.checks, ...domChecks, pixelCheck]
const order = { technical: 0, coverage: 1, semantic: 2, variety: 3 }
checks.sort((a, b) => order[a.category] - order[b.category])

const label = { PASS: 'PASS  ', FAIL: 'FAIL  ', UNVERIFIED: 'UNVERIF' }
let failed = 0
console.log(`\nMotion QA — reel ${reelId} (${reel.duration}s, ${reel.scenes.length} scenes)\n`)
for (const c of checks) {
  if (c.status === 'FAIL') failed++
  console.log(
    `  [${label[c.status]}] ${c.category.padEnd(9)} ${c.id.replace(/^(technical|coverage|semantic|variety)\./, '')} — ${c.detail}`,
  )
}

const passed = checks.filter((c) => c.status === 'PASS').length
const unverified = checks.filter((c) => c.status === 'UNVERIFIED').length
console.log(`\n  ${passed} PASS · ${failed} FAIL · ${unverified} UNVERIFIED`)
console.log(
  failed === 0
    ? '  RESULT: PASS (semantic + coverage + variety) — visual quality still needs a human frame review\n'
    : '  RESULT: FAIL — see the FAIL rows above\n',
)

process.exit(failed === 0 ? 0 : 1)
