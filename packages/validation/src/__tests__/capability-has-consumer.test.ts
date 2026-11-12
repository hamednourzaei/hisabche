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
  CAPABILITY_KEYS,
  deriveEngineOfflineMode,
  ENGINE_KEYS,
  ENGINES,
  USABLE_CAPABILITIES,
  type CapabilityKey,
} from '../schemas/business-capabilities'
import { OFFLINE_ENDPOINT_MATRIX } from '../schemas/offline-endpoint-matrix'

const REPO_ROOT = resolve(__dirname, '../../../..')
const stripQuery = (p: string) => p.split('?')[0]!

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

  it('V60 honesty rule: available requires engine clientHook + uiHost on disk AND offline matrix rows', () => {
    const matrixFeatures = new Set(
      Object.values(OFFLINE_ENDPOINT_MATRIX).map(([feature]) => feature),
    )

    for (const key of AVAILABLE_CAPABILITIES) {
      const def = CAPABILITIES[key]
      expect(def.engine, `${key} missing engine`).not.toBeNull()
      const engine = ENGINES[def.engine!]
      expect(engine, `${key} unknown engine`).toBeDefined()
      expect(engine.clientHook, `${key} engine ${engine.key} missing clientHook`).toBeTruthy()
      expect(engine.uiHost, `${key} engine ${engine.key} missing uiHost`).toBeTruthy()
      expect(
        existsSync(resolve(REPO_ROOT, stripQuery(engine.clientHook!))),
        `${key} clientHook missing on disk: ${engine.clientHook}`,
      ).toBe(true)
      expect(
        existsSync(resolve(REPO_ROOT, stripQuery(engine.uiHost!))),
        `${key} uiHost missing on disk: ${engine.uiHost}`,
      ).toBe(true)
      expect(engine.matrixFeature, `${key} missing matrixFeature`).toBeTruthy()
      expect(
        (matrixFeatures as Set<string>).has(engine.matrixFeature!),
        `${key} matrixFeature "${engine.matrixFeature}" has no row in OFFLINE_ENDPOINT_MATRIX`,
      ).toBe(true)
    }
  })

  it('V60 honesty rule: every USABLE capability + ENGINES path exists on disk and partial names limitations', () => {
    for (const key of USABLE_CAPABILITIES) {
      const def = CAPABILITIES[key]
      expect(def.evidence.sources.length, `${key} needs sources`).toBeGreaterThan(0)
      expect(def.evidence.tests.length, `${key} needs tests`).toBeGreaterThan(0)
      for (const s of [...def.evidence.sources, ...def.evidence.tests]) {
        expect(existsSync(resolve(REPO_ROOT, s)), `${key} missing disk evidence: ${s}`).toBe(true)
      }
      if (def.status === 'partial') {
        expect(def.limitations.length, `${key} partial must name limitations`).toBeGreaterThan(0)
      } else {
        expect(def.limitations, `${key} available must not name limitations`).toEqual([])
      }
    }

    for (const key of ENGINE_KEYS) {
      const e = ENGINES[key]
      for (const file of [e.service, e.localEngine, e.localEngineRoute, e.clientHook, e.uiHost]) {
        if (!file) continue
        expect(
          existsSync(resolve(REPO_ROOT, stripQuery(file))),
          `ENGINES.${key} missing file on disk: ${file}`,
        ).toBe(true)
      }
      expect(e.offline, `ENGINES.${key} offline mismatch`).toBe(
        deriveEngineOfflineMode(e.matrixFeature),
      )
    }
    expect(CAPABILITY_KEYS.length).toBeGreaterThanOrEqual(37)
  })

  it('V61 §2.1 registry truth: clientHook calls engine route, uiHost imports hook, and unregistered engine hooks fail', () => {
    const extractExportedHooks = (hookSrc: string): string[] => {
      const names: string[] = []
      const re = /export\s+(?:function|const)\s+(use[A-Za-z0-9_]+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(hookSrc)) !== null) {
        names.push(m[1]!)
      }
      return names
    }

    const endpointPrefixesForFeature = (matrixFeature: string): string[] => {
      return Object.entries(OFFLINE_ENDPOINT_MATRIX)
        .filter(([, [feat]]) => feat === matrixFeature)
        .map(([methodAndPath]) => {
          const pathOnly = methodAndPath.split(' ')[1] ?? ''
          return pathOnly.split('/:x')[0]!
        })
        .filter((p) => p.length > 1)
    }

    const registeredHooks = new Set<string>()
    for (const key of ENGINE_KEYS) {
      const e = ENGINES[key]
      if (e.clientHook) registeredHooks.add(stripQuery(e.clientHook))
      if (!e.clientHook || !e.matrixFeature) continue

      const hookSrc = readFileSync(resolve(REPO_ROOT, stripQuery(e.clientHook)), 'utf8')
      const prefixes = endpointPrefixesForFeature(e.matrixFeature)
      if (prefixes.length > 0) {
        const callsRoute = prefixes.some((prefix) => hookSrc.includes(prefix))
        expect(
          callsRoute,
          `ENGINES.${key}.clientHook (${e.clientHook}) does not reference any route prefix for ${e.matrixFeature}: ${prefixes.join(', ')}`,
        ).toBe(true)
      }

      if (e.uiHost) {
        const uiSrc = readFileSync(resolve(REPO_ROOT, stripQuery(e.uiHost)), 'utf8')
        const exportedHooks = extractExportedHooks(hookSrc)
        const importedByUi = exportedHooks.some((h) => uiSrc.includes(h))
        expect(
          importedByUi,
          `ENGINES.${key}.uiHost (${e.uiHost}) does not import any exported hook from ${e.clientHook}`,
        ).toBe(true)
      }
    }

    // Specific V61 §1.2 checks: delivery_logistics & contracts_recurring must be wired truthfully
    expect(ENGINES.delivery_logistics.clientHook).toBe('packages/api/src/hooks/universal-core.ts')
    expect(ENGINES.delivery_logistics.uiHost).toBe(
      'packages/ui/src/components/ui/invoices/containers/sales-orders-container.tsx',
    )
    expect(ENGINES.contracts_recurring.clientHook).toBe('packages/api/src/hooks/contracts.ts')
    expect(ENGINES.contracts_recurring.uiHost).toBe(
      'packages/ui/src/components/ui/customers/contracts-section.tsx',
    )

    // Injection test: a hook file calling /contracts must be registered in ENGINES
    expect(registeredHooks.has('packages/api/src/hooks/contracts.ts')).toBe(true)
  })
})
