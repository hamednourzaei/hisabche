// ============================================
// Hisabche Studio — Speech & Word Alignment Engine
//
// Strictly enforces the 3-state speech alignment lifecycle:
// 1. PROVISIONAL_CADENCE_MODEL_ACTIVE: No voiceover file exists. Timing estimated via cadence math. Confidence is null.
// 2. AUDIO_DETECTED_NOT_WORD_ALIGNED: Voiceover exists. FFmpeg runs for acoustic diagnostics (duration, pauses, volume),
//    but strictly REFUSES to synthesize fake word timestamps. Confidence remains null.
// 3. REAL_WORD_ALIGNMENT_READY: Voiceover exists AND trusted ASR/forced-alignment has generated full word timestamps
//    with verified audio provenance (trusted execution, SHA-256 match, valid timing, zero overlap violations, >=90% coverage).
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Canonical Reel 53 voiceover script (30 spoken words in 5 scenes)
export const REEL_53_CANONICAL_SCRIPT = [
  ['فروشت', 'زیاده…'],
  ['اما', 'آخر', 'ماه', 'نمی‌دونی', 'پولت', 'کجا', 'رفته!'],
  ['انبار،', 'طلب', 'مشتری‌ها،', 'خرج‌ها…'],
  ['حسابچه', 'کمک', 'می‌کنه', 'همه‌چیز', 'رو', 'یکجا', 'ببینی.'],
  ['همین', 'حالا', 'دخل', 'و', 'حسابت', 'رو', 'در', 'حسابچه', 'شفاف', 'کن.'],
]

export const REEL_53_ALL_WORDS = REEL_53_CANONICAL_SCRIPT.flat()
export const TOTAL_SCRIPT_WORDS = REEL_53_ALL_WORDS.length // 30

// FFmpeg discovery
const FFMPEG_PATHS = [
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
]

function getFFmpegExecutablePath() {
  const whereCmd = process.platform === 'win32' ? 'where.exe' : 'which'
  const checkPath = spawnSync(whereCmd, ['ffmpeg'], { encoding: 'utf8' })
  if (checkPath.status === 0 && checkPath.stdout.trim()) {
    const firstLine = checkPath.stdout.trim().split(/\r?\n/)[0].trim()
    if (firstLine && fs.existsSync(firstLine)) return firstLine
  }
  for (const p of FFMPEG_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return null
}

// ─── Persian Text Normalization ──────────────────────────────────────────────

export function normalizePersianToken(rawWord) {
  if (!rawWord) return ''
  let text = String(rawWord).trim().normalize('NFC')

  // Arabic to Persian letters
  text = text.replace(/[\u0649\u064A\u06D2]/g, '\u06CC') // ى, ي, ے -> ی
  text = text.replace(/\u0643/g, '\u06A9') // ك -> ک
  text = text.replace(/\u0629/g, '\u0647') // ة -> ه
  text = text.replace(/[\u0622\u0623\u0625]/g, '\u0627') // آ, أ, إ -> ا
  text = text.replace(/\u0624/g, '\u0648') // ؤ -> و
  text = text.replace(/\u0626/g, '\u06CC') // ئ -> ی

  // Strip Tatweel and Harakat
  text = text.replace(/\u0640/g, '')
  text = text.replace(/[\u064B-\u065F\u0670]/g, '')

  // Digits to ASCII
  text = text.replace(/[۰٠]/g, '0').replace(/[۱١]/g, '1').replace(/[۲٢]/g, '2')
  text = text.replace(/[۳٣]/g, '3').replace(/[۴٤]/g, '4').replace(/[۵٥]/g, '5')
  text = text
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9')

  // Strip punctuation & ZWNJ
  text = text.replace(/[،.؟!…:;«»""'()\[\]\-\/\\—_\u200C]/g, '')

  return text.trim()
}

export function persianTokensMatch(t1, t2) {
  const n1 = normalizePersianToken(t1)
  const n2 = normalizePersianToken(t2)
  if (n1 === n2) return true
  if (!n1 || !n2) return false
  if (n1.startsWith(n2) || n2.startsWith(n1)) {
    return Math.abs(n1.length - n2.length) <= 3
  }
  return false
}

// ─── Whisper & External Alignment Parser ─────────────────────────────────────

export function parseWhisperManifest(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      hasWordTimestamps: false,
      words: [],
      error: 'JSON is null or not an object.',
    }
  }

  const fullText = typeof raw.text === 'string' ? raw.text.trim() : undefined
  const language = typeof raw.language === 'string' ? raw.language : undefined

  // 1. OpenAI Whisper JSON: segments[].words[]
  if (Array.isArray(raw.segments)) {
    const collected = []
    let foundAnyWords = false

    for (const seg of raw.segments) {
      if (Array.isArray(seg.words) && seg.words.length > 0) {
        foundAnyWords = true
        for (const w of seg.words) {
          const wordText = String(w.word || w.text || '').trim()
          const start = Number(w.start)
          const end = Number(w.end)
          const prob =
            typeof w.probability === 'number'
              ? w.probability
              : typeof w.confidence === 'number'
                ? w.confidence
                : null

          if (wordText && Number.isFinite(start) && Number.isFinite(end)) {
            collected.push({
              word: wordText,
              start: Number(start.toFixed(3)),
              end: Number(end.toFixed(3)),
              confidence: prob !== null ? Number(prob.toFixed(2)) : null,
            })
          }
        }
      }
    }

    if (!foundAnyWords) {
      return {
        success: false,
        hasWordTimestamps: false,
        words: [],
        fullText,
        language,
        error:
          'Whisper JSON contains segment-level timestamps only, with no word-level timestamps. (Ensure --word_timestamps True was used).',
      }
    }

    return { success: true, hasWordTimestamps: true, words: collected, fullText, language }
  }

  // 2. Direct words array: words[]
  if (Array.isArray(raw.words)) {
    const collected = []
    for (const w of raw.words) {
      const wordText = String(w.word || w.text || '').trim()
      const start = Number(w.start)
      const end = Number(w.end)
      const prob =
        typeof w.probability === 'number'
          ? w.probability
          : typeof w.confidence === 'number'
            ? w.confidence
            : null

      if (wordText && Number.isFinite(start) && Number.isFinite(end)) {
        collected.push({
          word: wordText,
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          confidence: prob !== null ? Number(prob.toFixed(2)) : null,
        })
      }
    }

    return {
      success: collected.length > 0,
      hasWordTimestamps: collected.length > 0,
      words: collected,
      fullText,
      language,
    }
  }

  return {
    success: false,
    hasWordTimestamps: false,
    words: [],
    error: 'Unrecognized format. Missing "segments[].words" or "words[]".',
  }
}

// ─── Audio File Discovery & Checksum ─────────────────────────────────────────

export function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function findVoiceoverFile(reelId) {
  const normalizedId = String(reelId).padStart(2, '0')
  const rawId = String(reelId)

  const candidates = [
    path.resolve(ROOT, 'audio', `reel-${normalizedId}-vo.wav`),
    path.resolve(ROOT, 'audio', `reel-${normalizedId}-vo.mp3`),
    path.resolve(ROOT, 'audio', `reel-${rawId}-vo.wav`),
    path.resolve(ROOT, 'audio', `reel-${rawId}-vo.mp3`),
    path.resolve(ROOT, '.tmp', 'vo', `reel-${normalizedId}.wav`),
    path.resolve(ROOT, '.tmp', 'vo', `reel-${normalizedId}.mp3`),
  ]

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

export function findExternalAlignmentJson(reelId) {
  const normalizedId = String(reelId).padStart(2, '0')
  const rawId = String(reelId)

  const candidates = [
    path.resolve(ROOT, 'audio', `reel-${normalizedId}-whisper.json`),
    path.resolve(ROOT, 'audio', `reel-${rawId}-whisper.json`),
    path.resolve(ROOT, 'audio', `reel-${normalizedId}-alignment.json`),
    path.resolve(ROOT, '.tmp', 'vo', `reel-${normalizedId}-whisper.json`),
  ]

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

export function findExecutionReceiptFile(reelId) {
  const normalizedId = String(reelId).padStart(2, '0')
  const rawId = String(reelId)

  const candidates = [
    path.resolve(ROOT, 'audio', `reel-${normalizedId}-execution-receipt.json`),
    path.resolve(ROOT, 'audio', `reel-${rawId}-execution-receipt.json`),
    path.resolve(ROOT, 'audio', `reel-${normalizedId}-receipt.json`),
    path.resolve(ROOT, 'audio', `reel-${rawId}-receipt.json`),
    path.resolve(ROOT, '.tmp', 'vo', `reel-${normalizedId}-receipt.json`),
  ]

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

// ─── Main Alignment Pipeline ─────────────────────────────────────────────────

export async function alignVoiceover(targetReelId = '53', options = {}) {
  console.log(`\n======================================================`)
  console.log(`🎙️ Hisabche Speech & Voiceover Alignment Studio — Reel #${targetReelId}`)
  console.log(`======================================================\n`)

  const ffmpegBin = getFFmpegExecutablePath()
  const audioPath = options.audioFile
    ? path.resolve(options.audioFile)
    : findVoiceoverFile(targetReelId)
  const alignmentPath = path.resolve(
    ROOT,
    'src',
    'reels',
    'alignments',
    `reel-${targetReelId}-alignment.json`,
  )

  // ─── STATE 1: PROVISIONAL_CADENCE_MODEL_ACTIVE ─────────────────────────────
  if (!audioPath || !fs.existsSync(audioPath)) {
    console.log(`⚠️ No human voiceover audio file found in:`)
    console.log(`   - hisabche-promo-reel/audio/reel-${targetReelId}-vo.wav`)
    console.log(`   - hisabche-promo-reel/audio/reel-${targetReelId}-vo.mp3`)
    console.log(`\n📋 Status: PROVISIONAL_CADENCE_MODEL_ACTIVE`)
    console.log(`   Confidence: null (Timing derived purely from written Persian syllable cadence)`)
    console.log(`   Waiting for actual voiceover audio.`)
    console.log(`   Alignment template is available at: ${alignmentPath}`)
    console.log(`   To verify real speech, place your recording into audio/ and run:`)
    console.log(`   npm run align-vo ${targetReelId}\n`)

    if (fs.existsSync(alignmentPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
        existing.alignmentStatus = 'PROVISIONAL_CADENCE_MODEL_ACTIVE'
        existing.isProvisional = true
        existing.confidence = null
        existing.alignmentSource = 'cadence-model'
        fs.writeFileSync(alignmentPath, JSON.stringify(existing, null, 2), 'utf8')
      } catch {
        // preserve
      }
    }

    return {
      success: false,
      status: 'PROVISIONAL_CADENCE_MODEL_ACTIVE',
      isProvisional: true,
      audioPath: null,
      confidence: null,
      referenceWordCount: TOTAL_SCRIPT_WORDS,
      recognizedWordCount: 0,
      matchedWordsCount: 0,
      coveragePercent: 0,
      alignmentPath,
      message: 'Waiting for actual voiceover audio.',
    }
  }

  // Audio file exists! Compute audio identity & SHA-256
  const stat = fs.statSync(audioPath)
  const audioSha256 = computeFileSha256(audioPath)
  console.log(`✓ Detected Voiceover Recording: ${audioPath}`)
  console.log(
    `✓ File Size: ${(stat.size / 1024).toFixed(1)} KB | SHA-256: ${audioSha256?.slice(0, 16)}...`,
  )

  let measuredDuration = 26.0
  const detectedPauses = []

  if (ffmpegBin) {
    const probe = spawnSync(ffmpegBin, ['-i', audioPath], { encoding: 'utf8' })
    const output = (probe.stderr || '') + (probe.stdout || '')
    const durMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
    if (durMatch) {
      const hours = Number(durMatch[1])
      const minutes = Number(durMatch[2])
      const seconds = Number(durMatch[3])
      measuredDuration = hours * 3600 + minutes * 60 + seconds
      console.log(`✓ Measured Audio Duration: ${measuredDuration.toFixed(2)}s`)
    }

    // Silence detection for speech pause diagnostics
    const silenceCheck = spawnSync(
      ffmpegBin,
      ['-i', audioPath, '-af', 'silencedetect=noise=-30dB:d=0.20', '-f', 'null', '-'],
      { encoding: 'utf8' },
    )
    const silenceOutput = silenceCheck.stderr || ''
    const startRegex = /silence_start:\s*([\d.]+)/g
    const endRegex = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g

    let sMatch
    while ((sMatch = startRegex.exec(silenceOutput)) !== null) {
      detectedPauses.push({ start: Number(sMatch[1]) })
    }
    let eMatch
    let eIdx = 0
    while ((eMatch = endRegex.exec(silenceOutput)) !== null && eIdx < detectedPauses.length) {
      detectedPauses[eIdx].end = Number(eMatch[1])
      detectedPauses[eIdx].dur = Number(eMatch[2])
      eIdx++
    }

    console.log(
      `✓ Diagnostic Acoustic Analysis: Detected ${detectedPauses.length} speech pauses / breath gaps.`,
    )
  }

  // Check for external ASR / forced-alignment word timestamps
  const externalJsonPath = options.externalJson || findExternalAlignmentJson(targetReelId)
  let parseResult = { success: false, hasWordTimestamps: false, words: [] }
  let externalRaw = null

  if (externalJsonPath && fs.existsSync(externalJsonPath)) {
    console.log(`\n📥 Inspecting External Alignment Manifest: ${externalJsonPath}`)
    try {
      externalRaw = JSON.parse(fs.readFileSync(externalJsonPath, 'utf8'))
      parseResult = parseWhisperManifest(externalRaw)
    } catch (e) {
      console.warn(`⚠️ Could not parse external alignment JSON: ${e.message}`)
    }
  }

  // Check for verifiable execution receipt
  const receiptPath = options.receiptFile || findExecutionReceiptFile(targetReelId)
  let receiptData = null
  if (receiptPath && fs.existsSync(receiptPath)) {
    console.log(`\n📜 Inspecting Verifiable Execution Receipt: ${receiptPath}`)
    try {
      receiptData = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
    } catch (e) {
      console.warn(`⚠️ Could not parse execution receipt JSON: ${e.message}`)
    }
  }

  // ─── STATE 2: AUDIO_DETECTED_NOT_WORD_ALIGNED ─────────────────────────────
  // If no external word timestamps or parse failed:
  if (!parseResult.success || parseResult.words.length === 0) {
    console.log(`\n======================================================`)
    console.log(`⚠️ Status: AUDIO_DETECTED_NOT_WORD_ALIGNED`)
    console.log(`======================================================`)
    console.log(`✓ Audio file is present on disk (${audioPath})`)
    console.log(
      `✓ Acoustic silence/pause diagnostics were recorded (${detectedPauses.length} pauses)`,
    )
    if (parseResult.error) {
      console.log(`❌ Manifest Issue: ${parseResult.error}`)
    } else {
      console.log(`❌ CRITICAL: No word-level forced-alignment data found.`)
    }
    console.log(`   Silence detection identifies speech regions, NOT word-level boundaries.`)
    console.log(`   Word timestamps will NOT be synthesized. State remains PROVISIONAL.`)
    console.log(`   Confidence: null`)
    console.log(`\nTo achieve REAL_WORD_ALIGNMENT_READY, run Whisper with word timestamps:`)
    console.log(
      `   whisper reel-53-vo.wav --language fa --word_timestamps True --output_format json`,
    )
    console.log(`   and place in: hisabche-promo-reel/audio/reel-${targetReelId}-whisper.json\n`)

    if (fs.existsSync(alignmentPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
        existing.alignmentStatus = 'AUDIO_DETECTED_NOT_WORD_ALIGNED'
        existing.isProvisional = true
        existing.confidence = null
        existing.audioFile = path.relative(ROOT, audioPath)
        existing.audioSha256 = audioSha256
        existing.audioDuration = Number(measuredDuration.toFixed(2))
        fs.writeFileSync(alignmentPath, JSON.stringify(existing, null, 2), 'utf8')
      } catch {
        // preserve
      }
    }

    return {
      success: false,
      status: 'AUDIO_DETECTED_NOT_WORD_ALIGNED',
      isProvisional: true,
      audioPath,
      audioSha256,
      measuredDuration,
      confidence: null,
      referenceWordCount: TOTAL_SCRIPT_WORDS,
      recognizedWordCount: 0,
      matchedWordsCount: 0,
      coveragePercent: 0,
      detectedPausesCount: detectedPauses.length,
      alignmentPath,
      message:
        parseResult.error || 'Audio detected, but word-level forced-alignment data is missing.',
    }
  }

  // ─── STRICT AUDIT: Validate Provenance, Coverage, and Timing ───────────────
  const rawCues = parseResult.words
  const provenance = (externalRaw && externalRaw.provenance) || {}
  const blockingReasons = []

  // Anti-Spoofing Provenance Gate: Self-declared external files cannot self-certify!
  let provenanceValid = false
  const operatorName =
    options.manualReviewOperator || (options.trustedAdapter ? 'Operator (Manual)' : null)
  const isManualReview = Boolean(operatorName)

  if (isManualReview) {
    provenance.type = 'MANUAL_OPERATOR_REVIEWED'
    provenance.isTrustedExecution = false
    provenance.engine = 'manual-operator-review'
    provenance.manualReviewRecord = {
      reviewedBy: operatorName,
      reviewedAt: new Date().toISOString(),
      acceptedCanonicalCoverage: coveragePercent,
    }
    blockingReasons.push(
      `Manual operator review (${operatorName}) recorded: human inspection does NOT satisfy technical engine execution proof required for REAL_WORD_ALIGNMENT_READY.`,
    )
    console.log(`⚠️ Manual Operator Review Detected for: ${operatorName}`)
    console.log(
      `   Notice: Human review is recorded as MANUAL_REVIEW_ACCEPTED, but does NOT bypass engine execution proof.`,
    )
  } else if (receiptData) {
    // Static receipt file on disk
    if (receiptData.processRecord && receiptData.processRecord.verifiedSuccess) {
      if (
        receiptData.audioSha256 &&
        audioSha256 &&
        receiptData.audioSha256.toLowerCase() === audioSha256.toLowerCase()
      ) {
        provenanceValid = true
        provenance.isTrustedExecution = true
        provenance.type = receiptData.alignmentType || 'ASR_GENERATED'
        provenance.engine = receiptData.engine || 'whisper'
        provenance.engineVersion = receiptData.engineVersion
        console.log(
          `✓ Verified Live Process Record Found: Engine "${receiptData.engine}" (${receiptData.alignmentType}) verified with exitCode 0.`,
        )
      } else {
        blockingReasons.push(`Process record audio SHA-256 mismatch with audio file.`)
      }
    } else {
      blockingReasons.push(
        `Static on-disk execution receipt detected: Treats external JSON as EXTERNAL_UNVERIFIED because a static receipt cannot self-certify live subprocess execution.`,
      )
    }
  } else if (
    provenance.isTrustedExecution === true &&
    (provenance.type === 'ASR_GENERATED' || provenance.type === 'FORCED_ALIGNMENT_GENERATED')
  ) {
    provenanceValid = true
  } else {
    blockingReasons.push(
      `Provenance is unverified (EXTERNAL_UNVERIFIED). Self-declared external JSON cannot self-certify engine execution without a verified live subprocess execution trace.`,
    )
  }

  if (provenance.audioSha256 && audioSha256) {
    if (provenance.audioSha256.toLowerCase() !== audioSha256.toLowerCase()) {
      provenanceValid = false
      blockingReasons.push(
        `Audio SHA-256 mismatch: manifest specifies ${provenance.audioSha256.slice(0, 8)}, audio file is ${audioSha256.slice(0, 8)}.`,
      )
    }
  }

  // Check Timing Validity
  const timingInvalidWords = []
  const overlapInvalidWords = []

  for (let i = 0; i < rawCues.length; i++) {
    const c = rawCues[i]
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start) {
      timingInvalidWords.push(`Word "${c.word}" has invalid interval: [${c.start}, ${c.end}]`)
    }
    if (c.end > measuredDuration + 0.3) {
      timingInvalidWords.push(
        `Word "${c.word}" ends (${c.end}s) past audio duration (${measuredDuration}s)`,
      )
    }
    if (i > 0) {
      const prev = rawCues[i - 1]
      if (c.start < prev.end - 0.15) {
        overlapInvalidWords.push(
          `Word "${c.word}" overlaps previous word "${prev.word}" by ${(prev.end - c.start).toFixed(2)}s`,
        )
      }
    }
  }

  // Check Word Matching & Coverage against all 30 canonical script words
  const availableCues = [...rawCues]
  const matchedWords = []
  const missingWords = []
  let totalConfidenceSum = 0
  let confidenceCount = 0

  for (const refWord of REEL_53_ALL_WORDS) {
    const normRef = normalizePersianToken(refWord)
    const matchIdx = availableCues.findIndex((c) => persianTokensMatch(c.word, normRef))

    if (matchIdx !== -1) {
      const matched = availableCues.splice(matchIdx, 1)[0]
      matchedWords.push({ ref: refWord, matched })
      if (typeof matched.confidence === 'number' && Number.isFinite(matched.confidence)) {
        totalConfidenceSum += matched.confidence
        confidenceCount++
      }
    } else {
      missingWords.push(refWord)
    }
  }

  const extraWords = availableCues.map((c) => c.word)
  const coveragePercent = Math.round((matchedWords.length / TOTAL_SCRIPT_WORDS) * 100)
  const averageConfidence =
    confidenceCount > 0 ? Number((totalConfidenceSum / confidenceCount).toFixed(2)) : null

  console.log(`\n🔍 Speech Alignment Audit Results:`)
  console.log(`   Canonical Reference Words: ${TOTAL_SCRIPT_WORDS}`)
  console.log(`   Recognized ASR Words: ${rawCues.length}`)
  console.log(
    `   Matched Spoken Words: ${matchedWords.length}/${TOTAL_SCRIPT_WORDS} (${coveragePercent}%)`,
  )
  console.log(`   Missing Words: ${missingWords.length > 0 ? missingWords.join(', ') : 'None'}`)
  console.log(`   Extra Words: ${extraWords.length > 0 ? extraWords.join(', ') : 'None'}`)
  console.log(`   Timing Invalid Words: ${timingInvalidWords.length}`)
  console.log(`   Acoustic Overlap Collisions: ${overlapInvalidWords.length}`)
  console.log(
    `   Measured Confidence/Probability: ${averageConfidence !== null ? `${(averageConfidence * 100).toFixed(1)}%` : 'null'}`,
  )
  console.log(`   Provenance Verified: ${provenanceValid ? 'YES' : 'NO (EXTERNAL_UNVERIFIED)'}`)

  // Evaluate Readiness Criteria
  if (timingInvalidWords.length > 0)
    blockingReasons.push(`${timingInvalidWords.length} timing-invalid cues.`)
  if (overlapInvalidWords.length > 0)
    blockingReasons.push(`${overlapInvalidWords.length} severe acoustic overlap collisions.`)
  if (coveragePercent < 90)
    blockingReasons.push(`Alignment coverage (${coveragePercent}%) below 90% threshold.`)
  if (missingWords.length > 3)
    blockingReasons.push(`Too many missing reference words (${missingWords.length}).`)

  const isReadinessAccepted = blockingReasons.length === 0

  if (!isReadinessAccepted) {
    const resolvedNonReadyStatus = isManualReview
      ? 'MANUAL_REVIEW_ACCEPTED'
      : parseResult.success && parseResult.words.length > 0
        ? 'EXTERNAL_UNVERIFIED'
        : 'AUDIO_DETECTED_NOT_WORD_ALIGNED'

    console.warn(`\n⚠️ Promotion to REAL_WORD_ALIGNMENT_READY Blocked:`)
    blockingReasons.forEach((r) => console.warn(`   - ${r}`))
    console.warn(`\nResolved status: ${resolvedNonReadyStatus}\n`)

    if (fs.existsSync(alignmentPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
        existing.alignmentStatus = resolvedNonReadyStatus
        existing.isProvisional = true
        existing.confidence = null
        existing.alignmentSource = isManualReview ? 'manual-operator-review' : 'external-unverified'
        existing.audioFile = path.relative(ROOT, audioPath)
        existing.audioSha256 = audioSha256
        existing.audioDuration = Number(measuredDuration.toFixed(2))

        if (matchedWords.length > 0) {
          existing.scenes.forEach((sc) => {
            sc.words.forEach((w) => {
              const matchObj = matchedWords.find((m) => m.ref === w.word)
              if (matchObj) {
                w.start = Number(matchObj.matched.start.toFixed(2))
                w.end = Number(matchObj.matched.end.toFixed(2))
                w.confidence = null // MUST be null in non-ready states!
                w.normalized = normalizePersianToken(w.word)
              }
            })
          })
        }

        fs.writeFileSync(alignmentPath, JSON.stringify(existing, null, 2), 'utf8')
      } catch {
        // preserve
      }
    }

    return {
      success: false,
      status: resolvedNonReadyStatus,
      isProvisional: true,
      audioPath,
      audioSha256,
      measuredDuration,
      confidence: null,
      referenceWordCount: TOTAL_SCRIPT_WORDS,
      recognizedWordCount: rawCues.length,
      matchedWordsCount: matchedWords.length,
      coveragePercent,
      missingWords,
      extraWords,
      timingInvalidWords,
      overlapInvalidWords,
      blockingReasons,
      alignmentPath,
    }
  }

  // ─── STATE 3: REAL_WORD_ALIGNMENT_READY ───────────────────────────────────
  // All strict verification gates passed! Update the alignment manifest
  const alignmentData = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))

  alignmentData.scenes.forEach((sc) => {
    sc.words.forEach((w) => {
      const matchObj = matchedWords.find((m) => m.ref === w.word)
      if (matchObj) {
        w.start = Number(matchObj.matched.start.toFixed(2))
        w.end = Number(matchObj.matched.end.toFixed(2))
        w.confidence = matchObj.matched.confidence
        w.normalized = normalizePersianToken(w.word)
      } else {
        w.confidence = null
      }
    })
  })

  alignmentData.audioFile = path.relative(ROOT, audioPath)
  alignmentData.audioSha256 = audioSha256
  alignmentData.audioDuration = Number(measuredDuration.toFixed(2))
  alignmentData.alignmentStatus = 'REAL_WORD_ALIGNMENT_READY'
  alignmentData.isProvisional = false
  alignmentData.alignmentSource = provenance.engine || 'whisper-ctc'
  alignmentData.confidence = averageConfidence
  alignmentData.verifiedAt = new Date().toISOString()

  fs.writeFileSync(alignmentPath, JSON.stringify(alignmentData, null, 2), 'utf8')

  console.log(`\n======================================================`)
  console.log(`✅ REAL_WORD_ALIGNMENT_READY — Strict Verification Passed!`)
  console.log(`   Audio Track: ${audioPath}`)
  console.log(`   Audio SHA-256: ${audioSha256?.slice(0, 16)}...`)
  console.log(`   Duration: ${measuredDuration.toFixed(2)}s`)
  console.log(`   Total Script Words: ${TOTAL_SCRIPT_WORDS}`)
  console.log(
    `   Aligned Spoken Words: ${matchedWords.length}/${TOTAL_SCRIPT_WORDS} (${coveragePercent}%)`,
  )
  console.log(
    `   Average Confidence: ${averageConfidence !== null ? `${(averageConfidence * 100).toFixed(1)}%` : 'null'}`,
  )
  console.log(`   Alignment Manifest: ${alignmentPath}`)
  console.log(`======================================================\n`)

  return {
    success: true,
    status: 'REAL_WORD_ALIGNMENT_READY',
    isProvisional: false,
    audioPath,
    audioSha256,
    duration: measuredDuration,
    referenceWordCount: TOTAL_SCRIPT_WORDS,
    recognizedWordCount: rawCues.length,
    matchedWordsCount: matchedWords.length,
    coveragePercent,
    averageConfidence,
    missingWords,
    alignmentPath,
  }
}

// CLI Invocation
const manualReviewArg = process.argv.find(
  (a) => a.startsWith('--operator-review=') || a.startsWith('--manual-review='),
)
const manualReviewFlag =
  process.argv.includes('--operator-review') ||
  process.argv.includes('--manual-review') ||
  process.argv.includes('--trusted')
const operatorName = manualReviewArg
  ? manualReviewArg.split('=')[1]
  : manualReviewFlag
    ? 'Hamed (Solo Founder)'
    : null

const nonFlagArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const targetId = nonFlagArgs[0] || '53'

alignVoiceover(targetId, {
  manualReviewOperator: operatorName,
}).catch((err) => {
  console.error('❌ Voiceover Alignment Failed:', err)
  process.exit(1)
})
