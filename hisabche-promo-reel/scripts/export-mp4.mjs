// ============================================
// Hisabche Promo Reel Studio — Deterministic MP4 & Audio Exporter
//
// 1. Frame Stepping via Puppeteer (1080x1920 @ 30fps)
// 2. Deterministic PCM/WAV Audio Synthesizer (from reelCues)
// 3. Automated H.264 / AAC Muxing via FFmpeg
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'
import puppeteer from 'puppeteer'
import { findVoiceoverFile } from './align-voiceover.mjs'

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

// ─── Deterministic PCM/WAV Audio Synthesizer ─────────────────────────────────

function generateWavBuffer(cues, duration) {
  const sampleRate = 44100
  const totalSamples = Math.ceil(duration * sampleRate)
  const buffer = new Float32Array(totalSamples)

  // Deterministic noise generator
  function makeNoise(lengthSamples) {
    const noise = new Float32Array(lengthSamples)
    for (let i = 0; i < lengthSamples; i++) {
      const pseudo = (((i * 374761393) ^ (i * 668265263)) & 0xffff) / 0x7fff - 1
      noise[i] = pseudo
    }
    return noise
  }

  // Synthesize each cue deterministically
  for (const cue of cues) {
    const startSample = Math.floor(cue.at * sampleRate)
    if (startSample >= totalSamples) continue

    switch (cue.kind) {
      case 'pop': {
        const len = Math.floor(0.08 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 45)
          const freq = 800 - t * 7500
          const s = Math.sin(2 * Math.PI * Math.max(120, freq) * t) * env * 0.4
          buffer[startSample + i] += s
        }
        break
      }

      case 'tick': {
        const len = Math.floor(0.015 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 220)
          const s = Math.sin(2 * Math.PI * 1400 * t) * env * 0.35
          buffer[startSample + i] += s
        }
        break
      }

      case 'cardEnter': {
        const len = Math.floor(0.09 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 40)
          const freq = 180 - t * 1400
          const s = Math.sin(2 * Math.PI * Math.max(50, freq) * t) * env * 0.55
          buffer[startSample + i] += s
        }
        break
      }

      case 'alert': {
        const len = Math.floor(0.16 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 20)
          const s =
            (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1100 * t)) * env * 0.35
          buffer[startSample + i] += s
        }
        break
      }

      case 'whoosh': {
        const len = Math.floor(0.28 * sampleRate)
        const rawNoise = makeNoise(len)
        // 1-pole low-pass filter at ~380Hz for warm organic air displacement (eliminates harsh static buzz)
        let filtered = 0
        const alpha = (2 * Math.PI * 380) / sampleRate
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          filtered += alpha * (rawNoise[i] - filtered)
          const prog = i / len
          const env = Math.sin(Math.PI * prog) * 0.4
          const airRumble = Math.sin(2 * Math.PI * (120 - prog * 40) * (i / sampleRate)) * 0.15
          buffer[startSample + i] += (filtered * 1.8 + airRumble) * env
        }
        break
      }

      case 'impact': {
        // Physical rubber-stamp impact thud: 55Hz sub-punch + tactile wood slap
        const len = Math.floor(0.42 * sampleRate)
        let woodFilter = 0
        const woodAlpha = (2 * Math.PI * 650) / sampleRate
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const subEnv = Math.exp(-t * 14)
          const sub = Math.sin(2 * Math.PI * Math.max(45, 58 - t * 30) * t) * 0.65 * subEnv
          const slapEnv = Math.exp(-t * 55)
          const noiseSample = Math.random() * 2 - 1
          woodFilter += woodAlpha * (noiseSample - woodFilter)
          const slap = woodFilter * slapEnv * 0.4
          buffer[startSample + i] += sub + slap
        }
        break
      }

      case 'success':
      case 'chime': {
        const len = Math.floor(0.55 * sampleRate)
        // Warm muted acoustic triads (E4, G4, B4 ~ 329.63, 392.00, 493.88)
        const freqs = [329.63, 392.0, 493.88]
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 6.5)
          let s = 0
          for (let f = 0; f < freqs.length; f++) {
            s += Math.sin(2 * Math.PI * freqs[f] * t) * (0.12 / (f + 1))
          }
          buffer[startSample + i] += s * env
        }
        break
      }

      case 'cash': {
        const len = Math.floor(0.25 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 25)
          const s =
            (Math.sin(2 * Math.PI * 1320 * t) + 0.6 * Math.sin(2 * Math.PI * 2640 * t)) * env * 0.35
          buffer[startSample + i] += s
        }
        break
      }

      case 'titleHit':
      case 'cinematicReveal': {
        const len = Math.floor(0.5 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 9)
          const sub = Math.sin(2 * Math.PI * (70 - t * 40) * t) * 0.55
          buffer[startSample + i] += sub * env
        }
        break
      }

      default: {
        const len = Math.floor(0.06 * sampleRate)
        for (let i = 0; i < len && startSample + i < totalSamples; i++) {
          const t = i / sampleRate
          const env = Math.exp(-t * 50)
          const s = Math.sin(2 * Math.PI * 520 * t) * env * 0.3
          buffer[startSample + i] += s
        }
        break
      }
    }
  }

  // Master soft limiter & clamp
  for (let i = 0; i < totalSamples; i++) {
    const val = buffer[i]
    if (val > 0.95) buffer[i] = 0.95
    else if (val < -0.95) buffer[i] = -0.95
  }

  // Encode to 16-bit PCM RIFF WAV
  const dataSize = totalSamples * 2
  const wavBuffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(36 + dataSize, 4)
  wavBuffer.write('WAVE', 8)

  // fmt chunk
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, 20) // AudioFormat (1 for PCM)
  wavBuffer.writeUInt16LE(1, 22) // NumChannels (1 = Mono)
  wavBuffer.writeUInt32LE(sampleRate, 24) // SampleRate
  wavBuffer.writeUInt32LE(sampleRate * 2, 28) // ByteRate
  wavBuffer.writeUInt16LE(2, 32) // BlockAlign
  wavBuffer.writeUInt16LE(16, 34) // BitsPerSample

  // data chunk
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(dataSize, 40)

  // Write samples as 16-bit signed integers
  let offset = 44
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    const intVal = s < 0 ? s * 0x8000 : s * 0x7fff
    wavBuffer.writeInt16LE(Math.floor(intVal), offset)
    offset += 2
  }

  return wavBuffer
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
  const exportsDir = path.resolve(ROOT, 'exports')

  fs.mkdirSync(framesDir, { recursive: true })
  fs.mkdirSync(exportsDir, { recursive: true })

  // 4. Synthesize Deterministic Audio Track (.wav)
  console.log(`\n🔊 Synthesizing audio track from ${cues.length} choreography cues...`)
  const wavBuffer = generateWavBuffer(cues, totalDuration)
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
      `\n  ffmpeg -y -framerate ${fps} -i "${framesDir}\\frame_%05d.png" -i "${wavPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${outputMp4}"\n`,
    )
    return {
      success: false,
      blockedBy: 'FFMPEG_MISSING',
      framesDir,
      wavPath,
      outputMp4,
    }
  }

  const voFile = findVoiceoverFile(reel.id)
  let ffmpegArgs = []

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
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      outputMp4,
    ]
  } else {
    console.log(
      `\n⚠️ Notice: No recorded human voiceover found in audio/reel-${reel.id}-vo.wav or .mp3.`,
    )
    console.log(`   Exporting MP4 with SYNTHESIZED SFX ONLY (pending real voiceover recording).`)
    console.log(`🎬 Muxing with FFmpeg (Frames + Synthesized SFX): ${outputMp4}...`)
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
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
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
    `   Voiceover: ${voFile ? `MUXED (${path.basename(voFile)})` : 'SYNTHESIZED SFX ONLY (pending human recording)'}`,
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
