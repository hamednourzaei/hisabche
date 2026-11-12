import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isReplicaAllowedCaller, selectReadClient } from '../../db/routing'

describe('C.4.2, C.4.3, C.4.10 DB routing, Pooler safety, Lock discipline', () => {
  it('refuses replica routing for write-path callers and falls back to primary on unset or high lag', () => {
    expect(isReplicaAllowedCaller('services/invoice.service.ts')).toBe(false)
    expect(isReplicaAllowedCaller('services/reporting/dataset.domain.ts')).toBe(true)

    const writeCaller = selectReadClient({ callerPath: 'services/invoice.service.ts' })
    expect(writeCaller.target).toBe('primary')
    expect(writeCaller.reason).toBe('caller_not_allowlisted')

    const highLag = selectReadClient({
      callerPath: 'services/reporting/dataset.domain.ts',
      replicaLagMs: 12_000,
      maxLagMs: 5_000,
    })
    expect(highLag.target).toBe('primary')
    expect(highLag.reason).toBe('replica_lag_exceeded')
  })

  it('contains zero session-scoped pg_advisory_lock( calls across docs/*.sql', () => {
    const docsDir = resolve(__dirname, '../../../../docs')
    const sqlFiles = readdirSync(docsDir).filter((f) => f.endsWith('.sql'))
    for (const file of sqlFiles) {
      const content = readFileSync(resolve(docsDir, file), 'utf8')
      expect(content, `${file} must not use session-scoped pg_advisory_lock(`).not.toMatch(
        /\bpg_advisory_lock\s*\(/i,
      )
    }
  })
})
