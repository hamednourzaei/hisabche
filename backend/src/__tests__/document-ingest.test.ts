// ============================================
// Engine N14 — document ingestion.
// Capabilities #16, #30, #48, #49.
//
// ⚠️ THIS ENGINE REFUSES MORE THAN IT ACCEPTS, AND THAT IS THE DESIGN.
//
// The earlier roadmap declined OCR outright, with an honest reason: Storage, a
// queue, a provider and a security model, and none of the four existed. Three
// exist now. The fourth is credentials the owner supplies, so the DEFAULT is
// that no provider is configured — and a pipeline with no provider REJECTS every
// document rather than returning an empty result a caller would read as «there
// was nothing in the file».
//
// That distinction is the whole file. Every other failure here has the same
// shape: a plausible-looking empty or zero where the truth is «I don't know».
//
//   * a total the model could not read → `unreadable`, NOT a draft with 0
//   * a provider that read 3 of 5 pages → a WARNING, because its total looks
//     complete and is not
//   * a PDF with a text layer → refused, because OCR does it WORSE than a string
//   * a negative total → needs a credit note, because one reverses and the
//     other is a parsing bug, and they are not the same document
// ============================================

import { describe, expect, it } from 'vitest'

import {
  INGEST_LIMITS,
  checkIngestable,
  isConfirmable,
  safeFileName,
  toDraft,
  type ExtractedDocument,
  type IngestInput,
} from '../services/ingest/ingest.domain'

const CONFIGURED: IngestInput = {
  contentType: 'application/pdf',
  byteLength: 400_000,
  pageCount: 1,
  hasTextLayer: false,
  availability: { configured: true },
}

const document = (over: Partial<ExtractedDocument> = {}): ExtractedDocument => ({
  kind: 'invoice',
  fields: {
    totalMinor: { value: 100_00, confidence: 'high', region: { page: 1 } },
    unrecognisedLines: [],
  },
  pagesRead: 1,
  provider: { name: 'test', version: '1' },
  ...over,
})

describe('N14 — no provider means every document is REFUSED', () => {
  it('and the refusal says why, rather than returning nothing', () => {
    const verdict = checkIngestable({ ...CONFIGURED, availability: { configured: false } })

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'NO_PROVIDER' })
  })

  it('the configured path is accepted', () => {
    expect(checkIngestable(CONFIGURED)).toEqual({ ok: true })
  })
})

describe('N14 — limits are checked, and every refusal carries a reason', () => {
  it('rejects a type the product cannot parse safely', () => {
    // ⚠️ xlsx is deliberately absent: an xlsx is a zip and a dump can execute
    // code, and `README.md` records that its parser is not isolated.
    const verdict = checkIngestable({ ...CONFIGURED, contentType: 'application/vnd.ms-excel' })

    expect(verdict).toMatchObject({ kind: 'refused', reason: 'UNSUPPORTED_TYPE' })
    expect(INGEST_LIMITS.acceptedTypes as readonly string[]).not.toContain(
      'application/vnd.ms-excel',
    )
  })

  it('rejects an oversized file', () => {
    expect(
      checkIngestable({ ...CONFIGURED, byteLength: INGEST_LIMITS.maxBytes + 1 }),
    ).toMatchObject({
      reason: 'TOO_LARGE',
    })
  })

  it('rejects a document with too many pages', () => {
    expect(checkIngestable({ ...CONFIGURED, pageCount: INGEST_LIMITS.maxPages + 1 })).toMatchObject(
      {
        reason: 'TOO_MANY_PAGES',
      },
    )
  })

  it('rejects a zero-page document', () => {
    expect(checkIngestable({ ...CONFIGURED, pageCount: 0 })).toMatchObject({
      reason: 'TOO_FEW_PAGES',
    })
  })

  it('refuses OCR on a PDF that already has text', () => {
    // ⚠️ OCR does this WORSE than reading the string, and running it anyway
    // means a shop's accurate digital statement is transcribed by a model and
    // loses digits.
    expect(checkIngestable({ ...CONFIGURED, hasTextLayer: true })).toMatchObject({
      reason: 'NO_TEXT',
    })
  })

  it('the provider check runs BEFORE the type check', () => {
    // ⚠️ Cheapest-first would argue for the opposite, but answering "no OCR
    // provider" about a 40 MB spreadsheet wastes the only question worth asking.
    const verdict = checkIngestable({
      contentType: 'application/vnd.ms-excel',
      byteLength: 40_000_000,
      pageCount: 99,
      hasTextLayer: false,
      availability: { configured: false },
    })

    expect(verdict).toMatchObject({ reason: 'NO_PROVIDER' })
  })
})

describe('N14 — a total nobody could read is not a zero total', () => {
  it('a low-confidence zero total cannot be confirmed', () => {
    // ⚠️ THE failure in this file. A zero-total draft saved and confirmed is a
    // free item on the shelf, and the books record it as a real zero.
    const unreadable = document({
      fields: { totalMinor: { value: 0, confidence: 'low', region: null }, unrecognisedLines: [] },
    })

    expect(isConfirmable(unreadable)).toMatchObject({ ok: false, reason: 'TOTAL_UNREADABLE' })
  })

  it('a zero total read with HIGH confidence is a real zero', () => {
    // ⚠️ A free item IS a thing: a sample, a warranty job, a goodwill gesture.
    // Refusing it would make the product unable to file the documents that
    // exist precisely because they cost nothing.
    const free = document({
      fields: {
        totalMinor: { value: 0, confidence: 'high', region: { page: 1 } },
        unrecognisedLines: [],
      },
    })

    expect(isConfirmable(free).ok).toBe(true)
  })

  it('a fractional total is refused — money is an integer here', () => {
    const fractional = document({
      fields: {
        totalMinor: { value: 100.5, confidence: 'high', region: { page: 1 } },
        unrecognisedLines: [],
      },
    })

    expect(isConfirmable(fractional)).toMatchObject({ reason: 'TOTAL_NOT_AN_INTEGER' })
  })

  it('a NEGATIVE total asks for a credit note rather than being filed', () => {
    // ⚠️ One reverses and the other is a parsing bug, and they are not the same
    // document. Filing a credit note as a purchase is how a shop cancels a real
    // debt.
    const negative = document({
      fields: {
        totalMinor: { value: -100_00, confidence: 'high', region: { page: 1 } },
        unrecognisedLines: [],
      },
    })

    expect(isConfirmable(negative)).toMatchObject({
      ok: false,
      reason: 'NEGATIVE_TOTAL_NEEDS_A_CREDIT_NOTE',
    })
  })
})

describe('N14 — a partial read is always visible', () => {
  it('warns when the provider read fewer pages than the file has', () => {
    // ⚠️ The provider's total looks complete and is not, and there is nowhere
    // else this would surface.
    const verdict = toDraft(document({ pagesRead: 3 }), 5)

    expect(verdict.kind).toBe('draft')
    expect(verdict.kind === 'draft' && verdict.warnings.join(' ')).toContain('3 of 5 pages')
  })

  it('warns about an unrecognised document type', () => {
    const verdict = toDraft(document({ kind: 'unknown' }), 1)

    expect(verdict.kind === 'draft' && verdict.warnings.join(' ')).toContain(
      'type was not recognised',
    )
  })

  it('warns about lines the model could not place', () => {
    const verdict = toDraft(
      document({
        fields: {
          totalMinor: { value: 1, confidence: 'high', region: null },
          unrecognisedLines: ['?? 40.000'],
        },
      }),
      1,
    )

    expect(verdict.kind === 'draft' && verdict.warnings.join(' ')).toContain(
      '1 lines were not recognised',
    )
  })

  it('warns about a low-confidence total', () => {
    const verdict = toDraft(
      document({
        fields: {
          totalMinor: { value: 500, confidence: 'low', region: null },
          unrecognisedLines: [],
        },
      }),
      1,
    )

    expect(verdict.kind === 'draft' && verdict.warnings.join(' ')).toContain('low confidence')
  })

  it('a clean read produces no warnings', () => {
    const verdict = toDraft(document(), 1)

    expect(verdict.kind === 'draft' && verdict.warnings).toEqual([])
  })

  it('NOTHING IS WRITTEN — a draft is a draft', () => {
    // ⚠️ The engine returns a draft and the caller confirms it. It has no
    // database access at all, so there is nothing for it to write even by
    // accident.
    expect(toDraft(document(), 1).kind).toBe('draft')
  })
})

describe('N14 — an uploaded file name is attacker-controlled', () => {
  it('strips path separators', () => {
    expect(safeFileName('../../etc/passwd')).not.toContain('/')
  })

  it('strips characters that are not filename characters', () => {
    expect(safeFileName('receipt (1) <script>.pdf')).not.toMatch(/[<>() ]/)
  })

  it('keeps a normal name intact', () => {
    expect(safeFileName('invoice-2026-0042.pdf')).toBe('invoice-2026-0042.pdf')
  })

  it('never returns an empty name', () => {
    expect(safeFileName('')).toBe('document')
    expect(safeFileName('...')).toBe('document')
  })

  it('bounds the length', () => {
    expect(safeFileName(`${'a'.repeat(500)}.pdf`).length).toBeLessThanOrEqual(120)
  })
})
