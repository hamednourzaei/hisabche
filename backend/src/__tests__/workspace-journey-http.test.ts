// ============================================
// backend/src/__tests__/workspace-journey-http.test.ts
//
// Proves V64 §2.1: WORKSPACE_JOURNEY
// Signup / user -> workspace creation (workspace_create_with_owner) -> books currency stored.
//
// Drives the Fastify server over HTTP injection (app.inject).
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceRoutes } from '../routes/workspace.routes'

type DbError = { code?: string; message?: string } | null

const WS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER = '11111111-1111-4111-8111-111111111111'

const state: {
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>
  rpcResult: { data: unknown; error: DbError }
  storedWorkspaces: Map<string, Record<string, unknown>>
} = {
  rpcCalls: [],
  rpcResult: { data: WS_ID, error: null },
  storedWorkspaces: new Map(),
}

function chain(table: string) {
  const self: Record<string, unknown> = {}
  let selectedId: string | null = null
  let selectedUser: string | null = null

  self.select = () => self
  self.eq = (col: string, val: unknown) => {
    if (col === 'id' || col === 'workspace_id') selectedId = String(val)
    if (col === 'user_id') selectedUser = String(val)
    return self
  }
  self.in = (_col: string, _vals: unknown[]) => {
    return self
  }
  self.is = () => self
  self.order = () => self
  self.single = () => {
    if (table === 'workspaces') {
      const ws = state.storedWorkspaces.get(selectedId ?? WS_ID) ?? {
        id: WS_ID,
        name: 'دکان هرات',
        slug: 'dokan-herat',
        owner_id: OWNER,
        base_currency: 'AFN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return Promise.resolve({ data: ws, error: null })
    }
    if (table === 'workspace_members') {
      return Promise.resolve({
        data: { role: 'owner', has_access: true, user_id: selectedUser ?? OWNER },
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  }

  return self
}

vi.mock('../db', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      if (fn === 'workspace_create_with_owner') {
        const id = (state.rpcResult.data as string) ?? WS_ID
        state.storedWorkspaces.set(id, {
          id,
          name: args.p_name,
          slug: args.p_slug,
          owner_id: args.p_owner,
          base_currency: args.p_base_currency,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      return Promise.resolve(state.rpcResult)
    },
    from: (table: string) => chain(table),
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: Record<string, unknown>) => {
    request.user = { id: OWNER, email: 'owner@hisabche.test' }
    request.userId = OWNER
  },
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: Record<string, unknown>) => {
    request.tenancy = {
      workspaceId: WS_ID,
      userId: OWNER,
      role: 'owner',
    }
  },
}))

vi.mock('../middleware/cache.middleware', () => ({
  cacheMiddleware: () => async () => {},
  clearCache: () => async () => {},
}))

beforeEach(() => {
  state.rpcCalls = []
  state.rpcResult = { data: WS_ID, error: null }
  state.storedWorkspaces.clear()
})

async function buildApp() {
  const app = Fastify()
  await app.register(workspaceRoutes)
  return app
}

describe('WORKSPACE_JOURNEY (V64 §2.1)', () => {
  it('creates workspace through atomic RPC and stores books currency', async () => {
    const app = await buildApp()

    // 1. Post to create workspace
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      payload: {
        name: 'دکان هرات',
        baseCurrency: 'AFN',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { id: string }
    expect(body.id).toBe(WS_ID)

    // Verify that workspace_create_with_owner was invoked with correct arguments
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.rpcCalls[0]?.fn).toBe('workspace_create_with_owner')
    expect(state.rpcCalls[0]?.args).toMatchObject({
      p_owner: OWNER,
      p_name: 'دکان هرات',
      p_base_currency: 'AFN',
    })

    // 2. Read workspace back to verify stored attributes
    const readRes = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${WS_ID}`,
    })

    expect(readRes.statusCode).toBe(200)
    const readBody = JSON.parse(readRes.body)
    expect(readBody.id).toBe(WS_ID)
    expect(readBody.owner_id).toBe(OWNER)
    expect(readBody.base_currency).toBe('AFN')
  })
})
