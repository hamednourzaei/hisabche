// ============================================
// scripts/place-voiceover.mjs — one voiceover recording, placed scene by scene.
//
// A TTS file (ElevenLabs) reads the whole script without waiting for the
// scenes, so laid from 0:00 it runs ahead of the picture — 3 s by the end of
// reel 61 (owner, 17 Oct). Here the recording is cut at its pauses into one
// sentence per scene, and each sentence starts LEAD seconds into its scene.
//
// Pauses come from ffmpeg `silencedetect`. Each sentence is two phrases, split
// where the script has «:» or «؛»; so a file must show exactly
// 2 × scenes − 1 pauses, or the cut is refused (a guess would put a sentence
// in the wrong scene).
//
// Word times: the first word of each phrase gets its MEASURED start; the words
// inside a phrase are spread by letter count. That is an anchored estimate,
// not forced alignment — the reel stays PROVISIONAL.
//
// Usage: node scripts/place-voiceover.mjs <reelId> <recording>
//   writes audio/reel-<id>-vo.wav (picked up by export-mp4) and prints the
//   new word times as JSON for scripts/apply-vo-timing.
// ============================================

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe'
const LEAD = 0.2
const SPLIT = /[:؛]$/

export function pauses(file) {
  const r = spawnSync(
    FFMPEG,
    ['-i', file, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-'],
    {
      encoding: 'utf8',
    },
  )
  const out = r.stderr
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const duration = Number(
    /Duration: (\d+):(\d+):([\d.]+)/
      .exec(out)
      .slice(1)
      .reduce((s, v, i) => s + Number(v) * [3600, 60, 1][i], 0),
  )
  return { pauses: starts.map((s, i) => ({ start: s, end: ends[i] })), duration }
}

/** Two phrases per scene: [{start,end}] in the recording's own clock. */
export function phrasesOf(file, scenes) {
  const { pauses: ps, duration } = pauses(file)
  // Leading/trailing silence is not a pause between phrases.
  const inner = ps.filter((p) => p.start > 0.05 && p.end < duration - 0.05)
  if (inner.length !== scenes * 2 - 1) {
    throw new Error(
      `expected ${scenes * 2 - 1} pauses (two phrases per scene), found ${inner.length} — record one file per scene instead`,
    )
  }
  const bounds = [0, ...inner.flatMap((p) => [p.start, p.end]), duration]
  const phrases = []
  for (let i = 0; i < bounds.length; i += 2) phrases.push({ start: bounds[i], end: bounds[i + 1] })
  return phrases
}

/** New word times for one scene, relative to the scene start. */
export function wordTimes(words, phrasePair, sentenceStart) {
  const cut = words.findIndex((w) => SPLIT.test(w.word)) + 1
  if (cut <= 0 || cut >= words.length)
    throw new Error(`no «:» or «؛» to split: ${words.map((w) => w.word).join(' ')}`)
  const groups = [words.slice(0, cut), words.slice(cut)]
  const out = []
  groups.forEach((group, g) => {
    const phrase = phrasePair[g]
    const span = phrase.end - phrase.start
    const letters = group.reduce((s, w) => s + w.word.length, 0)
    let t = phrase.start
    for (const w of group) {
      const len = (span * w.word.length) / letters
      out.push({
        word: w.word,
        start: +(LEAD + t - sentenceStart).toFixed(2),
        end: +(LEAD + t + len - sentenceStart - 0.03).toFixed(2),
      })
      t += len
    }
  })
  return out
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, recording] = process.argv.slice(2)
  const { createServer } = await import('vite')
  const server = await createServer({
    configFile: 'vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
  await server.close()
  const reel = REELS.find((r) => r.id === id)
  const phrases = phrasesOf(recording, reel.scenes.length)
  const timing = []
  const inputs = []
  const filters = []
  reel.scenes.forEach((scene, i) => {
    const a = phrases[i * 2]
    const b = phrases[i * 2 + 1]
    const length = b.end - a.start
    if (length + LEAD > scene.end - scene.start) {
      throw new Error(
        `scene ${i + 1}: sentence ${length.toFixed(2)} s does not fit in ${(scene.end - scene.start).toFixed(2)} s`,
      )
    }
    timing.push({
      scene: i + 1,
      words: wordTimes(scene.sentence.words, [a, b], a.start),
      spoken: +length.toFixed(2),
    })
    inputs.push('-ss', String(a.start), '-t', String(length + 0.15), '-i', recording)
    const delay = Math.round((scene.start + LEAD) * 1000)
    filters.push(`[${i}:a]adelay=${delay}|${delay}[s${i}]`)
  })
  const out = path.join(ROOT, 'audio', `reel-${id}-vo.wav`)
  const mix = `${filters.join(';')};${reel.scenes.map((_, i) => `[s${i}]`).join('')}amix=inputs=${reel.scenes.length}:normalize=0,apad=whole_dur=${reel.duration}[out]`
  const r = spawnSync(
    FFMPEG,
    [
      '-v',
      'error',
      '-y',
      ...inputs,
      '-filter_complex',
      mix,
      '-map',
      '[out]',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-t',
      String(reel.duration),
      out,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error(r.stderr)
  fs.writeFileSync(
    path.join(ROOT, '.tmp', `reel-${id}-vo-timing.json`),
    JSON.stringify(timing, null, 2),
  )
  console.log(`✓ ${out}`)
  for (const s of timing)
    console.log(
      `  scene ${s.scene}: ${s.spoken}s — ${s.words.map((w) => `${w.word}@${w.start}`).join(' ')}`,
    )
}
