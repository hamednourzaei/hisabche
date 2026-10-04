// ============================================
// ingest.service — reading a picture into a draft, and recording the draft a
// person corrected (the gates themselves: document-ingest.test.ts).
//
// What can go wrong HERE: an empty draft when no provider is configured, a
// zero or invented total, «1O5» read as a number, a PDF half-read, a draft
// written to the books without a person, another workspace's supplier, a retry
// recording the bill twice, and the picture stored in the platform's log.
//
// No provider is contacted: the provider call is a function handed in.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const logged: Row[] = []
const suppliers: Row[] = []

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'ai_query_log') {
        return { insert: async (row: Row) => (logged.push(row), { error: null }) }
      }
      if (table !== 'suppliers') throw new Error(`unexpected table ${table}`)
      const filters: Array<(row: Row) => boolean> = []
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => (
          filters.push((row) => row[column] === value),
          builder
        ),
        maybeSingle: async () => ({
          data: suppliers.find((row) => filters.every((f) => f(row))) ?? null,
          error: null,
        }),
      }
      return builder
    },
  },
}))
vi.mock('../services/invoice.service', () => ({ InvoiceService: class {} }))

import {
  DocumentIngestService,
  documentFromReply,
  printedAmountToMinor,
} from '../services/ingest/ingest.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SUPPLIER = '11111111-1111-4111-8111-111111111111'
const THEIR_SUPPLIER = '22222222-2222-4222-8222-222222222222'
const REQUEST = '33333333-3333-4333-8333-333333333333'
const ctx = { workspaceId: WS, userId: 'u1', role: 'seller' } as never
const config = { provider: 'anthropic', model: 'vision-1', apiKey: 'k', baseUrl: null } as never

// A few bytes of «picture». The service only measures and forwards it.
const PICTURE = Buffer.from('not really a jpeg').toString('base64')

const REPLY = JSON.stringify({
  kind: 'receipt',
  total: { text: '۱۲۵٬۰۰۰', confidence: 'high' },
  tax: { text: '10,000.50', confidence: 'medium' },
  currency: { text: 'afn', confidence: 'high' },
  documentNumber: { text: 'F-2026-0042', confidence: 'high' },
  issuedOn: { text: '۱۴۰۵/۰۷/۱۲', confidence: 'medium' },
  supplierName: { text: 'شرکت نمونه', confidence: 'low' },
  unrecognisedLines: ['تشکر از خرید شما'],
})

let configured: boolean
let remaining: number
let reply: string
let sent: Array<Record<string, unknown>>
const issued: Array<{ body: Record<string, unknown>; key: string | null | undefined }> = []
const invoices = {
  create: vi.fn(
    async (
      _ctx: unknown,
      body: unknown,
      _branch: unknown,
      options?: { clientRequestId?: string | null },
    ) => {
      const key = options?.clientRequestId
      const again = issued.findIndex((call) => call.key === key)
      if (again >= 0) return { id: `inv-${again + 1}`, idempotentReplay: true }
      issued.push({ body: body as Record<string, unknown>, key })
      return { id: `inv-${issued.length}` }
    },
  ),
}

const build = () =>
  new DocumentIngestService(
    { getConfig: async () => (configured ? config : null) },
    {
      status: async () =>
        ({
          limit: 10,
          used: 0,
          remaining: remaining - logged.length,
          source: 'plan',
          plan: 'free',
        }) as never,
    },
    (async (_config: unknown, input: Record<string, unknown>) => {
      sent.push(input)
      return reply
    }) as never,
    invoices as never,
  )

beforeEach(() => {
  logged.length = 0
  suppliers.length = 0
  suppliers.push(
    { id: SUPPLIER, workspace_id: WS },
    { id: THEIR_SUPPLIER, workspace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
  )
  issued.length = 0
  invoices.create.mockClear()
  configured = true
  remaining = 5
  reply = REPLY
  sent = []
})

const jpeg = () => build().read(ctx, { contentType: 'image/jpeg', base64: PICTURE })

describe('a printed amount', () => {
  it('is read in any of the three digit scripts, into integer hundredths', () => {
    expect(printedAmountToMinor('125,000')).toBe(12_500_000)
    expect(printedAmountToMinor('۱۲۵٬۰۰۰')).toBe(12_500_000)
    expect(printedAmountToMinor('١٢٥ ٠٠٠')).toBe(12_500_000)
    expect(printedAmountToMinor('10,000.50')).toBe(1_000_050)
    expect(printedAmountToMinor('۹۹٫۵')).toBe(9_950)
  })

  it('grouped with a no-break space (how many printers write thousands) is still a number', () => {
    // Built from char codes: a literal no-break space in a source file is
    // invisible, and was once «tidied» into an ordinary space — which silently
    // stopped the parser accepting it.
    for (const code of [0x00a0, 0x202f]) {
      const text = `125${String.fromCharCode(code)}000`
      expect(printedAmountToMinor(text), `U+${code.toString(16)}`).toBe(12_500_000)
    }
  })

  it('that is not plainly a number is refused, not guessed', () => {
    for (const text of ['1O5', '12.5.3', 'about 500', '', '-200', '1e6', '500 AFN']) {
      expect(printedAmountToMinor(text), text).toBeNull()
    }
  })
})

describe('reading', () => {
  it('with no provider it is refused BY NAME — never an empty draft', async () => {
    configured = false
    const result = await jpeg()
    expect(result.verdict).toMatchObject({ kind: 'refused', reason: 'NO_PROVIDER' })
    expect(sent).toEqual([])
    expect(logged).toEqual([])
  })

  it('a PDF, a spreadsheet and a HEIC are refused before the provider is asked', async () => {
    for (const contentType of ['application/pdf', 'image/heic', 'application/vnd.ms-excel']) {
      const result = await build().read(ctx, { contentType, base64: PICTURE })
      expect(result.verdict, contentType).toMatchObject({
        kind: 'refused',
        reason: 'UNSUPPORTED_TYPE',
      })
    }
    expect(sent).toEqual([])
  })

  it('a picture over the limit is refused; something that is not base64 is an error', async () => {
    const big = 'A'.repeat(Math.ceil(((4 * 1024 * 1024 + 10) * 4) / 3))
    expect(
      (await build().read(ctx, { contentType: 'image/png', base64: big })).verdict,
    ).toMatchObject({
      kind: 'refused',
      reason: 'TOO_LARGE',
    })
    await expect(
      build().read(ctx, { contentType: 'image/png', base64: 'data:image/png;base64,AAAA' }),
    ).rejects.toThrow('INGEST_NOT_BASE64')
    expect(sent).toEqual([])
  })

  it('with the allowance spent, the provider is not called', async () => {
    remaining = 0
    await expect(jpeg()).rejects.toThrow('AI_QUOTA_EXCEEDED')
    expect(sent).toEqual([])
  })

  it('the picture goes to the provider, and the draft carries what was read with its confidence', async () => {
    const result = await jpeg()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.image).toEqual({ mediaType: 'image/jpeg', base64: PICTURE })

    expect(result.verdict.kind).toBe('draft')
    if (result.verdict.kind !== 'draft') return
    const { fields } = result.verdict.document
    expect(fields.totalMinor).toMatchObject({
      value: 12_500_000,
      confidence: 'high',
      raw: '۱۲۵٬۰۰۰',
    })
    expect(fields.taxMinor).toMatchObject({ value: 1_000_050, confidence: 'medium' })
    expect(fields.documentNumber).toMatchObject({ value: 'F-2026-0042' })
    expect(fields.issuedOn).toMatchObject({ value: '۱۴۰۵/۰۷/۱۲', confidence: 'medium' })
    expect(fields.supplierName).toMatchObject({ value: 'شرکت نمونه', confidence: 'low' })
    expect(result.verdict.document.provider).toEqual({ name: 'anthropic', version: 'vision-1' })
    expect(result.verdict.warnings.join(' ')).toContain('1 lines were not recognised')
    expect(result.currency).toBe('AFN')
    expect(result.confirmable).toEqual({ ok: true, reason: null })
    // Reading writes nothing to the books.
    expect(invoices.create).not.toHaveBeenCalled()
  })

  it('no total, a total that is not a number, or a reply that is not JSON is «unreadable» — not zero', async () => {
    const replies = [
      JSON.stringify({ kind: 'receipt', total: null }),
      JSON.stringify({ kind: 'receipt', total: { text: 'illegible', confidence: 'low' } }),
      JSON.stringify({ kind: 'receipt', total: { text: '0', confidence: 'high' } }),
      'I could not read this image.',
    ]
    for (const text of replies) {
      reply = text
      const result = await jpeg()
      expect(result.verdict, text).toEqual({ kind: 'unreadable', reason: 'TOTAL_NOT_FOUND' })
      expect(result.confirmable).toBeNull()
    }
  })

  it('a currency the product does not know is not offered as a guess', () => {
    const made = documentFromReply(
      JSON.stringify({
        total: { text: '500', confidence: 'high' },
        currency: { text: 'XYZ', confidence: 'high' },
      }),
      { name: 'p', version: 'v' },
    )
    expect(made?.currency).toBeNull()
    expect(made?.document.kind).toBe('unknown')
  })

  it('JSON wrapped in prose is still read', () => {
    const made = documentFromReply('Here it is:\n```json\n' + REPLY + '\n```', {
      name: 'p',
      version: 'v',
    })
    expect(made?.document.fields.totalMinor.value).toBe(12_500_000)
  })

  it('the usage row says a document was read — never what was on it', async () => {
    await jpeg()
    expect(logged).toHaveLength(1)
    expect(logged[0]).toMatchObject({ workspace_id: WS, actor_id: 'u1', answer_text: '[draft]' })
    const stored = JSON.stringify(logged[0])
    for (const secret of [PICTURE, 'F-2026-0042', 'شرکت نمونه', '125']) {
      expect(stored).not.toContain(secret)
    }
  })
})

describe('confirming', () => {
  const reviewed = (overrides: Row = {}) => ({
    requestId: REQUEST,
    supplierId: SUPPLIER,
    currency: 'AFN',
    issuedOn: '2026-10-03',
    total: 125_000,
    description: 'خرید طبق سند F-2026-0042',
    documentNumber: 'F-2026-0042',
    ...overrides,
  })

  it('issues ONE purchase invoice from the chosen supplier with the figures the person sent', async () => {
    const created = await build().confirm(ctx, reviewed())
    expect(created).toEqual({ invoiceId: 'inv-1' })
    expect(issued).toHaveLength(1)
    expect(issued[0]!.body).toMatchObject({
      type: 'purchase',
      supplierId: SUPPLIER,
      currency: 'AFN',
      date: '2026-10-03T00:00:00.000Z',
      subtotal: 125_000,
      total: 125_000,
      paidAmount: 0,
      reference: 'F-2026-0042',
    })
    const [item] = issued[0]!.body.items as Row[]
    expect(item).toMatchObject({ quantity: 1, unitPrice: 125_000, totalPrice: 125_000 })
    expect(item!.productId).toBeUndefined()
  })

  it('the same reviewed draft sent twice records one bill', async () => {
    const service = build()
    const first = await service.confirm(ctx, reviewed())
    const second = await service.confirm(ctx, reviewed())
    expect(second).toEqual(first)
    expect(issued).toHaveLength(1)
    expect(invoices.create.mock.calls[0]![3]!.clientRequestId).toBe(
      invoices.create.mock.calls[1]![3]!.clientRequestId,
    )
  })

  it('another workspace’s supplier is not found, and nothing is issued', async () => {
    await expect(build().confirm(ctx, reviewed({ supplierId: THEIR_SUPPLIER }))).rejects.toThrow(
      'not found',
    )
    expect(invoices.create).not.toHaveBeenCalled()
  })

  it('no supplier, no currency, a zero total or an unknown currency is refused', async () => {
    for (const bad of [
      { supplierId: undefined },
      { currency: undefined },
      { currency: 'XYZ' },
      { total: 0 },
      { total: -5 },
      { issuedOn: '۱۴۰۵/۰۷/۱۲' },
      { description: '  ' },
    ]) {
      await expect(build().confirm(ctx, reviewed(bad)), JSON.stringify(bad)).rejects.toThrow()
    }
    await expect(build().confirm(ctx, reviewed({ total: 0.004 }))).rejects.toThrow(
      'INGEST_TOTAL_TOO_SMALL',
    )
    expect(invoices.create).not.toHaveBeenCalled()
  })
})
