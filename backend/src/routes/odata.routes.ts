// ============================================
// backend/src/routes/odata.routes.ts
//
// OPTION 37: ODATA / BI DATASET EXPORT ENDPOINT
//
// Read-only OData v4 JSON format over reporting/dataset.domain.
// Guarded by workspace context and 'report.financial.read' capability.
// ============================================

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { supabase } from '../db'
import type { DatasetKey } from '../services/reporting/dataset.domain'

const ALLOWED_DATASETS: readonly DatasetKey[] = [
  'invoices',
  'payments',
  'journal_entries',
  'customers',
  'products',
  'suppliers',
  'budget',
  'time_entries',
]

export async function odataRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/odata/:dataset',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
    },
    async (request, reply) => {
      const { dataset } = request.params as { dataset: string }
      if (!ALLOWED_DATASETS.includes(dataset as DatasetKey)) {
        return reply.status(404).send({
          '@odata.error': {
            code: 'DATASET_NOT_FOUND',
            message: `Dataset '${dataset}' not found or not exposed via OData`,
          },
        })
      }

      const query = (request.query || {}) as { $top?: string; $skip?: string }
      const workspaceId = request.tenancy.workspaceId
      const top = Math.min(1000, Math.max(1, Number(query.$top) || 100))
      const skip = Math.max(0, Number(query.$skip) || 0)

      // Query the underlying canonical tenant table
      const { data, count, error } = await supabase
        .from(dataset)
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .range(skip, skip + top - 1)

      if (error) {
        return reply.status(500).send({
          '@odata.error': {
            code: 'QUERY_FAILED',
            message: error.message,
          },
        })
      }

      return reply.send({
        '@odata.context': `$metadata#${dataset}`,
        '@odata.count': count ?? data?.length ?? 0,
        value: data ?? [],
      })
    },
  )
}
