// ============================================
// backend/src/__tests__/database-ha-health-routes.test.ts
//
// Tests for Database HA & Health Monitoring Routes (/api/health/db, /api/health/fencing)
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { databaseHaRoutes, setPrimaryHealthProbeForTest } from '../routes/database-ha.routes'
import { setReplicaClientForTest, replicaCircuitBreaker, globalFencingEngine } from '../db/index'

describe('Database HA & Health Routes', () => {
  let server: ReturnType<typeof Fastify>

  beforeEach(async () => {
    server = Fastify()
    await databaseHaRoutes(server)
    replicaCircuitBreaker.reset()
    setReplicaClientForTest(null)
    setPrimaryHealthProbeForTest(async () => ({ healthy: true, latencyMs: 5 }))
  })

  it('GET /api/health/fencing returns current active writer epoch', async () => {
    const epoch = globalFencingEngine.getCurrentEpoch()

    const res = await server.inject({
      method: 'GET',
      url: '/api/health/fencing',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.activeWriterEpoch).toBe(epoch)
    expect(body.timestamp).toBeDefined()
  })

  it('GET /api/health/db returns structured primary, replica, breaker, and routing health', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/health/db',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('healthy')
    expect(body.primary).toBeDefined()
    expect(body.primary.role).toBe('primary')
    expect(body.circuitBreaker.state).toBe('closed')
    expect(body.routing.activeEpoch).toBeDefined()
    expect(body.fencing.activeWriterEpoch).toBeDefined()
  })

  it('GET /api/health/db reflects circuit breaker state when tripped', async () => {
    // Force circuit breaker open
    replicaCircuitBreaker.recordFailure()
    replicaCircuitBreaker.recordFailure()
    replicaCircuitBreaker.recordFailure()

    expect(replicaCircuitBreaker.getState()).toBe('open')

    const res = await server.inject({
      method: 'GET',
      url: '/api/health/db',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.circuitBreaker.state).toBe('open')
    expect(body.circuitBreaker.consecutiveFailures).toBe(3)
  })

  it('GET /api/health/db returns 503 degraded when primary is unreachable', async () => {
    setPrimaryHealthProbeForTest(async () => ({ healthy: false, latencyMs: null }))

    const res = await server.inject({
      method: 'GET',
      url: '/api/health/db',
    })

    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('degraded')
    expect(body.primary.healthy).toBe(false)
  })
})
