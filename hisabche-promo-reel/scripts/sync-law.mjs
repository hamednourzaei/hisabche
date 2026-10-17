// ============================================
// scripts/sync-law.mjs — the AV sync law, pure (owner, 17 Oct 2026).
//
// No fs, no ffmpeg: the export mixer (sound-design.mjs), the export gate
// (check-av-sync.mjs) and the browser preview (src/engine/sound.ts) import
// THIS file, so «where a sound's hit is» has one definition everywhere.
// ============================================

/**
 * The onset detector — ONE definition for the mixer (hit point of a file) and
 * the export gate (where a sound starts in the finished mix): high-pass at
 * 300 Hz (the music bed is not an onset), 5 ms RMS frames, and an onset where
 * a frame is 2.2× the mean of the previous 40 ms and above the floor.
 */
export const ONSET = {
  highpassHz: 300,
  hopSeconds: 0.005,
  lookback: 8,
  jump: 2.2,
  floor: 0.012,
  minGapSeconds: 0.08,
}

/** RBJ biquad high-pass, Q = 1/√2 (what ffmpeg's `highpass` does). */
export function highpass(x, sr, freq = ONSET.highpassHz) {
  const w = (2 * Math.PI * freq) / sr
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2)
  const cos = Math.cos(w)
  const a0 = 1 + alpha
  const b0 = (1 + cos) / 2 / a0
  const b1 = -(1 + cos) / a0
  const b2 = b0
  const a1 = (-2 * cos) / a0
  const a2 = (1 - alpha) / a0
  const y = new Float32Array(x.length)
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

/**
 * Onset times (seconds) of a mono signal. Frames before 0 count as silence.
 * `relative`: an onset must also reach this fraction of the signal's loudest
 * frame — for a file's hit point, so a faint pre-click is not «the hit».
 */
export function onsetsOf(mono, sr, relative = 0) {
  const x = highpass(mono, sr)
  const hop = Math.round(ONSET.hopSeconds * sr)
  const env = []
  for (let i = 0; i + hop <= x.length; i += hop) {
    let e = 0
    for (let k = 0; k < hop; k++) e += x[i + k] * x[i + k]
    env.push(Math.sqrt(e / hop))
  }
  let loudest = 0
  for (const v of env) loudest = Math.max(loudest, v)
  const floor = Math.max(ONSET.floor, relative * loudest)
  const onsets = []
  for (let i = 0; i < env.length; i++) {
    let prev = 0
    for (let k = 1; k <= ONSET.lookback; k++) prev += i - k >= 0 ? env[i - k] : 0
    prev /= ONSET.lookback
    const t = (i * hop) / sr
    if (
      env[i] > floor &&
      env[i] > prev * ONSET.jump &&
      (onsets.length === 0 || t - onsets.at(-1) > ONSET.minGapSeconds)
    ) {
      onsets.push(t)
    }
  }
  return onsets
}

/**
 * A file's hit onsets: onsets (at ≥ hitRelative of its loudest frame) that
 * reach HALF the loudest frame within SYNC_LAW.riseSeconds. A sound that
 * creeps up (a sparkle, a page rustle) has none: it is a swell, and a swell
 * cannot land on one frame — so no event kind may use one.
 */
export function hitOnsets(mono, sr) {
  return hitProfile(mono, sr).map((hit) => hit.t)
}

/**
 * Every hit with its strength (loudest 5 ms within riseSeconds of it).
 * `leads` is false when a LATER hit is more than SYNC_LAW.laterHitMax × the
 * first: a soft riffle then a loud slap — the ear hears the slap, so the
 * file has no single moment to put on the frame.
 */
export function hitProfile(mono, sr) {
  const x = highpass(mono, sr)
  const hop = Math.round(ONSET.hopSeconds * sr)
  const env = []
  for (let i = 0; i + hop <= x.length; i += hop) {
    let e = 0
    for (let k = 0; k < hop; k++) e += x[i + k] * x[i + k]
    env.push(Math.sqrt(e / hop))
  }
  const loudest = env.reduce((a, b) => Math.max(a, b), 0)
  const within = Math.max(1, Math.round(SYNC_LAW.riseSeconds / ONSET.hopSeconds))
  const hits = []
  for (const t of onsetsOf(mono, sr, SYNC_LAW.hitRelative)) {
    const i = Math.round(t / ONSET.hopSeconds)
    let peak = 0
    for (let k = i; k <= i + within && k < env.length; k++) peak = Math.max(peak, env[k])
    if (peak >= loudest / 2) hits.push({ t, peak })
  }
  return hits
}

/** True when the first hit is the one the ear hears as «the» hit. */
export function firstHitLeads(hits) {
  if (hits.length === 0) return false
  return hits.every((hit) => hit.peak <= hits[0].peak * SYNC_LAW.laterHitMax)
}

/** The fixed numbers of the sync law — tests and the export gate read these. */
export const SYNC_LAW = {
  /** A frame at this fraction of the file's peak is its hit point. */
  hitFraction: 0.5,
  /** Every file is normalised to this peak before its per-kind gain. */
  targetPeak: 0.5,
  /** Quieter than this raw peak = noise; refused. */
  minRawPeakDb: -45,
  /** Two cues closer than this share ONE sound (the first). */
  minGapSeconds: 0.12,
  /** The export fails if any placed sound starts further than this from its cue. */
  maxLagMs: 45,
  /**
   * CHOKE: a sound's tail fades out over this long, ending on the next hit.
   * Without it, reel 60's «cash» tail buried the «impact» 0.8 s later and the
   * gate could not find the impact at all — on screen the card shook in silence.
   */
  chokeSeconds: 0.06,
  /** …and is silent this long before the next hit, so the ear hears a new start. */
  chokeLeadSeconds: 0.04,
  /** A file's hit point is its first onset at ≥ this share of its loudest 5 ms. */
  hitRelative: 0.5,
  /** A transient reaches half its loudest frame within this of its onset. */
  riseSeconds: 0.03,
  /** No later hit in a file may be stronger than this × its first hit. */
  laterHitMax: 1.25,
  /** At most this much of a file is kept before its hit point (faded in). */
  leadSeconds: 0.02,
  /** The music bed's average level (RMS, linear) — far under every event. */
  bedRms: 0.008,
}
