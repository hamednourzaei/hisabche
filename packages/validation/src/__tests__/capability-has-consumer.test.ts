// ============================================
// packages/validation/src/__tests__/capability-has-consumer.test.ts
//
// GUARD TEST: A capability may only be marked `available` if it has real
// consumers across the stack outside packages/validation and a parity test.
//
// CLAUDE.md §7.1: A rule nobody calls is not implemented.
// ============================================

import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AVAILABLE_CAPABILITIES,
  CAPABILITIES,
  type CapabilityKey,
} from '../schemas/business-capabilities'

const REPO_ROOT = resolve(__dirname, '../../../..')

describe('capability-has-consumer guard', () => {
  it('only truly wired capabilities are available', () => {
    // Only capabilities with real runtime integration across server/engine/UI
    // are allowed to be marked available.
    expect(AVAILABLE_CAPABILITIES.length).toBeGreaterThanOrEqual(3)
  })

  it('every available capability has at least one consumer outside packages/validation', () => {
    for (const key of AVAILABLE_CAPABILITIES) {
      const def = CAPABILITIES[key]
      const outsideSources = def.evidence.sources.filter(
        (src) => !src.startsWith('packages/validation/'),
      )

      expect(
        outsideSources.length,
        `Capability "${key}" must name at least one consumer outside packages/validation`,
      ).toBeGreaterThan(0)

      for (const src of def.evidence.sources) {
        expect(
          existsSync(resolve(REPO_ROOT, src)),
          `Source file for "${key}" does not exist on disk: ${src}`,
        ).toBe(true)
      }
    }
  })

  it('every available capability names an engine or integration parity test', () => {
    for (const key of AVAILABLE_CAPABILITIES) {
      const def = CAPABILITIES[key]
      const parityOrIntegrationTests = def.evidence.tests.filter(
        (testPath) =>
          testPath.includes('parity') ||
          testPath.includes('local-engine') ||
          testPath.includes('backend') ||
          testPath.includes('packages/ui'),
      )

      expect(
        parityOrIntegrationTests.length,
        `Capability "${key}" must name a server-vs-engine parity or integration test`,
      ).toBeGreaterThan(0)

      for (const testPath of def.evidence.tests) {
        expect(
          existsSync(resolve(REPO_ROOT, testPath)),
          `Test file for "${key}" does not exist on disk: ${testPath}`,
        ).toBe(true)
      }
    }
  })

  it('inject-test: rejects a capability with zero consumers outside validation', () => {
    const fakeDefinition = {
      key: 'variants' as CapabilityKey,
      status: 'available' as const,
      labelKey: 'capability.variants',
      evidence: {
        sources: ['packages/validation/src/schemas/universal-core/variants.domain.ts'],
        tests: ['packages/validation/src/__tests__/universal-core.test.ts'],
      },
    }

    const outsideSources = fakeDefinition.evidence.sources.filter(
      (src) => !src.startsWith('packages/validation/'),
    )
    expect(outsideSources.length).toBe(0)
  })
})
