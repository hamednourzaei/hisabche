// ============================================
// packages/ui/src/__tests__/industry-support-note.test.ts
//
// The sentence under an industry choice must match what the resolver says the
// product can really do: nothing for a complete specialised profile, the
// "generic" note for a trade with no capability, and the "partial" note for a
// trade whose capability is real but not complete (V53 — a half-built chain is
// never allowed to read as a finished one).
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  INDUSTRY_NOTE_GENERIC_KEY,
  INDUSTRY_NOTE_PARTIAL_KEY,
  industrySupportNoteKey,
} from '../lib/industry-support-note'

const MESSAGES = resolve(__dirname, '../../../i18n/messages')

describe('industrySupportNoteKey', () => {
  it('says nothing when nothing was chosen', () => {
    expect(industrySupportNoteKey([])).toBeNull()
    expect(industrySupportNoteKey('')).toBeNull()
  })

  it('says nothing for a specialised profile whose capabilities are all complete', () => {
    expect(industrySupportNoteKey(['jewellery'])).toBeNull()
  })

  it('uses the generic note for a trade with no capability', () => {
    expect(industrySupportNoteKey(['courier'])).toBe(INDUSTRY_NOTE_GENERIC_KEY)
    expect(industrySupportNoteKey(['other'])).toBe(INDUSTRY_NOTE_GENERIC_KEY)
  })

  it('freight transport is no longer generic (it gained a profile, 13 Nov 2026)', () => {
    expect(industrySupportNoteKey(['freightTransport'])).not.toBe(INDUSTRY_NOTE_GENERIC_KEY)
  })

  it('uses the partial note for a trade that rides on a partial capability', () => {
    expect(industrySupportNoteKey(['clothing'])).toBe(INDUSTRY_NOTE_PARTIAL_KEY)
    expect(industrySupportNoteKey('clothing,jewellery')).toBe(INDUSTRY_NOTE_PARTIAL_KEY)
  })
})

describe('both note keys exist in every language', () => {
  for (const lang of ['fa', 'af', 'en'] as const) {
    it(lang, () => {
      const messages = JSON.parse(readFileSync(resolve(MESSAGES, lang, 'common.json'), 'utf8')) as {
        industry: { supportNote: Record<string, string> }
      }
      expect(messages.industry.supportNote.generic).toBeTruthy()
      expect(messages.industry.supportNote.partial).toBeTruthy()
    })
  }

  it('the English generic support note promises general tools, never specialized trade completeness', () => {
    const en = JSON.parse(readFileSync(resolve(MESSAGES, 'en', 'common.json'), 'utf8')) as {
      industry: { supportNote: Record<string, string> }
    }
    expect(en.industry.supportNote.generic).toMatch(/universal|general/i)
    expect(en.industry.supportNote.generic).toMatch(/not yet available/i)
  })
})
