// ============================================
// The AI action pipeline over real HTTP semantics (`fastify.inject`).
//
// The pipeline's OWN routes, service, rules and repository run for real. What
// stands in:
//   the provider         a scripted reply (no key, no network)
//   the database client  three in-memory tables with the same conditional
//                        update the claim relies on (the real triggers are
//                        exercised in ai-pipeline.pg.test.ts)
//   the business routes  stand-ins on the SAME server that record what reached
//                        them — which is the point: this proves WHAT the
//                        pipeline sends, as WHOM, and how many times.
//
// ⚠️ It does not prove that InvoiceService books an invoice. That is the
// invoice route's own suite; the pipeline adds no second way to write one.
// ============================================

import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AHMAD = '11111111-1111-4111-8111-111111111111'
const AHMAD_2 = '22222222-2222-4222-8222-222222222222'
const TEA = '33333333-3333-4333-8333-333333333333'

interface Session {
  userId: string
  workspaceId: string
  role: 'owner' | 'manager' | 'seller'
  /** A custom role's resolved set, when the member has one. */
  capabilities?: Set<string>
}

const { tables, state } = vi.hoisted(() => ({
  tables: new Map<string, Array<Record<string, unknown>>>(),
  state: {
    sessions: new Map<string, unknown>(),
    replies: [] as string[],
    modelCalls: [] as Array<{ system: string; user: string }>,
    configured: true,
    limit: 5,
    nextId: 1,
    clock: 0,
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (
    request: { headers: Row; userId?: string; session?: unknown },
    reply: { code: (n: number) => { send: (b: unknown) => unknown } },
  ) => {
    const token = String(request.headers.authorization ?? '').replace('Bearer ', '')
    const session = state.sessions.get(token) as Session | undefined
    if (!session) return reply.code(401).send({ error: 'Unauthorized' })
    request.userId = session.userId
    request.session = session
    return undefined
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown; session?: unknown }) => {
    const session = request.session as Session
    request.tenancy = {
      workspaceId: session.workspaceId,
      userId: session.userId,
      role: session.role,
      ...(session.capabilities ? { capabilities: session.capabilities } : {}),
    }
  },
}))

vi.mock('../services/developer/developer.service', () => ({
  developerService: { authenticateKey: async () => null, recordRequest: () => undefined },
}))

vi.mock('../services/ai/provider-client', () => ({
  callProvider: async (_config: unknown, input: { system: string; user: string }) => {
    state.modelCalls.push(input)
    return state.replies.shift() ?? '{"operation":"none","fields":{},"uncertain":[]}'
  },
}))
vi.mock('../services/ai/ai-settings.service', () => ({
  AiSettingsService: class {
    async getConfig() {
      return state.configured
        ? {
            provider: 'anthropic',
            baseUrl: null,
            model: 'test-model',
            apiKey: 'k',
            systemPrompt: '',
            topupContact: '',
            isEnabled: true,
          }
        : null
    }
    async getStatus() {
      return { topupContact: 'support' }
    }
  },
}))
vi.mock('../services/ai/ai-quota.service', () => ({
  // COUNTED from the same log the pipeline writes to, as the real one is.
  AiQuotaService: class {
    async status() {
      const used = (tables.get('ai_query_log') ?? []).length
      return {
        limit: state.limit,
        used,
        remaining: Math.max(0, state.limit - used),
        source: 'plan',
        plan: 'free',
      }
    }
  },
}))

vi.mock('../db', () => {
  const from = (table: string) => {
    if (!tables.has(table)) tables.set(table, [])
    const rows = tables.get(table) as Row[]
    const filters: Array<(row: Row) => boolean> = []
    let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'
    let payload: Row = {}
    const stamp = () => new Date(Date.now() + state.clock++).toISOString()
    const run = () => {
      if (mode === 'insert') {
        const row: Row = {
          id: `00000000-0000-4000-8000-${String(state.nextId++).padStart(12, '0')}`,
          created_at: stamp(),
          ...(table === 'ai_action_requests'
            ? {
                status: 'pending',
                key_id: null,
                run_id: null,
                result_status: null,
                result: null,
                decided_by: null,
                decided_at: null,
              }
            : {}),
          ...(table === 'ai_pipeline_runs'
            ? {
                status: 'understanding',
                dry_run: false,
                draft: {},
                questions: [],
                command: null,
                proposal: null,
                auto_approved: false,
              }
            : {}),
          ...payload,
        }
        rows.push(row)
        return { data: [row], error: null }
      }
      if (mode === 'upsert') {
        const existing = rows.find((row) => row.workspace_id === payload.workspace_id)
        if (existing) Object.assign(existing, payload)
        else rows.push({ ...payload })
        return { data: [payload], error: null }
      }
      const hit = rows.filter((row) => filters.every((filter) => filter(row)))
      if (mode === 'update')
        for (const row of hit) Object.assign(row, payload, { updated_at: stamp() })
      return { data: hit.map((row) => ({ ...row })), error: null }
    }
    const builder: Record<string, unknown> = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      eq: (column: string, value: unknown) => (
        filters.push((row) => row[column] === value),
        builder
      ),
      in: (column: string, values: unknown[]) => (
        filters.push((row) => values.includes(row[column])),
        builder
      ),
      insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
      update: (row: Row) => ((mode = 'update'), (payload = row), builder),
      upsert: (row: Row) => ((mode = 'upsert'), (payload = row), builder),
      single: async () => {
        const result = run()
        return { data: result.data[0] ?? null, error: result.error }
      },
      maybeSingle: async () => {
        const result = run()
        return { data: result.data[0] ?? null, error: result.error }
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    }
    return builder
  }
  return { supabase: { from } }
})

import { aiPipelineRoutes } from '../routes/ai-pipeline.routes'
import { mcpRoutes } from '../routes/mcp.routes'

const OWNER = 'session-owner'
const MANAGER = 'session-manager'
const SELLER = 'session-seller'
/** A member whose custom role sees customers and products but may not issue invoices. */
const CLERK = 'session-clerk'
const STRANGER = 'session-stranger'

/** The books the stand-in routes serve. */
let books: {
  customers: Row[]
  products: Row[]
  open: Row[]
  invoiceTotalOverride: number | null
}
let reached: Array<{
  method: string
  url: string
  authorization: string
  workspace: unknown
  key: unknown
  body: unknown
}>
let server: FastifyInstance

const reply = (operation: string, fields: Row, uncertain: string[] = []) =>
  JSON.stringify({ operation, fields, uncertain })

beforeEach(async () => {
  tables.clear()
  state.sessions.clear()
  state.sessions.set(OWNER, { userId: 'owner', workspaceId: WS, role: 'owner' } satisfies Session)
  state.sessions.set(MANAGER, {
    userId: 'manager',
    workspaceId: WS,
    role: 'manager',
  } satisfies Session)
  state.sessions.set(SELLER, {
    userId: 'seller',
    workspaceId: WS,
    role: 'seller',
  } satisfies Session)
  state.sessions.set(CLERK, {
    userId: 'clerk',
    workspaceId: WS,
    role: 'seller',
    capabilities: new Set(['customer.read', 'product.read', 'invoice.read']),
  } satisfies Session)
  state.sessions.set(STRANGER, {
    userId: 'zed',
    workspaceId: OTHER_WS,
    role: 'owner',
  } satisfies Session)
  state.replies = []
  state.modelCalls = []
  state.configured = true
  state.limit = 5
  state.nextId = 1
  state.clock = 0
  reached = []
  books = {
    customers: [
      {
        id: AHMAD,
        fullName: 'احمد کریمی',
        phone: '0700123456',
        email: null,
        address: 'کابل',
        notes: null,
        type: 'cash',
        isActive: true,
        updatedAt: 'v1',
      },
      {
        id: AHMAD_2,
        fullName: 'احمد نوری',
        phone: null,
        email: null,
        address: null,
        notes: null,
        type: 'cash',
        isActive: true,
        updatedAt: 'v1',
      },
    ],
    products: [{ id: TEA, name: 'چای سبز', unit: 'kg', sellPrice: 450, quantity: 10 }],
    open: [
      {
        invoiceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        invoiceNumber: 'INV-0007',
        outstanding: 300,
      },
    ],
    invoiceTotalOverride: null,
  }

  server = Fastify()
  server.addHook('preHandler', async (request) => {
    if (request.url.startsWith('/api/ai/pipeline') || request.url.startsWith('/api/ai-requests'))
      return
    reached.push({
      method: request.method,
      url: request.url,
      authorization: String(request.headers.authorization ?? ''),
      workspace: request.headers['x-workspace-id'],
      key: request.headers['idempotency-key'],
      body: request.body,
    })
  })

  const matching = (rows: Row[], field: string, search: unknown) =>
    rows.filter((row) => String(row[field]).includes(String(search ?? '')))
  server.get('/api/customers', async (request) => ({
    customers: matching(books.customers, 'fullName', (request.query as Row).search),
  }))
  server.get('/api/customers/:id', async (request, res) => {
    const found = books.customers.find((row) => row.id === (request.params as Row).id)
    return found ?? res.code(404).send({ error: 'Customer not found' })
  })
  server.post('/api/customers', async (request, res) => {
    const row = {
      id: '77777777-7777-4777-8777-777777777777',
      isActive: true,
      updatedAt: 'v1',
      ...(request.body as Row),
    }
    books.customers.push(row)
    return res.code(201).send(row)
  })
  server.patch('/api/customers/:id', async (request, res) => {
    const found = books.customers.find((row) => row.id === (request.params as Row).id)
    const { expectedUpdatedAt, ...changes } = request.body as Row
    if (!found) return res.code(404).send({ error: 'Customer not found' })
    // As CustomerService.update: the write lands only on the row that was read.
    if (expectedUpdatedAt !== undefined && found.updatedAt !== expectedUpdatedAt) {
      return res.code(409).send({ error: 'ConflictError', code: 'CUSTOMER_CHANGED' })
    }
    Object.assign(found, changes, { updatedAt: 'v2' })
    return found
  })
  server.get('/api/products', async (request) => ({
    products: matching(books.products, 'name', (request.query as Row).search),
  }))
  const invoices = new Map<string, Row>()
  server.post('/api/invoices', async (request, res) => {
    const body = request.body as { items: Array<{ totalPrice: number }>; customerId?: string }
    const key = String(request.headers['idempotency-key'])
    // As the invoice route: the same key answers with the invoice it made.
    const existing = invoices.get(key)
    if (existing) return res.code(200).send(existing)
    const total =
      books.invoiceTotalOverride ?? body.items.reduce((sum, line) => sum + line.totalPrice, 0)
    const row = {
      id: '88888888-8888-4888-8888-888888888888',
      invoiceNumber: 'INV-0042',
      total,
      items: body.items,
      customer: body.customerId ? { id: body.customerId } : null,
    }
    invoices.set(key, row)
    return res.code(201).send(row)
  })
  server.get('/api/invoices/:id', async () => [...invoices.values()][0] ?? {})
  server.get('/api/payments/open-invoices/customer/:id', async () => books.open)
  let payment: Row = {}
  server.post('/api/payments', async (request, res) => {
    payment = {
      id: '99999999-9999-4999-8999-999999999999',
      paymentNumber: 'PAY-0003',
      status: 'posted',
      ...(request.body as Row),
    }
    return res.code(201).send(payment)
  })
  server.get('/api/payments/:id', async () => payment)

  await server.register(aiPipelineRoutes)
  // THE approval queue lives beside the MCP gateway: one pair of routes for both origins.
  await server.register(mcpRoutes)
  await server.ready()
})

afterEach(async () => {
  await server.close()
})

const call = (method: 'GET' | 'POST' | 'PUT', url: string, session: string, body?: unknown) =>
  server.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${session}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  })

const enable = (autoApproveNonFinancial = false) =>
  call('PUT', '/api/ai/pipeline/settings', OWNER, { enabled: true, autoApproveNonFinancial })

const start = async (session: string, request: string, dryRun = false) => {
  const response = await call('POST', '/api/ai/pipeline/runs', session, { request, dryRun })
  const json = response.json() as any
  if (!json.run)
    require('fs').writeFileSync(
      'C:\\Users\\hamed\\Desktop\\hisabche\\backend-error.log',
      JSON.stringify(json, null, 2),
    )
  return { response, run: json.run as Row }
}
/** Approve or reject in THE queue: addressed by the request the run was queued as. */
const decide = (session: string, run: Row, decision: 'approve' | 'reject') =>
  call('POST', `/api/ai-requests/${String(run.requestId)}/${decision}`, session)
const approve = (session: string, run: Row) => decide(session, run, 'approve')
const queue = async (session: string) =>
  ((await call('GET', '/api/ai-requests?pending=1', session)).json() as { requests?: Row[] })
    .requests ?? []
const writes = () => reached.filter((entry) => entry.method !== 'GET')
const stages = (run: Row) =>
  (run.steps as Array<{ stage: string; outcome: string }>).map(
    (step) => `${step.stage}:${step.outcome}`,
  )

describe('the switch', () => {
  it('is OFF until an owner turns it on — and then nothing reaches the model', async () => {
    const settings = (await call('GET', '/api/ai/pipeline/settings', SELLER)).json()
    expect(settings).toMatchObject({
      enabled: false,
      autoApproveNonFinancial: false,
      available: true,
      canManage: false,
    })

    const { response } = await start(OWNER, 'یک مشتری بساز')
    expect(response.statusCode).toBe(403)
    expect(response.json().code).toBe('AI_PIPELINE_DISABLED')
    expect(state.modelCalls).toHaveLength(0)
    expect(tables.get('ai_pipeline_runs') ?? []).toHaveLength(0)
  })

  it('only the owner can turn it on', async () => {
    for (const session of [SELLER, MANAGER]) {
      const refused = await call('PUT', '/api/ai/pipeline/settings', session, {
        enabled: true,
        autoApproveNonFinancial: true,
      })
      expect(refused.statusCode).toBe(403)
      expect(refused.json().code).toBe('AI_PIPELINE_OWNER_ONLY')
    }
    expect((await enable()).json()).toMatchObject({
      enabled: true,
      autoApproveNonFinancial: false,
      canManage: true,
    })
  })

  it('turning it off stops an approval that was already waiting', async () => {
    await enable()
    state.replies.push(reply('create_customer', { fullName: 'محمود' }))
    const { run } = await start(SELLER, 'مشتری محمود را بساز')
    await call('PUT', '/api/ai/pipeline/settings', OWNER, {
      enabled: false,
      autoApproveNonFinancial: false,
    })
    expect((await approve(SELLER, run)).json().code).toBe('AI_PIPELINE_DISABLED')
    expect(writes()).toEqual([])
  })
})

describe('create_customer, end to end', () => {
  beforeEach(async () => {
    await enable()
  })

  it('proposes first — nothing is written until a person approves', async () => {
    state.replies.push(reply('create_customer', { fullName: 'محمود رحیمی', phone: '۰۷۹۹۰۰۰۱۱۱' }))
    const { response, run } = await start(SELLER, 'مشتری محمود رحیمی با شماره ۰۷۹۹۰۰۰۱۱۱ بساز')

    expect(response.statusCode).toBe(201)
    expect(run).toMatchObject({
      status: 'proposed',
      operation: 'create_customer',
      canApprove: true,
      needsApprover: false,
    })
    expect((run.proposal as { changes: Row[] }).changes).toEqual([
      { entity: 'customer', field: 'fullName', from: null, to: 'محمود رحیمی' },
      { entity: 'customer', field: 'type', from: null, to: 'cash' },
      { entity: 'customer', field: 'phone', from: null, to: '0799000111' },
    ])
    expect(stages(run)).toEqual([
      'understand:ok',
      'authorize:ok',
      'investigate:ok',
      'validate:ok',
      'propose:ok',
    ])
    expect(writes()).toEqual([])
    // The command is the server's; the client is shown the diff, not the body.
    expect(run.command).toBeUndefined()
    expect(run.workspaceId).toBeUndefined()
  })

  it('on approval runs the customer route as the approver, once, with the run as its key', async () => {
    state.replies.push(reply('create_customer', { fullName: 'محمود رحیمی' }))
    const { run } = await start(SELLER, 'مشتری محمود رحیمی را بساز')
    const done = (await approve(SELLER, run)).json().run as Row

    expect(writes()).toEqual([
      {
        method: 'POST',
        url: '/api/customers',
        authorization: `Bearer ${SELLER}`,
        workspace: WS,
        key: `aip-${run.id}`,
        body: { fullName: 'محمود رحیمی', type: 'cash' },
      },
    ])
    expect(done).toMatchObject({
      status: 'executed',
      approvedBy: 'seller',
      autoApproved: false,
      entityType: 'customer',
      entityId: '77777777-7777-4777-8777-777777777777',
      result: { number: 'محمود رحیمی', mismatches: [] },
    })
    expect(stages(done).slice(-3)).toEqual(['confirm:ok', 'execute:ok', 'verify:ok'])
  })

  it('a second approval, and an approval after a rejection, change nothing', async () => {
    state.replies.push(
      reply('create_customer', { fullName: 'محمود' }),
      reply('create_customer', { fullName: 'کریم' }),
    )
    const first = (await start(SELLER, 'محمود را بساز')).run
    await approve(SELLER, first)
    const again = await approve(SELLER, first)
    expect(again.statusCode).toBe(409)
    expect(again.json().code).toBe('AI_REQUEST_ALREADY_DECIDED')

    const second = (await start(SELLER, 'کریم را بساز')).run
    expect((await decide(SELLER, second, 'reject')).json().run.status).toBe('rejected')
    expect((await approve(SELLER, second)).statusCode).toBe(409)
    expect(writes()).toHaveLength(1)
  })
})

describe('a dry run', () => {
  it('stops at the proposal and can never be approved', async () => {
    await enable(true)
    state.replies.push(reply('create_customer', { fullName: 'محمود' }))
    const { run } = await start(OWNER, 'محمود را بساز', true)
    // Auto-approval is ON here and the proposal is clean: a dry run still does not run.
    expect(run).toMatchObject({ status: 'proposed', dryRun: true, canApprove: false })
    // It was never queued: there is no request anybody could approve.
    expect(run.requestId).toBeNull()
    expect(tables.get('ai_action_requests') ?? []).toEqual([])
    expect(await queue(OWNER)).toEqual([])
    expect(writes()).toEqual([])
  })
})

describe('asking for what is missing', () => {
  beforeEach(async () => {
    await enable()
  })

  it('an ambiguous customer is a question; only an offered choice answers it', async () => {
    state.replies.push(
      reply('create_invoice', {
        customerName: 'احمد',
        items: [{ productName: 'چای سبز', quantity: 2 }],
      }),
    )
    const { run } = await start(SELLER, 'برای احمد دو کیلو چای سبز فاکتور کن')
    expect(run.status).toBe('needs_input')
    expect(run.questions).toMatchObject([{ id: 'customer', kind: 'choice', reason: 'ambiguous' }])
    expect(stages(run).at(-1)).toBe('ask:stopped')

    const answer = (answers: Row, session = SELLER) =>
      call('POST', `/api/ai/pipeline/runs/${run.id}/answers`, session, { answers })

    // A record that was never offered: the question simply stays open.
    const stranger = (await answer({ customer: '99999999-9999-4999-8999-999999999999' })).json()
      .run as Row
    expect(stranger.status).toBe('needs_input')
    // Somebody else cannot say what the requester meant.
    expect((await answer({ customer: AHMAD }, MANAGER)).json().code).toBe('AI_RUN_NOT_YOURS')

    const proposed = (await answer({ customer: AHMAD })).json().run as Row
    expect(proposed.status).toBe('proposed')
    expect((proposed.proposal as { subject: string }).subject).toBe('احمد کریمی')
    expect(writes()).toEqual([])
    // Three requests to the pipeline, ONE model call, ONE unit of the allowance.
    expect(state.modelCalls).toHaveLength(1)
    expect(tables.get('ai_query_log')).toHaveLength(1)
  })

  it('free text goes back to the model inside the same run, and is not charged again', async () => {
    state.replies.push(
      reply('create_invoice', {}),
      reply('create_invoice', { items: [{ productName: 'چای سبز', quantity: 2 }] }),
    )
    const { run } = await start(SELLER, 'یک فاکتور بزن')
    expect(run.questions).toMatchObject([{ id: 'items', kind: 'text' }])
    const proposed = (
      await call('POST', `/api/ai/pipeline/runs/${run.id}/answers`, SELLER, {
        answers: { items: 'دو کیلو چای سبز' },
      })
    ).json().run as Row
    expect(proposed.status).toBe('proposed')
    expect(state.modelCalls).toHaveLength(2)
    expect(state.modelCalls[1]?.user).toContain('دو کیلو چای سبز')
    expect(tables.get('ai_query_log')).toHaveLength(1)
  })
})

describe('create_invoice: money needs a person, and runs once', () => {
  beforeEach(async () => {
    await enable(true)
    state.replies.push(
      reply('create_invoice', {
        customerName: 'احمد کریمی',
        currency: 'AFN',
        items: [{ productName: 'چای سبز', quantity: 2 }],
      }),
    )
  })

  it('is never auto-approved, even with the setting on and a clean proposal', async () => {
    const { run } = await start(OWNER, 'برای احمد کریمی دو کیلو چای سبز فاکتور کن')
    expect(run).toMatchObject({ status: 'proposed', autoApproved: false })
    expect((run.proposal as { warnings: unknown[] }).warnings).toEqual([])
    expect(writes()).toEqual([])
  })

  it('five approvals at once issue ONE invoice', async () => {
    const { run } = await start(SELLER, 'برای احمد کریمی دو کیلو چای سبز فاکتور کن')
    const settled = await Promise.all(Array.from({ length: 5 }, () => approve(SELLER, run)))
    expect(settled.map((response) => response.statusCode).sort()).toEqual([200, 409, 409, 409, 409])
    expect(
      settled
        .filter((response) => response.statusCode === 409)
        .map((response) => response.json().code),
    ).toEqual(Array(4).fill('AI_REQUEST_ALREADY_DECIDED'))
    const posts = writes()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ url: '/api/invoices', key: `aip-${run.id}` })
    expect((posts[0]?.body as { items: Row[] }).items).toEqual([
      {
        productId: TEA,
        productName: 'چای سبز',
        quantity: 2,
        unit: 'kg',
        unitPrice: 450,
        totalPrice: 900,
      },
    ])
  })

  it('when the books do not say what was agreed, the run says «needs review»', async () => {
    books.invoiceTotalOverride = 90
    const { run } = await start(SELLER, 'برای احمد کریمی دو کیلو چای سبز فاکتور کن')
    const done = (await approve(SELLER, run)).json().run as Row
    expect(done.status).toBe('needs_review')
    expect((done.result as { mismatches: Row[] }).mismatches).toEqual([
      { field: 'total', expected: 900, actual: 90 },
    ])
    expect(stages(done).at(-1)).toBe('verify:failed')
  })
})

describe('who may approve', () => {
  beforeEach(async () => {
    await enable()
    state.replies.push(
      reply('create_invoice', {
        customerName: 'احمد کریمی',
        currency: 'AFN',
        items: [{ productName: 'چای سبز', quantity: 1 }],
      }),
    )
  })

  it('a member whose role cannot issue invoices can ask, but not approve — a manager does, as themselves', async () => {
    const { run } = await start(CLERK, 'برای احمد کریمی یک کیلو چای سبز فاکتور کن')
    expect(run).toMatchObject({ status: 'proposed', canApprove: false, needsApprover: true })

    const own = await approve(CLERK, run)
    expect(own.statusCode).toBe(403)
    expect(own.json().code).toBe('AI_REQUEST_NOT_ALLOWED')
    // …and a refused approval did not use the request up.
    expect(tables.get('ai_action_requests')?.[0]?.status).toBe('pending')
    expect(writes()).toEqual([])

    // The manager sees it waiting, and the write carries the MANAGER's session.
    const waiting = await queue(MANAGER)
    expect(waiting.map((entry) => entry.id)).toEqual([run.requestId])
    expect(waiting[0]).toMatchObject({
      tool: 'create_invoice',
      risk: 'financial',
      keyId: null,
      runId: run.id,
    })
    expect(waiting[0]?.run).toMatchObject({ id: run.id, canApprove: true, proposal: run.proposal })
    const done = (await approve(MANAGER, run)).json().run as Row
    expect(done).toMatchObject({ status: 'executed', approvedBy: 'manager' })
    expect(writes()[0]?.authorization).toBe(`Bearer ${MANAGER}`)
    // The queue row and the run closed together, with the same outcome.
    expect(tables.get('ai_action_requests')?.[0]).toMatchObject({
      status: 'executed',
      decided_by: 'manager',
      result_status: 201,
    })
  })

  it('a seller cannot approve another seller’s run, nor see it in their list', async () => {
    const { run } = await start(CLERK, 'برای احمد کریمی یک کیلو چای سبز فاکتور کن')
    const refused = await approve(SELLER, run)
    expect(refused.statusCode).toBe(403)
    expect(refused.json().code).toBe('AI_REQUEST_NOT_ALLOWED')
    expect((await decide(SELLER, run, 'reject')).statusCode).toBe(403)
    // The queue is a manager's to read.
    expect((await call('GET', '/api/ai-requests', SELLER)).statusCode).toBe(403)
    expect(writes()).toEqual([])
  })

  it('a run is invisible from another business', async () => {
    const { run } = await start(SELLER, 'برای احمد کریمی یک کیلو چای سبز فاکتور کن')
    tables
      .get('ai_pipeline_settings')
      ?.push({ workspace_id: OTHER_WS, enabled: true, auto_approve_non_financial: false })
    expect((await approve(STRANGER, run)).statusCode).toBe(404)
    expect((await decide(STRANGER, run, 'reject')).statusCode).toBe(404)
    expect(await queue(STRANGER)).toEqual([])
    expect(writes()).toEqual([])
  })

  it('a member who may not even read what the plan needs is refused before anything is read', async () => {
    state.sessions.set('session-blind', {
      userId: 'blind',
      workspaceId: WS,
      role: 'seller',
      capabilities: new Set(['invoice.create']),
    } satisfies Session)
    const { run } = await start('session-blind', 'برای احمد کریمی یک کیلو چای سبز فاکتور کن')
    expect(run).toMatchObject({ status: 'refused', reasonCode: 'NOT_ALLOWED' })
    expect(reached).toEqual([])
  })
})

describe('register_payment and update_customer', () => {
  beforeEach(async () => {
    await enable(true)
  })

  it('a payment is proposed with what it settles, approved by a person, and read back', async () => {
    state.replies.push(
      reply('register_payment', {
        customerName: 'احمد کریمی',
        amount: 250,
        currency: 'AFN',
        invoiceNumber: 'INV-0007',
      }),
    )
    const { run } = await start(SELLER, 'احمد کریمی ۲۵۰ افغانی بابت فاکتور INV-0007 داد')
    expect(run.status).toBe('proposed')
    const done = (await approve(SELLER, run)).json().run as Row
    expect(writes()).toEqual([
      {
        method: 'POST',
        url: '/api/payments',
        authorization: `Bearer ${SELLER}`,
        workspace: WS,
        key: `aip-${run.id}`,
        body: {
          direction: 'in',
          partyType: 'customer',
          partyId: AHMAD,
          amount: 250,
          currency: 'AFN',
          method: 'cash',
          allocations: [{ invoiceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', amount: 250 }],
        },
      },
    ])
    expect(done).toMatchObject({
      status: 'executed',
      entityType: 'payment',
      result: { number: 'PAY-0003', mismatches: [] },
    })
  })

  it('a clean customer change may run by rule when the owner allowed it — and says it did', async () => {
    state.replies.push(
      reply('update_customer', { customerName: 'احمد کریمی', phone: '0799000111' }),
    )
    const { run } = await start(SELLER, 'شماره احمد کریمی را 0799000111 کن')
    expect(run).toMatchObject({ status: 'executed', autoApproved: true, approvedBy: 'seller' })
    expect(writes()).toEqual([
      {
        method: 'PATCH',
        url: `/api/customers/${AHMAD}`,
        authorization: `Bearer ${SELLER}`,
        workspace: WS,
        key: undefined,
        body: { phone: '0799000111', expectedUpdatedAt: 'v1' },
      },
    ])
  })

  it('a fuzzy match is never run by rule', async () => {
    books.customers = books.customers.slice(0, 1)
    state.replies.push(reply('update_customer', { customerName: 'احمد', phone: '0799000111' }))
    const { run } = await start(SELLER, 'شماره احمد را 0799000111 کن')
    expect(run).toMatchObject({ status: 'proposed', autoApproved: false })
    expect(writes()).toEqual([])
  })

  it('a customer edited by a colleague after the proposal is NOT overwritten', async () => {
    await enable(false)
    state.replies.push(
      reply('update_customer', { customerName: 'احمد کریمی', phone: '0799000111' }),
    )
    const { run } = await start(SELLER, 'شماره احمد کریمی را 0799000111 کن')
    // Meanwhile, somebody saves the customer.
    Object.assign(books.customers[0] as Row, { phone: '0788555444', updatedAt: 'v2' })

    const done = (await approve(SELLER, run)).json().run as Row
    expect(done).toMatchObject({
      status: 'failed',
      reasonCode: 'CUSTOMER_CHANGED',
      resultStatus: 409,
    })
    expect(books.customers[0]?.phone).toBe('0788555444')
    expect(stages(done).at(-1)).toBe('execute:failed')
  })
})

describe('what the pipeline will not do', () => {
  beforeEach(async () => {
    await enable()
  })

  it('anything outside the four operations is refused, and nothing is read or written', async () => {
    state.replies.push('{"operation":"delete_invoice","fields":{"invoiceNumber":"INV-0007"}}')
    const { run } = await start(OWNER, 'فاکتور INV-0007 را حذف کن')
    expect(run).toMatchObject({
      status: 'refused',
      reasonCode: 'UNSUPPORTED_REQUEST',
      operation: null,
    })
    expect(reached).toEqual([])
    expect(stages(run)).toEqual(['understand:stopped'])
  })

  it('out of allowance: refused before the provider is called, with the contact', async () => {
    state.limit = 0
    const { response } = await start(OWNER, 'محمود را بساز')
    expect(response.statusCode).toBe(429)
    expect(response.json()).toMatchObject({ code: 'AI_QUOTA_EXCEEDED', topupContact: 'support' })
    expect(state.modelCalls).toHaveLength(0)
    expect(tables.get('ai_pipeline_runs') ?? []).toHaveLength(0)
  })

  it('no provider configured is said as such', async () => {
    state.configured = false
    const { response } = await start(OWNER, 'محمود را بساز')
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('AI_NOT_CONFIGURED')
  })

  it('a request without a session never reaches it', async () => {
    expect(
      (await call('POST', '/api/ai/pipeline/runs', 'nobody', { request: 'x' })).statusCode,
    ).toBe(401)
  })

  it('the request is bounded', async () => {
    const long = await call('POST', '/api/ai/pipeline/runs', OWNER, { request: 'x'.repeat(2001) })
    expect(long.statusCode).toBe(400)
    expect(state.modelCalls).toHaveLength(0)
  })
})

describe('ONE approval queue for both assistants', () => {
  beforeEach(async () => {
    await enable()
  })

  it('an in-app proposal and an outside assistant’s request wait in the same list', async () => {
    state.replies.push(reply('create_customer', { fullName: 'محمود' }))
    const { run } = await start(SELLER, 'محمود را بساز')
    // What the MCP gateway stores when a key asks for something risky.
    tables.get('ai_action_requests')?.push({
      id: '00000000-0000-4000-8000-00000000aaaa',
      workspace_id: WS,
      key_id: 'key-1',
      run_id: null,
      requested_by: 'seller',
      tool: 'cancel_order',
      risk: 'destructive',
      arguments: { orderId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      status: 'pending',
      result_status: null,
      result: null,
      decided_by: null,
      decided_at: null,
      created_at: new Date(Date.now()).toISOString(),
    })

    const waiting = await queue(MANAGER)
    expect(waiting.map((entry) => entry.tool).sort()).toEqual(['cancel_order', 'create_customer'])
    const inApp = waiting.find((entry) => entry.runId === run.id)
    expect(inApp).toMatchObject({ risk: 'write', keyId: null })
    expect((inApp?.run as Row).proposal).toEqual(run.proposal)
    // The outside request has no run to show: it is shown as what was sent.
    expect(waiting.find((entry) => entry.keyId === 'key-1')?.run).toBeUndefined()
  })

  it('the person who asked through a key cannot approve it themselves; their own in-app request they can', async () => {
    tables.set('ai_action_requests', [
      {
        id: '00000000-0000-4000-8000-00000000bbbb',
        workspace_id: WS,
        key_id: 'key-1',
        run_id: null,
        requested_by: 'seller',
        tool: 'create_invoice',
        risk: 'financial',
        arguments: { invoice: {} },
        status: 'pending',
        result_status: null,
        result: null,
        decided_by: null,
        decided_at: null,
        created_at: new Date(Date.now()).toISOString(),
      },
    ])
    const viaKey = await call(
      'POST',
      '/api/ai-requests/00000000-0000-4000-8000-00000000bbbb/approve',
      SELLER,
    )
    expect(viaKey.statusCode).toBe(403)
    expect(viaKey.json().code).toBe('AI_REQUEST_NOT_ALLOWED')

    state.replies.push(reply('create_customer', { fullName: 'محمود' }))
    const { run } = await start(SELLER, 'محمود را بساز')
    expect((await approve(SELLER, run)).json().run.status).toBe('executed')
  })

  it('rejecting in the queue ends the run, and it cannot be approved afterwards', async () => {
    state.replies.push(reply('create_customer', { fullName: 'محمود' }))
    const { run } = await start(SELLER, 'محمود را بساز')
    const rejected = (await decide(MANAGER, run, 'reject')).json() as Row
    expect(rejected).toMatchObject({ status: 'rejected', decidedBy: 'manager' })
    expect((rejected.run as Row).status).toBe('rejected')
    const late = await approve(SELLER, run)
    expect(late.statusCode).toBe(409)
    expect(late.json().code).toBe('AI_REQUEST_ALREADY_DECIDED')
    expect(writes()).toEqual([])
  })

  it('approval by rule goes through the same queue row', async () => {
    await enable(true)
    state.replies.push(reply('create_customer', { fullName: 'محمود' }))
    const { run } = await start(SELLER, 'محمود را بساز')
    expect(run).toMatchObject({ status: 'executed', autoApproved: true })
    expect(tables.get('ai_action_requests')).toHaveLength(1)
    expect(tables.get('ai_action_requests')?.[0]).toMatchObject({
      id: run.requestId,
      run_id: run.id,
      status: 'executed',
      decided_by: 'seller',
    })
  })

  it('an unfinished run is cancelled by the person who asked — it was never in the queue', async () => {
    state.replies.push(reply('create_invoice', {}))
    const { run } = await start(SELLER, 'یک فاکتور بزن')
    expect(run.status).toBe('needs_input')
    expect((await call('POST', `/api/ai/pipeline/runs/${run.id}/cancel`, MANAGER)).statusCode).toBe(
      404,
    )
    const cancelled = (await call('POST', `/api/ai/pipeline/runs/${run.id}/cancel`, SELLER)).json()
      .run as Row
    expect(cancelled.status).toBe('rejected')
    expect(tables.get('ai_action_requests') ?? []).toEqual([])
  })
})
