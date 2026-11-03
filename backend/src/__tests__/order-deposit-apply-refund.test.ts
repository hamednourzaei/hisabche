// ============================================
// backend/src/__tests__/order-deposit-apply-refund.test.ts
//
// The apply/refund HTTP path, through the REAL route and the REAL service.
// Only the database, the ledger and the books currency are replaced.
//
// What this file proves is the NODE side of the contract:
//   · the right Postgres function is called with the currency's precision
//     (AFN 0, USD 2) and the accounts resolved by ROLE;
//   · a refusal from the function arrives as the code the person can act on
//     (409 for «not enough left», 404 for a deposit/invoice that is not here);
//   · a replay returns 200 and the first result, not a second posting;
//   · nothing is sent to the database when the request is already malformed.
//
// The ATOMICITY itself cannot be proved here — it is proved by
// order-deposit-apply-refund-01.pg.test.ts and the PGlite scenarios against the
// real function in docs/order-deposit-apply-refund-01-migration.sql.
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state: {
  deposit: Row | null
  updated: Row[]
  rpcCalls: Array<{ name: string; params: Row }>
  rpcResult: { data: unknown; error: { message: string } | null }
  ensured: string[][]
  accounts: Record<string, string> | null
  postings: unknown[]
  /** A capability this test pretends the signed-in user does not hold. */
  deniedCapability: string | null
} = {
  deposit: null,
  updated: [],
  rpcCalls: [],
  rpcResult: { data: null, error: null },
  ensured: [],
  accounts: null,
  postings: [],
  deniedCapability: null,
}

/** Every capability the route layer asked for while the app was built. */
const capabilities: string[] = []

/** The chainable query builder supabase-js returns; every call resolves to the fixture. */
function fromChain() {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.eq = self
  chain.update = (values: Row) => {
    state.updated.push(values)
    return chain
  }
  chain.maybeSingle = async () => ({ data: state.deposit, error: null })
  chain.single = async () => ({
    data: state.deposit ? { ...state.deposit, ...(state.updated.at(-1) ?? {}) } : null,
    error: null,
  })
  return chain
}

vi.mock('../db', () => ({
  supabase: {
    from: () => fromChain(),
    rpc: async (name: string, params: Row) => {
      state.rpcCalls.push({ name, params })
      return state.rpcResult
    },
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { user?: unknown }) => {
    request.user = { id: 'u-1' }
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: 'ws-1', userId: 'u-1', role: 'manager' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability:
    (capability: string) =>
    async (
      _request: unknown,
      reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    ) => {
      capabilities.push(capability)
      // The real middleware refuses before the handler runs; this fake refuses the
      // same way so the route's own guard can be observed from outside.
      if (state.deniedCapability === capability) {
        await reply.code(403).send({ error: 'Forbidden', code: 'FORBIDDEN' })
      }
      return undefined
    },
}))

vi.mock('../services/accounting', () => ({
  ledger: {
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => {
      state.ensured.push(roles)
      if (state.accounts) return { accounts: state.accounts, missing: [] }
      return { accounts: {}, missing: ['customer_advances'] }
    },
    postDocument: async (_ctx: unknown, request: unknown) => {
      state.postings.push(request)
      return { status: 'posted', entryId: 'je-receipt', entryNumber: 'JV-0001' }
    },
  },
}))

vi.mock('../services/base-currency', () => ({
  baseCurrencyOf: async () => 'AFN',
}))

// The cache layer talks to Redis; it is not what this test is about.
vi.mock('../utils/money-cache', () => ({
  invalidateMoneyCaches: async () => undefined,
}))

import { orderDepositRoutes } from '../routes/order-deposit.routes'
import { CAPABILITIES } from '../services/authorization/authorization.domain'

function build() {
  const app = Fastify()
  app.register(orderDepositRoutes)
  return app
}

const ORDER = '00000000-0000-4000-8000-0000000000aa'
const DEPOSIT = '20000000-0000-4000-8000-000000000001'
const INVOICE = '30000000-0000-4000-8000-000000000001'
const KEY = 'idem-key-apply-0001'

const depositRow = (overrides: Row = {}): Row => ({
  id: DEPOSIT,
  workspace_id: 'ws-1',
  order_id: ORDER,
  customer_id: 'c0000000-0000-4000-8000-000000000001',
  amount_minor: 100_000,
  payment_method: 'cash',
  applied_invoice_id: null,
  currency: 'AFN',
  posting_status: 'posted',
  journal_entry_id: 'je-receipt',
  created_at: '2026-11-03T00:00:00Z',
  ...overrides,
})

const appliedJson = {
  replayed: false,
  application_id: 'app-1',
  deposit_id: DEPOSIT,
  invoice_id: INVOICE,
  amount_minor: 40_000,
  currency: 'AFN',
  payment_id: 'pay-1',
  payment_number: 'PMT-2026-000001',
  journal_entry_id: 'je-apply',
  entry_number: 'JV-2026-000009',
  balance: {
    deposit_id: DEPOSIT,
    amount_minor: 100_000,
    applied_minor: 40_000,
    refunded_minor: 0,
    remaining_minor: 60_000,
  },
}

const refundedJson = {
  replayed: false,
  refund_id: 'ref-1',
  deposit_id: DEPOSIT,
  amount_minor: 25_000,
  currency: 'AFN',
  method: 'cash',
  reason: 'customer changed the order',
  payment_id: 'pay-2',
  payment_number: 'PMT-2026-000002',
  journal_entry_id: 'je-refund',
  entry_number: 'JV-2026-000010',
  balance: {
    deposit_id: DEPOSIT,
    amount_minor: 100_000,
    applied_minor: 0,
    refunded_minor: 25_000,
    remaining_minor: 75_000,
  },
}

beforeEach(() => {
  state.deposit = depositRow()
  state.updated = []
  state.rpcCalls = []
  state.rpcResult = { data: appliedJson, error: null }
  state.ensured = []
  state.accounts = {
    cash: 'acc-cash',
    bank: 'acc-bank',
    customer_advances: 'acc-adv',
    receivable: 'acc-rec',
  }
  state.postings = []
  state.deniedCapability = null
  capabilities.length = 0
})

describe('POST /api/orders/:id/deposits/:depositId/apply', () => {
  it('calls one atomic function with the AFN precision and the role-resolved accounts', async () => {
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })

    expect(response.statusCode).toBe(201)
    expect(state.rpcCalls).toHaveLength(1)
    const call = state.rpcCalls[0]!
    expect(call.name).toBe('order_deposit_apply')
    expect(call.params).toMatchObject({
      p_workspace_id: 'ws-1',
      p_user_id: 'u-1',
      p_deposit_id: DEPOSIT,
      p_invoice_id: INVOICE,
      p_amount_minor: 40_000,
      // AFN counts no decimals: the ledger books 40,000, not 400.00.
      p_fraction_digits: 0,
      p_idempotency_key: KEY,
      p_advances_account_id: 'acc-adv',
      p_receivable_account_id: 'acc-rec',
      p_actor_role: 'manager',
    })
    expect(String(call.params.p_entry_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // camelCase out, and the balance is what the database counted.
    expect(response.json().data).toMatchObject({
      replayed: false,
      applicationId: 'app-1',
      invoiceId: INVOICE,
      amountMinor: 40_000,
      paymentId: 'pay-1',
      journalEntryId: 'je-apply',
      balance: { appliedMinor: 40_000, remainingMinor: 60_000 },
    })
    await app.close()
  })

  it('uses the USD precision (two decimals) rather than a hardcoded divisor', async () => {
    state.deposit = depositRow({ currency: 'USD' })
    const app = build()
    await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 12_345, idempotencyKey: KEY },
    })
    expect(state.rpcCalls[0]?.params.p_fraction_digits).toBe(2)
    await app.close()
  })

  it('a replay answers 200 with the first result instead of posting again', async () => {
    state.rpcResult = { data: { ...appliedJson, replayed: true }, error: null }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.replayed).toBe(true)
    await app.close()
  })

  it('refuses a malformed key before touching the database', async () => {
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: 'short' },
    })
    expect(response.statusCode).toBe(400)
    expect(state.rpcCalls).toHaveLength(0)
    await app.close()
  })

  it('refuses a deposit whose currency is UNKNOWN instead of guessing two decimals', async () => {
    state.deposit = depositRow({ currency: null })
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('DEPOSIT_CURRENCY_UNKNOWN')
    expect(state.rpcCalls).toHaveLength(0)
    await app.close()
  })

  it('names the missing accounts and does not post anything', async () => {
    state.accounts = null
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('DEPOSIT_ACCOUNTS_MISSING')
    expect(state.rpcCalls).toHaveLength(0)
    await app.close()
  })

  it.each([
    'DEPOSIT_INSUFFICIENT_BALANCE',
    'DEPOSIT_APPLY_EXCEEDS_INVOICE',
    'DEPOSIT_INVOICE_NOT_FINAL',
    'DEPOSIT_INVOICE_NOT_POSTED',
    'DEPOSIT_CUSTOMER_MISMATCH',
    'DEPOSIT_PENDING_POSTING',
    'DEPOSIT_IDEMPOTENCY_CONFLICT',
  ])('a %s refusal from the function reaches the client as 409 with its code', async (code) => {
    state.rpcResult = { data: null, error: { message: `${code}: refused by the database` } }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe(code)
    await app.close()
  })

  // A missing invoice and an invoice in another workspace answer the same way
  // on purpose: from this workspace there is no such invoice. The rest of the
  // server reports that as NotFoundError, and so does this.
  it('a DEPOSIT_INVOICE_NOT_FOUND refusal is a 404', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'DEPOSIT_INVOICE_NOT_FOUND: no such invoice' },
    }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })
    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('a deposit outside this workspace or order is a 404, and nothing is called', async () => {
    state.deposit = null
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/apply`,
      payload: { invoiceId: INVOICE, amountMinor: 40_000, idempotencyKey: KEY },
    })
    expect(response.statusCode).toBe(404)
    expect(state.rpcCalls).toHaveLength(0)
    await app.close()
  })
})

describe('POST /api/orders/:id/deposits/:depositId/refund', () => {
  beforeEach(() => {
    state.rpcResult = { data: refundedJson, error: null }
  })

  it('calls the refund function with the reason, the deposit method and the money account', async () => {
    state.deposit = depositRow({ payment_method: 'bank' })
    state.rpcResult = {
      data: { ...refundedJson, method: 'bank', reason: 'customer cancelled the order' },
      error: null,
    }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'customer cancelled the order',
      },
    })

    expect(response.statusCode).toBe(201)
    const call = state.rpcCalls[0]!
    expect(call.name).toBe('order_deposit_refund')
    expect(call.params).toMatchObject({
      p_amount_minor: 25_000,
      p_fraction_digits: 0,
      p_method: 'bank',
      p_reason: 'customer cancelled the order',
      p_advances_account_id: 'acc-adv',
      p_money_account_id: 'acc-bank',
      p_idempotency_key: 'idem-key-refund-1',
    })
    expect(response.json().data).toMatchObject({
      refundId: 'ref-1',
      amountMinor: 25_000,
      method: 'bank',
      reason: 'customer cancelled the order',
      paymentId: 'pay-2',
      balance: { refundedMinor: 25_000, remainingMinor: 75_000 },
    })
    await app.close()
  })

  it('uses the canonical payment.record capability and no payment.refund', async () => {
    // Canonical definitions, not a guess: recording a payment is what a refund
    // is, and there is no separate refund permission anywhere in the codebase.
    expect(CAPABILITIES).toContain('payment.record')
    expect(CAPABILITIES).not.toContain('payment.refund')

    const app = build()
    await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'customer changed the order',
      },
    })
    expect(capabilities).toContain('payment.record')
    await app.close()
  })

  it('refuses an unauthorized user with 403 and calls nothing', async () => {
    state.deniedCapability = 'payment.record'
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'customer changed the order',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(state.rpcCalls).toHaveLength(0)
    await app.close()
  })

  it.each([
    ['missing', { amountMinor: 25_000, idempotencyKey: 'idem-key-refund-1' }],
    ['blank', { amountMinor: 25_000, idempotencyKey: 'idem-key-refund-1', reason: '   ' }],
    ['too short', { amountMinor: 25_000, idempotencyKey: 'idem-key-refund-1', reason: 'no' }],
    [
      'too long',
      {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'x'.repeat(501),
      },
    ],
  ])('refuses a %s reason with 400 before any SQL runs', async (_label, payload) => {
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload,
    })
    expect(response.statusCode).toBe(400)
    expect(state.rpcCalls).toHaveLength(0)
    await app.close()
  })

  it('refuses a refund larger than the remaining balance with 409', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'DEPOSIT_INSUFFICIENT_BALANCE: not enough left' },
    }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 200_000,
        idempotencyKey: 'idem-key-refund-2',
        reason: 'customer wants the money back',
      },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('DEPOSIT_INSUFFICIENT_BALANCE')
    await app.close()
  })

  it('a refund replay answers 200 and pays nothing twice', async () => {
    state.rpcResult = { data: { ...refundedJson, replayed: true }, error: null }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'customer changed the order',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.replayed).toBe(true)
    await app.close()
  })

  it('a refund whose journal is missing is a 409, never a completed refund', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'DEPOSIT_REFUND_NOT_POSTED: no posted entry' },
    }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-3',
        reason: 'customer changed the order',
      },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('DEPOSIT_REFUND_NOT_POSTED')
    await app.close()
  })

  it('maps a reason the database refuses onto 400, not 409', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'DEPOSIT_REFUND_REASON_REQUIRED: no reason' },
    }
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/refund`,
      payload: {
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-4',
        reason: 'customer changed the order',
      },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('DEPOSIT_REFUND_REASON_REQUIRED')
    await app.close()
  })
})

describe('POST /api/orders/:id/deposits/:depositId/post (receipt recovery)', () => {
  it('re-posts the receipt and records posting_status = posted', async () => {
    state.deposit = depositRow({ journal_entry_id: null, posting_status: 'pending_posting' })
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/post`,
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    expect(state.postings).toHaveLength(1)
    expect(state.updated.at(-1)).toMatchObject({
      posting_status: 'posted',
      journal_entry_id: 'je-receipt',
    })
    expect(response.json().posting).toMatchObject({ status: 'posted', entryId: 'je-receipt' })
    await app.close()
  })

  it('leaves the explicit pending_posting state when the chart still cannot express it', async () => {
    state.deposit = depositRow({ journal_entry_id: null, posting_status: 'pending_posting' })
    state.accounts = null
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits/${DEPOSIT}/post`,
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    expect(state.updated.at(-1)).toMatchObject({
      posting_status: 'pending_posting',
      journal_entry_id: null,
    })
    expect(response.json().posting).toMatchObject({ status: 'skipped', reason: 'missing_accounts' })
    await app.close()
  })
})
