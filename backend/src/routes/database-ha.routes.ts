// ============================================
// backend/src/routes/database-ha.routes.ts
//
// Operational HA, Health and Writer-Fencing Routes
// Exposes deep database topology, read-replica lag, circuit-breaker status,
// and writer fencing leases for monitoring and load-balancer probes.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  checkReplicaHealth,
  checkPrimaryPing,
  getDatabaseRoutingOverview,
  globalFencingEngine,
  replicaCircuitBreaker,
} from '../db/index'

let primaryHealthProbe = checkPrimaryPing

export function setPrimaryHealthProbeForTest(
  probe: (() => Promise<{ healthy: boolean; latencyMs: number | null }>) | null,
): void {
  primaryHealthProbe = probe ?? checkPrimaryPing
}

export async function databaseHaRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/health/db — Deep DB health check (Primary + Replica + Circuit Breaker + Routing)
  server.get('/api/health/db', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { healthy: primaryHealthy, latencyMs: primaryLatencyMs } = await primaryHealthProbe()

    const replicaHealth = await checkReplicaHealth()
    const routingOverview = getDatabaseRoutingOverview()
    const breakerState = replicaCircuitBreaker.getState()
    const currentEpoch = globalFencingEngine.getCurrentEpoch()

    const isSystemHealthy = primaryHealthy

    return reply.status(isSystemHealthy ? 200 : 503).send({
      status: isSystemHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      primary: {
        healthy: primaryHealthy,
        latencyMs: primaryLatencyMs,
        provider: 'supabase',
        role: 'primary',
      },
      replica: replicaHealth,
      circuitBreaker: {
        state: breakerState,
        consecutiveFailures: replicaCircuitBreaker.getFailureCount(),
      },
      routing: routingOverview,
      fencing: {
        activeWriterEpoch: currentEpoch,
      },
    })
  })

  // GET /api/health/fencing — Writer fencing token validation
  server.get('/api/health/fencing', async (_request: FastifyRequest, reply: FastifyReply) => {
    const epoch = globalFencingEngine.getCurrentEpoch()
    return reply.send({
      activeWriterEpoch: epoch,
      timestamp: new Date().toISOString(),
    })
  })
}
