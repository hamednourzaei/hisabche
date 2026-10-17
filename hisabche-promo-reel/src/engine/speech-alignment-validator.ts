// ============================================
// Hisabche Studio — Speech Alignment Validator & Provenance Engine
//
// Implements strict validation of speech alignment data:
// 1. Audio identity verification (SHA-256 + duration match)
// 2. Strict Provenance Hierarchy (Provisional, External Unverified, ASR, Forced Alignment)
// 3. Complete Whisper JSON schema parser (segments[].words[], probability, leading spaces)
// 4. Prevention of false promotion (self-declared JSON metadata cannot self-certify)
// 5. Spoken word coverage analysis against canonical script (all 30 words)
// 6. Acoustic timing validity (finite, non-negative, end > start, overlap limits)
// ============================================

import type { AlignmentLifecycleStatus } from './speech-model'
import { normalizePersianWord, persianWordsMatch } from './persian-text'

export const REEL_53_CANONICAL_SCRIPT: string[][] = [
  // Scene 0: Hook (2 words)
  ['فروشت', 'زیاده…'],
  // Scene 1: Contrast / Collapse (7 words)
  ['اما', 'آخر', 'ماه', 'نمی‌دونی', 'پولت', 'کجا', 'رفته!'],
  // Scene 2: Leaks (4 words)
  ['انبار،', 'طلب', 'مشتری‌ها،', 'خرج‌ها…'],
  // Scene 3: Solution (7 words)
  ['حسابچه', 'کمک', 'می‌کنه', 'همه‌چیز', 'رو', 'یکجا', 'ببینی.'],
  // Scene 4: CTA (10 words)
  ['همین', 'حالا', 'دخل', 'و', 'حسابت', 'رو', 'در', 'حسابچه', 'شفاف', 'کن.'],
]

export const REEL_53_ALL_WORDS: string[] = REEL_53_CANONICAL_SCRIPT.flat()
export const TOTAL_CANONICAL_WORDS = REEL_53_ALL_WORDS.length // exactly 30 words

export interface AudioIdentity {
  filePath: string
  fileName: string
  sha256?: string | undefined
  durationSec: number
  fileSizeBytes: number
}

/**
 * 5 Provenance Categories:
 * - PROVISIONAL: Calculated via syllable weight heuristics; no audio involved.
 * - EXTERNAL_UNVERIFIED: Received from external source; cannot self-certify engine execution.
 * - MANUAL_OPERATOR_REVIEWED: Manually inspected and approved by human operator; not an engine execution proof.
 * - ASR_GENERATED: Emitted by verifiable speech recognition inference (Whisper).
 * - FORCED_ALIGNMENT_GENERATED: Conditioned on reference transcript and aligned acoustically (CTC/MFA).
 */
export type ProvenanceType =
  | 'PROVISIONAL'
  | 'EXTERNAL_UNVERIFIED'
  | 'MANUAL_OPERATOR_REVIEWED'
  | 'ASR_GENERATED'
  | 'FORCED_ALIGNMENT_GENERATED'

export interface ProcessExecutionRecord {
  executablePath: string
  commandArgs: string[]
  exitCode: number
  durationMs: number
  executedAt: string
  audioSha256: string
  outputSha256?: string | undefined
  verifiedSuccess: boolean
}

export interface ManualReviewRecord {
  reviewedBy: string
  reviewedAt: string
  reviewNotes?: string | undefined
  acceptedCanonicalCoverage?: number | undefined
}

export interface AlignmentProvenance {
  type: ProvenanceType
  engine: string
  engineVersion?: string | undefined
  model?: string | undefined
  audioSha256?: string | undefined
  audioDuration?: number | undefined
  alignedAt?: string | undefined
  /**
   * Only trusted execution adapters or explicit test adapters can assert true execution.
   * Self-declared JSON files from disk are unverified by default.
   */
  isTrustedExecution?: boolean | undefined
  processRecord?: ProcessExecutionRecord | undefined
  manualReviewRecord?: ManualReviewRecord | undefined
  executionTrace?: string | undefined
}

export interface ParsedWordCue {
  word: string
  start: number
  end: number
  confidence: number | null
}

export interface WhisperParseResult {
  success: boolean
  hasWordTimestamps: boolean
  words: ParsedWordCue[]
  fullText?: string | undefined
  language?: string | undefined
  error?: string | undefined
}

/**
 * Parses raw Whisper JSON output (from openai-whisper or faster-whisper).
 * Handles segment-level vs word-level structures, probability field, and whitespace trimming.
 */
export function parseWhisperJson(raw: unknown): WhisperParseResult {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      hasWordTimestamps: false,
      words: [],
      error: 'Whisper JSON is null or not an object.',
    }
  }

  const obj = raw as Record<string, unknown>
  const fullText = typeof obj['text'] === 'string' ? obj['text'].trim() : undefined
  const language = typeof obj['language'] === 'string' ? obj['language'] : undefined

  // 1. Standard OpenAI Whisper JSON: obj.segments[].words[]
  if (Array.isArray(obj['segments'])) {
    const segments = obj['segments'] as Array<Record<string, unknown>>
    const collectedWords: ParsedWordCue[] = []
    let foundAnyWordTimestamps = false

    for (const seg of segments) {
      if (Array.isArray(seg['words']) && seg['words'].length > 0) {
        foundAnyWordTimestamps = true
        for (const w of seg['words'] as Array<Record<string, unknown>>) {
          const wordText = String(w['word'] ?? w['text'] ?? '').trim()
          const start = Number(w['start'])
          const end = Number(w['end'])
          const prob =
            typeof w['probability'] === 'number'
              ? w['probability']
              : typeof w['confidence'] === 'number'
                ? w['confidence']
                : null

          if (wordText && Number.isFinite(start) && Number.isFinite(end)) {
            collectedWords.push({
              word: wordText,
              start: Number(start.toFixed(3)),
              end: Number(end.toFixed(3)),
              confidence: prob !== null ? Number(prob.toFixed(2)) : null,
            })
          }
        }
      }
    }

    if (!foundAnyWordTimestamps) {
      return {
        success: false,
        hasWordTimestamps: false,
        words: [],
        fullText,
        language,
        error:
          'Whisper JSON contains segment timestamps only, with no word-level timestamps. (Ensure --word_timestamps True was used).',
      }
    }

    return {
      success: true,
      hasWordTimestamps: true,
      words: collectedWords,
      fullText,
      language,
    }
  }

  // 2. Direct words array format: obj.words[] (WhisperX / CTC / test fixtures)
  if (Array.isArray(obj['words'])) {
    const collectedWords: ParsedWordCue[] = []
    for (const w of obj['words'] as Array<Record<string, unknown>>) {
      const wordText = String(w['word'] ?? w['text'] ?? '').trim()
      const start = Number(w['start'])
      const end = Number(w['end'])
      const prob =
        typeof w['probability'] === 'number'
          ? w['probability']
          : typeof w['confidence'] === 'number'
            ? w['confidence']
            : null

      if (wordText && Number.isFinite(start) && Number.isFinite(end)) {
        collectedWords.push({
          word: wordText,
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          confidence: prob !== null ? Number(prob.toFixed(2)) : null,
        })
      }
    }

    return {
      success: collectedWords.length > 0,
      hasWordTimestamps: collectedWords.length > 0,
      words: collectedWords,
      fullText,
      language,
    }
  }

  return {
    success: false,
    hasWordTimestamps: false,
    words: [],
    error: 'Unrecognized Whisper JSON format. Neither "segments[].words" nor "words[]" found.',
  }
}

export interface AlignmentValidationReport {
  isValidForPromotion: boolean
  resolvedStatus: AlignmentLifecycleStatus
  provenanceType: ProvenanceType
  referenceWordCount: number
  recognizedWordCount: number
  matchedWordsCount: number
  missingWords: string[]
  extraWords: string[]
  mismatchedWords: string[]
  timingInvalidWords: string[]
  overlapInvalidWords: string[]
  alignmentCoveragePercent: number
  timeCoverageSec: number
  averageConfidence: number | null
  provenanceValid: boolean
  provenanceIssues: string[]
  blockingReasons: string[]
}

/**
 * Validates word cues against canonical script, audio boundaries, and provenance authenticity.
 * Enforces strict, zero-trust promotion criteria.
 */
export function validateAlignmentReadiness(options: {
  audio?: AudioIdentity | undefined
  provenance?: AlignmentProvenance | undefined
  rawCues: Array<{
    word: string
    start: number
    end: number
    confidence?: number | null | undefined
  }>
  canonicalWords?: string[] | undefined
  maxAllowedDriftSec?: number | undefined
}): AlignmentValidationReport {
  const {
    audio,
    provenance,
    rawCues,
    canonicalWords = REEL_53_ALL_WORDS,
    maxAllowedDriftSec = 0.5,
  } = options

  const blockingReasons: string[] = []
  const provenanceIssues: string[] = []
  const provType: ProvenanceType = provenance?.type ?? 'EXTERNAL_UNVERIFIED'

  // 1. Audio Presence Check
  if (!audio || audio.durationSec <= 0) {
    return {
      isValidForPromotion: false,
      resolvedStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE',
      provenanceType: 'PROVISIONAL',
      referenceWordCount: canonicalWords.length,
      recognizedWordCount: rawCues.length,
      matchedWordsCount: 0,
      missingWords: [...canonicalWords],
      extraWords: [],
      mismatchedWords: [],
      timingInvalidWords: [],
      overlapInvalidWords: [],
      alignmentCoveragePercent: 0,
      timeCoverageSec: 0,
      averageConfidence: null,
      provenanceValid: false,
      provenanceIssues: ['No valid audio file supplied.'],
      blockingReasons: ['Waiting for actual voiceover audio.'],
    }
  }

  // 2. Provenance & Execution Authenticity Validation
  let provenanceValid = true

  // STRICT ZERO-TRUST CHECKS:
  if (!provenance || provType === 'PROVISIONAL') {
    provenanceValid = false
    provenanceIssues.push(
      'Provenance is PROVISIONAL (cadence model); no live engine execution was performed.',
    )
  } else if (provType === 'EXTERNAL_UNVERIFIED') {
    provenanceValid = false
    provenanceIssues.push(
      'Provenance is EXTERNAL_UNVERIFIED: Self-declared external JSON or static on-disk receipt cannot self-certify engine execution without a verified live subprocess execution trace.',
    )
  } else if (provType === 'MANUAL_OPERATOR_REVIEWED') {
    provenanceValid = false
    provenanceIssues.push(
      'Provenance is MANUAL_OPERATOR_REVIEWED: Operator review confirms human inspection, but does NOT satisfy technical engine execution proof required for REAL_WORD_ALIGNMENT_READY.',
    )
  } else if (!provenance.isTrustedExecution) {
    provenanceValid = false
    provenanceIssues.push(
      `Provenance execution for ${provType} is not verified as a successful engine process run.`,
    )
  }

  if (provenance?.audioSha256 && audio.sha256) {
    if (provenance.audioSha256.toLowerCase() !== audio.sha256.toLowerCase()) {
      provenanceValid = false
      provenanceIssues.push(
        `Audio SHA-256 mismatch: manifest specifies ${provenance.audioSha256.slice(0, 8)}, audio file is ${audio.sha256.slice(0, 8)}`,
      )
    }
  }

  if (provenance?.audioDuration) {
    const durDrift = Math.abs(provenance.audioDuration - audio.durationSec)
    if (durDrift > maxAllowedDriftSec) {
      provenanceValid = false
      provenanceIssues.push(
        `Audio duration drift: manifest expects ${provenance.audioDuration}s, actual file is ${audio.durationSec}s (drift: ${durDrift.toFixed(2)}s)`,
      )
    }
  }

  // 3. Timing Validity Checks on Raw Cues
  const timingInvalidWords: string[] = []
  const overlapInvalidWords: string[] = []
  let totalTimeCovered = 0

  for (let i = 0; i < rawCues.length; i++) {
    const cue = rawCues[i]!

    // Start & End sanity
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end)) {
      timingInvalidWords.push(
        `Word "${cue.word}" has non-finite timestamp: [${cue.start}, ${cue.end}]`,
      )
      continue
    }
    if (cue.start < 0) {
      timingInvalidWords.push(`Word "${cue.word}" starts at negative time: ${cue.start}s`)
    }
    if (cue.end <= cue.start) {
      timingInvalidWords.push(
        `Word "${cue.word}" has zero or negative duration: [${cue.start}, ${cue.end}]`,
      )
    }
    if (cue.end > audio.durationSec + 0.3) {
      timingInvalidWords.push(
        `Word "${cue.word}" ends (${cue.end}s) beyond audio duration (${audio.durationSec}s)`,
      )
    }

    totalTimeCovered += Math.max(0, cue.end - cue.start)

    // Overlap checks
    if (i > 0) {
      const prev = rawCues[i - 1]!
      if (cue.start < prev.start) {
        timingInvalidWords.push(
          `Word "${cue.word}" starts (${cue.start}) before previous "${prev.word}" (${prev.start})`,
        )
      }
      // Overlap greater than 150ms is an acoustic violation
      if (cue.start < prev.end - 0.15) {
        overlapInvalidWords.push(
          `Word "${cue.word}" severely overlaps previous word "${prev.word}" by ${(prev.end - cue.start).toFixed(2)}s`,
        )
      }
    }
  }

  // 4. Token Matching & Full-Word Coverage Analysis
  const availableCues = [...rawCues]
  const matchedWords: string[] = []
  const missingWords: string[] = []
  let confidenceSum = 0
  let confidenceCount = 0

  for (const refWord of canonicalWords) {
    const normRef = normalizePersianWord(refWord, { stripZwnj: true })
    const matchIdx = availableCues.findIndex((c) => persianWordsMatch(c.word, normRef))

    if (matchIdx !== -1) {
      const matchedCue = availableCues.splice(matchIdx, 1)[0]!
      matchedWords.push(refWord)
      if (typeof matchedCue.confidence === 'number' && Number.isFinite(matchedCue.confidence)) {
        confidenceSum += matchedCue.confidence
        confidenceCount++
      }
    } else {
      missingWords.push(refWord)
    }
  }

  // Extra unrecognized words in ASR
  const extraWords = availableCues.map((c) => c.word)

  const coveragePercent = Math.round(
    (matchedWords.length / Math.max(1, canonicalWords.length)) * 100,
  )
  const averageConfidence =
    confidenceCount > 0 ? Number((confidenceSum / confidenceCount).toFixed(2)) : null

  // 5. Readiness Gates (Strict Zero-Trust Rules)
  if (!provenanceValid) {
    blockingReasons.push(...provenanceIssues)
  }
  if (timingInvalidWords.length > 0) {
    blockingReasons.push(`Found ${timingInvalidWords.length} timing-invalid word cues.`)
  }
  if (overlapInvalidWords.length > 0) {
    blockingReasons.push(
      `Found ${overlapInvalidWords.length} severe acoustic overlap collisions (>150ms).`,
    )
  }
  if (coveragePercent < 90) {
    blockingReasons.push(
      `Alignment coverage (${coveragePercent}%) is below 90% threshold (${matchedWords.length}/${canonicalWords.length} words matched).`,
    )
  }
  if (missingWords.length > 3) {
    blockingReasons.push(`Too many missing reference words (${missingWords.length} missing).`)
  }

  const isReady =
    blockingReasons.length === 0 &&
    provenanceValid &&
    (provType === 'ASR_GENERATED' || provType === 'FORCED_ALIGNMENT_GENERATED') &&
    provenance?.isTrustedExecution === true

  let resolvedStatus: AlignmentLifecycleStatus
  if (isReady) {
    resolvedStatus = 'REAL_WORD_ALIGNMENT_READY'
  } else if (provType === 'MANUAL_OPERATOR_REVIEWED') {
    resolvedStatus = 'MANUAL_REVIEW_ACCEPTED'
  } else if (provType === 'EXTERNAL_UNVERIFIED') {
    resolvedStatus = 'EXTERNAL_UNVERIFIED'
  } else {
    resolvedStatus = 'AUDIO_DETECTED_NOT_WORD_ALIGNED'
  }

  return {
    isValidForPromotion: isReady,
    resolvedStatus,
    provenanceType: provType,
    referenceWordCount: canonicalWords.length,
    recognizedWordCount: rawCues.length,
    matchedWordsCount: matchedWords.length,
    missingWords,
    extraWords,
    mismatchedWords: [],
    timingInvalidWords,
    overlapInvalidWords,
    alignmentCoveragePercent: coveragePercent,
    timeCoverageSec: Number(totalTimeCovered.toFixed(2)),
    averageConfidence,
    provenanceValid,
    provenanceIssues,
    blockingReasons,
  }
}
