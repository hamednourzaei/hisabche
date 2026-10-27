// ============================================
// scripts/build-remotion-audio.mjs — the soundtrack Remotion renders with.
//
// The Vite/Puppeteer exporter already designs its own audio (scripts/sound-
// design.mjs: music bed, scene drops, a designed transient per SoundKind,
// reverb, mastering). Remotion renders video only, so it needs the same track
// as a file. This script does not re-implement the sound: it asks the exporter
// for the reel's real cue list (reelCues — the same function the MP4 export
// uses) and hands it to the same designSoundtrack().
//
//   node scripts/build-remotion-audio.mjs 82 83
//
// Writes remotion/public/audio/reel-<id>.wav and the manifest Remotion reads
// (remotion/src/audio-manifest.json), so a composition only points at a track
// that really exists.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { designSoundtrack } from './sound-design.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function getFFmpegPath() {
  const whereCmd = process.platform === 'win32' ? 'where.exe' : 'which'
  try {
    const res = spawnSync(whereCmd, ['ffmpeg'], { encoding: 'utf8', windowsHide: true })
    if (res.status === 0 && res.stdout) {
      const line = res.stdout.trim().split(/\r?\n/)[0].trim()
      if (line && fs.existsSync(line)) return line
    }
  } catch {
    // optional lookup failed: fall through to the standard paths below
  }
  const standardPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
  ]
  for (const p of standardPaths) {
    if (fs.existsSync(p)) return p
  }
  return 'ffmpeg'
}

const FFMPEG = getFFmpegPath()
const TARGET_LUFS = -14
const TARGET_TP = -1.5
const requested = process.argv.slice(2)

/**
 * The exporter's music bed is mixed around a voiceover, so on its own it sits
 * far below social platforms' −14 LUFS. Two-pass loudnorm (measure, then apply
 * a linear gain with a true-peak ceiling) puts the finished track where a phone
 * plays it, without pumping the bed.
 */
function loudnessNormalize(file) {
  const measure = spawnSync(
    FFMPEG,
    [
      '-hide_banner',
      '-i',
      file,
      '-af',
      `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=11:print_format=json`,
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  )
  const stderr = measure.stderr ?? ''
  const jsonStart = stderr.lastIndexOf('{')
  const jsonEnd = jsonStart === -1 ? -1 : stderr.indexOf('}', jsonStart)
  if (jsonStart === -1 || jsonEnd === -1) throw new Error(`loudnorm could not measure ${file}`)
  const m = JSON.parse(stderr.slice(jsonStart, jsonEnd + 1))

  const normalized = file.replace(/\.wav$/, '.normalized.wav')
  const apply = spawnSync(
    FFMPEG,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      file,
      '-af',
      `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      '-ar',
      '48000',
      normalized,
    ],
    { encoding: 'utf8', windowsHide: true },
  )
  if (apply.status !== 0) throw new Error(`loudnorm failed: ${apply.stderr}`)
  fs.renameSync(normalized, file)
  return Number(m.input_i)
}

if (requested.length === 0) {
  console.error('usage: node scripts/build-remotion-audio.mjs <reelId> [reelId...]')
  process.exit(1)
}

const server = await createServer({
  root: ROOT,
  server: { port: 5181, host: '127.0.0.1', hmr: false, watch: null },
  logLevel: 'error',
})
await server.listen()

try {
  const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
  const { reelCues } = await server.ssrLoadModule('/src/scenes/index.tsx')

  const audioDir = path.resolve(ROOT, 'remotion', 'public', 'audio')
  fs.mkdirSync(audioDir, { recursive: true })

  const manifestPath = path.resolve(ROOT, 'remotion', 'src', 'audio-manifest.json')
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {}

  for (const rawId of requested) {
    const id = rawId.padStart(2, '0')
    const reel = REELS.find((r) => r.id === rawId || r.id === id)
    if (!reel) throw new Error(`Reel '${rawId}' not found in REELS`)

    const cues = reelCues(reel)
    const wav = designSoundtrack(cues, reel.duration, {
      sceneStarts: reel.scenes.map((scene) => scene.start),
      ctaAt: reel.scenes[reel.scenes.length - 1]?.start,
      reelId: reel.id,
      musicMood: reel.musicMood || 'calm',
      hasVoiceover: false,
    })

    const file = `reel-${reel.id}.wav`
    const wavPath = path.join(audioDir, file)
    fs.writeFileSync(wavPath, wav)
    const rawLufs = loudnessNormalize(wavPath)
    manifest[reel.id] = `audio/${file}`
    console.log(
      `✓ reel-${reel.id}: ${reel.duration}s, ${cues.length} cues → ${file} ` +
        `(${(fs.statSync(wavPath).size / 1024 / 1024).toFixed(1)} MB, ${rawLufs.toFixed(1)} → ${TARGET_LUFS} LUFS)`,
    )
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`✓ manifest: ${Object.keys(manifest).length} track(s)`)
} finally {
  await server.close()
}
