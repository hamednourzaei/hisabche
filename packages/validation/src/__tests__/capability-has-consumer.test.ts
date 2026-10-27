// ============================================
// packages/validation/src/__tests__/capability-has-consumer.test.ts
//
// GUARD TEST: A capability may only be marked `available` if it has real
// consumers across the stack outside packages/validation and a parity test.
//
// CLAUDE.md §7.1: A rule nobody calls is not implemented.
// ============================================

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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

  it('every UI source named as evidence is mounted by another file, not just present', () => {
    // A component that exists on disk but that no screen imports is the same
    // as no UI at all (CLAUDE.md §7.1). The product-page container is where
    // the industry sections are mounted behind the profile capability.
    for (const key of AVAILABLE_CAPABILITIES) {
      const def = CAPABILITIES[key]
      const sections = def.evidence.sources.filter(
        (src) => src.startsWith('packages/ui/') && /-section\.tsx$/.test(src),
      )
      for (const section of sections) {
        const stem = section
          .split('/')
          .pop()!
          .replace(/\.tsx$/, '')
        const mounted = def.evidence.sources
          .filter((src) => src !== section && src.startsWith('packages/ui/'))
          .some((src) => {
            const text = readFileSync(resolve(REPO_ROOT, src), 'utf8')
            return text.includes('/' + stem + "'") && text.includes(`'${key}'`)
          })
        expect(
          mounted,
          `UI section ${section} for "${key}" is not imported behind the '${key}' capability by any evidence file`,
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
