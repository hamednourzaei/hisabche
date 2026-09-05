// ============================================
// IDOR — cross-workspace object reference.
//
// Every test here hands a service a REAL id that belongs to ANOTHER workspace
// and asserts nothing comes back and nothing is written. These are not
// hypotheticals: three of the defects this suite pins were live in this
// codebase — an unscoped transaction list, an invoice that accepted any
// customer id, and a stock update that moved another shop's inventory.
//
// The fake PostgREST below enforces filters faithfully, because that is the
// whole property under test. If a service forgets `.eq('workspace_id', …)`,
// the fake returns the foreign row exactly as the real database would, and
// the test fails. A mock that returned empty by default would pass every one
// of these while the production code leaked.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* ── A small in-memory PostgREST that honours filters ───────────────────── */

type Row = Record<string, unknown>

const tables = new Map<string, Row[]>()

const TABLE_NAMES = [
  'invoices',
  'invoice_items',
  'invoice_item_details',
  'customers',
  'products',
  'transactions',
  'transactions_view',
  'stock_movements',
  'workspace_members',
  'activities',
  'notifications',
  'accounts',
  'workflows',
  'profiles',
  'users',
]

function reset(): void {
  tables.clear()
  for (const name of TABLE_NAMES) tables.set(name, [])
}

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const created: Row[] = []
  tables.set(table, created)
  return created
}

interface Filter {
  kind: 'eq' | 'neq' | 'in' | 'is'
  column: string
  value: unknown
}

function passes(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const actual = row[f.column]
    if (f.kind === 'eq') return actual === f.value
    if (f.kind === 'neq') return actual !== f.value
    if (f.kind === 'is') return actual === f.value
    if (f.kind === 'in') return (f.value as unknown[]).includes(actual)
    return true
  })
}

/**
 * Every query issued during a test, with the filters it carried.
 *
 * This exists because outcome-only assertions pass for the wrong reason. A
 * mutation test proved it: removing the workspace filter from
 * `CustomerService.getById` did NOT fail this suite, because getById also
 * awaits getBalance in parallel and THAT threw first. The unscoped read really
 * did happen; nothing observed it.
 *
 * So the invariant is checked where it actually lives — on the query.
 */
const queryLog: Array<{ table: string; filters: Filter[]; kind: string }> = []

const SHARED_TABLES = ['invoices', 'customers', 'products', 'transactions']

function assertEverySharedQueryWasScoped(): void {
  const unscoped = queryLog.filter(
    (q) =>
      SHARED_TABLES.includes(q.table) &&
      // An insert carries no filters — its tenancy is in the VALUES, which the
      // "carries both ids" tests assert separately.
      q.kind !== 'insert' &&
      !q.filters.some((f) => f.column === 'workspace_id' && f.kind === 'eq'),
  )

  expect(
    unscoped.map((q) => `${q.kind} ${q.table} [${q.filters.map((f) => f.column).join(', ')}]`),
    'every query against a shared business entity must carry .eq("workspace_id", …)',
  ).toEqual([])
}

function makeQuery(table: string) {
  const filters: Filter[] = []
  let pending: { kind: 'insert' | 'update' | 'delete'; values?: Row | Row[] } | null = null
  let limitN = Infinity

  const selected = () =>
    rowsOf(table)
      .filter((r) => passes(r, filters))
      .slice(0, limitN)

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      filters.push({ kind: 'eq', column, value })
      return api
    },
    neq: (column: string, value: unknown) => {
      filters.push({ kind: 'neq', column, value })
      return api
    },
    is: (column: string, value: unknown) => {
      filters.push({ kind: 'is', column, value })
      return api
    },
    in: (column: string, value: unknown[]) => {
      filters.push({ kind: 'in', column, value })
      return api
    },
    gt: () => api,
    gte: () => api,
    lt: () => api,
    lte: () => api,
    ilike: () => api,
    order: () => api,
    range: () => api,
    limit: (n: number) => {
      limitN = n
      return api
    },
    insert: (values: Row | Row[]) => {
      pending = { kind: 'insert', values }
      return api
    },
    update: (values: Row) => {
      pending = { kind: 'update', values }
      return api
    },
    delete: () => {
      pending = { kind: 'delete' }
      return api
    },

    // maybeSingle resolves without going through commit(), so it logs itself.
    maybeSingle: async () => {
      queryLog.push({ table, filters: [...filters], kind: 'select' })
      return { data: selected()[0] ?? null, error: null }
    },

    single: async () => {
      const outcome = await (api.commit as () => Promise<{ data: unknown; error: unknown }>)()
      if (outcome.error) return outcome
      const list = Array.isArray(outcome.data) ? outcome.data : [outcome.data]
      const first = list[0] ?? null
      if (!first) return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      return { data: first, error: null }
    },

    then: (resolve: (v: { data: unknown; error: unknown; count?: number }) => unknown) =>
      (api.commit as () => Promise<{ data: unknown; error: unknown }>)().then(resolve),

    commit: async () => {
      // Record BEFORE running: an insert carries no filters but still names a
      // table, and a read that returns nothing is exactly the case we must be
      // able to tell apart from a read that was properly scoped.
      queryLog.push({ table, filters: [...filters], kind: pending?.kind ?? 'select' })

      if (!pending) {
        const found = selected()
        return { data: found, error: null, count: found.length }
      }

      if (pending.kind === 'insert') {
        const incoming = Array.isArray(pending.values) ? pending.values : [pending.values as Row]
        const inserted = incoming.map((v) => {
          const row: Row = { id: v.id ?? `generated-${rowsOf(table).length + 1}`, ...v }
          rowsOf(table).push(row)
          return row
        })
        return { data: inserted, error: null }
      }

      // ── The important part for an IDOR test ──
      // update and delete apply ONLY to rows the filters actually match. A
      // service that omitted the workspace filter therefore really does mutate
      // the foreign row, and the assertion really does catch it.
      const targets = rowsOf(table).filter((r) => passes(r, filters))

      if (pending.kind === 'update') {
        const patch = (pending.values ?? {}) as Row
        for (const row of targets) Object.assign(row, patch)
        return { data: targets, error: null }
      }

      const survivors = rowsOf(table).filter((r) => !passes(r, filters))
      tables.set(table, survivors)
      return { data: targets, error: null }
    },
  }

  return api
}

vi.mock('../db', () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}))

vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: async () => null,
    set: async () => undefined,
    invalidate: async () => undefined,
  },
}))

const { CustomerService } = await import('../services/customer.service')
const { ProductService } = await import('../services/product.service')
const { InvoiceService } = await import('../services/invoice.service')

/* ── Two shops that must never see each other ───────────────────────────── */

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'

const CTX_A = { workspaceId: WS_A, userId: 'user-a', role: 'owner' } as const
const CTX_B = { workspaceId: WS_B, userId: 'user-b', role: 'owner' } as const

const B_CUSTOMER = 'customer-of-b'
const B_PRODUCT = 'product-of-b'
const B_INVOICE = 'invoice-of-b'
const B_TRANSACTION = 'transaction-of-b'

/**
 * Applied after EVERY test in this file, not just the denial ones.
 *
 * The outcome assertions say "no foreign data came back". This says "no
 * unscoped query was issued at all" — a strictly stronger claim, and the one
 * that survives a service accidentally being saved by an unrelated throw.
 */
afterEach(() => {
  assertEverySharedQueryWasScoped()
})

beforeEach(() => {
  reset()
  queryLog.length = 0

  rowsOf('customers').push(
    {
      id: 'customer-of-a',
      workspace_id: WS_A,
      user_id: 'user-a',
      full_name: 'مشتری الف',
      is_active: true,
    },
    {
      id: B_CUSTOMER,
      workspace_id: WS_B,
      user_id: 'user-b',
      full_name: 'مشتری ب',
      phone: '0700',
      is_active: true,
    },
  )

  rowsOf('products').push(
    {
      id: 'product-of-a',
      workspace_id: WS_A,
      user_id: 'user-a',
      name: 'کالای الف',
      quantity: 10,
      buy_price: 5,
    },
    {
      id: B_PRODUCT,
      workspace_id: WS_B,
      user_id: 'user-b',
      name: 'کالای ب',
      quantity: 100,
      buy_price: 7,
    },
  )

  rowsOf('invoices').push(
    {
      id: 'invoice-of-a',
      workspace_id: WS_A,
      user_id: 'user-a',
      invoice_number: 'A-1',
      total: 100,
      type: 'sale',
    },
    {
      id: B_INVOICE,
      workspace_id: WS_B,
      user_id: 'user-b',
      invoice_number: 'B-1',
      total: 999,
      type: 'sale',
    },
  )

  rowsOf('transactions').push(
    {
      id: 'transaction-of-a',
      workspace_id: WS_A,
      user_id: 'user-a',
      customer_id: 'customer-of-a',
      amount: 50,
      type: 'sale',
    },
    {
      id: B_TRANSACTION,
      workspace_id: WS_B,
      user_id: 'user-b',
      customer_id: B_CUSTOMER,
      amount: 500,
      type: 'sale',
    },
  )
})

/** Either an authorization/not-found throw, or a null result. Never data. */
async function deniedOrEmpty(run: () => Promise<unknown>): Promise<void> {
  let result: unknown
  try {
    result = await run()
  } catch {
    return // threw — denied
  }
  expect(result ?? null).toBeNull()
}

/* ═══════════════════════════════════════════════════════════════════════════
   Reading a foreign object by id
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a foreign id never returns data', () => {
  it('foreign customer id', async () => {
    await deniedOrEmpty(() => new CustomerService().getById(B_CUSTOMER, CTX_A))
  })

  it('foreign product id', async () => {
    await deniedOrEmpty(() => new ProductService().getById(B_PRODUCT, CTX_A))
  })

  it('foreign invoice id', async () => {
    await deniedOrEmpty(() => new InvoiceService().getById(B_INVOICE, CTX_A))
  })

  it('foreign customer balance', async () => {
    // The balance endpoint sums transactions. It must establish that the
    // customer is in this workspace FIRST, or it reports another shop's
    // receivables as a plain number with no row ever crossing the boundary.
    await deniedOrEmpty(() => new CustomerService().getBalance(B_CUSTOMER, CTX_A))
  })

  it('a list shows only this workspace', async () => {
    const customers = await new CustomerService().list(CTX_A, {} as never)
    const ids = (customers as { customers: Array<{ id: string }> }).customers.map((c) => c.id)

    expect(ids).toContain('customer-of-a')
    expect(ids).not.toContain(B_CUSTOMER)
  })

  it('the OTHER workspace sees the mirror image', async () => {
    // Guards against a filter that happens to be right for A by accident.
    const customers = await new CustomerService().list(CTX_B, {} as never)
    const ids = (customers as { customers: Array<{ id: string }> }).customers.map((c) => c.id)

    expect(ids).toEqual([B_CUSTOMER])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Mutating a foreign object by id
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a foreign id never mutates', () => {
  it('foreign customer update leaves the row untouched', async () => {
    await deniedOrEmpty(() =>
      new CustomerService().update(B_CUSTOMER, CTX_A, { fullName: 'HACKED' } as never),
    )

    const row = rowsOf('customers').find((r) => r.id === B_CUSTOMER)
    expect(row?.full_name).toBe('مشتری ب')
  })

  it('foreign customer delete leaves the row present', async () => {
    await deniedOrEmpty(() => new CustomerService().delete(B_CUSTOMER, CTX_A))
    expect(rowsOf('customers').some((r) => r.id === B_CUSTOMER)).toBe(true)
  })

  it('foreign product update leaves the row untouched', async () => {
    await deniedOrEmpty(() =>
      new ProductService().update(B_PRODUCT, CTX_A, { name: 'HACKED' } as never),
    )

    const row = rowsOf('products').find((r) => r.id === B_PRODUCT)
    expect(row?.name).toBe('کالای ب')
  })

  it('foreign product delete leaves the row present', async () => {
    await deniedOrEmpty(() => new ProductService().delete(B_PRODUCT, CTX_A))
    expect(rowsOf('products').some((r) => r.id === B_PRODUCT)).toBe(true)
  })

  it('foreign invoice update leaves the row untouched', async () => {
    await deniedOrEmpty(() => new InvoiceService().update(B_INVOICE, CTX_A, { total: 1 } as never))

    const row = rowsOf('invoices').find((r) => r.id === B_INVOICE)
    expect(row?.total).toBe(999)
  })

  it('foreign invoice delete leaves the row present', async () => {
    await deniedOrEmpty(() => new InvoiceService().delete(B_INVOICE, CTX_A))
    expect(rowsOf('invoices').some((r) => r.id === B_INVOICE)).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Foreign ids supplied as RELATIONSHIPS on a create
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a foreign id supplied as a relationship is refused', () => {
  it('an invoice cannot reference another workspace customer', async () => {
    // This was live: `customerId` went straight into the lookup with no
    // workspace filter, so the other shop's customer name came back in the
    // activity feed and the invoice pointed across the boundary.
    await expect(
      new InvoiceService().create(CTX_A, {
        customerId: B_CUSTOMER,
        total: 10,
        items: [],
      } as never),
    ).rejects.toThrow()

    // and the half-created invoice must not survive the refusal
    const strays = rowsOf('invoices').filter((r) => r.workspace_id === WS_A && r.total === 10)
    expect(strays).toEqual([])
  })

  it('an invoice cannot move another workspace stock', async () => {
    // Also live: batchUpdateStock looked products up by id alone, so a foreign
    // productId decremented THEIR inventory.
    const before = rowsOf('products').find((r) => r.id === B_PRODUCT)?.quantity

    await new InvoiceService()
      .create(CTX_A, {
        total: 10,
        items: [{ productId: B_PRODUCT, quantity: 5, unitPrice: 2, totalPrice: 10 }],
      } as never)
      .catch(() => undefined)

    const after = rowsOf('products').find((r) => r.id === B_PRODUCT)?.quantity
    expect(after).toBe(before)
    expect(after).toBe(100)

    // PHASE C — and no movement was written against their product either.
    //
    // This is now the load-bearing half of the guard: the quantity is a
    // projection of the movements, so a movement naming B_PRODUCT would move
    // their stock no matter what this workspace's product rows say.
    expect(rowsOf('stock_movements').filter((r) => r.product_id === B_PRODUCT)).toEqual([])
  })

  it('own-workspace relationships still work', async () => {
    // A denial test suite that only proves things fail can be satisfied by a
    // service that always fails. This is the counterweight.
    const invoice = await new InvoiceService().create(CTX_A, {
      customerId: 'customer-of-a',
      total: 20,
      items: [{ productId: 'product-of-a', quantity: 2, unitPrice: 10, totalPrice: 20 }],
    } as never)

    expect(invoice).toBeTruthy()

    // PHASE C — the sale is asserted on the MOVEMENT, not on products.quantity.
    //
    // `products.quantity` is now a projection maintained by a database trigger
    // (stock_movements_project), so it does not move in a test that has no
    // database. Asserting it here would be asserting the fake's behaviour.
    //
    // The movement is what the service is now responsible for, and it is the
    // stronger assertion anyway: a sale of 2 leaves a −2 row naming this
    // workspace's product.
    const movements = rowsOf('stock_movements').filter(
      (r) => r.product_id === 'product-of-a' && r.workspace_id === WS_A,
    )
    expect(movements).toHaveLength(1)
    expect(movements[0]?.quantity).toBe(-2)
    expect(movements[0]?.type).toBe('sale')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Every write records the actor AND the tenant
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a financial row carries both ids', () => {
  it('a created customer has workspace_id and user_id', async () => {
    await new CustomerService().create(CTX_A, { fullName: 'تازه' } as never)

    const created = rowsOf('customers').find((r) => r.full_name === 'تازه')
    expect(created?.workspace_id).toBe(WS_A)
    expect(created?.user_id).toBe('user-a')
  })

  it('a created invoice has workspace_id and user_id', async () => {
    await new InvoiceService().create(CTX_A, { total: 33, items: [] } as never)

    const created = rowsOf('invoices').find((r) => r.total === 33)
    expect(created?.workspace_id).toBe(WS_A)
    expect(created?.user_id).toBe('user-a')
  })

  it('a created product has workspace_id and user_id', async () => {
    await new ProductService().create(CTX_A, { name: 'کالای تازه' } as never)

    const created = rowsOf('products').find((r) => r.name === 'کالای تازه')
    expect(created?.workspace_id).toBe(WS_A)
    expect(created?.user_id).toBe('user-a')
  })
})
