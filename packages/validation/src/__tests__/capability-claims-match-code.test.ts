// ============================================
// packages/validation/src/__tests__/capability-claims-match-code.test.ts
//
// V65 · V64 §4 phase 1 — what the capability registry tells a customer must be
// true of the code that is actually on disk.
//
// The defect this guards: `serialized_items` claimed serials «cannot be recorded
// offline» while `POST /operations/serials/issue` was `available` in
// OFFLINE_ENDPOINT_MATRIX and implemented in the local engine. The registry had
// drifted away from the code and every generated document repeated it.
//
// The wiring matrix (`ENGINE-WIRING.csv`) is generated from disk by
// `scripts/capability/wiring-matrix.mjs`; this suite re-reads it and runs the
// pure rules in `capability-claims.domain.ts` against the REAL registry.
// ============================================

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CAPABILITIES, ENGINES, type CapabilityStatus } from '../schemas/business-capabilities'
import {
  CLAIM_LANGUAGES,
  capabilityClaimViolations,
  type ClaimInput,
  type ClaimedCapability,
  type ClaimedEngine,
} from '../schemas/capability-claims.domain'

const ROOT = resolve(__dirname, '../../../..')
const CSV_PATH = resolve(ROOT, 'docs/architecture/universal-core/ENGINE-WIRING.csv')
const GENERATOR = resolve(ROOT, 'scripts/capability/wiring-matrix.mjs')

/** The seven words V65 allows for a wiring status. */
const WIRING_STATUSES = [
  'available',
  'partial',
  'planned',
  'unsupported',
  'unwired',
  'online_required',
  'not_verified',
]

/** Every cell of the generated file is quoted and no value contains a comma. */
function readWiring(): Record<string, string>[] {
  const lines = readFileSync(CSV_PATH, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  const header = lines[0]!.slice(1, -1).split('","')
  return lines.slice(1).map((line) => {
    const cells = line.slice(1, -1).split('","')
    const row: Record<string, string> = {}
    header.forEach((name, index) => {
      row[name] = cells[index] ?? ''
    })
    return row
  })
}

function limitationCodesOf(language: string): string[] {
  const catalogue = JSON.parse(
    readFileSync(resolve(ROOT, 'packages/i18n/messages', language, 'common.json'), 'utf8'),
  ) as { capabilities?: { limitations?: Record<string, string> } }
  return Object.keys(catalogue.capabilities?.limitations ?? {})
}

const wiring = readWiring()
const engineRows = wiring.filter((row) => row.row_type === 'engine')
const capabilityRows = wiring.filter((row) => row.row_type === 'capability')

const claimedEngines: ClaimedEngine[] = Object.values(ENGINES).map((engine) => ({
  key: engine.key,
  localEngine: engine.localEngine,
  offlineStatus: engine.offlineStatus,
}))

const claimedCapabilities: ClaimedCapability[] = Object.entries(CAPABILITIES).map(
  ([key, entry]) => {
    const row = capabilityRows.find((candidate) => candidate.key === key)
    return {
      key,
      status: entry.status,
      engine: entry.engine,
      // Absent row ⇒ «no route answers it»; the cross-check below fails separately.
      hasBackendRoute: Number(row?.backend_route_files ?? '0') > 0,
      limitations: [...entry.limitations],
    }
  },
)

const limitationText: Record<string, string[]> = Object.fromEntries(
  CLAIM_LANGUAGES.map((language) => [language, limitationCodesOf(language)]),
)

const real: ClaimInput = {
  capabilities: claimedCapabilities,
  engines: claimedEngines,
  limitationText,
}

describe('the generated wiring matrix matches the registry', () => {
  it('is not stale', () => {
    const run = spawnSync(process.execPath, [GENERATOR, '--check'], { encoding: 'utf8' })
    expect(run.stderr.trim(), 'run node scripts/capability/wiring-matrix.mjs').toBe('')
    expect(run.status).toBe(0)
  })

  it('has exactly one row per engine and one per capability, in registry terms', () => {
    expect(engineRows.map((row) => row.key).sort()).toEqual(Object.keys(ENGINES).sort())
    expect(capabilityRows.map((row) => row.key).sort()).toEqual(Object.keys(CAPABILITIES).sort())
    expect(engineRows).toHaveLength(20)
    expect(capabilityRows).toHaveLength(38)
  })

  it('says the same status the registry says', () => {
    for (const [key, entry] of Object.entries(CAPABILITIES)) {
      const row = capabilityRows.find((candidate) => candidate.key === key)
      expect(row?.status, key).toBe(entry.status)
      expect(row?.engine ?? '', key).toBe(entry.engine ?? '')
    }
    for (const row of wiring) {
      expect(WIRING_STATUSES, `${row.key}: «${row.status}»`).toContain(row.status)
    }
  })

  it('never claims a chain it did not find', () => {
    for (const engine of Object.values(ENGINES)) {
      const row = engineRows.find((candidate) => candidate.key === engine.key)
      expect(row, engine.key).toBeDefined()
      // The matrix must quote the registry's own path, and that path must exist.
      expect(row!.service).toBe(engine.service ?? '')
      expect(row!.ui_host).toBe(engine.uiHost ?? '')
      expect(row!.client_hook).toBe(engine.clientHook ?? '')
      expect(row!.local_engine).toBe(engine.localEngine ?? '')

      if (engine.service !== null) expect(row!.service_present, engine.service).toBe('true')
      if (engine.uiHost !== null) expect(row!.ui_host_present, engine.uiHost).toBe('true')
      if (engine.clientHook !== null)
        expect(row!.client_hook_present, engine.clientHook).toBe('true')
      if (engine.localEngine !== null) {
        expect(row!.local_engine_present, engine.localEngine).toBe('true')
      }

      if (row!.status === 'available') {
        expect(Number(row!.backend_route_files), engine.key).toBeGreaterThan(0)
      }
      if (row!.status === 'unwired') {
        expect(Number(row!.backend_route_files), engine.key).toBe(0)
        expect(row!.local_engine_present, engine.key).toBe('false')
      }
    }
  })
})

describe('no capability claims what the code contradicts', () => {
  it('the real registry has zero violations', () => {
    const violations = capabilityClaimViolations(real)
    expect(
      violations.map(
        (violation) => `${violation.capability}: ${violation.code} — ${violation.detail}`,
      ),
    ).toEqual([])
  })

  it('every available capability rides an engine that is available offline', () => {
    const available = Object.values(CAPABILITIES).filter((entry) => entry.status === 'available')
    expect(available.length).toBeGreaterThan(0)
    for (const entry of available) {
      const engine = entry.engine === null ? undefined : ENGINES[entry.engine]
      expect(engine?.offlineStatus, entry.key).toBe('available')
      expect(entry.limitations, entry.key).toEqual([])
    }
  })

  it('the serial claim is the true one, not the offline-identity one that was false', () => {
    const serials = CAPABILITIES.serialized_items
    expect(serials.status).toBe('partial')
    expect(serials.limitations).toEqual(['SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY'])
    // The false text must not survive in any language.
    for (const language of CLAIM_LANGUAGES) {
      expect(limitationText[language]).not.toContain('OFFLINE_SERIAL_IDENTITY_MISSING')
    }
  })
})

describe('the rules fire on the registry defect they exist for', () => {
  /** A copy of the real registry entry, so a fixture cannot drift from it. */
  const patch = (key: string, change: Partial<ClaimedCapability>): ClaimInput => ({
    ...real,
    capabilities: claimedCapabilities.map((capability) =>
      capability.key === key ? { ...capability, ...change } : capability,
    ),
  })
  const codesOf = (input: ClaimInput) => capabilityClaimViolations(input).map((v) => v.code)

  it('an «available» capability that carries a limitation is refused', () => {
    const input = patch('measurement', { limitations: ['LINEAR_CUT_LOSS_NOT_TRACKED'] })
    expect(codesOf(input)).toContain('AVAILABLE_WITH_LIMITATION')
  })

  it('an «available» capability on an engine that is not available offline is refused', () => {
    const input = patch('measurement', { engine: 'sales_orders' })
    expect(codesOf(input)).toContain('AVAILABLE_NOT_OFFLINE_AVAILABLE')
  })

  it('a «partial» capability with no reason is refused', () => {
    const input = patch('variants', { limitations: [] })
    expect(codesOf(input)).toContain('PARTIAL_WITHOUT_LIMITATION')
  })

  it('a «planned» capability that carries a limitation is refused', () => {
    const input = patch('table_service', { limitations: ['NO_SERVER_ROUTE_OR_UI_PICKER'] })
    expect(codesOf(input)).toContain('PLANNED_WITH_LIMITATION')
  })

  it('a dangling engine name is refused', () => {
    const input = patch('variants', { engine: 'no_such_engine' })
    expect(codesOf(input)).toContain('UNKNOWN_ENGINE')
  })

  it('a limitation nobody translated is refused', () => {
    const input = patch('variants', { limitations: ['A_CODE_NOBODY_WROTE'] })
    expect(codesOf(input)).toContain('LIMITATION_NOT_TRANSLATED')
  })

  it('«works online only» on an engine that works offline is refused', () => {
    const input = patch('variants', { limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE'] })
    expect(codesOf(input)).toContain('SERVER_ONLY_CLAIM_CONTRADICTED')
  })

  it('«online only» on an engine available offline is refused', () => {
    const input = patch('measurement', { limitations: ['SOMETHING_ONLINE_ONLY'] })
    expect(codesOf(input)).toContain('ONLINE_ONLY_CLAIM_CONTRADICTED')
  })

  it('«there is no route» after the route shipped is refused — the registry defect', () => {
    // `variants` really is served by three route files today.
    expect(claimedCapabilities.find((c) => c.key === 'variants')?.hasBackendRoute).toBe(true)
    const input = patch('variants', { limitations: ['NO_SERVER_ROUTE_OR_UI_PICKER'] })
    expect(codesOf(input)).toContain('NO_ROUTE_CLAIM_CONTRADICTED')
  })

  it('the route-less claim still passes for a capability that has no route', () => {
    // `roll_cutting` has the limitation and no route: the rule must not be a ban
    // on the wording, only on the wording when it has become false.
    const roll = claimedCapabilities.find((capability) => capability.key === 'roll_cutting')
    expect(roll?.hasBackendRoute).toBe(false)
    expect(capabilityClaimViolations(real).map((v) => v.capability)).not.toContain('roll_cutting')
  })
})

describe('claim vocabulary', () => {
  it('every translated limitation code is canonical, in every language', () => {
    for (const language of CLAIM_LANGUAGES) {
      for (const code of limitationText[language]!) {
        expect(code, `${language}: «${code}»`).toMatch(/^[A-Z][A-Z0-9_]*$/)
      }
    }
  })

  it('the three languages carry the same limitation codes', () => {
    const [fa, af, en] = CLAIM_LANGUAGES.map((language) => [...limitationText[language]!].sort())
    expect(af).toEqual(fa)
    expect(en).toEqual(fa)
  })

  it('a capability status is one of the three the registry defines', () => {
    const statuses: CapabilityStatus[] = ['available', 'partial', 'planned']
    for (const row of capabilityRows) {
      expect(statuses, row.key).toContain(row.status)
    }
  })
})
