import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { startPg } from './helpers/pg-test-harness'

describe('PG: update-control-plane-01-migration.sql', () => {
  it('applies idempotently twice, enforces status/ring checks, and runs halt_runtime_release_atomic', async () => {
    const handle = await startPg()
    try {
      const migrationSql = fs.readFileSync(
        path.resolve(process.cwd(), '../docs/update-control-plane-01-migration.sql'),
        'utf8',
      )
      const verifySql = fs.readFileSync(
        path.resolve(process.cwd(), '../docs/VERIFY-update-control-plane-01.sql'),
        'utf8',
      )

      // Idempotent double execution
      await handle.sql.unsafe(migrationSql)
      await handle.sql.unsafe(migrationSql)

      const verifyRows = await handle.sql.unsafe(verifySql)
      expect(verifyRows[0]).toMatchObject({
        has_release_table: true,
        has_telemetry_table: true,
        has_directives_table: true,
        has_halt_rpc: true,
      })

      // Valid insert succeeds
      const insRows = await handle.sql.unsafe(
        `INSERT INTO public.runtime_release_artifacts
           (layer, component_id, version, channel, ring, rollout_percent, manifest_json, signature_json, sequence_no)
         VALUES ('core', 'hisabche-core', '1.10.0', 'stable', 'canary', 10, '{}'::jsonb, '{}'::jsonb, 1)
         RETURNING id`,
      )
      const releaseId = String(insRows[0]?.id)

      // Invalid status rejected
      await expect(
        handle.sql.unsafe(
          `UPDATE public.runtime_release_artifacts SET status = 'invalid_status' WHERE id = $1`,
          [releaseId],
        ),
      ).rejects.toThrow()

      // Atomic halt RPC transitions status and records directive
      const haltRows = await handle.sql.unsafe(
        `SELECT public.halt_runtime_release_atomic($1::uuid, 'halted', 'CANARY_CRASH', '1.9.0', '{}'::jsonb, '{}'::jsonb, 2) AS res`,
        [releaseId],
      )
      expect(haltRows[0]?.res).toMatchObject({ ok: true, status: 'halted', version: '1.10.0' })
    } finally {
      await handle.sql.end({ timeout: 5 })
      await handle.pg.stop()
    }
  })
})
