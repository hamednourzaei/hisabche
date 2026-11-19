// PART 5 / Slice 4: the migration service validates the archive manifest
// before creating a job. A bad archive must never reach staging.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenancyContext } from '../services/tenancy.service'

type Read = { data: unknown; error: { message?: string } | null }
const state: {
  count: Read
  inserts: Array<Record<string, unknown>>
  job: Record<string, unknown> | null
} = {
  count: { data: null, error: null },
  inserts: [],
  job: null,
}

interface Chain {
  eq: (...args: unknown[]) => Chain
  select: (...args: unknown[]) => Chain | Promise<Read>
  maybeSingle: () => Promise<Read>
  single: () => Promise<Read>
  update: (values: Record<string, unknown>) => Chain
  insert: (values: Record<string, unknown>) => Chain
  then: <T>(onfulfilled: (value: Read) => T) => Promise<T>
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      let values: Record<string, unknown> = {}
      const chain: Chain = {
        eq: () => chain,
        insert: (v: Record<string, unknown>) => {
          values = v
          return chain
        },
        select: (...args: unknown[]) => {
          if (args.length === 0 && table === 'cloud_migration_jobs')
            return Promise.resolve({ data: { id: 'job-1', ...values }, error: null })
          if (args.length === 0) return Promise.resolve(state.count as never)
          return chain
        },
        maybeSingle: () => Promise.resolve({ data: state.job, error: null }),
        update: (v: Record<string, unknown>) => {
          values = { ...values, ...v }
          return chain
        },
        single: () => Promise.resolve({ data: { id: 'job-1', ...values }, error: null }),
        then: (onfulfilled) => Promise.resolve(state.count as Read).then(onfulfilled),
      }
      return chain
    },
  },
}))

const { CloudMigrationService } =
  await import('../services/cloud-migration/cloud-migration.service')

const ctx = { workspaceId: 'ws-1', userId: 'u-1' } as unknown as TenancyContext
const preview = {
  workspaceId: 'ws-src',
  baseCurrency: 'AFN',
  counts: {} as never,
  totalsByCurrency: {},
  receivablesPerCurrency: {},
  payablesPerCurrency: {},
  stockByProductWarehouse: [],
  trialBalance: { totalDebit: 0, totalCredit: 0, balanced: true },
  profitByInvoice: [],
}
const manifest = {
  formatVersion: 1,
  sourceSchemaVersion: 35,
  supportedFormatVersions: [1],
  maxSupportedSchemaVersion: 40,
  requiredSections: ['invoice'],
  presentSections: ['invoice'],
  totalChecksumMatches: true,
}
const base = {
  deviceId: 'dev-1',
  licenceId: 'lic-1',
  packageChecksum: 'a'.repeat(64),
  chunksTotal: 1,
  previewMetrics: preview,
}

const completeJob = {
  id: 'job-1',
  workspace_id: 'ws-1',
  created_by: 'u-1',
  device_id: 'dev-1',
  licence_id: 'lic-1',
  status: 'AWAITING_CONFIRMATION',
  chunks_total: 1,
  chunks_completed: 1,
  reconciliation_result: { ok: true },
  reconciliation_diffs: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  state.count = { data: null, error: null }
  state.inserts = []
  state.job = { ...completeJob }
})

describe('archive preflight in the migration service (PART 5 Slice 4)', () => {
  it('refuses a job when the manifest has a checksum mismatch', async () => {
    const service = new CloudMigrationService()
    await expect(
      service.createJob(ctx, {
        ...base,
        sourceWorkspaceId: 'ws-src',
        manifest: { ...manifest, totalChecksumMatches: false },
      }),
    ).rejects.toThrow(/ARCHIVE_PREFLIGHT_FAILED:CHECKSUM_MISMATCH/)
  })

  it('creates a job for a valid manifest', async () => {
    const service = new CloudMigrationService()
    const job = await service.createJob(ctx, { ...base, sourceWorkspaceId: 'ws-src', manifest })
    expect(job).toBeDefined()
  })

  it('older clients without a manifest keep working', async () => {
    const service = new CloudMigrationService()
    const job = await service.createJob(ctx, base)
    expect(job).toBeDefined()
  })

  it('confirmation is refused when activation prerequisites are missing', async () => {
    const service = new CloudMigrationService()
    await expect(
      service.confirmJob(ctx, 'job-1', {
        deviceRegistered: false,
        baselineCursorEstablished: true,
        pendingMutationsReconciled: true,
        localDatabasePreserved: true,
      }),
    ).rejects.toThrow(/HYBRID_ACTIVATION_BLOCKED:DEVICE_NOT_REGISTERED/)
  })

  it('confirmation succeeds when every activation prerequisite holds', async () => {
    const service = new CloudMigrationService()
    const job = await service.confirmJob(ctx, 'job-1', {
      deviceRegistered: true,
      baselineCursorEstablished: true,
      pendingMutationsReconciled: true,
      localDatabasePreserved: true,
    })
    expect(job.status).toBe('COMPLETED')
  })
})
