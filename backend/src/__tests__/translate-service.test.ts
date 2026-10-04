// ============================================
// translate.service — the provider, the allowance and the usage row around the
// translation engine (the engine's own rules: document-translation.test.ts).
//
// What can go wrong HERE: a call made with no provider configured, a call made
// with the allowance spent, a figure reaching the model, a Persian-digit amount
// reaching the model, the document text stored in the platform's log, a paid
// call not counted, and a free refusal counted.
//
// No provider is contacted: the provider call is a function handed in.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const logged: Row[] = []
let logError: { message: string } | null = null

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      insert: async (row: Row) => {
        if (table !== 'ai_query_log') throw new Error(`unexpected table ${table}`)
        if (logError) return { error: logError }
        logged.push(row)
        return { error: null }
      },
    }),
  },
}))

import { DocumentTranslateService, translationPrompt } from '../services/ingest/translate.service'

const ctx = { workspaceId: 'ws-1', userId: 'u1', role: 'seller' } as never
const config = { provider: 'anthropic', model: 'm', apiKey: 'k', baseUrl: null } as never

const SOURCE = [
  'فاکتور شماره 2026-0042',
  'تاریخ: ۱۴۰۵/۰۷/۱۲',
  'جمع کل: ۱۲۵٬۰۰۰ افغانی',
  'مالیات: 10,000',
  'کد کالا SKU-A17',
].join('\n')

let configured: boolean
let remaining: number
let sent: Array<{ system: string; user: string; maxTokens?: number | undefined }>
let reply: (pinned: string) => string

const build = () =>
  new DocumentTranslateService(
    { getConfig: async () => (configured ? config : null) },
    {
      status: async () =>
        ({
          limit: 10,
          used: 10 - remaining + logged.length,
          remaining: remaining - logged.length,
          source: 'plan',
          plan: 'free',
        }) as never,
    },
    (async (_config: unknown, input: { system: string; user: string; maxTokens?: number }) => {
      sent.push(input)
      return reply(input.user)
    }) as never,
  )

beforeEach(() => {
  logged.length = 0
  logError = null
  configured = true
  remaining = 5
  sent = []
  // An honest translator: new prose, every marker kept.
  reply = (pinned) => pinned.replace('فاکتور', 'Invoice').replace('جمع کل', 'Total')
})

describe('not configured, out of allowance', () => {
  it('with no provider it says so — and nothing is called or counted', async () => {
    configured = false
    await expect(build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })).rejects.toThrow(
      'AI_NOT_CONFIGURED',
    )
    expect(sent).toEqual([])
    expect(logged).toEqual([])
  })

  it('with the allowance spent, the provider is not called', async () => {
    remaining = 0
    await expect(build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })).rejects.toThrow(
      'AI_QUOTA_EXCEEDED',
    )
    expect(sent).toEqual([])
  })
})

describe('what reaches the model', () => {
  it('no figure does — ASCII, Persian digits, a date or a document number', async () => {
    await build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })
    expect(sent).toHaveLength(1)
    const pinned = sent[0]!.user
    expect(pinned).not.toMatch(/[0-9۰-۹٠-٩]{2,}/)
    for (const figure of ['2026-0042', '۱۴۰۵/۰۷/۱۲', '۱۲۵٬۰۰۰', '10,000']) {
      expect(pinned).not.toContain(figure)
    }
    expect(pinned).toContain('⟦fig-0⟧')
  })

  it('the prompt names the two languages and tells the model to leave the markers alone', async () => {
    const prompt = translationPrompt('af', 'en')
    expect(prompt).toContain('Dari')
    expect(prompt).toContain('English')
    expect(prompt).toContain('⟦fig-0⟧')
    await build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })
    expect(sent[0]!.system).toBe(translationPrompt('fa', 'en'))
    expect(sent[0]!.maxTokens).toBe(4096)
  })
})

describe('the result', () => {
  it('carries the figures of the SOURCE, the source itself, and the allowance after the call', async () => {
    const { verdict, quota } = await build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })
    expect(verdict.kind).toBe('translated')
    if (verdict.kind !== 'translated') return
    expect(verdict.text).toContain('Invoice')
    for (const figure of ['2026-0042', '۱۴۰۵/۰۷/۱۲', '۱۲۵٬۰۰۰', '10,000']) {
      expect(verdict.text).toContain(figure)
    }
    expect(verdict.text).not.toContain('⟦')
    expect(verdict.source).toBe(SOURCE)
    expect(quota.remaining).toBe(4)
  })

  it('a model that drops a figure marker is refused — and the call is still counted', async () => {
    reply = (pinned) => pinned.replace('⟦fig-2⟧', '125000')
    const { verdict } = await build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })
    expect(verdict).toMatchObject({ kind: 'refused', reason: 'FIGURE_ALTERED' })
    expect(logged).toHaveLength(1)
    expect(logged[0]!.answer_text).toBe('[FIGURE_ALTERED]')
  })

  it('a refusal made before the provider is asked costs nothing', async () => {
    const service = build()
    expect(
      (await service.translate(ctx, { text: SOURCE, from: 'fa', to: 'fa' })).verdict,
    ).toMatchObject({
      kind: 'refused',
      reason: 'SAME_LOCALE',
    })
    expect(
      (await service.translate(ctx, { text: 'x'.repeat(8_001), from: 'fa', to: 'en' })).verdict,
    ).toMatchObject({ kind: 'refused', reason: 'TOO_LONG' })
    expect(sent).toEqual([])
    expect(logged).toEqual([])
  })
})

describe('the usage row', () => {
  it('says a translation was made — never what the document said', async () => {
    await build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })
    expect(logged).toHaveLength(1)
    const row = logged[0]!
    expect(row).toMatchObject({
      workspace_id: 'ws-1',
      actor_id: 'u1',
      model_provider: 'anthropic',
      resolved_views_or_functions: [],
      answer_text: '[translated]',
    })
    const stored = JSON.stringify(row)
    for (const secret of ['2026-0042', '۱۲۵٬۰۰۰', 'SKU-A17', 'افغانی', 'Invoice']) {
      expect(stored).not.toContain(secret)
    }
    expect(String(row.question_text)).toContain(`${SOURCE.length} characters`)
  })

  it('a failed log write does not fail the translation the person already paid for', async () => {
    logError = { message: 'down' }
    const { verdict } = await build().translate(ctx, { text: SOURCE, from: 'fa', to: 'en' })
    expect(verdict.kind).toBe('translated')
  })
})
