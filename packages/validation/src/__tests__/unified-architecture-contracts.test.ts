// PART 5 / PART 7: the contract-level work that unlocks Slice 4/5/6 and the
// offline onboarding behaviour. Pure rules — no database, no host, no network.

import { describe, expect, it } from 'vitest'
import {
  evaluateDeviceTopology,
  evaluateHybridActivation,
  evaluateOfflineOnboarding,
  shouldReplayAsMutation,
  evaluateArchivePreflight,
} from '../schemas/universal-core'

const fullActivation = {
  importReconciled: true,
  deviceRegistered: true,
  baselineCursorEstablished: true,
  pendingMutationsReconciled: true,
  localDatabasePreserved: true,
}

describe('flexible device topology contracts (PART 5 Slice 6)', () => {
  it('PRIMARY_DEVICE is the only operational role in this release', () => {
    const primary = evaluateDeviceTopology({
      role: 'PRIMARY_DEVICE',
      hasLocalDatabase: true,
      authenticatedWithLocalServer: false,
    })
    expect(primary).toEqual({ allowed: true, operational: true, reason: 'OK' })
  })

  it('LAN roles are contracts, not advertised operational capabilities', () => {
    const server = evaluateDeviceTopology({
      role: 'LOCAL_SERVER',
      hasLocalDatabase: true,
      authenticatedWithLocalServer: false,
    })
    const client = evaluateDeviceTopology({
      role: 'LAN_CLIENT',
      hasLocalDatabase: true,
      authenticatedWithLocalServer: false,
    })
    expect(server.operational).toBe(false)
    expect(client.operational).toBe(false)
    expect(client.reason).toBe('NO_LAN_AUTHENTICATION')
  })

  it('no local database is never a healthy state', () => {
    expect(
      evaluateDeviceTopology({
        role: 'PRIMARY_DEVICE',
        hasLocalDatabase: false,
        authenticatedWithLocalServer: false,
      }).allowed,
    ).toBe(false)
  })
})

describe('offline onboarding behaviour (PART 7 §6)', () => {
  it('incomplete onboarding resumes at the reached step and never claims cloud activation', () => {
    const d = evaluateOfflineOnboarding({
      localCompletedAt: null,
      localStep: 4,
      cloudActivated: false,
      nextRequiredStep: 5,
    })
    expect(d.state).toBe('INCOMPLETE_READY')
    expect(d.resumeStep).toBe(4)
    expect(d.mayUseBusinessOffline).toBe(false)
    expect(d.mayClaimCloudActivated).toBe(false)
  })

  it('an unreadable step resumes at the next mandatory step, not an empty dashboard', () => {
    const d = evaluateOfflineOnboarding({
      localCompletedAt: null,
      localStep: -1,
      cloudActivated: false,
      nextRequiredStep: 3,
    })
    expect(d.resumeStep).toBe(3)
  })

  it('a locally complete workspace keeps working offline without a cloud claim', () => {
    const d = evaluateOfflineOnboarding({
      localCompletedAt: '2026-11-19T00:00:00Z',
      localStep: 8,
      cloudActivated: false,
      nextRequiredStep: null,
    })
    expect(d.state).toBe('COMPLETE_OFFLINE')
    expect(d.mayUseBusinessOffline).toBe(true)
    expect(d.mayClaimCloudActivated).toBe(false)
  })

  it('a stale server answer cannot take completed local work away', () => {
    const d = evaluateOfflineOnboarding({
      localCompletedAt: '2026-11-19T00:00:00Z',
      localStep: 8,
      cloudActivated: true,
      nextRequiredStep: null,
    })
    expect(d.state).toBe('COMPLETE')
    expect(d.mayUseBusinessOffline).toBe(true)
  })
})

describe('archive preflight (PART 5 Slice 4)', () => {
  const manifest = {
    formatVersion: 1,
    sourceSchemaVersion: 35,
    supportedFormatVersions: [1],
    maxSupportedSchemaVersion: 40,
    requiredSections: ['invoice', 'journal_entry'],
    presentSections: ['invoice', 'journal_entry'],
    totalChecksumMatches: true,
  }
  const identity = { sourceWorkspaceId: 'ws-1', packageChecksum: 'abc123' }

  it('a valid archive is ready with a deterministic, time-free idempotency key', () => {
    const d = evaluateArchivePreflight(manifest, identity)
    expect(d.ready).toBe(true)
    expect(d.idempotencyKey).toBe('migrate:ws-1:abc123')
  })

  it('each broken prerequisite is named and blocks the import', () => {
    const d = evaluateArchivePreflight(
      {
        ...manifest,
        formatVersion: 99,
        sourceSchemaVersion: 99,
        presentSections: [],
        totalChecksumMatches: false,
      },
      identity,
    )
    expect(d.ready).toBe(false)
    expect(d.blockers).toContain('UNSUPPORTED_FORMAT_VERSION')
    expect(d.blockers).toContain('UNSUPPORTED_SCHEMA_VERSION')
    expect(d.blockers).toContain('MISSING_SECTION:invoice')
    expect(d.blockers).toContain('CHECKSUM_MISMATCH')
    expect(d.idempotencyKey).toBeNull()
  })
})

describe('hybrid activation (PART 5 Slice 5)', () => {
  it('all prerequisites must hold before activation', () => {
    expect(evaluateHybridActivation(fullActivation).mayActivate).toBe(true)
  })

  it('each missing prerequisite blocks activation by name', () => {
    const d = evaluateHybridActivation({
      ...fullActivation,
      importReconciled: false,
      deviceRegistered: false,
    })
    expect(d.blockers).toEqual(
      expect.arrayContaining(['IMPORT_NOT_RECONCILED', 'DEVICE_NOT_REGISTERED']),
    )
  })

  it('imported history is never replayed as a new business event', () => {
    expect(shouldReplayAsMutation('IMPORTED_HISTORY')).toBe(false)
    expect(shouldReplayAsMutation('POST_ACTIVATION_CLOUD')).toBe(false)
    expect(shouldReplayAsMutation('PRE_MIGRATION_PENDING')).toBe(true)
    expect(shouldReplayAsMutation('POST_ACTIVATION_LOCAL')).toBe(true)
  })
})
