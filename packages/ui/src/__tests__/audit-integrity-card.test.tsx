import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AuditIntegrityCard } from '../components/ui/audit/audit-integrity-card'

afterEach(cleanup)

const EN: Record<string, string> = {
  'audit.integrityChecking': 'Checking the history chain…',
  'audit.integrityUnreadable': 'The chain verdict could not be read.',
  'audit.integrityMigrationTitle': 'The history chain is not enabled on this database',
  'audit.integrityMigrationHint': 'Nothing has been checked.',
  'audit.integrityVerified': 'The history chain is intact',
  'audit.integrityVerifiedHint': '{count} chained rows were checked.',
  'audit.integrityBroken': 'The history chain is broken',
  'audit.integrityBrokenAt': 'First inconsistent row: {seq}',
  'audit.integrityLegacy': '{count} older rows (before the chain) were counted separately.',
  'audit.integrityHead': 'Chain head (keep it outside the database):',
  'audit.integrityCopy': 'Copy',
  'audit.integrityCopied': 'Copied',
  'audit.integrityLimitation': 'This check shows internal inconsistency only.',
  'audit.integrityReasonHash': "a row's hash does not match its content",
  'audit.integrityReasonLink': 'a row does not link to the row before it',
  'audit.integrityReasonMissing': 'a chained row is missing',
  'audit.integrityReasonTail': 'rows were removed from the end',
  'audit.retry': 'Try again',
}

const t = (key: string, fallback?: string): string => EN[key] ?? fallback ?? key

describe('AuditIntegrityCard (V53 4.7 / Phase H)', () => {
  it('an intact chain says HOW MANY rows were checked and offers the head', () => {
    render(
      <AuditIntegrityCard
        t={t}
        isLoading={false}
        verdict={{
          verified: true,
          count: 12,
          legacyUnchained: 3,
          head: { seq: 12, hash: 'abc123' },
        }}
      />,
    )
    expect(screen.getByText('The history chain is intact')).toBeTruthy()
    // The number a person reads is the checked count, not the flag beside it.
    expect(screen.getByText('12 chained rows were checked.')).toBeTruthy()
    expect(screen.getByText('12:abc123')).toBeTruthy()
    expect(screen.getByText(/3 older rows/)).toBeTruthy()
  })

  it('a broken chain names the first bad row and the reason, never «intact»', () => {
    render(
      <AuditIntegrityCard
        t={t}
        isLoading={false}
        verdict={{
          verified: false,
          count: 4,
          legacyUnchained: 0,
          failedAtSeq: 5,
          reason: 'TAIL_REMOVED',
          head: null,
        }}
      />,
    )
    expect(screen.queryByText('The history chain is intact')).toBeNull()
    expect(screen.getByText('The history chain is broken')).toBeTruthy()
    expect(screen.getByText(/First inconsistent row: 5/)).toBeTruthy()
    expect(screen.getByText(/rows were removed from the end/)).toBeTruthy()
  })

  it('a database without the migration is NOT shown as verified', () => {
    render(
      <AuditIntegrityCard
        t={t}
        isLoading={false}
        verdict={{
          verified: false,
          count: 0,
          legacyUnchained: 0,
          migrationRequired: true,
          head: null,
        }}
      />,
    )
    expect(screen.queryByText('The history chain is intact')).toBeNull()
    expect(screen.getByText('The history chain is not enabled on this database')).toBeTruthy()
  })

  it('a failed read is an error branch, never «no chain»', () => {
    render(<AuditIntegrityCard t={t} isLoading={false} verdict={undefined} error="Network Error" />)
    expect(screen.getByText('The chain verdict could not be read.')).toBeTruthy()
    expect(screen.getByText('Network Error')).toBeTruthy()
  })
})
