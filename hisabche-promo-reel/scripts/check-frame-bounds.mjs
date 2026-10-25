// Nothing may leave the frame (owner, 24 Oct 2026: «از کادر هم بیرون نزنن»).
// Renders a reel exactly as the exporter does (1080×1920, frame by frame through __SEEK_REEL) and, at
// every sampled moment, measures every visible piece of text and every recording against the frame.
//
//   node scripts/check-frame-bounds.mjs <reelId> [--step 0.5] [--margin 24]
//
// Exit code 1 and a list of {second, what, how far outside} when anything crosses the frame edge, or
// comes closer to it than the safe margin (default 24 px of the 1080×1920 frame — a line of type that
// touches the edge is "out" to a phone's rounded corners). Text that is fully transparent, hidden or
// clipped to nothing (an animation's not-yet-written part) is not measured.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FRAME = { width: 1080, height: 1920 }

function chrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]) {
    if (fs.existsSync(p)) return p
  }
  const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['google-chrome'], {
    encoding: 'utf8',
  })
  return found.status === 0 ? found.stdout.trim().split(/\r?\n/)[0] : null
}

/** Pure: which measured boxes break the frame, by how much (negative slack = outside). */
export function violationsOf(boxes, frame = FRAME, margin = 24) {
  const out = []
  for (const box of boxes) {
    const slack = {
      left: box.left - 0,
      top: box.top - 0,
      right: frame.width - box.right,
      bottom: frame.height - box.bottom,
    }
    const worst = Math.min(slack.left, slack.top, slack.right, slack.bottom)
    if (worst < margin) {
      const side = Object.entries(slack).find(([, v]) => v === worst)?.[0] ?? 'left'
      out.push({ what: box.what, side, slack: Math.round(worst), outside: worst < 0 })
    }
  }
  return out
}

export async function checkReel(reelId, { step = 0.5, margin = 24 } = {}) {
  const chromePath = chrome()
  if (!chromePath) throw new Error('No Chrome or Edge found')
  const server = await createServer({
    root: ROOT,
    server: { port: 5188, host: '127.0.0.1', hmr: false, watch: null },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.httpServer.address().port
  const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
  const reel = REELS.find(
    (r) => String(r.id) === String(reelId) || String(r.id) === String(reelId).padStart(2, '0'),
  )
  if (!reel) {
    await server.close()
    throw new Error(`reel ${reelId} not found`)
  }
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const found = new Map()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: FRAME.width, height: FRAME.height, deviceScaleFactor: 1 })
    await page.goto(`http://127.0.0.1:${port}/?reel=${reel.id}&frame&exact`, {
      waitUntil: 'domcontentloaded',
    })
    await page.evaluate(() => globalThis.document.fonts.ready)
    await page.waitForFunction(() => typeof globalThis.__SEEK_REEL === 'function', {
      timeout: 8000,
    })
    const end = reel.scenes[reel.scenes.length - 1].end
    for (let t = 0; t < end; t += step) {
      await page.evaluate((time) => globalThis.__SEEK_REEL(time), Number(t.toFixed(3)))
      const boxes = await page.evaluate(async () => {
        await new Promise((r) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)),
        )
        await Promise.all([...(globalThis.__REEL_MEDIA_PENDING ?? [])])
        const doc = globalThis.document
        const seen = (el) => {
          for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
            const s = globalThis.getComputedStyle(node)
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05)
              return false
          }
          return true
        }
        const result = []
        const walker = doc.createTreeWalker(doc.body, globalThis.NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent.trim()
          if (!text || !node.parentElement || !seen(node.parentElement)) continue
          if (node.parentElement.closest('script,style,aside,.panel')) continue
          const range = doc.createRange()
          range.selectNodeContents(node)
          for (const r of range.getClientRects()) {
            if (r.width < 1 || r.height < 1) continue
            // Text hidden behind an opaque scene (the engine's own backdrop sits under it) is not on screen.
            const cx = (r.left + r.right) / 2
            const cy = (r.top + r.bottom) / 2
            const inside =
              cx >= 0 && cx < globalThis.innerWidth && cy >= 0 && cy < globalThis.innerHeight
            if (inside) {
              const hit = doc.elementFromPoint(cx, cy)
              if (!hit || !(node.parentElement.contains(hit) || hit.contains(node.parentElement)))
                continue
            }
            result.push({
              what: text.slice(0, 40),
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
            })
          }
        }
        for (const el of doc.querySelectorAll('video,[role=img]')) {
          if (!seen(el)) continue
          const r = el.getBoundingClientRect()
          result.push({
            what: `recording ${el.tagName.toLowerCase()}`,
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
          })
        }
        return result
      })
      for (const v of violationsOf(boxes, FRAME, margin)) {
        const key = `${v.what}|${v.side}`
        const previous = found.get(key)
        if (!previous || v.slack < previous.slack)
          found.set(key, { ...v, second: Number(t.toFixed(2)) })
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }
  return {
    reel: String(reel.id),
    seconds: reel.scenes[reel.scenes.length - 1].end,
    problems: [...found.values()].sort((a, b) => a.second - b.second),
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const reelId = args[0]
  const stepAt = args.indexOf('--step')
  const marginAt = args.indexOf('--margin')
  const result = await checkReel(reelId, {
    step: stepAt >= 0 ? Number(args[stepAt + 1]) : 0.5,
    margin: marginAt >= 0 ? Number(args[marginAt + 1]) : 24,
  })
  console.log(
    `reel ${result.reel} · ${result.seconds}s · ${result.problems.length} frame-edge problem(s)`,
  )
  for (const p of result.problems) {
    console.log(
      `  ${p.outside ? 'OUTSIDE' : 'TOO CLOSE'} @${p.second}s  «${p.what}»  ${p.side} ${p.slack}px`,
    )
  }
  process.exitCode = result.problems.length ? 1 : 0
}
