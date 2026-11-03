// ============================================
// apps/mobile/src/host/__tests__/order-deposit-parity.test.ts
//
// Customer deposits on Android.
//
// The mobile app does not draw its own screens: it hosts `@hisabche/app-shell`
// in a WebView, so the customer screen — and the deposit panel inside its
// payments tab — is the same component the desktop shows. What IS different is
// the SQLite adapter underneath: `wrapExpoSqlite` over expo-sqlite instead of
// `node:sqlite`. This file runs the three deposit moves through BOTH adapters
// and requires the same answers: the same status codes, the same balances, the
// same ledger shape, and the same refusal in front of a viewer.
//
// ⚠️ THE IDS DIFFER BY DESIGN. Each device generates its own deposit id, so the
// requests are built per engine with that engine's id — the parity claim is
// about the RULES and the figures, not about two databases sharing a uuid.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DatabaseSync } from 'node:sqlite'
import { CREATE_STATEMENTS } from '@hisabche/app-bridge'
import {
  createLocalEngine,
  type LocalDb,
  type LocalEngine,
  type LocalEngineRequest,
  type LocalEngineResponse,
  type RunResult,
} from '@hisabche/local-engine'

import { wrapExpoSqlite, type ExpoSqliteDatabaseLike } from '../local-api'

const WORKSPACE = '11111111-1111-4111-8111-111111111111'
const OWNER = '22222222-2222-4222-8222-222222222222'
const VIEWER = '44444444-4444-4444-8444-444444444444'
const CUSTOMER = '55555555-5555-4555-8555-555555555555'
const ORDER = '66666666-6666-4666-8666-666666666666'
const INVOICE = '77777777-7777-4777-8777-777777777777'
const INVOICE_ENTRY = '88888888-8888-4888-8888-888888888888'

interface DepositView {
  id: string
  amountMinor: number
  appliedMinor: number
  refundedMinor: number
  remainingMinor: number
  currency: string | null
  status: string
  postingStatus: string | null
  journalEntryId: string | null
}

interface MovementView {
  replayed: boolean
  amountMinor: number
  journalEntryId: string | null
}

function createNodeDb(): LocalDb & { close: () => void } {
  const db = new DatabaseSync(':memory:')
  for (const statement of CREATE_STATEMENTS) db.exec(statement)
  let inTransaction = false
  return {
    close: () => db.close(),
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...(params as never[])) as T[]
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(...(params as never[])) as T | undefined
    },
    run(sql: string, params: unknown[] = []): RunResult {
      const result = db.prepare(sql).run(...(params as never[])) as {
        changes?: number
        lastInsertRowid?: number | bigint
      }
      return { changes: Number(result.changes) || 0, lastInsertRowid: result.lastInsertRowid }
    },
    exec(sql: string): void {
      db.exec(sql)
    },
    transaction<T>(fn: () => T): T {
      if (inTransaction) return fn()
      inTransaction = true
      db.exec('BEGIN')
      try {
        const value = fn()
        db.exec('COMMIT')
        return value
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      } finally {
        inTransaction = false
      }
    },
  }
}

/** expo-sqlite's API, backed by the same SQLite build so the comparison is fair. */
function createExpoDb(): ExpoSqliteDatabaseLike & { close: () => void } {
  const db = new DatabaseSync(':memory:')
  for (const statement of CREATE_STATEMENTS) db.exec(statement)
  return {
    close: () => db.close(),
    getAllSync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...(params as never[])) as T[]
    },
    getFirstSync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
      return (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null
    },
    runSync(sql: string, params: unknown[] = []) {
      const result = db.prepare(sql).run(...(params as never[])) as {
        changes?: number
        lastInsertRowid?: number | bigint
      }
      return { changes: Number(result.changes) || 0, lastInsertRowId: result.lastInsertRowid }
    },
    execSync(sql: string): void {
      db.exec(sql)
    },
    withTransactionSync(fn: () => void): void {
      db.exec('BEGIN')
      try {
        fn()
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

function seed(db: LocalDb): void {
  const now = '2026-11-01T00:00:00.000Z'
  db.run(
    `INSERT INTO local_workspace (id, name, base_currency, time_zone, created_at, updated_at)
     VALUES (?, 'فروشگاه موبایل', 'AFN', 'Asia/Kabul', ?, ?)`,
    [WORKSPACE, now, now],
  )
  db.run(
    `INSERT INTO local_user (id, email, full_name, role, created_at, updated_at)
     VALUES (?, 'owner@hisabche.local', 'مالک', 'owner', ?, ?)`,
    [OWNER, now, now],
  )
  db.run(
    `INSERT INTO local_user (id, email, full_name, role, created_at, updated_at)
     VALUES (?, 'viewer@hisabche.local', 'بیننده', 'viewer', ?, ?)`,
    [VIEWER, now, now],
  )
  db.run(
    `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
     VALUES (?, ?, 'احمد هروی', 1, ?, ?)`,
    [CUSTOMER, WORKSPACE, now, now],
  )
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total,
                          paid_amount, currency, status, updated_at)
     VALUES (?, ?, 'INV-M-1', 'sale', ?, '2026-10-01', 100000, 0, 'AFN', 'pending', ?)`,
    [INVOICE, WORKSPACE, CUSTOMER, now],
  )
  db.run(
    `INSERT INTO journal_entry (id, workspace_id, entry_number, date, description, reference,
                                status, source_type, source_id, posted_at, created_at, updated_at)
     VALUES (?, ?, 'J-M-INVOICE', '2026-10-01', 'sale', 'INV-M-1', 'posted',
             'invoice', ?, ?, ?, ?)`,
    [INVOICE_ENTRY, WORKSPACE, INVOICE, now, now, now],
  )
}

/** Every hosted request carries the signed-in user, exactly as the host bridge does. */
function signedIn(engine: LocalEngine, userId = OWNER): LocalEngine {
  return {
    routeTable: () => engine.routeTable(),
    request: <T = unknown>(req: LocalEngineRequest): Promise<LocalEngineResponse<T>> =>
      engine.request<T>({ ...req, headers: { 'x-user-id': userId, ...req.headers } }),
  }
}

const depositRequest = (): LocalEngineRequest => ({
  method: 'POST',
  path: `/orders/${ORDER}/deposits`,
  headers: { 'x-workspace-id': WORKSPACE },
  body: { customerId: CUSTOMER, amountMinor: 100_000, paymentMethod: 'cash' },
})

describe('Android: the deposit moves answer exactly like the desktop engine', () => {
  let nodeRaw: ReturnType<typeof createNodeDb>
  let expoRaw: ReturnType<typeof createExpoDb>
  let desktop: LocalEngine
  let mobile: LocalEngine
  let desktopDepositId = ''
  let mobileDepositId = ''

  beforeAll(() => {
    nodeRaw = createNodeDb()
    expoRaw = createExpoDb()
    seed(nodeRaw)
    seed(wrapExpoSqlite(expoRaw))

    desktop = signedIn(createLocalEngine(nodeRaw))
    mobile = signedIn(createLocalEngine(wrapExpoSqlite(expoRaw)))
  })

  afterAll(() => {
    nodeRaw.close()
    expoRaw.close()
  })

  /** One request, built with each engine's OWN deposit id, answered by both. */
  async function each<T>(
    make: (depositId: string) => LocalEngineRequest,
  ): Promise<[LocalEngineResponse<T>, LocalEngineResponse<T>]> {
    const [onDesktop, onMobile] = await Promise.all([
      desktop.request<T>(make(desktopDepositId)),
      mobile.request<T>(make(mobileDepositId)),
    ])
    expect(onMobile.status).toBe(onDesktop.status)
    return [onDesktop, onMobile]
  }

  /** A request that names no deposit: both engines answer their own data. */
  async function both<T>(
    req: LocalEngineRequest,
  ): Promise<[LocalEngineResponse<T>, LocalEngineResponse<T>]> {
    const [onDesktop, onMobile] = await Promise.all([
      desktop.request<T>(req),
      mobile.request<T>(req),
    ])
    expect(onMobile.status).toBe(onDesktop.status)
    return [onDesktop, onMobile]
  }

  const linesOf = (db: LocalDb, depositId: string) =>
    Object.fromEntries(
      db
        .all<{ role: string; debit: number; credit: number }>(
          `SELECT a.role AS role, l.debit AS debit, l.credit AS credit
             FROM journal_line l
             JOIN journal_entry je ON je.id = l.journal_id
             JOIN account a ON a.id = l.account_id
            WHERE je.workspace_id = ? AND je.source_type = 'order_deposit' AND je.source_id = ?`,
          [WORKSPACE, depositId],
        )
        .map((row) => [row.role, { debit: row.debit, credit: row.credit }]),
    )

  it('takes the receipt and books Dr cash / Cr customer advances on both adapters', async () => {
    const [onDesktop, onMobile] = await both<DepositView>(depositRequest())
    expect(onDesktop.status).toBe(201)

    desktopDepositId = onDesktop.data.id
    mobileDepositId = onMobile.data.id

    expect(onMobile.data).toMatchObject({
      amountMinor: 100_000,
      appliedMinor: 0,
      refundedMinor: 0,
      remainingMinor: 100_000,
      currency: 'AFN',
      postingStatus: 'posted',
      status: 'available',
    })
    expect(onMobile.data.journalEntryId).toBeTruthy()

    // The same ledger shape on the phone as on the laptop.
    const mobileLedger = linesOf(wrapExpoSqlite(expoRaw), mobileDepositId)
    expect(mobileLedger).toEqual({
      cash: { debit: 100_000, credit: 0 },
      customer_advances: { debit: 0, credit: 100_000 },
    })
    expect(linesOf(nodeRaw, desktopDepositId)).toEqual(mobileLedger)
  })

  it('applies 40 000 and refunds 10 000 with the same figures on both', async () => {
    const [applyDesktop, applyMobile] = await each<MovementView>((depositId) => ({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${depositId}/apply`,
      headers: { 'x-workspace-id': WORKSPACE },
      body: {
        invoiceId: INVOICE,
        amountMinor: 40_000,
        idempotencyKey: 'mobile-apply-0001',
        date: '2026-11-03',
      },
    }))
    expect(applyDesktop.status).toBe(201)
    expect(applyMobile.data).toMatchObject({ replayed: false, amountMinor: 40_000 })
    expect(applyMobile.data.journalEntryId).toBeTruthy()

    const [refundDesktop, refundMobile] = await each<MovementView>((depositId) => ({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${depositId}/refund`,
      headers: { 'x-workspace-id': WORKSPACE },
      body: {
        amountMinor: 10_000,
        reason: 'بازگشت بخشی از بیعانه',
        method: 'cash',
        idempotencyKey: 'mobile-refund-0001',
        date: '2026-11-03',
      },
    }))
    expect(refundDesktop.status).toBe(201)
    expect(refundMobile.data).toMatchObject({ replayed: false, amountMinor: 10_000 })

    // What the customer sees on the phone.
    const [listedDesktop, listedMobile] = await both<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
      headers: { 'x-workspace-id': WORKSPACE },
    })
    expect(listedMobile.data).toHaveLength(1)
    expect(listedMobile.data[0]).toMatchObject({
      amountMinor: 100_000,
      appliedMinor: 40_000,
      refundedMinor: 10_000,
      remainingMinor: 50_000,
      status: 'partially_used',
    })
    expect(listedMobile.data[0]!.remainingMinor).toBe(listedDesktop.data[0]!.remainingMinor)
  })

  it('replays a movement with the same intent key instead of taking the money twice', async () => {
    const [onDesktop, onMobile] = await each<MovementView>((depositId) => ({
      method: 'POST',
      path: `/orders/${ORDER}/deposits/${depositId}/refund`,
      headers: { 'x-workspace-id': WORKSPACE },
      body: {
        amountMinor: 10_000,
        reason: 'بازگشت بخشی از بیعانه',
        method: 'cash',
        idempotencyKey: 'mobile-refund-0001',
        date: '2026-11-03',
      },
    }))
    expect(onDesktop.status).toBe(200)
    expect(onMobile.data.replayed).toBe(true)

    const [listed] = await both<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
      headers: { 'x-workspace-id': WORKSPACE },
    })
    expect(listed.data[0]!.remainingMinor).toBe(50_000)
  })

  it('refuses a refund for a viewer on the phone, with the same code as the desktop', async () => {
    const asViewerDesktop = signedIn(createLocalEngine(nodeRaw), VIEWER)
    const asViewerMobile = signedIn(createLocalEngine(wrapExpoSqlite(expoRaw)), VIEWER)

    const body = {
      amountMinor: 5_000,
      reason: 'درخواست مشاهده‌گر',
      method: 'cash',
      idempotencyKey: 'viewer-refund-0001',
    }
    const [deniedDesktop, deniedMobile] = await Promise.all([
      asViewerDesktop.request({
        method: 'POST',
        path: `/orders/${ORDER}/deposits/${desktopDepositId}/refund`,
        headers: { 'x-workspace-id': WORKSPACE },
        body,
      }),
      asViewerMobile.request({
        method: 'POST',
        path: `/orders/${ORDER}/deposits/${mobileDepositId}/refund`,
        headers: { 'x-workspace-id': WORKSPACE },
        body,
      }),
    ])

    expect(deniedDesktop.status).toBe(403)
    expect(deniedMobile.status).toBe(403)
    expect(deniedMobile.data).toEqual(deniedDesktop.data)

    // And nothing was written: the refusal is not a silent partial move.
    const [listed] = await both<DepositView[]>({
      method: 'GET',
      path: `/customers/${CUSTOMER}/deposits`,
      headers: { 'x-workspace-id': WORKSPACE },
    })
    expect(listed.data[0]!.refundedMinor).toBe(10_000)
  })
})

describe('the mobile bundle contains the same deposit screen', () => {
  it('the shared customer detail view renders the panel, and mobile hosts that view', () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
    const detail = readFileSync(
      join(repoRoot, 'packages/ui/src/components/ui/customers/customer-detail-view.tsx'),
      'utf8',
    )
    expect(detail).toContain("import { CustomerDepositsPanel } from './customer-deposits-panel'")
    expect(detail).toContain('<CustomerDepositsPanel')

    // The mobile app's UI IS the shell bundle; no screen of its own.
    const mobilePackage = readFileSync(join(repoRoot, 'apps/mobile/package.json'), 'utf8')
    expect(mobilePackage).toContain('"@hisabche/app-shell"')
  })
})
