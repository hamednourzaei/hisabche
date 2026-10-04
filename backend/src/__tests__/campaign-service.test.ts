// ============================================
// Customer campaigns and NPS — the audience, the email, and the service.
//
// What can go wrong: a customer silently left out, a customer who opted out
// written to anyway, markup typed by a person ending up in an email, a campaign
// «sent» when no email can leave, a score recorded twice, a link opening
// somebody else's page.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []
const state: { rpcError: { code?: string; message: string } | null } = { rpcError: null }

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  let payload: Row = {}
  const run = () => {
    if (mode === 'insert') {
      const row = {
        id: `new-${(tables[table] ?? []).length + 1}`,
        status: 'draft',
        created_at: '2026-10-04T00:00:00Z',
        sent_at: null,
        ...payload,
      }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    if (mode === 'upsert') {
      const rows = (tables[table] ??= [])
      if (
        !rows.some(
          (row) =>
            row.customer_id === payload.customer_id && row.workspace_id === payload.workspace_id,
        )
      )
        rows.push({ ...payload })
      return { data: null, error: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    is: (column: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) === value),
      builder
    ),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
    upsert: (row: Row) => ((mode = 'upsert'), (payload = row), builder),
    single: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      if (state.rpcError) return { data: null, error: state.rpcError }
      const lines = args.p_lines as Row[]
      return {
        data: {
          queued: lines.filter((l) => !l.skip_reason).length,
          skipped: lines.filter((l) => l.skip_reason).length,
        },
        error: null,
      }
    },
  },
}))

import {
  customersInSegment,
  isSendableEmail,
  renderCampaignEmail,
  resolveAudience,
  summariseAudience,
} from '../services/campaigns/campaign.domain'
import { CampaignService } from '../services/campaigns/campaign.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

describe('who is in a segment', () => {
  const customers = ['a', 'b', 'c', 'never'].map((id) => ({ id, name: id, email: `${id}@x.io` }))
  const invoices = [
    { customerId: 'a', invoiceDate: '2026-09-25', dueDate: '2026-09-28', outstanding: 100 },
    { customerId: 'b', invoiceDate: '2026-05-01', dueDate: '2026-05-10', outstanding: 0 },
    { customerId: 'c', invoiceDate: '2026-09-30', dueDate: '2026-10-30', outstanding: 500 },
    { customerId: null, invoiceDate: '2026-09-30', dueDate: '2026-09-30', outstanding: 900 },
  ]
  const ids = (segment: never, days: number | null) =>
    customersInSegment(customers, invoices, segment, days, '2026-10-04').map((c) => c.id)

  it('overdue = owes on an invoice PAST its due date — not merely unpaid, not a settled one', () => {
    expect(ids('overdue' as never, null)).toEqual(['a'])
  })

  it('recent buyers and inactive split on the last purchase; a customer who never bought is in neither', () => {
    expect(ids('recent_buyers' as never, 30)).toEqual(['a', 'c'])
    expect(ids('inactive' as never, 30)).toEqual(['b'])
  })

  it('all is everyone', () => {
    expect(ids('all' as never, null)).toHaveLength(4)
  })
})

describe('who can actually be written to', () => {
  it('every customer of the segment gets a line: sendable, or skipped with the reason', () => {
    const lines = resolveAudience(
      [
        { id: 'ok', name: 'a', email: ' a@example.com ' },
        { id: 'none', name: 'b', email: null },
        { id: 'blank', name: 'b', email: '   ' },
        { id: 'bad', name: 'c', email: 'not-an-address' },
        { id: 'out', name: 'd', email: 'd@example.com' },
      ],
      new Set(['out']),
    )
    expect(lines.map((line) => [line.customerId, line.skipReason])).toEqual([
      ['ok', null],
      ['none', 'NO_EMAIL'],
      ['blank', 'NO_EMAIL'],
      ['bad', 'INVALID_EMAIL'],
      ['out', 'OPTED_OUT'],
    ])
    expect(lines[0]!.email).toBe('a@example.com')
    expect(summariseAudience(lines)).toEqual({
      total: 5,
      sendable: 1,
      noEmail: 2,
      invalidEmail: 1,
      optedOut: 1,
    })
  })

  it('an address that would reach two inboxes, or none, is not an address', () => {
    for (const bad of ['a@b', 'a@@b.co', 'a b@c.io', 'a@b.io, c@d.io', '<a@b.io>', '']) {
      expect(isSendableEmail(bad), bad).toBe(false)
    }
    expect(isSendableEmail('ali.karimi+shop@example.co.uk')).toBe(true)
  })
})

describe('the email', () => {
  const render = (overrides: Record<string, unknown> = {}) =>
    renderCampaignEmail({
      kind: 'nps',
      language: 'fa',
      body: 'سلام {name}\nخط دوم',
      customerName: 'احمد',
      businessName: 'فروشگاه',
      feedbackUrl: 'https://hisabche.com/fa/feedback/tok',
      ...overrides,
    } as never)

  it('what a person typed is TEXT: markup in the body, the name or the business name is escaped', () => {
    const html = render({
      body: '<script>alert(1)</script> {name}',
      customerName: '<img src=x onerror=1>',
      businessName: '"><b>x</b>',
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('{name} becomes the customer’s name and line breaks survive', () => {
    const html = render()
    expect(html).toContain('سلام احمد<br>خط دوم')
    expect(html).toContain('dir="rtl"')
  })

  it('an NPS email has the eleven score links and an opt-out; a message has only the opt-out', () => {
    const nps = render()
    for (let score = 0; score <= 10; score++) expect(nps).toContain(`/feedback/tok?score=${score}"`)
    expect(nps).toContain('/feedback/tok?unsubscribe=1')
    const message = render({ kind: 'message' })
    expect(message).not.toContain('?score=')
    expect(message).toContain('/feedback/tok?unsubscribe=1')
    expect(render({ language: 'en' })).toContain('dir="ltr"')
  })
})

describe('the service', () => {
  let service: CampaignService
  const campaign = (overrides: Row = {}): Row => ({
    id: 'camp',
    workspace_id: WS,
    name: 'n',
    kind: 'nps',
    subject: 's',
    body: 'سلام {name}',
    language: 'fa',
    segment: 'all',
    segment_days: null,
    status: 'draft',
    created_at: '2026-10-01T00:00:00Z',
    sent_at: null,
    ...overrides,
  })

  beforeEach(() => {
    for (const key of Object.keys(tables)) delete tables[key]
    rpcCalls.length = 0
    state.rpcError = null
    process.env.RESEND_API_KEY = 're_test_placeholder'
    process.env.FRONTEND_URL = 'https://example.test/'
    tables.customer_campaigns = [campaign()]
    tables.workspaces = [{ id: WS, name: 'فروشگاه نمونه' }]
    tables.customers = [
      { id: 'c1', workspace_id: WS, full_name: 'احمد', email: 'a@example.com', is_active: true },
      { id: 'c2', workspace_id: WS, full_name: 'سارا', email: null, is_active: true },
      { id: 'c3', workspace_id: WS, full_name: 'رضا', email: 'r@example.com', is_active: true },
      { id: 'gone', workspace_id: WS, full_name: 'x', email: 'x@example.com', is_active: false },
      {
        id: 'theirs',
        workspace_id: OTHER,
        full_name: 'secret',
        email: 's@example.com',
        is_active: true,
      },
    ]
    tables.customer_contact_optouts = [{ workspace_id: WS, customer_id: 'c3', channel: 'email' }]
    tables.campaign_recipients = []
    tables.email_outbox = []
    service = new CampaignService()
  })

  it('preview counts who would and would not be written to — and writes nothing', async () => {
    const preview = await service.preview(ctx, 'camp')
    expect(preview).toMatchObject({
      total: 3,
      sendable: 1,
      noEmail: 1,
      optedOut: 1,
      tooLarge: false,
    })
    expect(rpcCalls).toEqual([])
  })

  it('launch hands ONE function a line per customer of THIS workspace, with a link per recipient', async () => {
    const result = await service.launch(ctx, 'camp')
    expect(result).toEqual({ queued: 1, skipped: 2 })
    expect(rpcCalls).toHaveLength(1)
    const lines = rpcCalls[0]!.args.p_lines as Array<Row & { html?: string }>
    expect(lines.map((line) => [line.customer_id, line.skip_reason ?? null])).toEqual([
      ['c1', null],
      ['c2', 'NO_EMAIL'],
      ['c3', 'OPTED_OUT'],
    ])
    expect(lines[0]!.html).toContain(`https://example.test/fa/feedback/${lines[0]!.token}?score=10`)
    expect(lines[0]!.html).toContain('سلام احمد')
    expect(new Set(lines.map((line) => line.token)).size).toBe(3)
    expect(JSON.stringify(lines)).not.toContain('secret')
  })

  it('with no way to send email the campaign is REFUSED — not «sent» into an outbox that will fail', async () => {
    delete process.env.RESEND_API_KEY
    await expect(service.launch(ctx, 'camp')).rejects.toThrow('CAMPAIGN_EMAIL_NOT_CONFIGURED')
    expect(rpcCalls).toEqual([])
    expect(service.channelStatus()).toEqual({ email: { configured: false } })
  })

  it('a segment nobody can be reached in, and a campaign already sent, are refused before the database', async () => {
    tables.customers = [
      { id: 'c2', workspace_id: WS, full_name: 'سارا', email: null, is_active: true },
    ]
    await expect(service.launch(ctx, 'camp')).rejects.toThrow('CAMPAIGN_NOBODY_REACHABLE')
    tables.customer_campaigns = [campaign({ status: 'sent' })]
    await expect(service.launch(ctx, 'camp')).rejects.toThrow('CAMPAIGN_ALREADY_SENT')
    expect(rpcCalls).toEqual([])
  })

  it('an audience above the limit is refused whole, never cut down', async () => {
    tables.customers = Array.from({ length: 2001 }, (_, index) => ({
      id: `k${index}`,
      workspace_id: WS,
      full_name: 'x',
      email: `k${index}@example.com`,
      is_active: true,
    }))
    await expect(service.launch(ctx, 'camp')).rejects.toThrow('CAMPAIGN_AUDIENCE_TOO_LARGE')
    expect((await service.preview(ctx, 'camp')).tooLarge).toBe(true)
    expect(rpcCalls).toEqual([])
  })

  it('another workspace’s campaign is «not found»; a missing table is «not set up»', async () => {
    tables.customer_campaigns = [campaign({ workspace_id: OTHER })]
    await expect(service.launch(ctx, 'camp')).rejects.toThrow('not found')
    tables.customer_campaigns = [campaign()]
    state.rpcError = { code: 'PGRST202', message: 'Could not find the function' }
    await expect(service.launch(ctx, 'camp')).rejects.toThrow('CAMPAIGNS_MIGRATION_PENDING')
  })

  describe('after it is sent', () => {
    beforeEach(() => {
      tables.customer_campaigns = [campaign({ status: 'sent', sent_at: `${daysAgo(2)}T10:00:00Z` })]
      tables.email_outbox = [
        { id: 'o1', status: 'sent' },
        { id: 'o2', status: 'pending' },
        { id: 'o3', status: 'failed' },
      ]
      const recipient = (id: string, overrides: Row): Row => ({
        id,
        workspace_id: WS,
        campaign_id: 'camp',
        customer_id: id,
        token: `tok-${id}`,
        outbox_id: null,
        skip_reason: null,
        nps_score: null,
        nps_comment: null,
        responded_at: null,
        ...overrides,
      })
      tables.campaign_recipients = [
        recipient('r1', {
          outbox_id: 'o1',
          nps_score: 10,
          nps_comment: 'عالی',
          responded_at: '2026-10-03T08:00:00Z',
        }),
        recipient('r2', { outbox_id: 'o2' }),
        recipient('r3', { outbox_id: 'o3', nps_score: 3, responded_at: '2026-10-03T09:00:00Z' }),
        recipient('r4', { outbox_id: 'o-gone' }),
        recipient('r5', { skip_reason: 'NO_EMAIL' }),
      ]
    })

    it('delivery is read from the OUTBOX; a row that vanished is «unknown», never «sent»', async () => {
      const { delivery } = await service.detail(ctx, 'camp')
      expect(delivery).toEqual({
        queued: 4,
        sent: 1,
        pending: 1,
        failed: 1,
        unknown: 1,
        skipped: { noEmail: 1, invalidEmail: 0, optedOut: 0 },
      })
    })

    it('the score comes from the answers, and says how many were asked', async () => {
      const { nps } = await service.detail(ctx, 'camp')
      expect(nps).toMatchObject({
        score: 0,
        population: 4,
        counts: { promoters: 1, detractors: 1, respondents: 2 },
      })
      expect(nps!.comments).toEqual([
        { score: 10, comment: 'عالی', answeredAt: '2026-10-03T08:00:00Z' },
      ])
    })

    it('nobody answered = no score, with the reason — not zero', async () => {
      for (const row of tables.campaign_recipients!)
        Object.assign(row, { nps_score: null, responded_at: null })
      const { nps } = await service.detail(ctx, 'camp')
      expect(nps).toMatchObject({ score: null, reason: 'NO_RESPONSES' })
    })

    it('a recipient’s page names the business and whether they can answer', async () => {
      expect(await service.feedbackView('tok-r2')).toEqual({
        businessName: 'فروشگاه نمونه',
        asksForScore: true,
        answered: false,
        canAnswer: true,
        unsubscribed: false,
      })
      expect(await service.feedbackView('tok-r1')).toMatchObject({
        answered: true,
        canAnswer: false,
      })
    })

    it('a score is recorded once; the second answer changes nothing and says so', async () => {
      expect(await service.answer('tok-r2', { score: 8, comment: ' خوب ' })).toEqual({
        recorded: true,
      })
      expect(tables.campaign_recipients![1]).toMatchObject({ nps_score: 8, nps_comment: 'خوب' })
      expect(await service.answer('tok-r2', { score: 0, comment: null })).toEqual({
        recorded: false,
      })
      expect(tables.campaign_recipients![1]!.nps_score).toBe(8)
    })

    it('a link that was never sent, a made-up one, and an expired one open nothing', async () => {
      await expect(service.feedbackView('tok-r5')).rejects.toThrow('not found')
      await expect(service.feedbackView('nope')).rejects.toThrow('not found')
      tables.customer_campaigns = [
        campaign({ status: 'sent', sent_at: `${daysAgo(61)}T10:00:00Z` }),
      ]
      await expect(service.answer('tok-r2', { score: 9, comment: null })).rejects.toThrow(
        'NPS_LINK_EXPIRED',
      )
      expect((await service.feedbackView('tok-r2')).canAnswer).toBe(false)
    })

    it('opting out is recorded for THAT customer, once, and is idempotent', async () => {
      await service.unsubscribe('tok-r2')
      await service.unsubscribe('tok-r2')
      const mine = tables.customer_contact_optouts!.filter((row) => row.customer_id === 'r2')
      expect(mine).toEqual([{ workspace_id: WS, customer_id: 'r2', channel: 'email' }])
      expect((await service.feedbackView('tok-r2')).unsubscribed).toBe(true)
    })
  })
})
