// ============================================
// scripts/check-av-sync.mjs — the AV sync gate (owner, 17 Oct 2026).
//
// Measures, on the FINISHED file, where each sound really starts, and compares
// it with the cue the reel asked for. A sound more than SYNC_LAW.maxLagMs away
// from its visual event — or one that cannot be heard at all because something
// else covers it — fails the export. «The sounds are a bit off» is not a
// review note any more; it is a number.
//
// One detector (`onsetsOf` in sound-design.mjs) decides both where a file's
// hit point is and where a sound starts in the mix, and one placement
// (`cuePlacements`) is both what the mixer writes and what this gate expects.
// A swell (no transient even alone) cannot be measured as an onset; it is
// reported as placed by its hit point, never as «measured OK».
//
// Usage alone: node scripts/check-av-sync.mjs <reelId> [file]
// ============================================

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { SYNC_LAW, cuePlacements, onsetsOf } from './sound-design.mjs'

const SR = 16000

export function measureOnsets(file, ffmpeg) {
  const r = spawnSync(
    ffmpeg,
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'],
    {
      maxBuffer: 1 << 28,
    },
  )
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}`)
  const pcm = new Float32Array(
    r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length),
  )
  return onsetsOf(pcm, SR)
}

/**
 * @returns {{ ok: boolean, rows: Array<{at:number, kind:string, status:'ok'|'late'|'masked'|'swell', lagMs:number|null}> }}
 */
export function checkAvSync(file, cues, ffmpeg, reelId = '0') {
  const onsets = measureOnsets(file, ffmpeg)
  const rows = cuePlacements(cues, reelId).map(({ cue, sample }) => {
    const at = +cue.at.toFixed(3)
    if (sample && !sample.transient) return { at, kind: cue.kind, status: 'swell', lagMs: null }
    let best = null
    for (const o of onsets)
      if (best === null || Math.abs(o - cue.at) < Math.abs(best - cue.at)) best = o
    const lagMs = best === null ? null : Math.round((best - cue.at) * 1000)
    if (lagMs === null || Math.abs(lagMs) > 4 * SYNC_LAW.maxLagMs)
      return { at, kind: cue.kind, status: 'masked', lagMs }
    return {
      at,
      kind: cue.kind,
      status: Math.abs(lagMs) <= SYNC_LAW.maxLagMs ? 'ok' : 'late',
      lagMs,
    }
  })
  return { ok: rows.every((row) => row.status === 'ok' || row.status === 'swell'), rows }
}

const LABEL = { ok: '✓', late: '✗ off', masked: '✗ not heard', swell: '~ swell' }

export function printAvSync(result) {
  console.log(`\n🔊 AV sync gate (±${SYNC_LAW.maxLagMs} ms):`)
  for (const row of result.rows) {
    const lag = row.lagMs === null ? '' : `${row.lagMs > 0 ? '+' : ''}${row.lagMs} ms`
    console.log(
      `  ${LABEL[row.status].padEnd(12)} ${String(row.at).padStart(6)}s  ${row.kind.padEnd(20)} ${lag}`,
    )
  }
  const measured = result.rows.filter((r) => r.status !== 'swell').length
  const swells = result.rows.length - measured
  console.log(
    `  ${measured} transients measured, ${swells} swells placed by hit point (no onset to measure)`,
  )
  console.log(
    result.ok
      ? '✓ Every sound lands on its visual event.'
      : '✗ AV SYNC FAILED — fix the sound, do not publish this file.',
  )
}

// Run alone: node scripts/check-av-sync.mjs 60
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
) {
  const id = process.argv[2]
  const file =
    process.argv[3] ??
    path.join(
      process.env.HISABCHE_EXPORT_DIR || path.join(os.homedir(), 'Videos', 'hisabche-reels'),
      `reel-${id}.mp4`,
    )
  const { createServer } = await import('vite')
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
  const { reelCues } = await server.ssrLoadModule('/src/scenes/index.tsx')
  await server.close()
  const reel = REELS.find((r) => r.id === id)
  if (!reel) {
    console.error(`reel ${id} not found`)
    process.exit(2)
  }
  let target = file
  // --mix: check the soundtrack alone, as the export would mix it (seconds, not minutes).
  if (process.argv[3] === '--mix') {
    const { designSoundtrack } = await import('./sound-design.mjs')
    const wav = designSoundtrack(reelCues(reel), reel.duration, {
      sceneStarts: reel.scenes.map((scene) => scene.start),
      ctaAt: reel.scenes[reel.scenes.length - 1]?.start,
      reelId: reel.id,
      musicMood: reel.musicMood || 'calm',
      hasVoiceover: false,
    })
    target = path.join(os.tmpdir(), `hisabche-av-sync-${id}.wav`)
    fs.writeFileSync(target, wav)
  } else if (!fs.existsSync(file)) {
    console.error(`${file} not found`)
    process.exit(2)
  }
  const result = checkAvSync(target, reelCues(reel), 'C:\\ffmpeg\\bin\\ffmpeg.exe', id)
  printAvSync(result)
  process.exit(result.ok ? 0 : 1)
}
