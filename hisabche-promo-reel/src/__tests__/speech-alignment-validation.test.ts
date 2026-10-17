import { describe, it, expect } from 'vitest'
import {
  validateAlignmentReadiness,
  parseWhisperJson,
  REEL_53_ALL_WORDS,
  TOTAL_CANONICAL_WORDS,
  type AudioIdentity,
  type AlignmentProvenance,
} from '../engine/speech-alignment-validator'
import {
  parseExecutionReceipt,
  verifyExecutionReceipt,
  reconcileScriptTokensWithAsr,
  ExecutionReceiptAdapter,
  LocalWhisperCliEngine,
  ManualOperatorReviewAdapter,
  inspectHostSpeechEnvironment,
  type ExecutionReceipt,
} from '../engine/speech-engine-adapter'
import { reel53 } from '../reels/reel-53-word-synchronized-cashflow'
import { WordSyncTeleprompter } from '../ui/WordSyncTeleprompter'
import { renderToString } from 'react-dom/server'
import React from 'react'
import type { SentencePlan } from '../engine/speech-model'

describe('Strict Speech Alignment Readiness & Provenance Engine (Comprehensive Audits)', () => {
  const dummySha256 = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678'
  const validAudio: AudioIdentity = {
    filePath: 'audio/reel-53-vo.wav',
    fileName: 'reel-53-vo.wav',
    sha256: dummySha256,
    durationSec: 26.0,
    fileSizeBytes: 1024000,
  }

  const trustedProvenance: AlignmentProvenance = {
    type: 'ASR_GENERATED',
    engine: 'whisper-cli',
    engineVersion: '1.7.1',
    model: 'ggml-large-v3.bin',
    audioSha256: dummySha256,
    audioDuration: 26.0,
    alignedAt: '2026-10-15T20:00:00Z',
    isTrustedExecution: true,
  }

  function makeFullCues(
    modifier?: (
      cues: Array<{ word: string; start: number; end: number; confidence?: number }>,
    ) => void,
  ) {
    let t = 0.2
    const cues = REEL_53_ALL_WORDS.map((w) => {
      const start = Number(t.toFixed(2))
      const end = Number((t + 0.6).toFixed(2))
      t += 0.8
      return { word: w, start, end, confidence: 0.95 }
    })
    if (modifier) modifier(cues)
    return cues
  }

  // 1. No audio present
  it('1. returns PROVISIONAL_CADENCE_MODEL_ACTIVE and blocks promotion when audio is absent', () => {
    const report = validateAlignmentReadiness({
      audio: undefined,
      rawCues: [],
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.resolvedStatus).toBe('PROVISIONAL_CADENCE_MODEL_ACTIVE')
    expect(report.blockingReasons[0]).toContain('Waiting for actual voiceover audio')
    expect(report.averageConfidence).toBeNull()
  })

  // 2. Audio present without alignment
  it('2. returns AUDIO_DETECTED_NOT_WORD_ALIGNED when audio exists but zero cues are supplied', () => {
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: [],
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.resolvedStatus).toBe('AUDIO_DETECTED_NOT_WORD_ALIGNED')
    expect(report.matchedWordsCount).toBe(0)
    expect(report.alignmentCoveragePercent).toBe(0)
  })

  // 3. A correct audio hash with fabricated/untrusted provenance cannot establish trusted readiness
  it('3. blocks promotion even when audio SHA-256 matches if execution is unverified (anti-spoofing)', () => {
    const unverifiedProvenance: AlignmentProvenance = {
      type: 'EXTERNAL_UNVERIFIED',
      engine: 'whisper-cli',
      audioSha256: dummySha256,
      isTrustedExecution: false, // External static file from untrusted source
    }
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: unverifiedProvenance,
      rawCues: makeFullCues(),
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.resolvedStatus).toBe('EXTERNAL_UNVERIFIED')
    expect(report.provenanceValid).toBe(false)
    expect(report.provenanceIssues[0]).toContain('EXTERNAL_UNVERIFIED')
  })

  // 4. Externally supplied metadata cannot self-certify engine execution
  it('4. rejects external JSON self-declaring engine name without verifiable execution trace', () => {
    const selfCertified: AlignmentProvenance = {
      type: 'EXTERNAL_UNVERIFIED',
      engine: 'openai-whisper',
      model: 'large-v3',
      audioSha256: dummySha256,
      // isTrustedExecution is undefined
    }
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: selfCertified,
      rawCues: makeFullCues(),
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.resolvedStatus).toBe('EXTERNAL_UNVERIFIED')
  })

  // 5. OpenAI Whisper JSON format parsing with segments[].words[] and probability
  it('5. successfully parses standard OpenAI Whisper JSON containing segments and word probabilities', () => {
    const whisperJson = {
      text: 'فروشت زیاده…',
      language: 'fa',
      segments: [
        {
          id: 0,
          start: 0.0,
          end: 2.5,
          text: ' فروشت زیاده…',
          words: [
            { word: ' فروشت', start: 0.18, end: 0.85, probability: 0.94 },
            { word: ' زیاده…', start: 0.95, end: 2.2, probability: 0.97 },
          ],
        },
      ],
    }

    const parsed = parseWhisperJson(whisperJson)
    expect(parsed.success).toBe(true)
    expect(parsed.hasWordTimestamps).toBe(true)
    expect(parsed.words).toHaveLength(2)
    expect(parsed.words[0]!.word).toBe('فروشت') // trimmed whitespace
    expect(parsed.words[0]!.confidence).toBe(0.94) // probability mapped to confidence
  })

  // 6. Whisper segment timestamps without word timestamps cannot pass as full word alignment
  it('6. safely detects when Whisper JSON contains segment timestamps only and rejects as incomplete', () => {
    const segmentOnlyJson = {
      text: 'فروشت زیاده…',
      segments: [
        { id: 0, start: 0.0, end: 2.5, text: 'فروشت زیاده…' }, // No words[] inside segment
      ],
    }

    const parsed = parseWhisperJson(segmentOnlyJson)
    expect(parsed.success).toBe(false)
    expect(parsed.hasWordTimestamps).toBe(false)
    expect(parsed.error).toContain('segment timestamps only')
  })

  // 7. Malformed or incompatible Whisper JSON fails safely without throwing
  it('7. handles malformed, null, or empty objects gracefully without runtime crashes', () => {
    expect(parseWhisperJson(null).success).toBe(false)
    expect(parseWhisperJson({}).success).toBe(false)
    expect(parseWhisperJson({ random: 123 }).success).toBe(false)
  })

  // 8. Missing words and extra words calculated from actual validated sequences
  it('8. accurately reports missing words and extra recognized words', () => {
    const cues = makeFullCues((c) => {
      // Remove 5 reference words
      c.splice(0, 5)
      // Add 1 extra recognized word
      c.push({ word: 'تخفیف', start: 24.5, end: 25.0, confidence: 0.9 })
    })
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: cues,
    })
    expect(report.missingWords.length).toBe(5)
    expect(report.extraWords).toContain('تخفیف')
    expect(report.isValidForPromotion).toBe(false) // >3 missing words blocks promotion
  })

  // 9. Persian normalization and نیم‌فاصله in matching
  it('9. matches words despite نیم‌فاصله, Arabic Kaf/Yeh, or Harakat differences', () => {
    const cues = makeFullCues((c) => {
      const idx = c.findIndex((w) => w.word.includes('می‌کنه'))
      if (idx !== -1) {
        c[idx]!.word = 'میکنه' // without ZWNJ
      }
    })
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: cues,
    })
    expect(report.missingWords).not.toContain('می‌کنه')
  })

  // 10. Invalid timestamps (negative start or zero duration)
  it('10. blocks promotion and flags cues with negative start or zero duration', () => {
    const cues = makeFullCues((c) => {
      c[2]!.start = -1.0
      c[3]!.end = c[3]!.start // zero duration
    })
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: cues,
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.timingInvalidWords.length).toBeGreaterThanOrEqual(2)
    expect(report.blockingReasons.some((r) => r.includes('timing-invalid'))).toBe(true)
  })

  // 11. Out-of-duration timestamps (end > audioDuration)
  it('11. flags cues that extend beyond the measured audio duration', () => {
    const cues = makeFullCues((c) => {
      c[c.length - 1]!.end = 32.5 // audio is 26s
    })
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: cues,
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.timingInvalidWords.some((w) => w.includes('beyond audio duration'))).toBe(true)
  })

  // 12. Invalid overlap (>150ms collision)
  it('12. detects severe acoustic overlap collisions between adjacent words', () => {
    const cues = makeFullCues((c) => {
      c[1]!.start = c[0]!.end - 0.45 // 450ms collision
    })
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: cues,
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.overlapInvalidWords.length).toBeGreaterThan(0)
    expect(report.blockingReasons.some((r) => r.includes('overlap'))).toBe(true)
  })

  // 13. Audio SHA-256 mismatch
  it('13. blocks promotion when manifest SHA-256 does not match actual audio file checksum', () => {
    const alteredProvenance: AlignmentProvenance = {
      ...trustedProvenance,
      audioSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    }
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: alteredProvenance,
      rawCues: makeFullCues(),
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.provenanceValid).toBe(false)
    expect(report.provenanceIssues[0]).toContain('SHA-256 mismatch')
  })

  // 14. Coverage threshold failure (<90% coverage)
  it('14. blocks promotion if coverage falls below 90% threshold', () => {
    // 30 words total; 25 matches = 83% (<90%)
    const cues = makeFullCues((c) => {
      c.splice(25, 5)
    })
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: cues,
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.alignmentCoveragePercent).toBeLessThan(90)
    expect(report.blockingReasons.some((r) => r.includes('below 90% threshold'))).toBe(true)
  })

  // 15. Valid trusted alignment adapter promotes to REAL_WORD_ALIGNMENT_READY
  it('15. successfully promotes to REAL_WORD_ALIGNMENT_READY when all strict readiness conditions are met', () => {
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: trustedProvenance,
      rawCues: makeFullCues(),
    })
    expect(report.isValidForPromotion).toBe(true)
    expect(report.resolvedStatus).toBe('REAL_WORD_ALIGNMENT_READY')
    expect(report.matchedWordsCount).toBe(TOTAL_CANONICAL_WORDS)
    expect(report.alignmentCoveragePercent).toBe(100)
    expect(report.averageConfidence).toBe(0.95)
    expect(report.blockingReasons).toHaveLength(0)
  })

  // 16. Renderer behavior in provisional vs verified states
  it('16. renders distinct lifecycle badges in teleprompter for provisional and verified states', () => {
    const planProvisional: SentencePlan = {
      text: 'فروشت زیاده…',
      intent: 'هوک',
      alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE',
      isProvisional: true,
      alignmentSource: 'cadence-model',
      confidence: null,
      words: [{ word: 'فروشت', start: 0.2, end: 0.8, confidence: null }],
    }

    const htmlProvisional = renderToString(
      React.createElement(WordSyncTeleprompter, { sentence: planProvisional, t: 0.5 }),
    )
    expect(htmlProvisional).toContain('ریتم هجاهای فارسی (تخمینی)')
    expect(htmlProvisional).toContain('status-provisional')

    const planVerified: SentencePlan = {
      text: 'فروشت زیاده…',
      intent: 'هوک',
      alignmentStatus: 'REAL_WORD_ALIGNMENT_READY',
      isProvisional: false,
      alignmentSource: 'whisper-ctc',
      confidence: 0.95,
      words: [{ word: 'فروشت', start: 0.2, end: 0.8, confidence: 0.95 }],
    }

    const htmlVerified = renderToString(
      React.createElement(WordSyncTeleprompter, { sentence: planVerified, t: 0.5 }),
    )
    expect(htmlVerified).toContain('همگام با گفتار واقعی')
    expect(htmlVerified).toContain('status-verified')
  })

  // 17. Execution receipt parsing & validation
  it('17. parses valid execution receipt and rejects malformed receipt objects', () => {
    const validReceiptRaw = {
      receiptVersion: '1.0',
      engine: 'openai-whisper',
      engineVersion: '20231117',
      alignmentType: 'ASR_GENERATED',
      audioSha256: dummySha256,
      audioDurationSec: 26.0,
      command:
        'whisper audio/reel-53-vo.wav --language fa --word_timestamps True --output_format json',
      executedAt: '2026-10-15T21:00:00Z',
      isTrustedReceipt: true,
    }

    const parseResult = parseExecutionReceipt(validReceiptRaw)
    expect(parseResult.valid).toBe(true)
    expect(parseResult.receipt?.engine).toBe('openai-whisper')
    expect(parseResult.receipt?.alignmentType).toBe('ASR_GENERATED')
    expect(parseResult.receipt?.isTrustedReceipt).toBe(true)

    expect(parseExecutionReceipt(null).valid).toBe(false)
    expect(parseExecutionReceipt({}).valid).toBe(false)
    expect(parseExecutionReceipt({ engine: 'whisper', alignmentType: 'INVALID_TYPE' }).valid).toBe(
      false,
    )
  })

  // 18. Receipt verification: static receipts remain EXTERNAL_UNVERIFIED; only verified processRecords establish live trust
  it('18. verifies that static on-disk receipts remain EXTERNAL_UNVERIFIED, while live processRecords establish trust', () => {
    // A) Static receipt without process execution record (cannot self-certify)
    const staticReceipt: ExecutionReceipt = {
      receiptVersion: '1.0',
      engine: 'openai-whisper',
      alignmentType: 'ASR_GENERATED',
      audioSha256: dummySha256,
      executedAt: '2026-10-15T21:00:00Z',
      isTrustedReceipt: true,
      // processRecord is undefined
    }

    const unverifiedStatic = verifyExecutionReceipt(staticReceipt, validAudio)
    expect(unverifiedStatic.verified).toBe(true)
    expect(unverifiedStatic.provenance?.type).toBe('EXTERNAL_UNVERIFIED')
    expect(unverifiedStatic.provenance?.isTrustedExecution).toBe(false)

    // B) Verified receipt with live processRecord
    const liveReceipt: ExecutionReceipt = {
      ...staticReceipt,
      processRecord: {
        executablePath: 'C:\\tools\\whisper\\whisper-cli.exe',
        commandArgs: ['audio/reel-53-vo.wav', '--language', 'fa'],
        exitCode: 0,
        durationMs: 3100,
        executedAt: '2026-10-15T21:00:00Z',
        audioSha256: dummySha256,
        verifiedSuccess: true,
      },
    }

    const verifiedLive = verifyExecutionReceipt(liveReceipt, validAudio)
    expect(verifiedLive.verified).toBe(true)
    expect(verifiedLive.provenance?.isTrustedExecution).toBe(true)
    expect(verifiedLive.provenance?.type).toBe('ASR_GENERATED')

    // C) Mismatched audio hash is refused immediately
    const mismatchedAudio: AudioIdentity = {
      ...validAudio,
      sha256: '99999999999999999999999999999999',
    }
    const rejected = verifyExecutionReceipt(liveReceipt, mismatchedAudio)
    expect(rejected.verified).toBe(false)
    expect(rejected.error).toContain('Audio SHA-256 mismatch')
  })

  // 19. ExecutionReceiptAdapter end-to-end integration
  it('19. promotes to REAL_WORD_ALIGNMENT_READY through ExecutionReceiptAdapter when verified processRecord and Whisper JSON pass all gates', () => {
    const adapter = new ExecutionReceiptAdapter()
    const receipt: ExecutionReceipt = {
      receiptVersion: '1.0',
      engine: 'openai-whisper',
      alignmentType: 'ASR_GENERATED',
      audioSha256: dummySha256,
      executedAt: '2026-10-15T21:00:00Z',
      isTrustedReceipt: true,
      processRecord: {
        executablePath: 'C:\\tools\\whisper\\whisper-cli.exe',
        commandArgs: ['audio/reel-53-vo.wav', '--language', 'fa'],
        exitCode: 0,
        durationMs: 3100,
        executedAt: '2026-10-15T21:00:00Z',
        audioSha256: dummySha256,
        verifiedSuccess: true,
      },
    }

    const whisperJson = {
      text: 'فروشت زیاده…',
      language: 'fa',
      words: makeFullCues(),
    }

    const result = adapter.alignWithReceipt({
      audio: validAudio,
      receipt,
      rawWhisperJson: whisperJson,
    })

    expect(result.success).toBe(true)
    expect(result.provenance.isTrustedExecution).toBe(true)
    expect(result.provenance.type).toBe('ASR_GENERATED')
    expect(result.wordCues).toHaveLength(TOTAL_CANONICAL_WORDS)
  })

  // 20. Token reconciliation against Persian script
  it('20. accurately reconciles recognized tokens against all 30 canonical words', () => {
    const rawCues = makeFullCues((cues) => {
      // simulate 1 missing word
      cues.splice(0, 1)
      // simulate 1 extra word
      cues.push({ word: 'اضافی', start: 25.0, end: 25.5, confidence: 0.88 })
    })

    const recon = reconcileScriptTokensWithAsr(rawCues, REEL_53_ALL_WORDS)
    expect(recon.matchedWords.length).toBe(29)
    expect(recon.missingWords).toHaveLength(1)
    expect(recon.missingWords[0]).toBe('فروشت')
    expect(recon.extraWords).toContain('اضافی')
    expect(recon.coveragePercent).toBe(97)
  })

  // 21. Real Reel 53 definition truthful lifecycle state
  it('21. guarantees Reel 53 runtime definition reports PROVISIONAL_CADENCE_MODEL_ACTIVE and isProvisional=true before audio alignment', () => {
    expect(reel53.scenes).toHaveLength(5)
    reel53.scenes.forEach((scene) => {
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence?.isProvisional).toBe(true)
      expect(scene.sentence?.alignmentStatus).toBe('PROVISIONAL_CADENCE_MODEL_ACTIVE')
      expect(scene.sentence?.confidence).toBeNull()
    })
  })

  // 22. Host speech environment diagnostic reports honest absence of Whisper
  it('22. reports honest host environment diagnostics stating Whisper CLI and torch are absent', () => {
    const diag = inspectHostSpeechEnvironment()
    expect(diag.ffmpegDetected).toBe(true)
    expect(diag.whisperCliDetected).toBe(false)
    expect(diag.pythonAudioEnvDetected).toBe(false)
    expect(diag.activeOperationalEngine).toContain('cadence-model')
  })

  // 23. ManualOperatorReviewAdapter guarantees human review cannot masquerade as engine execution
  it('23. guarantees ManualOperatorReviewAdapter sets MANUAL_OPERATOR_REVIEWED and cannot promote to REAL_WORD_ALIGNMENT_READY', () => {
    const manualAdapter = new ManualOperatorReviewAdapter()
    const result = manualAdapter.reviewAndAccept({
      audio: validAudio,
      operatorName: 'Hamed (Solo Founder)',
      reviewNotes: 'Manually verified Persian voiceover against canonical script.',
      rawWhisperJson: {
        text: 'فروشت زیاده…',
        language: 'fa',
        words: makeFullCues(),
      },
    })

    expect(result.success).toBe(false) // Never claims automated engine readiness
    expect(result.provenance.type).toBe('MANUAL_OPERATOR_REVIEWED')
    expect(result.provenance.isTrustedExecution).toBe(false) // Human review is not engine execution proof
    expect(result.provenance.manualReviewRecord?.reviewedBy).toBe('Hamed (Solo Founder)')
    expect(result.error).toContain('MANUAL_REVIEW_ACCEPTED')

    // Validator check
    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: result.provenance,
      rawCues: result.wordCues,
    })
    expect(report.isValidForPromotion).toBe(false)
    expect(report.resolvedStatus).toBe('MANUAL_REVIEW_ACCEPTED')
    expect(report.blockingReasons.some((r) => r.includes('human inspection'))).toBe(true)
  })

  // 24. LocalWhisperCliEngine reports actionable ENGINE_NOT_INSTALLED error
  it('24. LocalWhisperCliEngine safely detects missing executable and returns ENGINE_NOT_INSTALLED', async () => {
    const cliEngine = new LocalWhisperCliEngine()
    const avail = await cliEngine.isAvailable()
    expect(avail.available).toBe(false)
    expect(avail.reason).toContain('ENGINE_NOT_INSTALLED')

    const result = await cliEngine.align('audio/reel-53-vo.wav')
    expect(result.success).toBe(false)
    expect(result.missingPrerequisite?.engineNeeded).toContain('whisper')
    expect(result.error).toContain('ENGINE_NOT_INSTALLED')
  })

  // 25. WordSyncTeleprompter renders distinct badge for manual review state
  it('25. renders distinct status-manual-review badge in teleprompter when status is MANUAL_REVIEW_ACCEPTED', () => {
    const planManualReview: SentencePlan = {
      text: 'فروشت زیاده…',
      intent: 'هوک',
      alignmentStatus: 'MANUAL_REVIEW_ACCEPTED',
      isProvisional: true,
      alignmentSource: 'manual-operator-review',
      confidence: null,
      words: [{ word: 'فروشت', start: 0.2, end: 0.8, confidence: null }],
    }

    const html = renderToString(
      React.createElement(WordSyncTeleprompter, { sentence: planManualReview, t: 0.5 }),
    )
    expect(html).toContain('انطباق بازبینی‌شده دستی')
    expect(html).toContain('status-manual-review')
  })

  // 26. Proves that --trusted cannot bypass engine execution requirements
  it('26. proves that operator review flags cannot bypass technical engine execution or promote unverified external JSON', () => {
    const externalUnverifiedProvenance: AlignmentProvenance = {
      type: 'EXTERNAL_UNVERIFIED',
      engine: 'whisper-operator-certified', // Simulated manual flag
      audioSha256: dummySha256,
      isTrustedExecution: false,
    }

    const report = validateAlignmentReadiness({
      audio: validAudio,
      provenance: externalUnverifiedProvenance,
      rawCues: makeFullCues(),
    })

    expect(report.isValidForPromotion).toBe(false)
    expect(report.resolvedStatus).toBe('EXTERNAL_UNVERIFIED')
    expect(report.blockingReasons.some((r) => r.includes('EXTERNAL_UNVERIFIED'))).toBe(true)
  })
})
