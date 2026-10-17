// ============================================
// Hisabche Studio Sound Engine — Web Audio API
// Professional Cinematic & Editorial Sound Design.
// Features: Master Bus with Dynamics Compressor,
// Layered Synthesis, Deterministic Noise Shaping,
// ADSR Envelopes, and Expressive Compound Cues.
// Zero runtime dependencies.
// ============================================

export type SoundKind =
  | 'pop'
  | 'whoosh'
  | 'success'
  | 'tick'
  | 'scan'
  | 'alert'
  | 'impact'
  | 'chime'
  | 'cash'
  | 'sync'
  // Compound & Semantic Sound Effects
  | 'cinematicReveal'
  | 'titleHit'
  | 'dataFlow'
  | 'bigReveal'
  | 'insightReveal'
  | 'precisionSequence'
  | 'softTransition'
  | 'financialMilestone'
  | 'cardEnter'
  | 'sceneTransition'
  | 'majorReveal'
  | 'successResolution'
  | 'ctaResolution'
  // Tactile Foley Sound Effects (2026 Master Catalog)
  | 'markerScribble'
  | 'paperRustle'
  | 'paperTear'
  | 'cameraSwish'
  | 'typewriterClick'
  | 'clockTickRapid'
  | 'chatPop'
  | 'receiptPrint'
  | 'cardThock'

export type AudioPalette = 'cinematic' | 'editorial' | 'kinetic' | 'financial' | 'digital'

// ─── Master Audio Bus & Lifecycle Management ──────────────────────────────

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let compressor: DynamicsCompressorNode | null = null
let noiseBuffer: AudioBuffer | null = null
let isMuted = false

/** Safe AudioContext initialization with master compressor and limiter. */
function getAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null

    ctx = new AudioContextClass()

    // Dynamics Compressor as soft master ceiling to prevent clipping
    compressor = ctx.createDynamicsCompressor()
    compressor.threshold.setValueAtTime(-6, ctx.currentTime)
    compressor.knee.setValueAtTime(12, ctx.currentTime)
    compressor.ratio.setValueAtTime(4, ctx.currentTime)
    compressor.attack.setValueAtTime(0.003, ctx.currentTime)
    compressor.release.setValueAtTime(0.15, ctx.currentTime)

    // Master Gain Node for instant mute and level control
    masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(isMuted ? 0 : 0.85, ctx.currentTime)

    // Routing: Sound Voices -> Master Gain -> Compressor -> Destination
    masterGain.connect(compressor)
    compressor.connect(ctx.destination)

    // Precompute deterministic pink/band-limited noise buffer (1 second, 44.1kHz)
    const len = Math.floor(ctx.sampleRate * 1.0)
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    for (let i = 0; i < len; i++) {
      // Deterministic pseudo-random generation to avoid Math.random variance
      const white = (((i * 374761393) ^ (i * 668265263)) & 0xffff) / 0x7fff - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

/** Toggles master mute state immediately without clicks. */
export function setMuted(next: boolean) {
  isMuted = next
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime)
    masterGain.gain.setValueAtTime(next ? 0 : 0.85, ctx.currentTime)
  }
}

// ─── Sound Design Toolkit (Layered Synthesis Primitives) ──────────────────

interface VoiceOptions {
  type?: OscillatorType
  startFreq: number
  endFreq?: number
  attack?: number
  decay?: number
  peakGain?: number
  detune?: number
  filterFreq?: number
  filterType?: BiquadFilterType
  startTime?: number
}

function playSynthesizedVoice(a: AudioContext, opts: VoiceOptions): AudioNode {
  const t0 = opts.startTime ?? a.currentTime
  const attack = opts.attack ?? 0.01
  const decay = opts.decay ?? 0.15
  const peak = opts.peakGain ?? 0.2

  const osc = a.createOscillator()
  const gain = a.createGain()

  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.startFreq, t0)
  if (opts.endFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, opts.endFreq), t0 + attack + decay)
  }
  if (opts.detune) {
    osc.detune.setValueAtTime(opts.detune, t0)
  }

  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)

  const nodeOut: AudioNode = gain
  if (opts.filterFreq) {
    const filter = a.createBiquadFilter()
    filter.type = opts.filterType ?? 'lowpass'
    filter.frequency.setValueAtTime(opts.filterFreq, t0)
    osc.connect(filter)
    filter.connect(gain)
  } else {
    osc.connect(gain)
  }

  if (masterGain) {
    nodeOut.connect(masterGain)
  }

  osc.start(t0)
  osc.stop(t0 + attack + decay + 0.02)

  // Voice cleanup
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }

  return nodeOut
}

/** Short, warm transient tap generator (removes 8-bit arcade clicks). */
function playTransient(a: AudioContext, t0: number, freq = 920, gainPeak = 0.09) {
  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: freq,
    endFreq: 220,
    attack: 0.002,
    decay: 0.016,
    peakGain: gainPeak,
    filterFreq: 1800,
    filterType: 'lowpass',
    startTime: t0,
  })
}

// ─── 10 Redesigned Core Sound Effects ────────────────────────────────────

/** `pop` — Tactile micro-interaction: soft physical tap with rounded, warm tonal body. */
export function playPop() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  // 1. Gentle tactile transient tap
  playTransient(a, now, 880, 0.08)

  // 2. Rounded warm woody body
  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 240,
    endFreq: 150,
    attack: 0.005,
    decay: 0.045,
    peakGain: 0.14,
    startTime: now,
  })
}

/** `whoosh` — Cinematic movement: deep filtered air displacement with low-mid breath. */
export function playWhoosh() {
  const a = getAudio()
  if (!a || isMuted || !noiseBuffer) return
  const now = a.currentTime
  const dur = 0.32

  // 1. Layered Pink Noise Sweep (Smooth low-mid envelope, no 8-bit fizz)
  const src = a.createBufferSource()
  src.buffer = noiseBuffer

  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.95
  filter.frequency.setValueAtTime(120, now)
  filter.frequency.exponentialRampToValueAtTime(420, now + dur * 0.45)
  filter.frequency.exponentialRampToValueAtTime(140, now + dur)

  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.18, now + dur * 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(filter).connect(gain)
  if (masterGain) gain.connect(masterGain)

  src.start(now)
  src.stop(now + dur + 0.02)

  // 2. Sub air displacement
  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 90,
    endFreq: 160,
    attack: 0.04,
    decay: 0.26,
    peakGain: 0.12,
    startTime: now,
  })
}

/** `success` — Warm harmonic resolution: Cmaj9 chord with warm bass root. */
export function playSuccess() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime
  // C3 bass root + C4, E4, G4, B4, D5 (Cmaj9)
  const chord = [130.81, 261.63, 329.63, 392.0, 493.88, 587.33]

  chord.forEach((freq, idx) => {
    const t0 = now + idx * 0.035
    playSynthesizedVoice(a, {
      type: idx === 0 ? 'sine' : 'triangle',
      startFreq: freq,
      attack: 0.025,
      decay: idx === 0 ? 1.1 : 0.85 - idx * 0.06,
      peakGain: idx === 0 ? 0.12 : 0.065,
      filterFreq: 1400,
      filterType: 'lowpass',
      startTime: t0,
    })
  })
}

/** `tick` — Precision: ultra-short mechanical editorial dial tick (organic, non-arcade). */
export function playTick() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: 1050,
    endFreq: 360,
    attack: 0.001,
    decay: 0.012,
    peakGain: 0.07,
    filterFreq: 1600,
    filterType: 'lowpass',
    startTime: now,
  })
}

/** `scan` — Telemetry scanning: gentle dual-carrier sweep with smooth lowpass roll-off. */
export function playScan() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 420,
    endFreq: 680,
    attack: 0.015,
    decay: 0.09,
    peakGain: 0.08,
    filterFreq: 1100,
    filterType: 'lowpass',
    startTime: now,
  })

  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 428,
    endFreq: 692,
    attack: 0.015,
    decay: 0.09,
    peakGain: 0.06,
    filterFreq: 1100,
    filterType: 'lowpass',
    startTime: now + 0.01,
  })
}

/** `alert` — Dramatic tension: low-register cello minor-second dissonance with sub rumble. */
export function playAlert() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  // Low C3 (130.8Hz) and C#3 (138.6Hz) tension interval (dramatic cinematic dissonance)
  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: 130.81,
    endFreq: 122.0,
    attack: 0.02,
    decay: 0.32,
    peakGain: 0.15,
    filterFreq: 380,
    filterType: 'lowpass',
    startTime: now,
  })

  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: 138.59,
    endFreq: 130.0,
    attack: 0.02,
    decay: 0.32,
    peakGain: 0.13,
    filterFreq: 380,
    filterType: 'lowpass',
    startTime: now + 0.04,
  })

  // Deep cinematic sub foundation
  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 58,
    endFreq: 42,
    attack: 0.015,
    decay: 0.38,
    peakGain: 0.22,
    startTime: now,
  })
}

/** `impact` — Rubber-stamp physical impact thud: 55Hz sub punch + tactile wood slap. */
export function playImpact() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  // 1. Tactile wood slap transient
  playTransient(a, now, 520, 0.14)

  // 2. Physical rubber-stamp mid body punch
  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: 95,
    endFreq: 52,
    attack: 0.004,
    decay: 0.12,
    peakGain: 0.24,
    filterFreq: 480,
    filterType: 'lowpass',
    startTime: now,
  })

  // 3. Deep 55Hz sub punch
  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 58,
    endFreq: 32,
    attack: 0.008,
    decay: 0.45,
    peakGain: 0.35,
    startTime: now,
  })
}

/** `chime` — Discovery and insight: warm muted acoustic triads with tactile decay. */
export function playChime() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime
  // Warm muted acoustic triads (E4, G4, B4, E5 ~ 329.63, 392.0, 493.88, 659.25)
  const partials = [329.63, 392.0, 493.88, 659.25]

  partials.forEach((freq, idx) => {
    const t0 = now + idx * 0.04
    playSynthesizedVoice(a, {
      type: 'triangle',
      startFreq: freq,
      attack: 0.015,
      decay: 0.7 - idx * 0.08,
      peakGain: 0.055,
      filterFreq: 1200,
      filterType: 'lowpass',
      startTime: t0,
    })
  })
}

/** `cash` — Financial transaction: clean latch click + warm metallic coin chime. */
export function playCash() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  // 1. Tactile register latch
  playTransient(a, now, 640, 0.1)

  // 2. Warm brass bell resonance
  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: 783.99,
    attack: 0.008,
    decay: 0.45,
    peakGain: 0.11,
    filterFreq: 1800,
    filterType: 'lowpass',
    startTime: now + 0.02,
  })

  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 1174.66,
    attack: 0.006,
    decay: 0.55,
    peakGain: 0.07,
    filterFreq: 2200,
    filterType: 'lowpass',
    startTime: now + 0.035,
  })
}

/** `sync` — Data movement & sync: warm harmonic sweep ending in a clean soft lock. */
export function playSync() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  // Stereo detuned upward sweep
  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 240,
    endFreq: 580,
    attack: 0.02,
    decay: 0.16,
    peakGain: 0.1,
    detune: -6,
    filterFreq: 1200,
    filterType: 'lowpass',
    startTime: now,
  })

  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 244,
    endFreq: 588,
    attack: 0.02,
    decay: 0.16,
    peakGain: 0.1,
    detune: 6,
    filterFreq: 1200,
    filterType: 'lowpass',
    startTime: now,
  })

  // Final soft lock tick
  playTransient(a, now + 0.16, 750, 0.07)
}

// ─── Expressive Compound & Semantic Sound Effects ────────────────────────

/** `cinematicReveal` — Subtle rise, movement whoosh, and weighted impact. */
export function playCinematicReveal() {
  playWhoosh()
  setTimeout(() => playImpact(), 80)
}

/** `titleHit` — Crisp transient + punchy tonal body. */
export function playTitleHit() {
  playPop()
  setTimeout(() => playImpact(), 40)
}

/** `dataFlow` — Rhythmic digital pulse stream. */
export function playDataFlow() {
  playTick()
  setTimeout(() => playTick(), 60)
  setTimeout(() => playTick(), 120)
  setTimeout(() => playSync(), 180)
}

/** `bigReveal` — Deep tension swell followed by final impact. */
export function playBigReveal() {
  playWhoosh()
  setTimeout(() => playImpact(), 140)
  setTimeout(() => playChime(), 200)
}

/** `insightReveal` — Sparkling chime + warm resolution chord. */
export function playInsightReveal() {
  playChime()
  setTimeout(() => playSuccess(), 100)
}

/** `precisionSequence` — Tightly timed editorial tick sequence. */
export function playPrecisionSequence() {
  playTick()
  setTimeout(() => playTick(), 50)
  setTimeout(() => playTick(), 100)
}

/** `softTransition` — Low-intensity subtle movement. */
export function playSoftTransition() {
  playWhoosh()
}

/** `financialMilestone` — Restrained impact + metallic transaction ring. */
export function playFinancialMilestone() {
  playImpact()
  setTimeout(() => playCash(), 100)
  setTimeout(() => playSuccess(), 220)
}

/** `cardEnter` — Tactile card entrance: gentle pop with subtle air movement. */
export function playCardEnter() {
  playPop()
}

/** `sceneTransition` — Audio bridge between scenes: air whoosh with low sub weight. */
export function playSceneTransition() {
  playWhoosh()
  setTimeout(() => playImpact(), 100)
}

/** `majorReveal` — Landmark feature reveal with impact and crystalline shimmer. */
export function playMajorReveal() {
  playWhoosh()
  setTimeout(() => playImpact(), 120)
  setTimeout(() => playChime(), 220)
}

/** `successResolution` — Complete problem solved: rich harmonic resolution. */
export function playSuccessResolution() {
  playSuccess()
}

/** `ctaResolution` — Final closing confident resolution with lingering chime. */
export function playCtaResolution() {
  playSuccess()
  setTimeout(() => playChime(), 180)
}

// ─── Tactile Foley Sound Effects (2026 Master Catalog) ───────────────────

/** `markerScribble` — Felt-tip marker drawing on tactile paper (bandpassed pink noise, 1400-2200Hz). */
export function playMarkerScribble() {
  const a = getAudio()
  if (!a || isMuted || !noiseBuffer) return
  const now = a.currentTime
  const dur = 0.18

  const src = a.createBufferSource()
  src.buffer = noiseBuffer

  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 2.2
  filter.frequency.setValueAtTime(1400, now)
  filter.frequency.exponentialRampToValueAtTime(2200, now + dur * 0.5)
  filter.frequency.exponentialRampToValueAtTime(1600, now + dur)

  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.02)
  gain.gain.linearRampToValueAtTime(0.08, now + 0.09)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(filter).connect(gain)
  if (masterGain) gain.connect(masterGain)

  src.start(now)
  src.stop(now + dur + 0.02)
}

/** `paperRustle` — Delicate paper sliding/handling texture. */
export function playPaperRustle() {
  const a = getAudio()
  if (!a || isMuted || !noiseBuffer) return
  const now = a.currentTime
  const dur = 0.12

  const src = a.createBufferSource()
  src.buffer = noiseBuffer

  const filter = a.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(1800, now)
  filter.frequency.exponentialRampToValueAtTime(3200, now + dur)

  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(filter).connect(gain)
  if (masterGain) gain.connect(masterGain)

  src.start(now)
  src.stop(now + dur + 0.02)
}

/** `paperTear` — Crisp physical paper tear transient with fibrous texture. */
export function playPaperTear() {
  const a = getAudio()
  if (!a || isMuted || !noiseBuffer) return
  const now = a.currentTime
  const dur = 0.14

  const src = a.createBufferSource()
  src.buffer = noiseBuffer

  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.6
  filter.frequency.setValueAtTime(2800, now)
  filter.frequency.exponentialRampToValueAtTime(1200, now + dur)

  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(0.18, now + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(filter).connect(gain)
  if (masterGain) gain.connect(masterGain)

  src.start(now)
  src.stop(now + dur + 0.02)

  playTransient(a, now, 1200, 0.06)
}

/** `cameraSwish` — Smooth airy train-scroll camera movement across vertical stations. */
export function playCameraSwish() {
  const a = getAudio()
  if (!a || isMuted || !noiseBuffer) return
  const now = a.currentTime
  const dur = 0.28

  const src = a.createBufferSource()
  src.buffer = noiseBuffer

  const filter = a.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(450, now)
  filter.frequency.exponentialRampToValueAtTime(950, now + dur * 0.4)
  filter.frequency.exponentialRampToValueAtTime(250, now + dur)

  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.14, now + dur * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(filter).connect(gain)
  if (masterGain) gain.connect(masterGain)

  src.start(now)
  src.stop(now + dur + 0.02)
}

/** `typewriterClick` — Crisp 10ms mechanical key tap. */
export function playTypewriterClick() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  playTransient(a, now, 1850, 0.07)
  playSynthesizedVoice(a, {
    type: 'triangle',
    startFreq: 340,
    endFreq: 180,
    attack: 0.002,
    decay: 0.012,
    peakGain: 0.06,
    startTime: now,
  })
}

/** `clockTickRapid` — Rapid mechanical watch escapement tick. */
export function playClockTickRapid() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  playTransient(a, now, 2400, 0.05)
  setTimeout(() => {
    const a2 = getAudio()
    if (a2 && !isMuted) {
      playTransient(a2, a2.currentTime, 1900, 0.04)
    }
  }, 45)
}

/** `chatPop` — Soft friendly message bubble pop with gentle air release. */
export function playChatPop() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  playSynthesizedVoice(a, {
    type: 'sine',
    startFreq: 640,
    endFreq: 320,
    attack: 0.003,
    decay: 0.038,
    peakGain: 0.12,
    startTime: now,
  })
  playTransient(a, now, 980, 0.04)
}

/** `receiptPrint` — Stepper motor advancement buzz for thermal POS paper. */
export function playReceiptPrint() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  for (let i = 0; i < 3; i++) {
    playSynthesizedVoice(a, {
      type: 'sawtooth',
      startFreq: 140,
      endFreq: 110,
      attack: 0.002,
      decay: 0.015,
      peakGain: 0.08,
      filterFreq: 800,
      filterType: 'lowpass',
      startTime: now + i * 0.025,
    })
  }
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────

export function play(kind: SoundKind) {
  switch (kind) {
    case 'pop':
      return playPop()
    case 'whoosh':
      return playWhoosh()
    case 'success':
      return playSuccess()
    case 'tick':
      return playTick()
    case 'scan':
      return playScan()
    case 'alert':
      return playAlert()
    case 'impact':
      return playImpact()
    case 'chime':
      return playChime()
    case 'cash':
      return playCash()
    case 'sync':
      return playSync()
    case 'cinematicReveal':
      return playCinematicReveal()
    case 'titleHit':
      return playTitleHit()
    case 'dataFlow':
      return playDataFlow()
    case 'bigReveal':
      return playBigReveal()
    case 'insightReveal':
      return playInsightReveal()
    case 'precisionSequence':
      return playPrecisionSequence()
    case 'softTransition':
      return playSoftTransition()
    case 'financialMilestone':
      return playFinancialMilestone()
    case 'cardEnter':
      return playCardEnter()
    case 'sceneTransition':
      return playSceneTransition()
    case 'majorReveal':
      return playMajorReveal()
    case 'successResolution':
      return playSuccessResolution()
    case 'ctaResolution':
      return playCtaResolution()
    case 'markerScribble':
      return playMarkerScribble()
    case 'paperRustle':
      return playPaperRustle()
    case 'paperTear':
      return playPaperTear()
    case 'cameraSwish':
      return playCameraSwish()
    case 'typewriterClick':
      return playTypewriterClick()
    case 'clockTickRapid':
      return playClockTickRapid()
    case 'chatPop':
      return playChatPop()
    case 'receiptPrint':
      return playReceiptPrint()
    case 'cardThock':
      return playCardThock()
  }
}

/** `cardThock` — Soft mechanical thock (apple-like tap or damped keyboard) for card entry. */
export function playCardThock() {
  const a = getAudio()
  if (!a || isMuted) return
  const now = a.currentTime

  try {
    const osc = a.createOscillator()
    const gain = a.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.04)

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    if (masterGain) {
      osc.connect(gain)
      gain.connect(masterGain)
    } else {
      osc.connect(gain)
      gain.connect(a.destination)
    }

    osc.start(now)
    osc.stop(now + 0.04)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  } catch {
    // Graceful fallback
  }
}

export const soundEngine = {
  play,
  playPop,
  playWhoosh,
  playCardThock,
  playSuccess,
  playTick,
  playScan,
  playAlert,
  playImpact,
  playChime,
  playCash,
  playSync,
  playMarkerScribble,
  playPaperRustle,
  playPaperTear,
  playCameraSwish,
  playTypewriterClick,
  playClockTickRapid,
  playChatPop,
  playReceiptPrint,
  setMuted,
}
