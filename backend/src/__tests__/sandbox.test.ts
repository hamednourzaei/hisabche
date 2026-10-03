// ============================================
// Sandbox workspaces — the service's reading of the database's refusals, the
// routes on a real Fastify, and the wiring a unit test cannot see. The
// database rules themselves are proven in developer-platform-06.pg.test.ts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SANDBOX_ERROR_CODES } from '@hisabche/validation'

const db = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../db', () => ({ supabase: { rpc: db.rpc } }))

import { NotConfiguredError } from '../services/developer/developer.repository'
import { SandboxError, createSandboxService } from '../services/developer/sandbox.service'
import { buildSandboxRoutes } from '../routes/sandbox.routes'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

const ctx = { workspaceId: 'ws-1', userId: 'user-1' } as never

describe('create', () => {
  const invalidateUserCache = vi.fn(async () => {})
  const service = createSandboxService({ invalidateUserCache })
  beforeEach(() => {
    db.rpc.mockReset()
    invalidateUserCache.mockClear()
  })

  it('a new sandbox shows up in the workspace list at once; an existing one is returned as-is', async () => {
    db.rpc.mockResolvedValueOnce({
      data: [{ id: 'sb', name: 'Shop (sandbox)', created: true }],
      error: null,
    })
    expect(await service.create(ctx)).toEqual({ id: 'sb', name: 'Shop (sandbox)', created: true })
    expect(db.rpc).toHaveBeenCalledWith('create_sandbox_workspace', {
      p_parent: 'ws-1',
      p_user: 'user-1',
    })
    expect(invalidateUserCache).toHaveBeenCalledWith('user-1')

    db.rpc.mockResolvedValueOnce({
      data: [{ id: 'sb', name: 'Shop (sandbox)', created: false }],
      error: null,
    })
    await service.create(ctx)
    expect(invalidateUserCache).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['SANDBOX_OF_SANDBOX', 409],
    ['SANDBOX_NOT_MEMBER', 403],
    ['SANDBOX_PARENT_NOT_FOUND', 404],
  ])('the database refusing with %s is a %i, named', async (code, status) => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: code } })
    await expect(service.create(ctx)).rejects.toMatchObject({ code, statusCode: status })
  })

  it('the migration not run is «not configured», never a 500', async () => {
    db.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'function not found' },
    })
    await expect(service.create(ctx)).rejects.toBeInstanceOf(NotConfiguredError)
  })

  it('every refusal has words in the UI list', () => {
    for (const code of [
      'SANDBOX_OF_SANDBOX',
      'SANDBOX_NOT_MEMBER',
      'SANDBOX_PARENT_NOT_FOUND',
      'SANDBOX_NOT_CONFIGURED',
    ]) {
      expect(SANDBOX_ERROR_CODES as readonly string[]).toContain(code)
    }
  })
})

describe('routes', () => {
  const fake = {
    status: vi.fn(async () => ({ isSandbox: false, parent: null, sandbox: null })),
    create: vi.fn(async (): Promise<{ id: string; name: string; created: boolean }> => {
      throw new SandboxError('SANDBOX_OF_SANDBOX', 409)
    }),
    reset: vi.fn(async (): Promise<{ id: string; name: string }> => ({ id: 'new', name: 'x' })),
  }
  const app = Fastify()
  // The real preHandlers need a real session; the wiring test below proves
  // they are there. Here: what the handlers answer.
  app.addHook('onRoute', (route) => {
    route.preHandler = async (request) => {
      ;(request as unknown as { tenancy: unknown }).tenancy = ctx
    }
  })
  app.register(buildSandboxRoutes(fake))
  beforeAll(() => app.ready())
  afterAll(() => app.close())

  it('a refusal is its status and its code', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/developer/sandbox' })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'SANDBOX_OF_SANDBOX', code: 'SANDBOX_OF_SANDBOX' })
  })

  it('a reset answers with the NEW sandbox; a refusal keeps its code', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/developer/sandbox/reset' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ id: 'new', name: 'x' })
    fake.reset.mockRejectedValueOnce(new SandboxError('SANDBOX_RESET_NOT_A_SANDBOX', 409))
    const refused = await app.inject({ method: 'POST', url: '/api/developer/sandbox/reset' })
    expect(refused.statusCode).toBe(409)
    expect(refused.json()).toEqual({
      error: 'SANDBOX_RESET_NOT_A_SANDBOX',
      code: 'SANDBOX_RESET_NOT_A_SANDBOX',
    })
  })

  it('created is 201, returned is 200', async () => {
    fake.create.mockResolvedValueOnce({ id: 'sb', name: 'x', created: true })
    expect((await app.inject({ method: 'POST', url: '/api/developer/sandbox' })).statusCode).toBe(
      201,
    )
    fake.create.mockResolvedValueOnce({ id: 'sb', name: 'x', created: false })
    expect((await app.inject({ method: 'POST', url: '/api/developer/sandbox' })).statusCode).toBe(
      200,
    )
  })

  it('the migration not run is a 503 with its own code', async () => {
    fake.status.mockRejectedValueOnce(new NotConfiguredError())
    const res = await app.inject({ method: 'GET', url: '/api/developer/sandbox' })
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('SANDBOX_NOT_CONFIGURED')
  })
})

describe('wiring', () => {
  const routes = read('routes', 'sandbox.routes.ts')

  it('reading is for any member; creating needs workspace.manage', () => {
    expect(routes).toContain('const member = [authenticate, requireWorkspaceContext]')
    expect(routes).toContain(
      "const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]",
    )
    const get = routes.indexOf("fastify.get(\n      '/api/developer/sandbox'")
    const post = routes.indexOf("fastify.post(\n      '/api/developer/sandbox'")
    expect(routes.slice(get, get + 120)).toContain('preHandler: member')
    expect(routes.slice(post, post + 120)).toContain('preHandler: manage')
  })

  it('registered, and never open to an API key', async () => {
    expect(read('index.ts')).toContain('await server.register(sandboxRoutes)')
    const { API_ROUTE_SCOPES } = await import('../services/developer/developer.domain')
    expect(Object.keys(API_ROUTE_SCOPES).filter((k) => k.includes('sandbox'))).toEqual([])
  })

  it('the sandbox is written by the database function — no second insert path', () => {
    const service = read('services', 'developer', 'sandbox.service.ts')
    expect(service).toContain("rpc('create_sandbox_workspace'")
    expect(service).not.toMatch(/from\('workspaces'\)\s*\.insert/)
    expect(service).not.toMatch(/from\('workspace_members'\)\s*\.insert/)
  })
})
