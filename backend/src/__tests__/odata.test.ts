import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { odataRoutes } from '../routes/odata.routes'

// Mock authentication and tenancy middlewares
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: any) => {
    request.user = { id: 'test-user-id' }
  },
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: any) => {
    request.tenancy = {
      workspaceId: '11111111-1111-1111-1111-111111111111',
      userId: 'test-user-id',
      role: 'owner',
    }
  },
}))

vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => {},
}))

vi.mock('../db', () => ({
  supabase: {
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: [{ id: 'mock-1', name: 'Mock Data' }],
            count: 1,
            error: null,
          }),
        }),
      }),
    })),
  },
}))

describe('OData Route', () => {
  async function buildApp() {
    const app = Fastify()
    await app.register(odataRoutes)
    return app
  }

  it('rejects unknown dataset with 404 OData error', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/odata/unknown_entity',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body['@odata.error']).toBeDefined()
    expect(body['@odata.error'].code).toBe('DATASET_NOT_FOUND')
  })

  it('serves allowed dataset in OData v4 JSON format', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/odata/invoices?$top=10&$skip=0',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body['@odata.context']).toBe('$metadata#invoices')
    expect(body['@odata.count']).toBe(1)
    expect(Array.isArray(body.value)).toBe(true)
    expect(body.value).toHaveLength(1)
  })
})
