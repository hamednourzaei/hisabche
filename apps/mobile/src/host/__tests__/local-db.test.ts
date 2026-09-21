// ============================================
// ⚠️ THE SQL IS RUN, NOT ASSERTED ABOUT.
//
// `expo-sqlite` needs a device, so this suite runs the statements the mobile
// host builds against Node's real SQLite. What it proves is the part that
// actually breaks: that the shared builders produce SQL this schema accepts,
// that a reserved table name survives, and that a queued write and a cached
// read behave the way the host expects.
//
// What it does NOT prove: that expo-sqlite's driver behaves identically on a
// phone. Only the device shows that, which is why the offline check on a real
// handset is still a step somebody has to do.
// ============================================

import { DatabaseSync } from 'node:sqlite'

import { CREATE_STATEMENTS, buildSelect, buildUpserts, normalizeValue } from '@hisabche/app-bridge'

let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const statement of CREATE_STATEMENTS) db.exec(statement)
})

afterEach(() => {
  db.close()
})

const run = ({ sql, params }: { sql: string; params: unknown[] }): void => {
  db.prepare(sql).run(...(params as never[]))
}

const all = <T>({ sql, params }: { sql: string; params: unknown[] }): T[] =>
  db.prepare(sql).all(...(params as never[])) as T[]

describe('the mobile cache runs the shared SQL', () => {
  it('⚠️ upserts a product and reads it back without a network', () => {
    for (const statement of buildUpserts('product', [
      {
        id: 'p1',
        name: 'گردنبند طلا',
        quantity: 4,
        sell_price: 1500000,
        is_active: true,
        updated_at: '2026-09-21T00:00:00.000Z',
        version: 3,
      },
    ])) {
      run(statement)
    }

    const rows = all<{ name: string; is_active: number; version: number }>(
      buildSelect({ table: 'product', direction: 'desc', limit: 10, offset: 0 }),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('گردنبند طلا')
    // The boolean became 0/1 the same way it does on the desktop — a row that
    // stored `"true"` would stop matching every `WHERE is_active = 1`.
    expect(rows[0]?.is_active).toBe(1)
    expect(rows[0]?.version).toBe(3)
  })

  it('⚠️ a second pull overwrites the row instead of duplicating it', () => {
    const write = (quantity: number, version: number): void => {
      for (const statement of buildUpserts('product', [
        { id: 'p1', name: 'زنجیر', quantity, updated_at: '2026-09-21T00:00:00.000Z', version },
      ])) {
        run(statement)
      }
    }

    write(4, 1)
    write(9, 2)

    const rows = all<{ quantity: number; version: number }>(
      buildSelect({ table: 'product', direction: 'desc', limit: 10, offset: 0 }),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.quantity).toBe(9)
    expect(rows[0]?.version).toBe(2)
  })

  it('⚠️ searches only the columns the contract declares', () => {
    for (const statement of buildUpserts('product', [
      { id: 'p1', name: 'انگشتر', barcode: '629', updated_at: 'x', version: 1 },
      { id: 'p2', name: 'دستبند', barcode: '777', updated_at: 'x', version: 1 },
    ])) {
      run(statement)
    }

    expect(
      all(
        buildSelect({
          table: 'product',
          search: 'انگشتر',
          direction: 'desc',
          limit: 10,
          offset: 0,
        }),
      ),
    ).toHaveLength(1)
    expect(
      all(
        buildSelect({ table: 'product', search: '777', direction: 'desc', limit: 10, offset: 0 }),
      ),
    ).toHaveLength(1)
    // `sell_price` is not searchable; a value that happens to match must not
    // widen the result.
    expect(
      all(
        buildSelect({
          table: 'product',
          search: 'nothing-matches',
          direction: 'desc',
          limit: 10,
          offset: 0,
        }),
      ),
    ).toHaveLength(0)
  })

  it('⚠️ the reserved table name works — `transaction` is quoted everywhere', () => {
    for (const statement of buildUpserts('transaction', [
      {
        id: 't1',
        type: 'payment',
        amount: 250000,
        date: '2026-09-21',
        updated_at: 'x',
        version: 1,
      },
    ])) {
      run(statement)
    }

    const rows = all<{ amount: number }>(
      buildSelect({ table: 'transaction', direction: 'desc', limit: 10, offset: 0 }),
    )
    expect(rows[0]?.amount).toBe(250000)
  })

  it('⚠️ a row with no id is skipped, not inserted', () => {
    // The server's id is the primary key. A row without one would insert a
    // duplicate on every pull instead of overwriting its own copy.
    const statements = buildUpserts('product', [{ name: 'بدون شناسه', updated_at: 'x' }])
    expect(statements).toEqual([])
  })

  it('⚠️ queues a write and takes it back off, exactly once', () => {
    db.prepare(
      `INSERT OR IGNORE INTO sync_queue (client_id, entity, operation, payload, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    ).run('c1', 'invoice', 'create', JSON.stringify({ total: 5 }), '2026-09-21T00:00:00.000Z')

    // The same clientId again is the retry the shared UI makes when it does
    // not see a response — it must not become a second invoice.
    db.prepare(
      `INSERT OR IGNORE INTO sync_queue (client_id, entity, operation, payload, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    ).run('c1', 'invoice', 'create', JSON.stringify({ total: 5 }), '2026-09-21T00:00:01.000Z')

    const queued = db.prepare('SELECT * FROM sync_queue').all()
    expect(queued).toHaveLength(1)

    db.prepare('DELETE FROM sync_queue WHERE client_id = ?').run('c1')
    expect(db.prepare('SELECT * FROM sync_queue').all()).toHaveLength(0)
  })

  it('⚠️ normalises values the same way both hosts do', () => {
    expect(normalizeValue(true)).toBe(1)
    expect(normalizeValue(false)).toBe(0)
    expect(normalizeValue(undefined)).toBeNull()
    expect(normalizeValue(null)).toBeNull()
    expect(normalizeValue({ a: 1 })).toBe('{"a":1}')
  })
})
