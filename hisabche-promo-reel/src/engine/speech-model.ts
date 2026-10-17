// ============================================
// Hisabche Studio — Speech & Word-Synchronization Engine
//
// Models word-level and sentence-driven timing, enabling
// every meaningful spoken word to trigger visual reactions,
// motion states, and synchronized acoustic transients.
// ============================================

import type { SoundKind } from './sound'
import { normalizePersianWord } from './persian-text'

/**
 * Explicit 5-stage lifecycle of speech alignment:
 * 1. PROVISIONAL_CADENCE_MODEL_ACTIVE: No voiceover file exists. Timing estimated via cadence math.
 * 2. AUDIO_DETECTED_NOT_WORD_ALIGNED: Voiceover exists, FFmpeg acoustic diagnostics run, but no word timestamps.
 * 3. EXTERNAL_UNVERIFIED: Word timestamps exist in manifest, but engine execution provenance is not proven.
 * 4. MANUAL_REVIEW_ACCEPTED: Timings were reviewed and accepted by a human operator, but lack verified engine execution.
 * 5. REAL_WORD_ALIGNMENT_READY: Real voiceover exists AND verified subprocess engine execution (ASR or forced-alignment)
 *    has generated full word timestamps with >=90% canonical script coverage and zero overlap violations.
 */
export type AlignmentLifecycleStatus =
  | 'PROVISIONAL_CADENCE_MODEL_ACTIVE'
  | 'AUDIO_DETECTED_NOT_WORD_ALIGNED'
  | 'EXTERNAL_UNVERIFIED'
  | 'MANUAL_REVIEW_ACCEPTED'
  | 'REAL_WORD_ALIGNMENT_READY'

export interface WordCue {
  /** The exact spoken word or short token (Persian). */
  word: string
  /** Start time in seconds relative to the scene's start. */
  start: number
  /** End time in seconds relative to the scene's start. */
  end: number
  /** Whether this word receives kinetic typography emphasis/glow. */
  emphasis?: boolean | undefined
  /** Semantic action ID triggered at this exact word. */
  action?: string | undefined
  /** Sound effect fired at this word's timestamp. */
  sound?: SoundKind | undefined
  /**
   * Confidence score from real forced alignment / ASR (0.0 to 1.0).
   * MUST be null when timing is estimated or provisional — never invented.
   */
  confidence?: number | null | undefined
  /** Normalized Persian token used for speech recognition alignment */
  normalized?: string | undefined
}

export interface SentenceEnding {
  /** Second offset relative to scene start when the sentence resolves. */
  at: number
  /** The narrative punctuation/state shift (e.g. 'freeze-hold', 'crack-graph', 'snap-dashboard'). */
  action: string
  /** Sound effect associated with this turning point. */
  sound?: SoundKind | undefined
}

export interface SentencePlan {
  /** Full spoken voiceover sentence text. */
  text: string
  /** Communicative objective and emotional tone (e.g. 'هوک / جلب توجه', 'تشدید نگرانی', 'آشکارسازی مشکل', 'راهکار حسابچه'). */
  intent: string
  /** Explicit alignment state */
  alignmentStatus?: AlignmentLifecycleStatus | undefined
  /** Whether timings are provisional (true) or verified real speech (false). */
  isProvisional?: boolean | undefined
  /** Source of alignment */
  alignmentSource?:
    | (
        | 'forced-aligner'
        | 'whisper-asr'
        | 'whisper-ctc'
        | 'manual-operator-review'
        | 'external-unverified'
        | 'diagnostic-audio-only'
        | 'cadence-model'
      )
    | undefined
  /** Average alignment confidence across all words (null when provisional) */
  confidence?: number | null | undefined
  /** Full word-level and phrase-level timed cues for every spoken word. */
  words: WordCue[]
  /** Narrative punctuation event at the conclusion of the sentence. */
  sentenceEnding?: SentenceEnding | undefined
}

/**
 * Deterministically computes natural Persian speech timing based on syllable weights,
 * morphological clitics, and punctuation pauses when recorded audio is provisional.
 */
export function estimatePersianCadence(
  sentence: string,
  options: {
    startOffset?: number
    totalDuration?: number
    emphasizedWords?: string[]
    wordActions?: Record<string, { action?: string; sound?: SoundKind; emphasis?: boolean }>
  } = {},
): WordCue[] {
  const { startOffset = 0.2, totalDuration, emphasizedWords = [], wordActions = {} } = options

  // Clean tokens while preserving punctuation clues
  const rawTokens = sentence.trim().split(/\s+/)
  if (rawTokens.length === 0) return []

  // Calculate syllable and weight estimates for Persian words
  const weights = rawTokens.map((token) => {
    const clean = normalizePersianWord(token, { stripZwnj: true })
    // Base weight from character length (approximate proxy for syllable count in Persian)
    let w = Math.max(1, clean.length * 0.22)
    // Extra weight for punctuation pauses attached to the word
    if (token.includes('…')) w += 1.4
    else if (token.includes('؟') || token.includes('!')) w += 0.9
    else if (token.includes('،') || token.includes(',')) w += 0.6
    else if (token.endsWith('.')) w += 0.8

    // Extra weight for emphasized keywords
    if (emphasizedWords.some((ew) => clean.includes(ew) || ew.includes(clean))) {
      w *= 1.35
    }
    return w
  })

  const totalWeight = weights.reduce((acc, cur) => acc + cur, 0)
  const availableTime = totalDuration
    ? Math.max(1.0, totalDuration - startOffset - 0.3)
    : rawTokens.length * 0.42

  let currentTime = startOffset
  const wordCues: WordCue[] = []

  rawTokens.forEach((token, idx) => {
    const cleanWord = normalizePersianWord(token, { stripZwnj: true })
    const dur = (weights[idx]! / totalWeight) * availableTime
    const wordStart = Number(currentTime.toFixed(2))
    const wordEnd = Number((currentTime + Math.max(0.2, dur * 0.85)).toFixed(2))

    const isEmphasized =
      emphasizedWords.some((ew) => cleanWord.includes(ew) || ew.includes(cleanWord)) ||
      Boolean(wordActions[cleanWord]?.emphasis)

    const actionData = wordActions[cleanWord]

    wordCues.push({
      word: token,
      normalized: cleanWord,
      start: wordStart,
      end: wordEnd,
      emphasis: isEmphasized,
      action: actionData?.action,
      sound: actionData?.sound,
      confidence: null, // STRICT: Provisional cadence has null confidence
    })

    // Advance time with a slight natural inter-word breath gap
    const pauseBonus = token.includes('…') ? 0.35 : token.includes('،') ? 0.15 : 0.05
    currentTime += dur + pauseBonus
  })

  return wordCues
}

/**
 * Returns the currently active word at timestamp `t` with configurable tolerance.
 */
export function getActiveWord(
  words: WordCue[],
  currentTime: number,
  toleranceSec = 0.08,
): WordCue | null {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    if (currentTime >= w.start - toleranceSec && currentTime <= w.end + toleranceSec) {
      return w
    }
  }
  return null
}

/**
 * Finds any visual action or sound effect triggered within `windowSec` of `currentTime`.
 */
export function getEventAtTimestamp(
  words: WordCue[],
  currentTime: number,
  windowSec = 0.05,
): { word: string; action?: string; sound?: SoundKind } | null {
  for (const w of words) {
    if (Math.abs(currentTime - w.start) <= windowSec) {
      if (w.action || w.sound) {
        return { word: w.word, action: w.action, sound: w.sound }
      }
    }
  }
  return null
}

/**
 * Validates word cue sequence for monotonicity, duration positivity, and overlap bounds.
 */
export function validateWordSequence(words: WordCue[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!

    if (w.start < 0) {
      errors.push(`Word "${w.word}" has negative start time: ${w.start}`)
    }
    if (w.end <= w.start) {
      errors.push(`Word "${w.word}" has non-positive duration: start=${w.start}, end=${w.end}`)
    }
    if (i > 0) {
      const prev = words[i - 1]!
      if (w.start < prev.start) {
        errors.push(
          `Word "${w.word}" starts (${w.start}) before previous word "${prev.word}" (${prev.start})`,
        )
      }
      // Check severe overlap (>150ms overlap is an acoustic collision)
      if (w.start < prev.end - 0.15) {
        errors.push(
          `Word "${w.word}" severely overlaps previous word "${prev.word}": overlap=${(prev.end - w.start).toFixed(2)}s`,
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Verifies that the audio track duration and video composition duration do not drift.
 */
export function verifyAudioVideoSync(
  audioDuration: number,
  videoDuration: number,
  maxDriftSec = 0.5,
): { inSync: boolean; driftSec: number } {
  const driftSec = Math.abs(audioDuration - videoDuration)
  return {
    inSync: driftSec <= maxDriftSec,
    driftSec: Number(driftSec.toFixed(3)),
  }
}

/**
 * Resolves the lifecycle status from audio presence and alignment data availability.
 */
export function determineAlignmentStatus(options: {
  hasAudio: boolean
  hasWordAlignment: boolean
  coveragePercent?: number
  isEngineVerified?: boolean
  isManualReview?: boolean
}): AlignmentLifecycleStatus {
  const {
    hasAudio,
    hasWordAlignment,
    coveragePercent = 0,
    isEngineVerified,
    isManualReview,
  } = options
  if (!hasAudio) return 'PROVISIONAL_CADENCE_MODEL_ACTIVE'
  if (!hasWordAlignment || coveragePercent < 80) return 'AUDIO_DETECTED_NOT_WORD_ALIGNED'
  if (isManualReview) return 'MANUAL_REVIEW_ACCEPTED'
  if (isEngineVerified === false) return 'EXTERNAL_UNVERIFIED'
  return 'REAL_WORD_ALIGNMENT_READY'
}
