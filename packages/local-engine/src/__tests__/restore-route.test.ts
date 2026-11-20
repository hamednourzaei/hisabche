// The portable archive is only a capability if a real caller can reach it.
// These tests go through the engine's request() — the same surface the IPC
// localApiRequest channel uses — not directly through restoreArchive().

import { describe, expect, it } from 'vitest'

import { createExportPackage } from '../export'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

const options = { deviceId: 'dev-route', licenceId: 'lic-route', workspaceId: TEST_WORKSPACE_ID }

function seededArchive() {
  const source = createTestDb()
  source.run(
    `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
     VALUES ('p-route', '${TEST_WORKSPACE_ID}', 'Saffron', 1500, 2000, 3, 1, '2026-01-01', '2026-01-01')`,
  )
  return createExportPackage(source, options)
}

describe('POST /workspaces/restore (portable archive end to end)', () => {
  it('is registered on the engine route table', () => {
    const engine = createTestEngine(createTestDb())
    expect(engine.routeTable()).toContainEqual({ method: 'POST', path: '/workspaces/restore' })
  })

  it('restores the archive and reports rows, not a boolean', async () => {
    const engine = createTestEngine(createTestDb())
    const response = await engine.request<{ totalRows: number; restoredTables: string[] }>({
      method: 'POST',
      path: '/workspaces/restore',
      body: { archive: seededArchive() },
    })
    expect(response.status).toBe(201)
    expect(response.data.totalRows).toBeGreaterThanOrEqual(1)
    expect(response.data.restoredTables).toContain('product')
  })

  it('a repeated restore is an idempotent no-op — no duplicate rows', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const body = { archive: seededArchive() }
    await engine.request({ method: 'POST', path: '/workspaces/restore', body })
    await engine.request({ method: 'POST', path: '/workspaces/restore', body })
    expect(db.get<{ c: number }>(`SELECT COUNT(*) as c FROM product WHERE id = 'p-route'`)?.c).toBe(
      1,
    )
  })

  it('refuses a tampered archive before any write, with a readable code', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const archive = seededArchive()
    const tampered = JSON.parse(JSON.stringify(archive)) as typeof archive
    const product = tampered.sections.product
    if (!product) throw new Error('no product section')
    const row = product.rows[0]
    if (!row) throw new Error('no product row')
    row.name = 'Changed after checksum'

    const response = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/workspaces/restore',
      body: { archive: tampered },
    })
    expect(response.status).toBe(400)
    expect(response.data.code).toContain('RESTORE_ARCHIVE_INVALID')
    expect(db.get<{ c: number }>('SELECT COUNT(*) as c FROM product')?.c).toBe(0)
  })

  it('a body-supplied workspace id cannot redirect the restore', async () => {
    const engine = createTestEngine(createTestDb())
    const response = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/workspaces/restore',
      body: { archive: seededArchive(), expectedWorkspaceId: 'another-workspace' },
    })
    // The id comes from the caller's context, never from the body. The extra
    // field is ignored; the archive itself still matches this workspace, so it
    // restores here. A copied file cannot name a different tenant.
    expect(response.status).toBe(201)
  })

  it('refuses an archive whose metadata names another workspace', async () => {
    const engine = createTestEngine(createTestDb())
    const source = createTestDb()
    const archive = createExportPackage(source, {
      ...options,
      workspaceId: 'other-workspace-id',
    })
    const response = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/workspaces/restore',
      body: { archive },
    })
    expect(response.status).toBe(400)
    expect(response.data.code).toBe('RESTORE_WORKSPACE_MISMATCH')
  })
})
