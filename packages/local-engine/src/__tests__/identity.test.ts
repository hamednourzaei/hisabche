// ============================================
// BUG-NEW-006 / GAP-NEW-002: who is asking is named by the request, or nobody is.
//
// The engine used to authorize from «the first row of local_user» and to invent a
// user and a workspace when none existed. These tests use the RAW engine (no test
// wrapper that stamps a user) so the absence of an identity is real.
// ============================================

import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const SELLER_ID = '44444444-4444-4444-8444-444444444444'
const MANAGER_ID = '55555555-5555-4555-8555-555555555555'
const FOREIGN_WORKSPACE = '99999999-9999-4999-8999-999999999999'

function twoUserDevice() {
  const db = createTestDb()
  db.run(
    `INSERT INTO local_user (id, email, full_name, role, created_at, updated_at)
     VALUES ('${SELLER_ID}', 's@x.local', 'seller', 'seller', datetime('now'), datetime('now')),
            ('${MANAGER_ID}', 'm@x.local', 'manager', 'manager', datetime('now'), datetime('now'))`,
  )
  return { db, engine: createLocalEngine(db) }
}

const as = (userId: string | undefined, extra: Record<string, string> = {}) => ({
  'x-workspace-id': TEST_WORKSPACE_ID,
  ...(userId ? { 'x-user-id': userId } : {}),
  ...extra,
})

/** POST /branches is guarded by an owner-level capability. */
const writeAs = (engine: ReturnType<typeof createLocalEngine>, headers: Record<string, string>) =>
  engine.request({ method: 'POST', path: '/branches', headers, body: {} })

describe('a request that names nobody has no identity', () => {
  it('is refused with 401 even on a device that has exactly one user', async () => {
    const engine = createLocalEngine(createTestDb())
    const res = await writeAs(engine, as(undefined))
    expect(res.status).toBe(401)
    expect(res.data).toMatchObject({ code: 'IDENTITY_REQUIRED' })
  })

  it('is refused for reads of business data too', async () => {
    const engine = createLocalEngine(createTestDb())
    const res = await engine.request({ method: 'GET', path: '/invoices', headers: as(undefined) })
    expect(res.status).toBe(401)
  })

  it('on a device with several users is not handed the first user rights', async () => {
    const { engine } = twoUserDevice()
    const res = await writeAs(engine, as(undefined))
    expect(res.status).toBe(401)
  })
})

describe('a named user must exist', () => {
  it('an unknown user id is refused', async () => {
    const { engine } = twoUserDevice()
    const res = await writeAs(engine, as('99999999-9999-4999-8999-999999999998'))
    expect(res.status).toBe(401)
    expect(res.data).toMatchObject({ code: 'UNKNOWN_USER' })
  })

  it('a malformed user id is refused', async () => {
    const { engine } = twoUserDevice()
    const res = await writeAs(engine, as("x'; DROP TABLE local_user; --"))
    expect(res.status).toBe(401)
  })

  it('the cloud edition queue writer is let in at the lowest role only', async () => {
    const { engine } = twoUserDevice()
    const cloudUser = '77777777-7777-4777-8777-777777777777'
    // Held at the lowest role: a guarded write is refused as a capability, not as identity.
    const res = await writeAs(engine, as(cloudUser, { 'x-hisabche-queue': '1' }))
    expect(res.status).toBe(403)
    expect(res.data).toMatchObject({ code: 'CAPABILITY_REQUIRED' })
  })
})

describe('the workspace is the device own', () => {
  it('a header naming another workspace is refused', async () => {
    const { engine } = twoUserDevice()
    const res = await engine.request({
      method: 'GET',
      path: '/invoices',
      headers: { 'x-workspace-id': FOREIGN_WORKSPACE, 'x-user-id': TEST_USER_ID },
    })
    expect(res.status).toBe(403)
    expect(res.data).toMatchObject({ code: 'WORKSPACE_MISMATCH' })
  })

  it('a device with no workspace refuses business calls instead of inventing one', async () => {
    const db = createTestDb()
    db.run('DELETE FROM local_workspace')
    const res = await createLocalEngine(db).request({
      method: 'GET',
      path: '/invoices',
      headers: { 'x-user-id': TEST_USER_ID },
    })
    expect(res.status).toBe(401)
    expect(res.data).toMatchObject({ code: 'WORKSPACE_REQUIRED' })
  })
})

describe('each user is who their own row says', () => {
  it('the owner is allowed, the manager and the seller are not (owner-only write)', async () => {
    const { engine } = twoUserDevice()
    expect((await writeAs(engine, as(TEST_USER_ID))).status).not.toBe(403)
    expect((await writeAs(engine, as(MANAGER_ID))).status).toBe(403)
    expect((await writeAs(engine, as(SELLER_ID))).status).toBe(403)
  })

  it('switching users on the same device switches the permissions with them', async () => {
    const { engine } = twoUserDevice()
    const order = [SELLER_ID, TEST_USER_ID, SELLER_ID, MANAGER_ID, TEST_USER_ID]
    const seen: number[] = []
    for (const id of order) seen.push((await writeAs(engine, as(id))).status === 403 ? 403 : 0)
    expect(seen).toEqual([403, 0, 403, 403, 0])
  })

  it('a user cannot raise their own role with a header', async () => {
    const { engine } = twoUserDevice()
    const res = await writeAs(engine, as(SELLER_ID, { 'x-user-role': 'owner' }))
    expect(res.status).toBe(403)
  })

  it('the profile read is the caller own, not the first row', async () => {
    const { engine } = twoUserDevice()
    const res = await engine.request<{ user: { id: string; role: string } }>({
      method: 'GET',
      path: '/auth/me',
      headers: as(SELLER_ID),
    })
    expect(res.status).toBe(200)
    expect(res.data.user.id).toBe(SELLER_ID)
    expect(res.data.user.role).toBe('member')
  })
})

describe('the two calls that create the first identity need none', () => {
  it('a fresh device can be asked what it holds, and can create its first workspace', async () => {
    const db = createTestDb()
    db.run('DELETE FROM local_user')
    db.run('DELETE FROM local_workspace')
    const engine = createLocalEngine(db)

    const listed = await engine.request<unknown[]>({ method: 'GET', path: '/workspaces' })
    expect(listed.status).toBe(200)
    expect(listed.data).toEqual([])

    const created = await engine.request<{ ownerId: string; id: string }>({
      method: 'POST',
      path: '/workspaces',
      body: { name: 'فروشگاه من', baseCurrency: 'AFN' },
    })
    expect(created.status).toBe(201)
    expect(created.data.ownerId).toMatch(/^[0-9a-f-]{36}$/)

    // The owner, now on file, is who the session will name.
    const asOwner = await engine.request({
      method: 'GET',
      path: '/invoices',
      headers: { 'x-user-id': created.data.ownerId },
    })
    expect(asOwner.status).toBe(200)
  })

  it('once a workspace exists, creating another is the owner alone', async () => {
    const { engine } = twoUserDevice()
    const res = await engine.request({
      method: 'POST',
      path: '/workspaces',
      headers: as(SELLER_ID),
      body: { name: 'x', baseCurrency: 'AFN' },
    })
    expect(res.status).toBe(403)
  })
})
