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
const LEAD = 0.2
const SPLIT = /[:؛]$/

/** Every silence of at least `minSilence` seconds, in the recording's clock. */
export function pauses(file, minSilence = 0.25) {
  const r = spawnSync(
    FFMPEG,
    ['-i', file, '-af', `silencedetect=noise=-38dB:d=${minSilence}`, '-f', 'null', '-'],
    {
      encoding: 'utf8',
      windowsHide: true,
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
  return { pauses: starts.map((s, i) => ({ start: s, end: ends[i] ?? duration })), duration }
}

/** Shortest silence offered as a phrase split: a quick reader's «؛» is ~0.1 s. */
const CANDIDATE_SILENCE = 0.08
/** Cost per second of a silence that no punctuation explains (a mid-phrase breath). */
const UNEXPLAINED = 1
/** A punctuation mark where the reader MUST pause: the «؛»/«:» split and a sentence end. */
const REQUIRED = /[:؛]$/
/** A punctuation mark where the reader MAY pause: comma, «.», «؟», «!». */
const OPTIONAL = /[،,.؟?!]$/

/**
 * Text chunks between the script's punctuation marks, across all scenes: the
 * mark after each chunk is `required` (the phrase split, a scene's end) or
 * optional (a comma). The last chunk has no mark after it.
 */
export function scriptChunks(scenes) {
  const chunks = []
  let letters = 0
  scenes.forEach((scene, si) => {
    const words = scene.sentence.words
    words.forEach((w, wi) => {
      letters += w.word.length
      const sceneEnd = wi === words.length - 1
      if (sceneEnd && si === scenes.length - 1) return
      if (sceneEnd || REQUIRED.test(w.word)) {
        chunks.push({ letters, required: true })
        letters = 0
      } else if (OPTIONAL.test(w.word)) {
        chunks.push({ letters, required: false })
        letters = 0
      }
    })
  })
  chunks.push({ letters, required: false })
  return chunks
}

/**
 * Lines the script's punctuation up with the recording's silences, offline (no
 * speech model): every «؛» and sentence end takes exactly one silence, a comma
 * may take one, and a silence left unexplained (a breath mid-phrase) costs its
 * length. The text between two marks should last its letters × the reader's
 * own pace. Dynamic programming over (mark, silence) — exact, not greedy.
 * Returns the silences on the REQUIRED marks in order, or null if none fits.
 */
export function choosePauses(candidates, speechStart, speechEnd, chunks) {
  const c = [...candidates].sort((x, y) => x.start - y.start)
  const slots = chunks.length - 1
  const totalLetters = chunks.reduce((sum, chunk) => sum + chunk.letters, 0)
  const silent = c.reduce((sum, p) => sum + (p.end - p.start), 0)
  const pace = Math.max(speechEnd - speechStart - silent, 0.1) / totalLetters
  const gapLength = (from, to) => {
    let sum = 0
    for (let q = from + 1; q < to; q++) sum += c[q].end - c[q].start
    return sum
  }
  // Text from after mark `k` to mark `k2`, spoken between silences m and m2
  // (-1 = speech start, c.length = speech end).
  const edge = (k, m, k2, m2) => {
    let letters = 0
    for (let j = k + 1; j <= k2; j++) letters += chunks[j].letters
    for (let j = k + 1; j < k2; j++) if (chunks[j].required) return Infinity
    const from = m < 0 ? speechStart : c[m].end
    const to = m2 >= c.length ? speechEnd : c[m2].start
    const unexplained = gapLength(m, m2)
    const spoken = to - from - unexplained
    if (spoken <= 0) return Infinity
    return Math.log(spoken / (letters * pace)) ** 2 + UNEXPLAINED * unexplained
  }
  const best = Array.from({ length: slots }, () => new Array(c.length).fill(Infinity))
  const back = Array.from({ length: slots }, () => new Array(c.length).fill(null))
  for (let k = 0; k < slots; k++) {
    for (let m = 0; m < c.length; m++) {
      let low = edge(-1, -1, k, m)
      let prev = null
      for (let k0 = 0; k0 < k; k0++) {
        for (let m0 = 0; m0 < m; m0++) {
          if (best[k0][m0] === Infinity) continue
          const cost = best[k0][m0] + edge(k0, m0, k, m)
          if (cost < low) {
            low = cost
            prev = [k0, m0]
          }
        }
      }
      best[k][m] = low
      back[k][m] = prev
    }
  }
  let low = slots === 0 ? edge(-1, -1, 0, c.length) : Infinity
  let at = null
  for (let k = 0; k < slots; k++) {
    for (let m = 0; m < c.length; m++) {
      if (best[k][m] === Infinity) continue
      const cost = best[k][m] + edge(k, m, slots, c.length)
      if (cost < low) {
        low = cost
        at = [k, m]
      }
    }
  }
  if (low === Infinity) return null
  const picked = []
  for (let node = at; node; node = back[node[0]][node[1]]) {
    if (chunks[node[0]].required) picked.unshift(c[node[1]])
  }
  return picked
}

/**
 * Two phrases per scene: [{start,end}] in the recording's own clock.
 * `chunks` = `scriptChunks(scenes)`. Splits are found automatically from the
 * punctuation; `fix` (--drop / --add) still overrides by hand.
 */
export function phrasesOf(file, chunks, fix = { drop: [], add: [] }) {
  const { pauses: ps, duration } = pauses(file, CANDIDATE_SILENCE)
  // Leading/trailing silence is not a pause between phrases.
  const head = ps.find((p) => p.start <= 0.05)
  const tail = ps.find((p) => p.end >= duration - 0.05 && p.start > 0.05)
  const speechStart = head ? head.end : 0
  const speechEnd = tail ? tail.start : duration
  const candidates = [
    ...ps.filter(
      (p) => p !== head && p !== tail && !fix.drop.some((d) => Math.abs(d - p.start) < 0.02),
    ),
    ...fix.add,
  ]
  const inner = choosePauses(candidates, speechStart, speechEnd, chunks)
  if (!inner) {
    throw new Error(
      `could not line ${chunks.filter((x) => x.required).length} required pauses up with ${candidates.length} silences — leave a breath at every «؛» / «:» and between sentences`,
    )
  }
  const bounds = [speechStart, ...inner.flatMap((p) => [p.start, p.end]), speechEnd]
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
  const [id, recording, ...flags] = process.argv.slice(2)
  const flag = (name) =>
    (flags.find((f) => f.startsWith(`--${name}=`)) ?? '')
      .split('=')[1]
      ?.split(',')
      .filter(Boolean) ?? []
  const fix = {
    drop: flag('drop').map(Number),
    add: flag('add').map((r) => {
      const [start, end] = r.split('-').map(Number)
      return { start, end }
    }),
  }
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
  const phrases = phrasesOf(recording, scriptChunks(reel.scenes), fix)
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
