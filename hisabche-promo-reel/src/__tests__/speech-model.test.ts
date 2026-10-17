import { describe, it, expect } from 'vitest'
import {
  estimatePersianCadence,
  getActiveWord,
  getEventAtTimestamp,
  validateWordSequence,
  verifyAudioVideoSync,
  determineAlignmentStatus,
  type WordCue,
} from '../engine/speech-model'
import fs from 'node:fs'
import path from 'node:path'

describe('Speech & Word Alignment Model', () => {
  it('computes positive, monotonically advancing word timestamps from Persian text with null confidence', () => {
    const text = 'فروشت زیاده… ولی حساب بانکیت خالیه؟'
    const words = estimatePersianCadence(text, {
      startOffset: 0.2,
      totalDuration: 4.5,
      emphasizedWords: ['زیاده', 'خالیه'],
    })

    expect(words.length).toBeGreaterThan(0)

    let prevStart = -1
    for (const w of words) {
      expect(w.start).toBeGreaterThanOrEqual(prevStart)
      expect(w.end).toBeGreaterThan(w.start)
      expect(w.confidence).toBeNull() // STRICT: provisional confidence is always null
      prevStart = w.start
    }
  })

  it('allocates extra weight to punctuation pauses (ellipsis and question marks)', () => {
    const textWithPause = 'زیاده…'
    const normalText = 'زیاده'

    const cuesPause = estimatePersianCadence(textWithPause, {
      startOffset: 0.0,
      totalDuration: 2.0,
    })
    const cuesNormal = estimatePersianCadence(normalText, { startOffset: 0.0, totalDuration: 2.0 })

    expect(cuesPause[0]).toBeDefined()
    expect(cuesNormal[0]).toBeDefined()
    expect(cuesPause[0]!.word).toContain('…')
  })

  it('correctly maps semantic actions, sound effects, and kinetic emphasis to targeted words', () => {
    const text = 'فروشت زیاده'
    const words = estimatePersianCadence(text, {
      startOffset: 0.2,
      emphasizedWords: ['زیاده'],
      wordActions: {
        فروشت: { action: 'card-slam-sales', sound: 'impact' },
        زیاده: { action: 'counter-surge', sound: 'cash', emphasis: true },
      },
    })

    expect(words).toHaveLength(2)
    expect(words[0]!.word).toBe('فروشت')
    expect(words[0]!.action).toBe('card-slam-sales')
    expect(words[0]!.sound).toBe('impact')
    expect(words[0]!.confidence).toBeNull()

    expect(words[1]!.word).toBe('زیاده')
    expect(words[1]!.action).toBe('counter-surge')
    expect(words[1]!.sound).toBe('cash')
    expect(words[1]!.emphasis).toBe(true)
    expect(words[1]!.confidence).toBeNull()
  })

  it('identifies the active word at timestamp t using getActiveWord with tolerance', () => {
    const words: WordCue[] = [
      { word: 'فروشت', start: 0.2, end: 0.8, confidence: null },
      { word: 'زیاده…', start: 0.95, end: 2.3, confidence: null },
    ]

    // Inside word 1
    const active1 = getActiveWord(words, 0.5)
    expect(active1?.word).toBe('فروشت')

    // Inside word 2
    const active2 = getActiveWord(words, 1.5)
    expect(active2?.word).toBe('زیاده…')

    // In the gap between words (0.87s is within 0.08s tolerance of 0.8s)
    const activeTolerance = getActiveWord(words, 0.85, 0.08)
    expect(activeTolerance?.word).toBe('فروشت')

    // Far outside any word
    const outside = getActiveWord(words, 3.5)
    expect(outside).toBeNull()
  })

  it('dispatches semantic visual events and SFX at exact word timestamps', () => {
    const words: WordCue[] = [
      {
        word: 'فروشت',
        start: 0.2,
        end: 0.8,
        action: 'sales-slam',
        sound: 'titleHit',
        confidence: null,
      },
      {
        word: 'زیاده…',
        start: 0.95,
        end: 2.3,
        action: 'count-surge',
        sound: 'whoosh',
        confidence: null,
      },
    ]

    const eventAt02 = getEventAtTimestamp(words, 0.2, 0.05)
    expect(eventAt02).not.toBeNull()
    expect(eventAt02?.action).toBe('sales-slam')
    expect(eventAt02?.sound).toBe('titleHit')

    const eventAt05 = getEventAtTimestamp(words, 0.5, 0.05)
    expect(eventAt05).toBeNull()
  })

  it('validates word sequences, catching negative durations and severe acoustic overlaps', () => {
    const validWords: WordCue[] = [
      { word: 'فروشت', start: 0.2, end: 0.8, confidence: null },
      { word: 'زیاده…', start: 0.9, end: 1.5, confidence: null },
    ]
    expect(validateWordSequence(validWords).valid).toBe(true)

    const invalidOverlap: WordCue[] = [
      { word: 'فروشت', start: 0.2, end: 1.2, confidence: null },
      { word: 'زیاده…', start: 0.4, end: 1.5, confidence: null }, // starts 0.8s before previous ends
    ]
    const checkOverlap = validateWordSequence(invalidOverlap)
    expect(checkOverlap.valid).toBe(false)
    expect(checkOverlap.errors.length).toBeGreaterThan(0)
    expect(checkOverlap.errors[0]).toContain('severely overlaps')

    const negativeDuration: WordCue[] = [{ word: 'خطا', start: 1.5, end: 1.2, confidence: null }]
    const checkNeg = validateWordSequence(negativeDuration)
    expect(checkNeg.valid).toBe(false)
    expect(checkNeg.errors[0]).toContain('non-positive duration')
  })

  it('correctly resolves the 3 alignment lifecycle states', () => {
    // 1. Missing audio
    expect(determineAlignmentStatus({ hasAudio: false, hasWordAlignment: false })).toBe(
      'PROVISIONAL_CADENCE_MODEL_ACTIVE',
    )

    // 2. Audio present, but no word timestamps
    expect(determineAlignmentStatus({ hasAudio: true, hasWordAlignment: false })).toBe(
      'AUDIO_DETECTED_NOT_WORD_ALIGNED',
    )

    // 3. Audio present with poor coverage (<80%)
    expect(
      determineAlignmentStatus({ hasAudio: true, hasWordAlignment: true, coveragePercent: 65 }),
    ).toBe('AUDIO_DETECTED_NOT_WORD_ALIGNED')

    // 4. Audio present with verified word alignment (>=80%)
    expect(
      determineAlignmentStatus({ hasAudio: true, hasWordAlignment: true, coveragePercent: 95 }),
    ).toBe('REAL_WORD_ALIGNMENT_READY')
  })

  it('verifies audio and video duration synchronization within tolerance', () => {
    // Perfect match
    const perfect = verifyAudioVideoSync(26.0, 26.0)
    expect(perfect.inSync).toBe(true)
    expect(perfect.driftSec).toBe(0.0)

    // Minor acceptable drift (<0.5s)
    const minorDrift = verifyAudioVideoSync(26.15, 26.0, 0.5)
    expect(minorDrift.inSync).toBe(true)
    expect(minorDrift.driftSec).toBe(0.15)

    // Unacceptable drift (>0.5s)
    const severeDrift = verifyAudioVideoSync(24.8, 26.0, 0.5)
    expect(severeDrift.inSync).toBe(false)
    expect(severeDrift.driftSec).toBe(1.2)
  })

  it('verifies that the Reel 53 alignment manifest contains all 30 script words in provisional state', () => {
    const alignmentPath = path.resolve(
      __dirname,
      '..',
      'reels',
      'alignments',
      'reel-53-alignment.json',
    )
    expect(fs.existsSync(alignmentPath)).toBe(true)

    const raw = fs.readFileSync(alignmentPath, 'utf8')
    const json = JSON.parse(raw)

    expect(json.reelId).toBe('53')
    expect(json.alignmentStatus).toBe('PROVISIONAL_CADENCE_MODEL_ACTIVE')
    expect(json.isProvisional).toBe(true)
    expect(json.confidence).toBeNull()
    expect(json.audioDuration).toBe(26.0)
    expect(Array.isArray(json.scenes)).toBe(true)
    expect(json.scenes.length).toBe(5)

    // Verify all 30 words are present
    let totalWordsCount = 0
    for (const sc of json.scenes) {
      expect(typeof sc.sceneIndex).toBe('number')
      expect(typeof sc.vo).toBe('string')
      expect(Array.isArray(sc.words)).toBe(true)
      expect(sc.words.length).toBeGreaterThan(0)

      for (const w of sc.words) {
        expect(typeof w.word).toBe('string')
        expect(typeof w.start).toBe('number')
        expect(typeof w.end).toBe('number')
        expect(w.end).toBeGreaterThan(w.start)
        expect(w.confidence).toBeNull() // STRICT: provisional confidence is null
        totalWordsCount++
      }
    }

    expect(totalWordsCount).toBe(30)
  })
})
