/* global document */
// ============================================
// Hisabche Promo Reel — Standalone Free-Reels MP4 Exporter
// Renders the 3 unconstrained bazaar & commerce narrative videos into 1080x1920 MP4
// Usage:
//   node scripts/export-free-reel.mjs 1 [maxSeconds]  -> Reel 1: Bazaar Humor (30s)
//   node scripts/export-free-reel.mjs 2 [maxSeconds]  -> Reel 2: Warehouse Mystery (42s)
//   node scripts/export-free-reel.mjs 3 [maxSeconds]  -> Reel 3: Partners' Dispute (44s)
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'
import puppeteer from 'puppeteer'
import { designSoundtrack } from './sound-design.mjs'

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

const FFMPEG_PATHS = [
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
]

function getFFmpegExecutablePath() {
  const whereCmd = process.platform === 'win32' ? 'where.exe' : 'which'
  const checkPath = spawnSync(whereCmd, ['ffmpeg'], { encoding: 'utf8' })
  if (checkPath.status === 0 && checkPath.stdout.trim()) {
    const firstLine = checkPath.stdout.trim().split(/\r?\n/)[0].trim()
    if (firstLine && fs.existsSync(firstLine)) return firstLine
  }
  for (const p of FFMPEG_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export async function exportFreeReel(options = {}) {
  const rawTarget = String(options.target || '1').toLowerCase()
  const targetIndex =
    rawTarget === '2' || rawTarget === 'warehouse'
      ? 1
      : rawTarget === '3' || rawTarget === 'partners'
        ? 2
        : 0

  const fps = Number(options.fps || 30)

  const chromePath = getChromeExecutablePath()
  if (!chromePath) {
    throw new Error('No system Chrome or Edge browser found in standard installation paths.')
  }

  const ffmpegPath = getFFmpegExecutablePath()

  // 1. Start local Vite server
  const server = await createServer({
    root: ROOT,
    server: {
      port: 5180 + targetIndex,
      host: '127.0.0.1',
      hmr: false,
      watch: null,
    },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.httpServer.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  // 2. Load Free-Reel catalog
  const { FREE_REELS_CATALOG } = await server.ssrLoadModule('/src/freestyle/bazaar-humor-data.ts')
  const current = FREE_REELS_CATALOG[targetIndex] || FREE_REELS_CATALOG[0]

  const totalDuration = options.seconds
    ? Math.min(Number(options.seconds), current.meta.duration)
    : current.meta.duration
  const totalFrames = Math.ceil(totalDuration * fps)
  const cues = current.cues.filter((c) => !options.seconds || c.at < totalDuration)

  console.log(`\n======================================================`)
  console.log(`🎭 Hisabche Free-Reel Exporter — Video #${targetIndex + 1}: ${current.meta.title}`)
  console.log(`   (1080x1920 @ ${fps}fps | ${totalDuration}s)`)
  console.log(`======================================================\n`)
  console.log(`✓ Chrome Engine: ${chromePath}`)
  console.log(ffmpegPath ? `✓ FFmpeg Binary: ${ffmpegPath}` : `⚠️ FFmpeg Binary NOT FOUND`)
  console.log(`✓ Loaded: "${current.meta.title}"`)
  console.log(
    `✓ Duration: ${totalDuration}s (${totalFrames} frames) | Audio Cues: ${cues.length} events`,
  )

  // 3. Prepare Output Directories
  const tempExportDir = path.resolve(ROOT, '.tmp', 'export', current.meta.id)
  const framesDir = path.resolve(tempExportDir, 'frames')
  const exportsDir = path.resolve(
    process.env.HISABCHE_EXPORT_DIR || path.join(os.homedir(), 'Videos', 'hisabche-reels'),
  )

  fs.mkdirSync(framesDir, { recursive: true })
  fs.mkdirSync(exportsDir, { recursive: true })

  // 4. Synthesize Deterministic Audio Track (.wav)
  console.log(`\n🔊 Synthesizing audio track from ${cues.length} cues...`)
  const sceneStarts = current.scenes.map((s) => s.start)
  const ctaScene = current.scenes[current.scenes.length - 1]
  const wavBuffer = designSoundtrack(cues, totalDuration, {
    reelId: current.meta.id,
    musicMood: targetIndex === 1 ? 'tense' : 'calm',
    sceneStarts,
    ctaAt: ctaScene.start,
  })

  const wavPath = path.resolve(tempExportDir, 'soundtrack.wav')
  fs.writeFileSync(wavPath, wavBuffer)
  console.log(
    `  ✓ Audio track synthesized: ${(wavBuffer.length / 1024).toFixed(1)} KB -> ${wavPath}`,
  )

  // 5. Deterministic Frame Capture via Puppeteer
  console.log(`\n📸 Rendering ${totalFrames} frames at 1080x1920 via fast seeking...`)
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })

  const initialUrl = `${baseUrl}/?free=${targetIndex + 1}&frame&exact`
  await page.goto(initialUrl, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
  })

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps
    await page.evaluate((timestamp) => {
      const g = globalThis
      if (typeof g.__SEEK_REEL === 'function') {
        g.__SEEK_REEL(timestamp)
      }
    }, t)

    const frameFile = path.resolve(framesDir, `frame_${String(frame).padStart(5, '0')}.png`)
    await page.screenshot({ path: frameFile, type: 'png' })

    if (frame % 30 === 0 || frame === totalFrames - 1) {
      const pct = Math.round(((frame + 1) / totalFrames) * 100)
      process.stdout.write(
        `\r  [${pct}%] Rendered frame ${frame + 1}/${totalFrames} (t=${t.toFixed(2)}s)`,
      )
    }
  }
  console.log(`\n✓ All ${totalFrames} frames captured successfully.`)
  await browser.close()
  await server.close()

  // 6. Mux into MP4 with FFmpeg
  if (ffmpegPath) {
    const outputMp4 = path.resolve(exportsDir, `${current.meta.id}.mp4`)
    console.log(`\n🎬 Encoding final MP4 with FFmpeg -> ${outputMp4}`)
    const ffmpegArgs = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.resolve(framesDir, 'frame_%05d.png'),
      '-i',
      wavPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'fast',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      outputMp4,
    ]

    const enc = spawnSync(ffmpegPath, ffmpegArgs, { stdio: 'inherit' })
    if (enc.status === 0) {
      console.log(`\n🎉 SUCCESS! Video exported to: ${outputMp4}`)
      return outputMp4
    } else {
      console.error(`\n❌ FFmpeg encoding failed with status: ${enc.status}`)
    }
  } else {
    console.log(`\n⚠️ FFmpeg was not found. PNG frames and WAV audio saved in: ${tempExportDir}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetArg = process.argv[2] || '1'
  const secondsArg = process.argv[3] ? Number(process.argv[3]) : null
  exportFreeReel({ target: targetArg, seconds: secondsArg }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
