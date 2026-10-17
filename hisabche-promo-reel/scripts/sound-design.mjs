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
// ============================================

const SR = 48000

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

function musicBed(bus, duration) {
  // i – VI – III – VII in D minor, two bars each at ~86 bpm, low-passed pad.
  const chords = [
    [50, 57, 62, 65],
    [46, 53, 58, 62],
    [53, 57, 60, 65],
    [48, 55, 60, 64],
  ]
  const bar = (60 / 86) * 4
  const lpL = onePoleLP(1100)
  const lpR = onePoleLP(1000)
  const n = Math.ceil(duration * SR)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const idx = Math.floor(t / (bar * 2)) % chords.length
    const local = t % (bar * 2)
    const fadeChord = Math.min(1, local / 0.6) * Math.min(1, (bar * 2 - local) / 0.6)
    let l = 0
    let r = 0
    for (const m of chords[idx]) {
      const f = midi(m)
      l += Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 1.003 * t)
      r += Math.sin(2 * Math.PI * f * 0.998 * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t) * 0.5
    }
    // A soft eighth-note pulse on the root keeps time without drums.
    const eighth = (t % (bar / 8)) / (bar / 8)
    const pulse =
      Math.sin(2 * Math.PI * midi(chords[idx][0] - 12) * t) * Math.exp(-eighth * 6) * 0.6
    const fadeIn = Math.min(1, t / 1.5)
    const fadeOut = Math.min(1, (duration - t) / 1.2)
    const level = 0.035 * fadeChord * fadeIn * Math.max(0, fadeOut) * (1 - 0.75 * bus.duck[i])
    bus.L[i] += (lpL(l) + pulse) * level
    bus.R[i] += (lpR(r) + pulse) * level
  }
}

function sceneDrops(bus, sceneStarts) {
  for (const at of sceneStarts) {
    if (at <= 0.05) continue
    bus.add(
      at - 0.02,
      render(0.9, (t) => Math.sin(2 * Math.PI * (48 - 18 * t) * t) * env(t, 0.003, 0.3)),
      {
        gain: 0.55,
        send: 0.1,
        duck: 0.5,
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
  const target = Math.pow(10, -17 / 20)
  const gain = Math.min(8, target / rms)
  const ceiling = Math.pow(10, -1 / 20) // −1 dBTP-ish
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
  // Hits first, so the music bed knows where to duck.
  // At most one designed hit per 120 ms: a pile-up of hits is noise.
  let last = -1
  cues
    .slice()
    .sort((a, b) => a.at - b.at)
    .forEach((cue, i) => {
      if (cue.at - last < 0.12 && cue.kind !== 'ctaResolution') return
      last = cue.at
      const r = recipe(cue.kind, 1009 * (i + 1))
      bus.add(cue.at, r.samples, r)
    })
  sceneDrops(bus, structure.sceneStarts ?? [])
  if (typeof structure.ctaAt === 'number' && structure.ctaAt > 1.5) riser(bus, structure.ctaAt)
  musicBed(bus, duration)

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
