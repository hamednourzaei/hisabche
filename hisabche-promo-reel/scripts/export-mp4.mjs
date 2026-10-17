// ============================================
// Hisabche Promo Reel Studio — Deterministic MP4 & Audio Exporter
//
// 1. Frame Stepping via Puppeteer (1080x1920 @ 30fps)
// 2. Deterministic PCM/WAV Audio Synthesizer (from reelCues)
// 3. Automated H.264 / AAC Muxing via FFmpeg
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'
import puppeteer from 'puppeteer'
import { findVoiceoverFile } from './align-voiceover.mjs'
import { designSoundtrack } from './sound-design.mjs'
import { checkAvSync, printAvSync } from './check-av-sync.mjs'

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

// FFmpeg executable discovery
const FFMPEG_PATHS = [
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
]

function getFFmpegExecutablePath() {
  // 1. Check PATH
  const whereCmd = process.platform === 'win32' ? 'where.exe' : 'which'
  const checkPath = spawnSync(whereCmd, ['ffmpeg'], { encoding: 'utf8' })
  if (checkPath.status === 0 && checkPath.stdout.trim()) {
    const firstLine = checkPath.stdout.trim().split(/\r?\n/)[0].trim()
    if (firstLine && fs.existsSync(firstLine)) return firstLine
  }

  // 2. Check standard installation directories
  for (const p of FFMPEG_PATHS) {
    if (fs.existsSync(p)) return p
  }

  return null
}

// ─── Main Export Pipeline ────────────────────────────────────────────────────

export async function exportReelMP4(options = {}) {
  const targetReelId = String(options.reelId || '52')
  const fps = Number(options.fps || 30)
  const maxSeconds = options.seconds ? Number(options.seconds) : null

  console.log(`\n======================================================`)
  console.log(`🎥 Hisabche Reel Exporter — Reel #${targetReelId} (1080x1920 @ ${fps}fps)`)
  console.log(`======================================================\n`)

  const chromePath = getChromeExecutablePath()
  if (!chromePath) {
    throw new Error('No system Chrome or Edge browser found in standard installation paths.')
  }

  const ffmpegPath = getFFmpegExecutablePath()
  console.log(`✓ Chrome Engine: ${chromePath}`)
  console.log(
    ffmpegPath
      ? `✓ FFmpeg Binary: ${ffmpegPath}`
      : `⚠️ FFmpeg Binary: NOT FOUND on PATH or standard folders`,
  )

  // 1. Start local Vite server
  const server = await createServer({
    root: ROOT,
    server: { port: 5178, host: '127.0.0.1' },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.httpServer.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  // 2. Load Reel definition & cues
  const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
  const { reelCues } = await server.ssrLoadModule('/src/scenes/index.tsx')

  const reel = REELS.find((r) => r.id === targetReelId || r.id === targetReelId.padStart(2, '0'))
  if (!reel) {
    await server.close()
    throw new Error(`Reel ID '${targetReelId}' not found in REELS registry.`)
  }

  const totalDuration = maxSeconds ? Math.min(maxSeconds, reel.duration) : reel.duration
  const totalFrames = Math.ceil(totalDuration * fps)
  const cues = reelCues(reel)

  console.log(`✓ Loaded Reel: "${reel.title}"`)
  console.log(
    `✓ Duration: ${totalDuration}s (${totalFrames} frames) | Audio Cues: ${cues.length} events`,
  )

  // 3. Prepare Output Directories
  const tempExportDir = path.resolve(ROOT, '.tmp', 'export', `reel-${reel.id}`)
  const framesDir = path.resolve(tempExportDir, 'frames')
  // Finished videos live OUTSIDE the repository (owner, 17 Oct 2026): a
  // clean step in a git tool (git clean -fdx, «Discard all») wiped the ignored
  // exports folder on every push. Nothing under the repo can be pushed or
  // cleaned away from here. Override with HISABCHE_EXPORT_DIR.
  const exportsDir = path.resolve(
    process.env.HISABCHE_EXPORT_DIR || path.join(os.homedir(), 'Videos', 'hisabche-reels'),
  )

  fs.mkdirSync(framesDir, { recursive: true })
  fs.mkdirSync(exportsDir, { recursive: true })

  const voFile = findVoiceoverFile(reel.id)

  // 4. Synthesize Deterministic Audio Track (.wav)
  console.log(`\n🔊 Synthesizing audio track from ${cues.length} choreography cues...`)
  // Designed soundtrack: stereo, music bed with side-chain, scene drops, a
  // riser into the CTA, reverb and mastering (scripts/sound-design.mjs).
  const wavBuffer = designSoundtrack(cues, totalDuration, {
    sceneStarts: reel.scenes.map((scene) => scene.start),
    ctaAt: reel.scenes[reel.scenes.length - 1]?.start,
    reelId: reel.id,
    musicMood: reel.musicMood || 'calm',
    hasVoiceover: Boolean(voFile),
  })
  const wavPath = path.resolve(tempExportDir, 'audio.wav')
  fs.writeFileSync(wavPath, wavBuffer)
  console.log(
    `  ✓ Audio track synthesized: ${(wavBuffer.length / 1024).toFixed(1)} KB -> ${wavPath}`,
  )

  // 5. Deterministic Frame Capture via Puppeteer
  console.log(`\n📸 Rendering ${totalFrames} frames at 1080x1920 via fast seeking...`)

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })

  // Initial load
  const initialUrl = `${baseUrl}/?reel=${reel.id}&frame&exact`
  await page.goto(initialUrl, { waitUntil: 'domcontentloaded' })
  // ⚠️ These callbacks are serialised and run IN THE PAGE, where `globalThis` IS
  // the browser window. Written as `globalThis` (not `window`) so a Node-side
  // linter sees a declared global instead of an undefined one.
  await page.evaluate(() => globalThis.document.fonts.ready)

  // Ensure __SEEK_REEL is available
  await page.waitForFunction(() => typeof globalThis.__SEEK_REEL === 'function', { timeout: 5000 })

  const startTime = Date.now()
  for (let i = 0; i < totalFrames; i++) {
    const t = Number((i / fps).toFixed(4))
    await page.evaluate((time) => globalThis.__SEEK_REEL(time), t)

    const frameFile = path.resolve(framesDir, `frame_${String(i).padStart(5, '0')}.png`)
    await page.screenshot({ path: frameFile, type: 'png' })

    if (i > 0 && (i % 30 === 0 || i === totalFrames - 1)) {
      const pct = Math.round(((i + 1) / totalFrames) * 100)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1)
      process.stdout.write(
        `\r  Rendering: ${i + 1}/${totalFrames} frames (${pct}%) [${rate} fps, ${elapsed}s elapsed]`,
      )
    }
  }
  process.stdout.write('\n')

  await browser.close()
  await server.close()

  console.log(`✓ Frame rendering complete! All frames saved to:\n  ${framesDir}`)

  // 6. Encode & Mux to MP4
  const outputMp4 = path.resolve(exportsDir, `reel-${reel.id}.mp4`)

  if (!ffmpegPath) {
    console.log(`\n======================================================`)
    console.log(`⚠️ FFmpeg Not Detected on System PATH`)
    console.log(`======================================================`)
    console.log(`Frames and audio track were rendered deterministically without error.`)
    console.log(`To assemble into final MP4, install FFmpeg or run:`)
    console.log(
      `\n  ffmpeg -y -framerate ${fps} -i "${framesDir}\\frame_%05d.png" -i "${wavPath}" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -shortest "${outputMp4}"\n`,
    )
    return {
      success: false,
      blockedBy: 'FFMPEG_MISSING',
      framesDir,
      wavPath,
      outputMp4,
    }
  }

  let ffmpegArgs
  if (voFile) {
    console.log(`\n🎙️ Voiceover Audio Track Detected: ${voFile}`)
    console.log(`🎬 Muxing with FFmpeg (Frames + Human Voiceover + Ducked SFX): ${outputMp4}...`)
    ffmpegArgs = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(framesDir, 'frame_%05d.png'),
      '-i',
      voFile,
      '-i',
      wavPath,
      '-filter_complex',
      '[1:a]volume=1.0[v];[2:a]volume=0.45[s];[v][s]amix=inputs=2:duration=first:dropout_transition=2[a]',
      '-map',
      '0:v',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-preset',
      'slow',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '256k',
      '-shortest',
      outputMp4,
    ]
  } else {
    console.log(
      `\n⚠️ Notice: No recorded human voiceover found in audio/reel-${reel.id}-vo.wav or .mp3.`,
    )
    console.log(
      `   Exporting MP4 with RECORDED SFX & MUSIC BED (pending real voiceover recording).`,
    )
    console.log(`🎬 Muxing with FFmpeg (Frames + Recorded Audio Track): ${outputMp4}...`)
    ffmpegArgs = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(framesDir, 'frame_%05d.png'),
      '-i',
      wavPath,
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-preset',
      'slow',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '256k',
      '-shortest',
      outputMp4,
    ]
  }

  const ffmpegResult = spawnSync(ffmpegPath, ffmpegArgs, { stdio: 'inherit' })
  if (ffmpegResult.status !== 0) {
    console.error('❌ FFmpeg encoding failed with status code:', ffmpegResult.status)
    return {
      success: false,
      blockedBy: 'FFMPEG_ERROR',
      framesDir,
      wavPath,
      outputMp4,
    }
  }

  // AV SYNC GATE: every placed sound must start within SYNC_LAW.maxLagMs of
  // its cue, measured on what was produced (the MP4; the effects track when a
  // voiceover would mask the onsets). A miss fails the export.
  const sync = checkAvSync(voFile ? wavPath : outputMp4, cues, ffmpegPath, reel.id)
  printAvSync(sync)
  if (!sync.ok) {
    process.exitCode = 1
    return { success: false, blockedBy: 'AV_SYNC', framesDir, wavPath, outputMp4 }
  }

  const stat = fs.statSync(outputMp4)
  console.log(`\n======================================================`)
  console.log(`✅ Production MP4 Export Succeeded!`)
  console.log(`   File: ${outputMp4}`)
  console.log(`   Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`   Resolution: 1080x1920 (Vertical 9:16)`)
  console.log(`   Framerate: ${fps} fps`)
  console.log(`   Duration: ${totalDuration}s`)
  const alignmentPath = path.resolve(
    ROOT,
    'src',
    'reels',
    'alignments',
    `reel-${reel.id}-alignment.json`,
  )
  let alignmentStatus = 'PROVISIONAL_CADENCE_MODEL_ACTIVE'
  if (fs.existsSync(alignmentPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
      alignmentStatus =
        data.alignmentStatus ||
        (data.isProvisional ? 'PROVISIONAL_CADENCE_MODEL_ACTIVE' : 'REAL_WORD_ALIGNMENT_READY')
    } catch {
      // A malformed alignment file is not fatal: the provisional status stands.
    }
  }

  console.log(
    `   Voiceover: ${voFile ? `MUXED (${path.basename(voFile)})` : 'RECORDED SFX & MUSIC (pending human voiceover recording)'}`,
  )
  console.log(`   Alignment Status: ${alignmentStatus}`)
  console.log(`======================================================\n`)

  return {
    success: true,
    hasVoiceover: Boolean(voFile),
    voiceoverFile: voFile,
    alignmentStatus,
    outputMp4,
    sizeBytes: stat.size,
    totalFrames,
    fps,
  }
}

// Direct CLI Invocation
const args = process.argv.slice(2)
const reelId = args[0] || '52'
const fpsIndex = args.indexOf('--fps')
const fps = fpsIndex !== -1 ? Number(args[fpsIndex + 1]) : 30
const secIndex = args.indexOf('--seconds')
const seconds = secIndex !== -1 ? Number(args[secIndex + 1]) : null

exportReelMP4({ reelId, fps, seconds }).catch((err) => {
  console.error('❌ Export failed:', err)
  process.exit(1)
})
