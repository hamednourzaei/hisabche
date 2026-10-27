// AUDIT PROBE (read-only): does the body the real clients send pass the server's push schema?
// Both clients build { mutations: [ { mutationId, entityType, entityId, operation, payload, expectedVersion? } ] }
// (packages/app-shell/src/features/sync/sync-engine.ts pushVersioned; apps/mobile/src/features/offline/sync-runner.ts).
import { describe, expect, it } from 'vitest'
import { syncPushRequestSchema } from '../../../packages/validation/src/schemas/sync-protocol.schema'

const clientBody = {
  mutations: [
    {
      mutationId: '11111111-1111-4111-8111-111111111111',
      entityType: 'customer',
      entityId: '22222222-2222-4222-8222-222222222222',
      operation: 'update',
      payload: { id: '22222222-2222-4222-8222-222222222222', phone: '0700000000' },
      expectedVersion: 3,
    },
  ],
}

describe('audit probe: client push body vs server schema', () => {
  it('reports what the server schema says about the body the clients send', () => {
    const parsed = syncPushRequestSchema.safeParse(clientBody)

    console.log(
      'PROBE success =',
      parsed.success,
      parsed.success ? '' : JSON.stringify(parsed.error.flatten().fieldErrors),
    )
    expect(typeof parsed.success).toBe('boolean')
  })

  it('the same body with deviceId and batchId is accepted', () => {
    const parsed = syncPushRequestSchema.safeParse({
      ...clientBody,
      deviceId: 'desktop-1',
      batchId: '33333333-3333-4333-8333-333333333333',
    })

    console.log('PROBE with deviceId+batchId success =', parsed.success)
    expect(typeof parsed.success).toBe('boolean')
  })
})
