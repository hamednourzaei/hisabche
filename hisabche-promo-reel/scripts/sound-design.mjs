// ============================================
// scripts/sound-design.mjs — the export's sound, designed rather than beeped.
//
// What the MP4 hears. Deterministic (same reel → same bytes), dependency-free,
// stereo 48 kHz, mastered:
//
//   1. a MUSIC BED: a slow minor-key pad progression, low-passed, that ducks
//      (side-chain) under every hit so effects never fight it;
//   2. STRUCTURE: a sub drop at each scene change and a riser into the CTA;
//   3. every SoundKind DESIGNED: transient + body + tail, placed in the stereo
//      field, many of them Foley-shaped (marker, paper, typewriter, cash);
//   4. a shared REVERB send (Schroeder: 4 combs + 2 all-passes per side);
//   5. MASTERING: gentle bus compression, soft-clip limiter, and loudness
//      brought to about −14 LUFS (approximated by RMS on the K-weighted-ish
//      high-passed signal) — the level Instagram and YouTube normalise to.
//
// Any SoundKind without its own recipe falls back to a soft tactile tap, never
// silence and never a raw beep.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FFMPEG = 'C:\\ffmpeg\\bin\\ffmpeg.exe'
const SFX_MANIFEST_PATH = path.resolve(ROOT, 'assets', 'sfx', 'manifest.json')
const MUSIC_MANIFEST_PATH = path.resolve(ROOT, 'assets', 'music', 'manifest.json')

const SR = 48000

// ─── sample cache & variant choice ──────────────────────────────────────────
const sampleCache = new Map()

export function getPcmSample(filePath) {
  if (sampleCache.has(filePath)) return sampleCache.get(filePath)
  if (!fs.existsSync(filePath)) return null
  const buf = execSync(`"${FFMPEG}" -v error -i "${filePath}" -f f32le -ac 2 -ar ${SR} pipe:1`, {
    maxBuffer: 50 * 1024 * 1024,
  })
  const numFrames = buf.length / 8
  const L = new Float32Array(numFrames)
  const R = new Float32Array(numFrames)
  for (let i = 0; i < numFrames; i++) {
    L[i] = buf.readFloatLE(i * 8)
    R[i] = buf.readFloatLE(i * 8 + 4)
  }
  // ── AV SYNC LAW (owner, 17 Oct 2026) ──────────────────────────────────────
  // A recorded file is placed by its HIT POINT, not by its first byte: files
  // arrived with up to 519 ms of silence and peaks up to 1 s in, so a sound
  // came half a second after the card it belongs to. The hit point is the
  // first frame that reaches half the file's peak; the mixer puts THAT frame
  // on the cue. Every file is also brought to the same peak (−6 dBFS) so a
  // −40 dB recording is not lost under the music, and a file quieter than
  // −45 dBFS raw is refused (it is noise, not a sound; short clicks are recorded
  // as low as −43 dB and are fine once normalised).
  let peak = 0
  for (let i = 0; i < numFrames; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  const rawPeakDb = 20 * Math.log10(peak || 1e-9)
  if (rawPeakDb < SYNC_LAW.minRawPeakDb) {
    sampleCache.set(filePath, null)
    return null
  }
  const norm = SYNC_LAW.targetPeak / peak
  for (let i = 0; i < numFrames; i++) {
    L[i] *= norm
    R[i] *= norm
  }
  // The hit point is where the EAR hears the sound start: the first onset by
  // the same detector the export gate runs on the finished file. A swell has
  // no onset; it is placed by the first frame at half its peak.
  const mono = new Float32Array(numFrames)
  for (let i = 0; i < numFrames; i++) mono[i] = (L[i] + R[i]) / 2
  const hits = hitProfile(mono, SR)
  const onsets = hits.map((hit) => hit.t)
  let anchor = 0
  if (onsets.length > 0) {
    anchor = Math.round(onsets[0] * SR)
  } else {
    for (let i = 0; i < numFrames; i++) {
      if (Math.max(Math.abs(L[i]), Math.abs(R[i])) >= SYNC_LAW.targetPeak * SYNC_LAW.hitFraction) {
        anchor = i
        break
      }
    }
  }
  // Nothing audible before the hit: a faint shimmer 145 ms ahead of the real
  // hit (cinematic-sparkle) is heard as «early». Keep SYNC_LAW.leadSeconds of
  // lead, faded in, and drop the rest.
  const lead = Math.round(SYNC_LAW.leadSeconds * SR)
  const from = Math.max(0, anchor - lead)
  const keptL = L.slice(from)
  const keptR = R.slice(from)
  for (let i = 0; i < Math.min(lead, anchor - from); i++) {
    const g = i / lead
    keptL[i] *= g
    keptR[i] *= g
  }
  // Level is set on what is KEPT: a printer's motor run-up before its clack
  // was the file's loudest part, and it is gone.
  let keptPeak = 0
  for (let i = 0; i < keptL.length; i++)
    keptPeak = Math.max(keptPeak, Math.abs(keptL[i]), Math.abs(keptR[i]))
  const renorm = keptPeak > 0 ? SYNC_LAW.targetPeak / keptPeak : 1
  for (let i = 0; i < keptL.length; i++) {
    keptL[i] *= renorm
    keptR[i] *= renorm
  }
  const sample = {
    L: keptL,
    R: keptR,
    length: keptL.length,
    anchor: anchor - from,
    transient: onsets.length > 0,
    leads: firstHitLeads(hits),
    rawPeakDb,
  }
  sampleCache.set(filePath, sample)
  return sample
}

export {
  ONSET,
  SYNC_LAW,
  highpass,
  onsetsOf,
  hitOnsets,
  hitProfile,
  firstHitLeads,
} from './sync-law.mjs'
import { SYNC_LAW, firstHitLeads, hitProfile } from './sync-law.mjs'

function readSfxManifest() {
  if (!fs.existsSync(SFX_MANIFEST_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(SFX_MANIFEST_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/** A sample cut to `frames`, its last `SYNC_LAW.chokeSeconds` faded to silence. */
function choked(sample, frames) {
  if (frames >= sample.length) return sample
  const n = Math.max(0, frames)
  const L = sample.L.slice(0, n)
  const R = sample.R.slice(0, n)
  const fade = Math.min(n, Math.floor(SYNC_LAW.chokeSeconds * SR))
  for (let i = 0; i < fade; i++) {
    const g = i / fade
    L[n - 1 - i] *= g
    R[n - 1 - i] *= g
  }
  return { ...sample, L, R, length: n }
}

/**
 * Where every placed cue's recorded file goes — the ONE answer the mixer
 * writes and the export gate measures. `start` is in seconds (the file's
 * first frame), so the hit point is `start + anchor / sampleRate` = `cue.at`.
 * A cue with no usable file has `sample: null` (the synth recipe plays it).
 */
export function cuePlacements(cues, reelId = '0', manifest = readSfxManifest()) {
  const placed = placedCues(cues).map((cue, i) => {
    const file = chooseVariant(manifest[cue.kind], reelId, i)
    const sample = file ? getPcmSample(path.resolve(ROOT, 'assets', 'sfx', file)) : null
    return { cue, index: i, file, sample, start: sample ? cue.at - sample.anchor / SR : cue.at }
  })
  // One sound at a time: each tail ends where the next hit begins.
  for (let i = 0; i + 1 < placed.length; i++) {
    const here = placed[i]
    if (!here.sample) continue
    here.sample = choked(
      here.sample,
      Math.floor((placed[i + 1].cue.at - SYNC_LAW.chokeLeadSeconds - here.start) * SR),
    )
  }
  return placed
}

export const SAMPLE_RATE = SR

/**
 * The cues that actually get a sound, after the «one hit per 120 ms» rule —
 * the same list the mixer places and the export gate measures. A cue thinned
 * away here was never promised a sound of its own.
 */
export function placedCues(cues) {
  let last = -Infinity
  return cues
    .slice()
    .sort((a, b) => a.at - b.at)
    .filter((cue) => {
      if (cue.at - last < SYNC_LAW.minGapSeconds && cue.kind !== 'ctaResolution') return false
      last = cue.at
      return true
    })
}

export function chooseVariant(variants, reelId, cueIndex) {
  if (!variants || variants.length === 0) return null
  if (variants.length === 1) return variants[0]
  let h = 2166136261 >>> 0
  const str = `${reelId || '0'}:${cueIndex}`
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return variants[h % variants.length]
}

const KIND_PROPERTIES = {
  pop: { gain: 0.55, pan: -0.1, send: 0.1, duck: 0.2 },
  chatPop: { gain: 0.55, pan: 0.15, send: 0.1, duck: 0.2 },
  tick: { gain: 0.45, pan: 0.2, send: 0.08, duck: 0.15 },
  clockTickRapid: { gain: 0.45, pan: 0.25, send: 0.08, duck: 0.2 },
  typewriterClick: { gain: 0.5, pan: -0.15, send: 0.1, duck: 0.2 },
  markerScribble: { gain: 0.55, pan: 0.2, send: 0.08, duck: 0.25 },
  paperRustle: { gain: 0.5, pan: -0.25, send: 0.12, duck: 0.2 },
  paperTear: { gain: 0.52, pan: -0.2, send: 0.12, duck: 0.25 },
  cardEnter: { gain: 0.55, pan: -0.1, send: 0.1, duck: 0.2 },
  cardThock: { gain: 0.6, pan: 0.1, send: 0.12, duck: 0.3 },
  cash: { gain: 0.58, pan: 0.2, send: 0.15, duck: 0.35 },
  receiptPrint: { gain: 0.5, pan: -0.2, send: 0.1, duck: 0.25 },
  whoosh: { gain: 0.5, pan: 0.0, send: 0.18, duck: 0.35 },
  cameraSwish: { gain: 0.52, pan: 0.1, send: 0.18, duck: 0.35 },
  softTransition: { gain: 0.45, pan: -0.1, send: 0.15, duck: 0.25 },
  sceneTransition: { gain: 0.55, pan: 0.0, send: 0.2, duck: 0.4 },
  impact: { gain: 0.65, pan: 0.0, send: 0.18, duck: 0.45 },
  alert: { gain: 0.5, pan: 0.1, send: 0.2, duck: 0.3 },
  titleHit: { gain: 0.65, pan: 0.0, send: 0.2, duck: 0.5 },
  bigReveal: { gain: 0.65, pan: 0.0, send: 0.22, duck: 0.5 },
  majorReveal: { gain: 0.68, pan: 0.0, send: 0.25, duck: 0.55 },
  cinematicReveal: { gain: 0.55, pan: 0.0, send: 0.25, duck: 0.4 },
  insightReveal: { gain: 0.52, pan: 0.15, send: 0.2, duck: 0.35 },
  dataFlow: { gain: 0.45, pan: -0.2, send: 0.12, duck: 0.25 },
  sync: { gain: 0.5, pan: 0.1, send: 0.15, duck: 0.25 },
  scan: { gain: 0.48, pan: 0.2, send: 0.12, duck: 0.2 },
  precisionSequence: { gain: 0.45, pan: -0.1, send: 0.1, duck: 0.2 },
  success: { gain: 0.55, pan: 0.1, send: 0.2, duck: 0.35 },
  chime: { gain: 0.52, pan: 0.15, send: 0.22, duck: 0.3 },
  financialMilestone: { gain: 0.6, pan: 0.1, send: 0.22, duck: 0.45 },
  successResolution: { gain: 0.58, pan: 0.0, send: 0.25, duck: 0.4 },
  ctaResolution: { gain: 0.62, pan: 0.0, send: 0.25, duck: 0.5 },
}

// ─── deterministic noise ────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) / 0xffffffff) * 2 - 1
  }
}

// ─── tiny DSP kit ───────────────────────────────────────────────────────────
const onePoleLP = (cut) => {
  const a = Math.exp((-2 * Math.PI * cut) / SR)
  let z = 0
  return (x) => (z = (1 - a) * x + a * z)
}
const onePoleHP = (cut) => {
  const lp = onePoleLP(cut)
  return (x) => x - lp(x)
}
/** RBJ band-pass (constant skirt), for formant-ish noise. */
function bandPass(freq, q) {
  const w = (2 * Math.PI * freq) / SR
  const alpha = Math.sin(w) / (2 * q)
  const b0 = alpha
  const b2 = -alpha
  const a0 = 1 + alpha
  const a1 = -2 * Math.cos(w)
  const a2 = 1 - alpha
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return (x) => {
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}
const env = (t, attack, decay) =>
  t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay)
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

// ─── the mix bus ────────────────────────────────────────────────────────────
class Bus {
  constructor(duration) {
    this.n = Math.ceil((duration + 2) * SR)
    this.L = new Float32Array(this.n)
    this.R = new Float32Array(this.n)
    this.sendL = new Float32Array(this.n)
    this.sendR = new Float32Array(this.n)
    /** 0..1: how hard the music ducks at each sample (max of hits). */
    this.duck = new Float32Array(this.n)
  }
  /** Add a mono source at time `at`, panned (-1..1), with a reverb send. */
  add(at, samples, { gain = 1, pan = 0, send = 0.15, duck = 0.5 } = {}) {
    const start = Math.floor(at * SR)
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4)
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4)
    for (let i = 0; i < samples.length; i++) {
      const k = start + i
      if (k < 0 || k >= this.n) continue
      const v = samples[i]
      this.L[k] += v * gl
      this.R[k] += v * gr
      this.sendL[k] += v * gl * send
      this.sendR[k] += v * gr * send
    }
    // Side-chain envelope: duck fast, release over ~350 ms.
    const len = Math.min(samples.length + Math.floor(0.35 * SR), this.n - start)
    for (let i = 0; i < len; i++) {
      const k = start + i
      if (k < 0) continue
      const t = i / SR
      const d = duck * (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.18))
      if (d > this.duck[k]) this.duck[k] = d
    }
  }

  /** Add a stereo source at time `at`, with a reverb send and ducking. */
  addStereo(at, sample, { gain = 1, pan = 0, send = 0.15, duck = 0.5 } = {}) {
    const start = Math.floor(at * SR)
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4)
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4)
    const len = Math.min(sample.L.length, sample.R.length)
    for (let i = 0; i < len; i++) {
      const k = start + i
      if (k < 0 || k >= this.n) continue
      const vL = sample.L[i] * gl
      const vR = sample.R[i] * gr
      this.L[k] += vL
      this.R[k] += vR
      this.sendL[k] += vL * send
      this.sendR[k] += vR * send
    }
    const duckLen = Math.min(len + Math.floor(0.35 * SR), this.n - start)
    for (let i = 0; i < duckLen; i++) {
      const k = start + i
      if (k < 0) continue
      const t = i / SR
      const d = duck * (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.18))
      if (d > this.duck[k]) this.duck[k] = d
    }
  }
}

const render = (seconds, fn) => {
  const len = Math.floor(seconds * SR)
  const out = new Float32Array(len)
  for (let i = 0; i < len; i++) out[i] = fn(i / SR, i)
  return out
}

// ─── the recipes ────────────────────────────────────────────────────────────
// Each returns { samples, gain, pan, send, duck }.

function recipe(kind, seed) {
  const n = rng(seed)
  switch (kind) {
    case 'pop':
    case 'chatPop': {
      // A soft bubble: sine sweep up + tiny noise click.
      const hp = onePoleHP(2000)
      return {
        samples: render(0.14, (t) => {
          const f = 420 + 520 * (1 - Math.exp(-t / 0.02))
          return (
            Math.sin(2 * Math.PI * f * t) * env(t, 0.003, 0.045) * 0.7 +
            hp(n()) * env(t, 0.0005, 0.004) * 0.25
          )
        }),
        gain: 0.5,
        pan: n() * 0.6,
        send: 0.12,
        duck: 0.25,
      }
    }
    case 'tick':
    case 'clockTickRapid': {
      // A mechanical watch: two tiny metallic clicks (tick-tock pair).
      const bp = bandPass(3800, 6)
      const bp2 = bandPass(2600, 6)
      const rapid = kind === 'clockTickRapid'
      const count = rapid ? 6 : 1
      return {
        samples: render(rapid ? 0.62 : 0.05, (t) => {
          let v = 0
          for (let c = 0; c < count; c++) {
            const tc = t - c * 0.1
            const x = n()
            v += (c % 2 ? bp2(x) : bp(x)) * env(tc, 0.0004, 0.006) * 3
          }
          return v
        }),
        gain: 0.42,
        pan: 0.35,
        send: 0.08,
        duck: 0.15,
      }
    }
    case 'typewriterClick': {
      const bp = bandPass(1800, 3)
      return {
        samples: render(0.5, (t) => {
          let v = 0
          for (const k of [0, 0.09, 0.15, 0.27, 0.33]) {
            const tk = t - k
            v +=
              bp(n()) * env(tk, 0.0005, 0.008) * 2.2 +
              Math.sin(2 * Math.PI * 140 * tk) * env(tk, 0.001, 0.012) * 0.4
          }
          return v
        }),
        gain: 0.5,
        pan: -0.25,
        send: 0.1,
        duck: 0.2,
      }
    }
    case 'markerScribble': {
      // Felt tip on paper: band-passed noise with a stroke rhythm.
      const bp = bandPass(3200, 1.2)
      return {
        samples: render(0.55, (t) => {
          const stroke = 0.5 + 0.5 * Math.sin(2 * Math.PI * 9 * t) ** 2
          return bp(n()) * stroke * env(t, 0.02, 0.28) * 1.4
        }),
        gain: 0.55,
        pan: 0.2,
        send: 0.08,
        duck: 0.25,
      }
    }
    case 'paperRustle':
    case 'paperTear': {
      const bp = bandPass(kind === 'paperTear' ? 2400 : 4200, 0.9)
      const tear = kind === 'paperTear'
      return {
        samples: render(tear ? 0.45 : 0.6, (t) => {
          const crackle = n() > (tear ? 0.6 : 0.85) ? 1 : 0.25
          return bp(n()) * crackle * env(t, 0.01, tear ? 0.18 : 0.25) * 1.6
        }),
        gain: 0.5,
        pan: -0.3,
        send: 0.12,
        duck: 0.3,
      }
    }
    case 'cardEnter':
    case 'cardThock': {
      // A card set down on a table: low thump + soft slap.
      const lp = onePoleLP(900)
      return {
        samples: render(0.25, (t) => {
          const thump = Math.sin(2 * Math.PI * (110 - 50 * t) * t) * env(t, 0.002, 0.06)
          return thump * 0.9 + lp(n()) * env(t, 0.0008, 0.015) * 0.6
        }),
        gain: 0.62,
        pan: n() * 0.3,
        send: 0.14,
        duck: 0.45,
      }
    }
    case 'cash': {
      // Coins: several detuned metallic partials, staggered.
      return {
        samples: render(0.6, (t) => {
          let v = 0
          const hits = [0, 0.045, 0.1, 0.17]
          hits.forEach((h, i) => {
            const th = t - h
            if (th < 0) return
            for (const f of [2637, 3520, 4186, 5274]) {
              v += Math.sin(2 * Math.PI * f * (1 + i * 0.013) * th) * env(th, 0.0005, 0.07) * 0.12
            }
          })
          return v
        }),
        gain: 0.5,
        pan: 0.3,
        send: 0.25,
        duck: 0.3,
      }
    }
    case 'whoosh':
    case 'cameraSwish':
    case 'softTransition':
    case 'sceneTransition': {
      // Air moving past: swept band-passed noise, stereo-panned across.
      const dur = kind === 'softTransition' ? 0.6 : 0.42
      const lp = onePoleLP(5000)
      return {
        samples: render(dur, (t) => {
          const p = t / dur
          const bp = 300 + 2600 * Math.sin(Math.PI * p)
          const shaped = lp(n()) * Math.sin(Math.PI * p) ** 2
          return shaped * (0.5 + 0.5 * Math.sin(2 * Math.PI * bp * t * 0.0006))
        }),
        gain: kind === 'softTransition' ? 0.28 : 0.42,
        pan: 0,
        send: 0.3,
        duck: 0.2,
      }
    }
    case 'alert': {
      // Not an 8-bit beep: a muted two-note warning with a soft body.
      return {
        samples: render(0.5, (t) => {
          const f = t < 0.18 ? midi(76) : midi(72)
          const tt = t < 0.18 ? t : t - 0.18
          return (
            (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) *
            env(tt, 0.004, 0.09) *
            0.45
          )
        }),
        gain: 0.42,
        pan: 0,
        send: 0.2,
        duck: 0.5,
      }
    }
    case 'impact': {
      // A rubber stamp: 55 Hz punch + wood slap + short room.
      const bp = bandPass(650, 2)
      return {
        samples: render(0.6, (t) => {
          const sub = Math.sin(2 * Math.PI * (70 - 25 * t) * t) * env(t, 0.002, 0.14)
          return sub * 1.0 + bp(n()) * env(t, 0.0005, 0.02) * 2.2
        }),
        gain: 0.7,
        pan: 0,
        send: 0.22,
        duck: 0.8,
      }
    }
    case 'titleHit':
    case 'bigReveal':
    case 'majorReveal': {
      // Cinematic hit: sub boom + bright crack + tail into the reverb.
      const hp = onePoleHP(3000)
      return {
        samples: render(1.4, (t) => {
          const boom = Math.sin(2 * Math.PI * (58 - 20 * t) * t) * env(t, 0.004, 0.42)
          const crack = hp(n()) * env(t, 0.0005, 0.03)
          return boom * 0.9 + crack * 0.7
        }),
        gain: 0.62,
        pan: 0,
        send: 0.45,
        duck: 0.9,
      }
    }
    case 'cinematicReveal':
    case 'insightReveal': {
      // A shimmer swelling up into a soft chord — the «brand» moment.
      return {
        samples: render(1.6, (t) => {
          let v = 0
          for (const m of [62, 65, 69, 74]) {
            const f = midi(m)
            v += Math.sin(2 * Math.PI * f * t + Math.sin(2 * Math.PI * 5 * t) * 0.3) * 0.18
          }
          const swell = t < 0.5 ? (t / 0.5) ** 2 : Math.exp(-(t - 0.5) / 0.5)
          return v * swell
        }),
        gain: 0.5,
        pan: 0,
        send: 0.55,
        duck: 0.6,
      }
    }
    case 'dataFlow':
    case 'sync':
    case 'scan':
    case 'precisionSequence': {
      // Fast arpeggiated digital blips, filtered warm — data settling.
      const notes = kind === 'precisionSequence' ? [69, 72, 76, 81] : [76, 79, 83, 88, 91]
      const lp = onePoleLP(4500)
      return {
        samples: render(0.12 * notes.length + 0.25, (t) => {
          let v = 0
          notes.forEach((m, i) => {
            const tn = t - i * 0.07
            v += Math.sin(2 * Math.PI * midi(m) * tn) * env(tn, 0.002, 0.05) * 0.35
          })
          return lp(v)
        }),
        gain: 0.45,
        pan: 0.15,
        send: 0.3,
        duck: 0.35,
      }
    }
    case 'financialMilestone':
    case 'success':
    case 'chime':
    case 'successResolution': {
      // A warm, muted acoustic triad (E4 G4 B4) with a bell-ish overtone.
      return {
        samples: render(1.8, (t) => {
          let v = 0
          ;[64, 67, 71].forEach((m, i) => {
            const tn = t - i * 0.05
            const f = midi(m)
            v +=
              (Math.sin(2 * Math.PI * f * tn) + 0.25 * Math.sin(2 * Math.PI * f * 2.76 * tn)) *
              env(tn, 0.004, 0.55) *
              0.3
          })
          return v
        }),
        gain: 0.55,
        pan: 0,
        send: 0.5,
        duck: 0.6,
      }
    }
    case 'ctaResolution': {
      // The end card: a resolving chord with a low anchor — «this is the answer».
      return {
        samples: render(2.6, (t) => {
          let v = 0
          ;[50, 57, 62, 66, 69].forEach((m, i) => {
            const tn = t - i * 0.06
            v += Math.sin(2 * Math.PI * midi(m) * tn) * env(tn, 0.01, 0.9) * (i === 0 ? 0.45 : 0.22)
          })
          return v
        }),
        gain: 0.6,
        pan: 0,
        send: 0.5,
        duck: 0.85,
      }
    }
    case 'receiptPrint': {
      const bp = bandPass(2100, 4)
      return {
        samples: render(
          0.9,
          (t) => bp(n()) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 38 * t)) * env(t, 0.02, 0.5) * 1.5,
        ),
        gain: 0.42,
        pan: 0.2,
        send: 0.1,
        duck: 0.3,
      }
    }
    default: {
      // Unknown kind: a soft tactile tap — never silence, never a beep.
      const lp = onePoleLP(1600)
      return {
        samples: render(
          0.12,
          (t) =>
            lp(n()) * env(t, 0.001, 0.02) * 1.2 +
            Math.sin(2 * Math.PI * 180 * t) * env(t, 0.002, 0.03) * 0.5,
        ),
        gain: 0.45,
        pan: 0,
        send: 0.12,
        duck: 0.3,
      }
    }
  }
}

// ─── structure: music bed, scene drops, the riser ───────────────────────────

function musicBed(bus, duration, { mood = 'calm', hasVoiceover = false } = {}) {
  let musicManifest = []
  if (fs.existsSync(MUSIC_MANIFEST_PATH)) {
    try {
      musicManifest = JSON.parse(fs.readFileSync(MUSIC_MANIFEST_PATH, 'utf8'))
    } catch {
      // ignore
    }
  }

  let musicFile = 'music-calm-softly.ogg'
  const match = musicManifest.find((m) => m.mood === mood) || musicManifest[0]
  if (match?.file) musicFile = match.file

  const musicPath = path.resolve(ROOT, 'assets', 'music', musicFile)
  const sample = getPcmSample(musicPath)
  if (!sample) return

  const n = Math.ceil(duration * SR)
  // Duck by ~ -10 dB when voiceover is present: 10^(-10/20) ≈ 0.3162
  const voDucking = hasVoiceover ? 0.3162 : 1.0
  // The bed is set by its AVERAGE level, not its peak: a dense track at the
  // events' peak buried them (reel 60: music alone 0.08–0.17 RMS above 300 Hz,
  // the event sounds 0.2–0.3 — six of them «not heard»). SYNC_LAW.bedRms keeps
  // every event about 20 dB over the bed.
  let sq = 0
  for (let i = 0; i < sample.length; i++)
    sq += (sample.L[i] * sample.L[i] + sample.R[i] * sample.R[i]) / 2
  const bedRms = Math.sqrt(sq / Math.max(1, sample.length))
  const baseGain = (SYNC_LAW.bedRms / Math.max(bedRms, 1e-6)) * voDucking

  for (let i = 0; i < n; i++) {
    const t = i / SR
    const sampleIdx = i % sample.L.length
    const fadeIn = Math.min(1, t / 1.5)
    const fadeOut = Math.min(1, (duration - t) / 1.2)
    const duckFactor = 1 - 0.75 * bus.duck[i]
    const level = baseGain * fadeIn * Math.max(0, fadeOut) * duckFactor

    bus.L[i] += sample.L[sampleIdx] * level
    bus.R[i] += sample.R[sampleIdx] * level
  }
}

function sceneDrops(bus, sceneStarts) {
  for (const at of sceneStarts) {
    if (at <= 0.05) continue
    bus.add(
      at - 0.02,
      // 0.25 s: the cut's own thump, gone before the scene's first event.
      render(0.25, (t) => Math.sin(2 * Math.PI * (48 - 18 * t) * t) * env(t, 0.003, 0.07)),
      // Under the cut's own sound, never over the scene's first event.
      {
        gain: 0.3,
        send: 0.1,
        duck: 0.3,
      },
    )
  }
}

function riser(bus, at, len = 1.4) {
  const n = rng(77)
  const bp = bandPass(1200, 0.7)
  bus.add(
    at - len,
    render(len, (t) => {
      const p = t / len
      return (
        bp(n()) * p ** 2.2 * 1.2 + Math.sin(2 * Math.PI * (200 + 600 * p * p) * t) * p ** 3 * 0.2
      )
    }),
    { gain: 0.4, send: 0.35, duck: 0 },
  )
}

// ─── reverb: Schroeder, decorrelated L/R ────────────────────────────────────
function reverb(input, tuning) {
  const combs = tuning.combs.map((len) => ({ buf: new Float32Array(len), i: 0, lp: 0 }))
  const aps = tuning.aps.map((len) => ({ buf: new Float32Array(len), i: 0 }))
  const out = new Float32Array(input.length)
  for (let k = 0; k < input.length; k++) {
    const x = input[k]
    let s = 0
    for (const c of combs) {
      const y = c.buf[c.i]
      c.lp = y * 0.75 + c.lp * 0.25 // damping
      c.buf[c.i] = x + c.lp * 0.82
      c.i = (c.i + 1) % c.buf.length
      s += y
    }
    s /= combs.length
    for (const a of aps) {
      const y = a.buf[a.i]
      const v = s + y * 0.5
      a.buf[a.i] = v
      a.i = (a.i + 1) % a.buf.length
      s = y - v * 0.5
    }
    out[k] = s
  }
  return out
}

// ─── master ─────────────────────────────────────────────────────────────────
function master(L, R) {
  // Bus compression (slow, gentle) then soft clip.
  let envl = 0
  const att = Math.exp(-1 / (0.005 * SR))
  const rel = Math.exp(-1 / (0.15 * SR))
  for (let i = 0; i < L.length; i++) {
    const peak = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    envl = peak > envl ? att * envl + (1 - att) * peak : rel * envl + (1 - rel) * peak
    const over = Math.max(0, envl - 0.5)
    const g = 1 / (1 + over * 1.5)
    L[i] *= g
    R[i] *= g
  }
  // Loudness ≈ −14 LUFS: RMS of high-passed signal to −17 dBFS, then limit.
  const hpL = onePoleHP(100)
  const hpR = onePoleHP(100)
  let sum = 0
  for (let i = 0; i < L.length; i++) {
    const a = hpL(L[i])
    const b = hpR(R[i])
    sum += a * a + b * b
  }
  const rms = Math.sqrt(sum / (2 * L.length)) || 1e-9
  const target = Math.pow(10, -16.2 / 20)
  const ceiling = Math.pow(10, -5.5 / 20) // −5.5 dBFS ceiling guarantees AAC true peak <= −1.0 dBTP on dense transients
  // AV sync law: loudness never costs the hits. The continuous bed dominates
  // the average, so «reach −16 dBFS RMS» alone raised the bed back up and
  // tanh flattened every hit into it (reel 60: six sounds «not heard»). The
  // make-up gain stops where the loudest hit still sits at 80% of the ceiling.
  let peak = 0
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  const gain = Math.min(8, target / rms, (0.8 * ceiling) / Math.max(peak, 1e-9))
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh((L[i] * gain) / ceiling) * ceiling
    R[i] = Math.tanh((R[i] * gain) / ceiling) * ceiling
  }
}

/**
 * The reel's soundtrack as a stereo 16-bit 48 kHz WAV.
 *
 * @param {{at:number, kind:string}[]} cues  every sound, on the reel's clock
 * @param {number} duration                  seconds
 * @param {{ sceneStarts?: number[], ctaAt?: number }} [structure]
 */
export function designSoundtrack(cues, duration, structure = {}) {
  const bus = new Bus(duration)
  const reelId = structure.reelId || '0'
  const musicMood = structure.musicMood || 'calm'
  const hasVoiceover = Boolean(structure.hasVoiceover)

  // Hits first, so the music bed knows where to duck.
  // At most one designed hit per 120 ms: a pile-up of hits is noise.
  cuePlacements(cues, reelId).forEach(({ cue, index, sample, start }) => {
    if (sample) {
      const props = KIND_PROPERTIES[cue.kind] || { gain: 0.5, pan: 0, send: 0.15, duck: 0.3 }
      // The HIT POINT lands on the cue (AV sync law), not the file's start.
      bus.addStereo(start, sample, props)
      return
    }
    // Fallback to synthesis recipe if sample not found
    const r = recipe(cue.kind, 1009 * (index + 1))
    bus.add(cue.at, r.samples, r)
  })
  sceneDrops(bus, structure.sceneStarts ?? [])
  if (typeof structure.ctaAt === 'number' && structure.ctaAt > 1.5) riser(bus, structure.ctaAt)
  musicBed(bus, duration, { mood: musicMood, hasVoiceover })

  const wetL = reverb(bus.sendL, {
    combs: [1557, 1617, 1491, 1422].map((x) => Math.round((x * SR) / 44100)),
    aps: [225, 556],
  })
  const wetR = reverb(bus.sendR, {
    combs: [1580, 1640, 1514, 1445].map((x) => Math.round((x * SR) / 44100)),
    aps: [248, 579],
  })
  const n = Math.ceil(duration * SR)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    L[i] = bus.L[i] + wetL[i] * 0.6
    R[i] = bus.R[i] + wetR[i] * 0.6
  }
  // Fade the last 0.4 s so the file never ends on a click.
  const tail = Math.floor(0.4 * SR)
  for (let i = 0; i < tail; i++) {
    const g = i / tail
    L[n - 1 - i] *= g
    R[n - 1 - i] *= g
  }
  master(L, R)

  const dataSize = n * 4
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(2, 22) // stereo
  wav.writeUInt32LE(SR, 24)
  wav.writeUInt32LE(SR * 4, 28)
  wav.writeUInt16LE(4, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  let o = 44
  for (let i = 0; i < n; i++) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), o)
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), o + 2)
    o += 4
  }
  return wav
}
