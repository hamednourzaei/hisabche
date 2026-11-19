// PART 5 / Slice 3: restore never overwrites business data and never accepts
// an invalid archive. Success is measured in restored ROWS, not a flag.

import { describe, expect, it } from 'vitest'
import { createExportPackage, restoreArchive, validateRestore } from '../export'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

const options = { deviceId: 'dev-r', licenceId: 'lic-r', workspaceId: TEST_WORKSPACE_ID }

function seed(db: ReturnType<typeof createTestDb>) {
  db.run(
    `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
     VALUES ('p1', '${TEST_WORKSPACE_ID}', 'Saffron', 1500, 2000, 10, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  )
  db.run(
    `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
     VALUES ('c1', '${TEST_WORKSPACE_ID}', 'Ahmad', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  )
}

describe('safe local restore (PART 5 Slice 3)', () => {
  it('restores a seeded archive into an empty workspace with its rows intact', () => {
    const source = createTestDb()
    seed(source)
    const pkg = createExportPackage(source, options)

    const target = createTestDb()
    const result = restoreArchive(target, pkg, { expectedWorkspaceId: TEST_WORKSPACE_ID })
    expect(result.totalRows).toBeGreaterThanOrEqual(2)
    const product = target.get<{ name: string }>(`SELECT name FROM product WHERE id = 'p1'`)
    expect(product?.name).toBe('Saffron')
    const customer = target.get<{ full_name: string }>(
      `SELECT full_name FROM customer WHERE id = 'c1'`,
    )
    expect(customer?.full_name).toBe('Ahmad')
  })

  it('a repeated restore is an idempotent no-op — no duplicate rows', () => {
    const source = createTestDb()
    seed(source)
    const pkg = createExportPackage(source, options)
    const target = createTestDb()
    restoreArchive(target, pkg, { expectedWorkspaceId: TEST_WORKSPACE_ID })
    restoreArchive(target, pkg, { expectedWorkspaceId: TEST_WORKSPACE_ID })
    expect(target.get<{ c: number }>(`SELECT COUNT(*) as c FROM product`)?.c).toBe(1)
    expect(target.get<{ c: number }>(`SELECT COUNT(*) as c FROM customer`)?.c).toBe(1)
  })

  it('a DIFFERENT local row with the same id is never overwritten', () => {
    const source = createTestDb()
    seed(source)
    const pkg = createExportPackage(source, options)
    const target = createTestDb()
    target.run(`INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
      VALUES ('p1', '${TEST_WORKSPACE_ID}', 'Locally changed', 0, 0, 0, 1, '2026-01-01', '2026-01-01')`)
    expect(() => restoreArchive(target, pkg, { expectedWorkspaceId: TEST_WORKSPACE_ID })).toThrow(
      /RESTORE_TARGET_NOT_EMPTY:product/,
    )
    expect(target.get<{ name: string }>(`SELECT name FROM product WHERE id = 'p1'`)?.name).toBe(
      'Locally changed',
    )
  })

  it('a tampered archive is refused before any write', () => {
    const source = createTestDb()
    seed(source)
    const pkg = createExportPackage(source, options)
    const tampered = JSON.parse(JSON.stringify(pkg)) as typeof pkg
    const productSection = tampered.sections.product
    if (!productSection) throw new Error('no product section in archive')
    const firstRow = productSection.rows[0]
    if (!firstRow) throw new Error('no product row in archive')
    firstRow.name = 'Changed'
    const target = createTestDb()
    expect(() => validateRestore(tampered, { expectedWorkspaceId: TEST_WORKSPACE_ID })).toThrow(
      /RESTORE_ARCHIVE_INVALID/,
    )
    expect(target.get<{ c: number }>('SELECT COUNT(*) as c FROM product')?.c).toBe(0)
  })

  it('an archive for another workspace is refused', () => {
    const source = createTestDb()
    const pkg = createExportPackage(source, options)
    expect(() => validateRestore(pkg, { expectedWorkspaceId: 'other-ws' })).toThrow(
      'RESTORE_WORKSPACE_MISMATCH',
    )
  })
})
