import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { workspaceRoutes } from '../routes/workspace.routes'

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: any) => {
    request.user = { id: '00000000-0000-0000-0000-000000000002' }
  },
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: any) => {
    request.tenancy = {
      workspaceId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      role: 'owner',
    }
  },
}))

vi.mock('../middleware/cache.middleware', () => ({
  cacheMiddleware: () => async () => {},
  clearCache: () => async () => {},
}))

describe('Workspace Routes (Option 43 Accountant Mode)', () => {
  async function buildApp() {
    const app = Fastify()
    await app.register(workspaceRoutes)
    return app
  }

  it('registers workspace routes successfully', async () => {
    const app = await buildApp()
    expect(app).toBeDefined()
  })
})
