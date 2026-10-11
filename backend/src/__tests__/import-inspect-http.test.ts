// ============================================
// `POST /api/migrations/inspect` over real HTTP: the route, its guards and its
// answers — and that a first look writes nothing.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: fakeId('owner'), token: 'inspect-token-owner' }
const SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', async () => (globalThis as any).__inspectFakeDb)

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__inspectFakeDb = createFakeDb(db, users)
  db.seed('workspace_members', [
    {
      id: fakeId('member'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

const headers = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP }
const post = (payload: Record<string, unknown>, withAuth = true) =>
  app.inject({
    method: 'POST',
    url: '/api/migrations/inspect',
    headers: withAuth ? headers : {},
    payload,
  })

describe('POST /api/migrations/inspect', () => {
  it('says what a CSV holds, and creates no job', async () => {
    const response = await post({
      filename: 'customers.csv',
      content:
        'نام مشتری,تلفن,آدرس\nاحمد,0700123456,کابل\nکریم,0799111222,هرات\nولی,0788000111,مزار',
    })

    expect(response.statusCode, response.body).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.detection.entity).toBe('customer')
    expect(body.detection.confidence).toBe('high')
    expect(body.rowCount).toBe(3)
    expect(body.sourceType).toBe('csv')
    // A look is not an import: nothing was stored anywhere.
    expect(db.rows('migration_jobs')).toHaveLength(0)
  })

  it('refuses an old .xls by its code', async () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ])
    const response = await post({ filename: 'old.xls', contentBase64: ole.toString('base64') })

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error).toBe('MIGRATION_XLSX_OLD_FORMAT')
  })

  it('wants exactly one source', async () => {
    const both = await post({ filename: 'a.csv', content: 'a,b\n1,2', contentBase64: 'AAAA' })
    const neither = await post({ filename: 'a.csv' })
    expect(both.statusCode).toBe(400)
    expect(neither.statusCode).toBe(400)
  })

  it('is not open to someone who is not signed in', async () => {
    const response = await post({ filename: 'a.csv', content: 'a,b\n1,2' }, false)
    expect(response.statusCode).toBe(401)
  })
})
