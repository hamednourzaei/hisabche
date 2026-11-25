// ============================================
// backend/src/routes/capacity.routes.ts
//
// V76 Phase 11–12 — Admin Capacity Intelligence API.
// All endpoints sit behind the S-1 Admin RBAC chain (`adminRoute`).
// Benchmark execution additionally enforces assertIsolatedBenchmarkEnvironment.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { BENCHMARK_SUITE_IDS, WORKLOAD_PROFILES } from '@hisabche/validation'
import { adminRoute } from '../middleware/admin-rbac.middleware'
import { capacityIntelligenceService } from '../services/capacity/benchmark-suites.service'
import { BenchmarkSafetyError } from '../services/capacity/safety-guard'

const summaryQuerySchema = z.object({
  profile: z.enum(WORKLOAD_PROFILES).default('mixed_production'),
  multiplier: z.coerce.number().min(1).max(16).default(1),
})

const runSuiteBodySchema = z.object({
  suiteId: z.enum(BENCHMARK_SUITE_IDS),
  targetHostname: z.string().min(1),
  databaseHostname: z.string().min(1),
  syntheticCredentialId: z.string().min(1),
  stages: z.array(z.number().int().positive()).max(12).optional(),
  datasetSeed: z.number().int().optional(),
  datasetSize: z.number().int().positive().max(1_000_000).optional(),
})

export default async function capacityRoutes(server: FastifyInstance): Promise<void> {
  server.get(
    '/api/admin/capacity/discovery',
    { preHandler: adminRoute('operations.monitor.read') },
    async () => {
      return capacityIntelligenceService.getDiscoverySnapshot()
    },
  )

  server.get(
    '/api/admin/capacity/summary',
    { preHandler: adminRoute('operations.monitor.read') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = summaryQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid query parameters', code: 'VALIDATION_FAILED' })
      }
      return capacityIntelligenceService.getCapacitySummary(
        parsed.data.profile,
        parsed.data.multiplier,
      )
    },
  )

  server.get(
    '/api/admin/capacity/history',
    { preHandler: adminRoute('operations.monitor.read') },
    async () => {
      return { runs: capacityIntelligenceService.getHistory() }
    },
  )

  server.post(
    '/api/admin/capacity/benchmarks/run',
    { preHandler: adminRoute('operations.monitor.write', { stepUp: true }) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = runSuiteBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid benchmark request', code: 'VALIDATION_FAILED' })
      }
      try {
        const result = await capacityIntelligenceService.runSuite({
          suiteId: parsed.data.suiteId,
          target: {
            targetHostname: parsed.data.targetHostname,
            databaseHostname: parsed.data.databaseHostname,
            syntheticCredentialId: parsed.data.syntheticCredentialId,
          },
          ...(parsed.data.stages ? { stages: parsed.data.stages } : {}),
          ...(parsed.data.datasetSeed !== undefined
            ? { datasetSeed: parsed.data.datasetSeed }
            : {}),
          ...(parsed.data.datasetSize !== undefined
            ? { datasetSize: parsed.data.datasetSize }
            : {}),
        })
        return reply.send(result)
      } catch (err) {
        if (err instanceof BenchmarkSafetyError) {
          return reply.code(403).send({ error: err.message, code: err.code })
        }
        throw err
      }
    },
  )

  server.post(
    '/api/admin/capacity/kill-switch',
    { preHandler: adminRoute('operations.monitor.write', { stepUp: true }) },
    async () => {
      return capacityIntelligenceService.triggerKillSwitch()
    },
  )
}
