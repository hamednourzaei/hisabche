import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { developerRoutes } from '../routes/developer.routes'

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

vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => {},
}))

describe('Developer Routes (Option 42 Webhook Console)', () => {
  async function buildApp() {
    const app = Fastify()
    await app.register(developerRoutes)
    return app
  }

  it('registers developer routes successfully', async () => {
    const app = await buildApp()
    expect(app).toBeDefined()
  })
})
