// apps/web/scripts/landing-scene-verify.mjs
//
// Measures the landing's 3D hall in a real browser and writes what it found.
// It asserts nothing and hides nothing: every number goes into the JSON, and
// the report built from it marks what was not measured as UNVERIFIED.
//
//   node scripts/landing-scene-verify.mjs [baseUrl] [outDir]
//
// Needs a server already running (dev or production) and the Chromium that
// `@playwright/test` installed. Deterministic frames come from
// `reducedMotion: 'reduce'`: the scene then draws exactly where the page is,
// with no easing in between.

/* global document, window, HTMLCanvasElement, getComputedStyle, Image, requestAnimationFrame */
// (The functions handed to the page run in the browser, not in Node.)

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3039'
const OUT = process.argv[3] ?? join('..', '..', 'docs', 'landing', 'scene')
const SHOTS = join(OUT, 'shots')
mkdirSync(SHOTS, { recursive: true })

const VIEWPORTS = [
  [320, 568],
  [360, 740],
  [390, 844],
  [393, 852],
  [412, 915],
  [430, 932],
  [844, 390],
  [768, 1024],
  [820, 1180],
  [1366, 768],
  [1920, 1080],
]
/** [name, beat, how far into the beat]. Five stations: beats 1…5; 6 is the ending. */
const STOPS = [
  ['opening', 0, 0.6],
  ['walk-offline', 3, 0.12],
  ['pay', 1, 0.75],
  ['cash', 2, 0.75],
  ['stock', 3, 0.75],
  ['post', 4, 0.75],
  ['report', 5, 0.75],
  ['core', 6, 0.3],
  ['invitation', 6, 0.95],
]
const BEATS = 7
const KEPT = new Set(['fa-1366x768', 'fa-390x844', 'en-1366x768', 'af-390x844'])

const browser = await chromium.launch()
const results = { base: BASE, at: new Date().toISOString(), runs: [], extra: {} }

async function open(locale, width, height, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 768 ? 2 : 1,
    reducedMotion: options.motion ? 'no-preference' : 'reduce',
    hasTouch: width < 768,
  })
  if (options.noWebGL) {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return String(kind).startsWith('webgl') ? null : original.call(this, kind, ...rest)
      }
    })
  }
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 300))
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${String(error).slice(0, 300)}`))
  await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  if (!options.noWebGL) {
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.calls, null, {
      timeout: 90_000,
    })
  } else {
    await page.waitForTimeout(4000)
  }
  return { context, page, errors }
}

async function goTo(page, beat, local, wait = true) {
  await page.evaluate(
    ([b, l, beats]) => {
      const wrap = document.querySelector('canvas').parentElement.parentElement
      const span = wrap.offsetHeight - window.innerHeight
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo(
        0,
        wrap.getBoundingClientRect().top + window.scrollY + ((b + l) / beats) * span,
      )
    },
    [beat, local, BEATS],
  )
  if (wait) {
    await page
      .waitForFunction((b) => document.querySelector('canvas')?.dataset.beat === String(b), beat, {
        timeout: 8000,
      })
      .catch(() => {})
  }
  await page.waitForTimeout(350)
}

/** Everything the page can say about itself at this stop. */
function probe(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('canvas').parentElement
    const box = (element) => {
      if (!element) return null
      const style = getComputedStyle(element)
      if (style.display === 'none' || Number(style.opacity) === 0) return null
      const r = element.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
    }
    const caption = [...frame.querySelectorAll(':scope > section')].find(
      (section) => getComputedStyle(section).display !== 'none',
    )
    const parts = {
      header: box(document.querySelector('header')),
      route: box(frame.querySelector('nav ol')),
      caption: box(caption?.firstElementChild),
      skip: box([...frame.querySelectorAll(':scope > button')].at(-1)),
      bubble: box(frame.querySelector(':scope > p[aria-hidden]')),
      chip: box(frame.querySelector(':scope > p[role=status]')),
    }
    const names = Object.keys(parts).filter((name) => parts[name])
    const overlaps = []
    for (let a = 0; a < names.length; a++) {
      for (let b = a + 1; b < names.length; b++) {
        const one = parts[names[a]]
        const two = parts[names[b]]
        const wide = Math.min(one.x + one.w, two.x + two.w) - Math.max(one.x, two.x)
        const tall = Math.min(one.y + one.h, two.y + two.h) - Math.max(one.y, two.y)
        if (wide > 1 && tall > 1)
          overlaps.push(`${names[a]}×${names[b]} ${Math.round(wide)}×${Math.round(tall)}`)
      }
    }
    const clipped = names.filter((name) => {
      const r = parts[name]
      return (
        r.x < -1 ||
        r.y < -1 ||
        r.x + r.w > window.innerWidth + 1 ||
        r.y + r.h > window.innerHeight + 1
      )
    })
    const targets = [...frame.querySelectorAll('nav button')]
      .map((button) => button.getBoundingClientRect())
      .filter((r) => r.width > 0)
    const data = document.querySelector('canvas').dataset
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlaps,
      clipped,
      smallestTarget: targets.length
        ? Math.round(Math.min(...targets.map((r) => Math.min(r.width, r.height))))
        : null,
      skipHeight: parts.skip ? Math.round(parts.skip.h) : null,
      counter: caption?.querySelector('p')?.innerText ?? null,
      calls: Number(data.calls ?? 0),
      triangles: Number(data.triangles ?? 0),
      textures: Number(data.textures ?? 0),
      geometries: Number(data.geometries ?? 0),
      cover: Number(data.cover ?? 0),
      scene: frame.dataset.scene ?? null,
      fallbackBoard: Boolean(frame.querySelector(':scope > div > dl')),
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
    }
  })
}

/** What the picture itself looks like: brightness, and how much of it is one flat colour. */
async function look(page, shot) {
  const data = shot.toString('base64')
  return page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = Math.round((160 * image.height) / image.width)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const tones = new Map()
    let sum = 0
    for (let i = 0; i < px.length; i += 4) {
      sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
      const key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3)
      tones.set(key, (tones.get(key) ?? 0) + 1)
    }
    const count = px.length / 4
    return {
      luminance: Number((sum / count).toFixed(3)),
      tones: tones.size,
      largestFlat: Number((Math.max(...tones.values()) / count).toFixed(3)),
    }
  }, data)
}

// ── The matrix: every stop × every size in Persian; two sizes in Dari and English ──
const plan = [
  ...VIEWPORTS.map(([w, h]) => ['fa', w, h]),
  ['af', 390, 844],
  ['af', 1366, 768],
  ['en', 390, 844],
  ['en', 1366, 768],
]
for (const [locale, width, height] of plan) {
  const id = `${locale}-${width}x${height}`
  const run = { id, locale, width, height, stops: [], errors: [] }
  try {
    const { context, page, errors } = await open(locale, width, height)
    for (const [name, beat, local] of STOPS) {
      await goTo(page, beat, local)
      const shot = await page.screenshot({ type: 'png' })
      const seen = { name, ...(await probe(page)), ...(await look(page, shot)) }
      run.stops.push(seen)
      if (KEPT.has(id))
        await page.screenshot({ path: join(SHOTS, `${id}-${name}.jpg`), type: 'jpeg', quality: 62 })
    }
    run.errors = errors
    await context.close()
  } catch (error) {
    run.failed = String(error).slice(0, 300)
  }
  results.runs.push(run)
  console.log(id, run.failed ?? `${run.stops.length} stops, ${run.errors.length} console errors`)
}

// ── No WebGL: the page must still tell the story ──
{
  const { context, page, errors } = await open('fa', 1366, 768, { noWebGL: true })
  await goTo(page, 1, 0.75, false)
  await page.waitForTimeout(600)
  const seen = await probe(page)
  await page.screenshot({
    path: join(SHOTS, 'fa-1366x768-no-webgl.jpg'),
    type: 'jpeg',
    quality: 62,
  })
  results.extra.noWebGL = {
    fallbackBoard: seen.fallbackBoard,
    scene: seen.scene,
    counter: seen.counter,
    errors,
  }
  await context.close()
  console.log('no-webgl', JSON.stringify(results.extra.noWebGL))
}

// ── Going round three times: does the renderer keep what it should, and no more? ──
{
  const { context, page, errors } = await open('fa', 1366, 768)
  const passes = []
  for (let pass = 0; pass < 3; pass++) {
    for (const [, beat, local] of STOPS) await goTo(page, beat, local)
    const seen = await probe(page)
    passes.push({ textures: seen.textures, geometries: seen.geometries })
    await goTo(page, 0, 0.1)
  }
  results.extra.leak = { passes, errors }
  await context.close()
  console.log('leak', JSON.stringify(passes))
}

// ── With motion on: how long a frame takes here (this machine, headless) ──
{
  const { context, page, errors } = await open('fa', 1366, 768, { motion: true })
  await goTo(page, 2, 0.6, false)
  await page.waitForTimeout(2500)
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const gaps = []
        let last = performance.now()
        const tick = (now) => {
          gaps.push(now - last)
          last = now
          if (gaps.length < 180) requestAnimationFrame(tick)
          else resolve(gaps.slice(5).sort((a, b) => a - b))
        }
        requestAnimationFrame(tick)
      }),
  )
  results.extra.frames = {
    samples: frames.length,
    median: Number(frames[Math.floor(frames.length / 2)].toFixed(1)),
    p95: Number(frames[Math.floor(frames.length * 0.95)].toFixed(1)),
    note: 'headless Chromium on the development machine; not a phone, not a production build',
    errors,
  }
  await context.close()
  console.log('frames', JSON.stringify(results.extra.frames))
}

await browser.close()
writeFileSync(join(OUT, 'verify-results.json'), `${JSON.stringify(results, null, 2)}\n`)
console.log('written', join(OUT, 'verify-results.json'))
