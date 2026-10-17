// ============================================
// Hisabche Promo Reel — Permanent Motion-Graphics Engine Guardrails Test
//
// Strictly enforces Hard Rules 14, 15, 16, 17, and 19 across all reels (>= 60)
// and templates:
//
// 1. HARD RULE 14: One Single Focal Stage & On-Stage Text Budget (<= 6 words)
// 2. HARD RULE 15: Natural Persian Copy & Zero Broken Fragments
// 3. HARD RULE 16: Elimination of Horizontal Dividers & Center Line Artifacts
// 4. HARD RULE 17: Evidence-Based Audio & Subtitle Synchronization
// 5. HARD RULE 19: Subtitle Rhythm Mechanics (smooth, overshoot-free highlight)
//
// Hard Rule 18 (motion-first doctrine & text persistence) is a craft rule
// enforced in production review; it has no source-level assertion here.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REELS } from '../reels'
import { BANNED_PERSIAN_FRAGMENTS, MAX_ONSTAGE_WORDS } from '../engine/guardrails'

const FROM_REEL = 60
const lawfulReels = REELS.filter((reel) => Number(reel.id) >= FROM_REEL)

function getLineText(line: unknown): string {
  if (typeof line === 'string') return line
  if (typeof line === 'object' && line !== null) {
    const record = line as Record<string, unknown>
    if (typeof record.label === 'string') return record.label
    if (typeof record.text === 'string') return record.text
  }
  return ''
}

describe('Permanent Motion-Graphics Engine Guardrails (Hard Rules 14-17 & 19)', () => {
  it('applies to all reels from 60 onward', () => {
    expect(lawfulReels.length).toBeGreaterThan(0)
  })

  // ─── 1. HARD RULE 14: One Focal Stage & On-Stage Text Budget ───────────────
  describe('Hard Rule 14: Single Focal Stage & Text Budget', () => {
    for (const reel of lawfulReels) {
      describe(`Reel ${reel.id} («${reel.title}»)`, () => {
        reel.scenes.forEach((scene, sIdx) => {
          it(`scene ${sIdx + 1}: does not duplicate spoken narration on stage`, () => {
            const vo = (scene.vo || '').replace(/[.,،؛!?؟]/g, '').trim()
            if (scene.spec && 'lines' in scene.spec && Array.isArray(scene.spec.lines)) {
              for (const rawLine of scene.spec.lines) {
                const line = getLineText(rawLine)
                const normLine = line.replace(/[.,،؛!?؟]/g, '').trim()
                if (normLine.length > 12) {
                  // A long title/line must not match the exact spoken sentence
                  expect(
                    vo.includes(normLine),
                    `Scene ${sIdx + 1} duplicates narration on stage: "${line}"`,
                  ).toBe(false)
                }
              }
            }
          })

          it(`scene ${sIdx + 1}: respects the 6-word on-stage text budget per label`, () => {
            if (scene.spec && 'lines' in scene.spec && Array.isArray(scene.spec.lines)) {
              for (const rawLine of scene.spec.lines) {
                const line = getLineText(rawLine)
                const wordCount = line.trim().split(/\s+/).filter(Boolean).length
                expect(
                  wordCount,
                  `Line exceeds on-stage text budget (${MAX_ONSTAGE_WORDS} words): "${line}"`,
                ).toBeLessThanOrEqual(MAX_ONSTAGE_WORDS)
              }
            }
          })
        })
      })
    }
  })

  // ─── 2. HARD RULE 15: Natural Persian Copy & Zero Broken Fragments ────────
  describe('Hard Rule 15: Natural Persian Copy (Zero Broken Fragments)', () => {
    for (const reel of lawfulReels) {
      it(`Reel ${reel.id}: on-stage copy contains zero banned stilted Persian fragments`, () => {
        // Test visual on-stage specs, titles, badges, lines (excluding the immutable voiceover audio transcript)
        const stageContent = reel.scenes.map((s) => JSON.stringify(s.spec)).join(' ')
        for (const fragment of BANNED_PERSIAN_FRAGMENTS) {
          expect(
            stageContent.includes(fragment),
            `Reel ${reel.id} on-stage content contains banned copy fragment: "${fragment}"`,
          ).toBe(false)
        }
      })
    }

    it('actor files from reel 60 onward do not contain banned fragments', () => {
      const componentsDir = path.resolve(__dirname, '..', 'components')
      const files = fs.readdirSync(componentsDir)
      for (const file of files) {
        const match = file.match(/^Reel(\d+)/)
        if (match && Number(match[1]) >= FROM_REEL) {
          const content = fs.readFileSync(path.join(componentsDir, file), 'utf8')
          for (const fragment of BANNED_PERSIAN_FRAGMENTS) {
            expect(
              content.includes(fragment),
              `Actor ${file} contains banned copy fragment: "${fragment}"`,
            ).toBe(false)
          }
        }
      }
    })
  })

  // ─── 3. HARD RULE 16: Elimination of Horizontal Dividers ──────────────────
  describe('Hard Rule 16: Zero Accidental Horizontal Dividers', () => {
    it('styles.css neutralizes .topology-split-screen-horizon::before divider', () => {
      const stylesPath = path.resolve(__dirname, '..', 'styles.css')
      const css = fs.readFileSync(stylesPath, 'utf8')
      expect(css).toContain('.topology-split-screen-horizon::before')
      expect(css).toContain('display: none !important')
    })

    it('styles.css contains no horizon divider line classes', () => {
      const stylesPath = path.resolve(__dirname, '..', 'styles.css')
      const css = fs.readFileSync(stylesPath, 'utf8')
      expect(
        /horizon-line/i.test(css),
        'styles.css still defines a horizon divider line class',
      ).toBe(false)
    })

    it('active components do not contain accidental .r*-horizon horizontal dividing lines', () => {
      const componentsDir = path.resolve(__dirname, '..', 'components')
      const files = fs.readdirSync(componentsDir)
      for (const file of files) {
        const match = file.match(/^Reel(\d+)/)
        if (match && Number(match[1]) >= FROM_REEL) {
          const content = fs.readFileSync(path.join(componentsDir, file), 'utf8')
          // Word-bounded: catches `.r61-horizon`, `horizon-line`, `horizon::before`
          // without false-positiving on the English word "horizontal".
          expect(
            /\bhorizon\b/i.test(content),
            `${file} contains unwanted horizontal divider component or class`,
          ).toBe(false)
        }
      }
    })
  })

  // ─── 4. HARD RULE 17: Evidence-Based Audio & Subtitle Synchronization ─────
  describe('Hard Rule 17: Evidence-Based Subtitle Synchronization', () => {
    for (const reel of lawfulReels) {
      it(`Reel ${reel.id}: never claims WORD_SYNC_VERIFIED without forced-alignment proof`, () => {
        const alignmentPath = path.resolve(
          __dirname,
          '..',
          'reels',
          'alignments',
          `reel-${reel.id}-alignment.json`,
        )
        if (fs.existsSync(alignmentPath)) {
          const data = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
          if (data.alignmentStatus === 'WORD_SYNC_VERIFIED') {
            expect(data.isProvisional, 'Cannot be provisional and WORD_SYNC_VERIFIED').toBe(false)
            expect(Array.isArray(data.words), 'Must have verified words array').toBe(true)
            expect(data.words.length).toBeGreaterThan(0)
            expect(typeof data.confidence, 'Must have measured alignment confidence').toBe('number')
          }
        }
      })
    }
  })

  // ─── 5. HARD RULE 19: Subtitle Rhythm Mechanics ───────────────────────────
  describe('Hard Rule 19: Subtitle Highlight Follows the Voice Without Pops', () => {
    it('teleprompter uses one smooth overshoot-free ramp (no jolt spring)', () => {
      const src = fs
        .readFileSync(path.resolve(__dirname, '..', 'ui', 'WordSyncTeleprompter.tsx'), 'utf8')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
      expect(src).toContain('Math.sin(Math.PI *')
      expect(src.includes('spring('), 'karaoke highlight must not use a spring jolt').toBe(false)
    })
  })
})
