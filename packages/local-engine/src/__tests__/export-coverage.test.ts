// PART 5 / Phase C: a backup that could not read a REQUIRED table is not a
// successful archive. The gap must be visible and verification must fail.

import { describe, expect, it } from 'vitest'
import { createExportPackage, verifyExportPackage } from '../export'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

const options = {
  deviceId: 'dev-cov',
  licenceId: 'lic-cov',
  workspaceId: TEST_WORKSPACE_ID,
}

describe('portable archive coverage (PART 5 Phase C)', () => {
  it('reports every required table and passes when the schema is complete', () => {
    const db = createTestDb()
    const pkg = createExportPackage(db, options)
    expect(pkg.coverage?.expectedRequired).toBeGreaterThan(0)
    expect(pkg.coverage?.missingRequired).toEqual([])
    expect(pkg.coverage?.exportedRequired).toBe(pkg.coverage?.expectedRequired)
    expect(verifyExportPackage(pkg).valid).toBe(true)
  })

  it('an unreadable required table makes verification fail, not silently empty', () => {
    const db = createTestDb()
    db.run('DROP TABLE journal_line')
    const pkg = createExportPackage(db, options)
    expect(pkg.coverage?.missingRequired).toContain('journal_line')
    expect(pkg.sections.journal_line?.rowCount).toBe(0)
    const verification = verifyExportPackage(pkg)
    expect(verification.valid).toBe(false)
    expect(verification.reason).toContain('MISSING_REQUIRED_TABLES')
  })

  it('the full table set is exported, including the outbox', () => {
    const db = createTestDb()
    const pkg = createExportPackage(db, options)
    expect(pkg.sections.sync_queue).toBeDefined()
    expect(pkg.sections.order_deposits).toBeDefined()
    expect(pkg.sections.product_variants).toBeDefined()
  })
})
