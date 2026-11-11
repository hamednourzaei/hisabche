// ============================================
// packages/ui/src/__tests__/unwired-capability-hooks.test.ts
//
// V53 4.6 / Phase D — an API hook nobody consults must never sit beside a capability advertised as COMPLETE.
//
// The audit found a list of hooks in packages/api/src/hooks/universal-core.ts that no screen calls. A hook
// is not a feature: if the capability registry says a trade «has» appointments, serialized items or metal
// rates, a person is entitled to find them in the product. This guard states, for every exported hook,
// either «a screen uses it» or «it is one of the documented unwired ones, and the capability it would
// belong to is NOT marked available».
//
// The documented list can shrink freely (wire one), but a NEW unwired hook fails this test until it is
// either connected or listed with an honest reason.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { CAPABILITIES, type CapabilityKey } from '@hisabche/validation'

const ROOT = join(__dirname, '..', '..', '..', '..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next' || entry === 'out')
      continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    )
      out.push(full)
  }
  return out
}

const hookSource = readFileSync(join(ROOT, 'packages/api/src/hooks/universal-core.ts'), 'utf8')
const hookNames = [...hookSource.matchAll(/export function (use[A-Za-z0-9_]+)/g)].map((m) => m[1]!)

// Read every candidate file ONCE: the check asks the same question of every hook, and re-reading the
// tree per hook made the test slow enough to time out on a cold filesystem cache (the assertion, not the
// scan, is the point).
const consumerSources = [
  ...walk(join(ROOT, 'packages/ui/src')),
  ...walk(join(ROOT, 'packages/app-shell/src')),
  ...walk(join(ROOT, 'apps/web')),
  ...walk(join(ROOT, 'apps/desktop/src')),
]
  .filter((file) => !file.endsWith(join('hooks', 'universal-core.ts')))
  .map((file) => ({ file, text: readFileSync(file, 'utf8') }))

const consumersOf = (hook: string): string[] => {
  const pattern = new RegExp(`\\b${hook}\\b`)
  return consumerSources.filter((source) => pattern.test(source.text)).map((source) => source.file)
}

/**
 * Hooks with no consumer today, and the honest reason. `capability` names the registry entry a person
 * would expect to find them behind; it is asserted NOT to be `available`.
 */
const UNWIRED: Record<string, { capability?: CapabilityKey; reason: string }> = {
  useVehicles: {
    capability: 'auto_fitments',
    reason: 'vehicle records exist for fitment; no vehicle screen is wired',
  },
  useCreateVehicle: {
    capability: 'auto_fitments',
    reason: 'vehicle records exist for fitment; no vehicle screen is wired',
  },
  useRegisterWarranty: {
    capability: 'serialized_items',
    reason: 'warranties are listed on the invoice; the registration button is not wired',
  },
  useOrderDeposits: {
    reason: 'the customer screen uses useCustomerDeposits; the order-scoped list has no screen',
  },
  useAppointments: { reason: 'appointment API only; no scheduling screen' },
  useCreateAppointment: { reason: 'appointment API only; no scheduling screen' },
  useCropCycles: { reason: 'crop-cycle API only; no farm screen' },
  useCreateCropCycle: { reason: 'crop-cycle API only; no farm screen' },
  useConsumePackageCredit: { reason: 'package credits are consumed by the service-delivery path' },
  useReversePackageCredit: { reason: 'package credit API only; no screen' },
  useExpirePackageCredit: { reason: 'package credit API only; no screen' },
  usePackageCreditLedger: { reason: 'package credit ledger API only; no screen' },
}

describe('every universal-core hook is either wired or honestly unwired', () => {
  it('finds the hooks it is supposed to check', () => {
    expect(hookNames.length).toBeGreaterThan(20)
    expect(hookNames).toContain('useOrderDeposits')
  })

  it('a hook with no consumer is on the documented list (a new one fails here)', () => {
    const unwired = hookNames.filter((hook) => consumersOf(hook).length === 0)
    const undocumented = unwired.filter((hook) => !(hook in UNWIRED))
    expect(undocumented, 'wire the hook to a screen, or add it to UNWIRED with a reason').toEqual(
      [],
    )
  })

  it('nothing on the documented list has quietly gained a consumer', () => {
    // When a screen is wired, the entry moves out of the list: this keeps the notes true.
    const stale = Object.keys(UNWIRED).filter((hook) => consumersOf(hook).length > 0)
    expect(stale, 'remove the entry from UNWIRED now that a screen uses it').toEqual([])
  })

  it('no unwired hook belongs to a capability the registry calls AVAILABLE', () => {
    for (const [hook, entry] of Object.entries(UNWIRED)) {
      if (!entry.capability) continue
      expect(
        CAPABILITIES[entry.capability].status,
        `${hook} has no screen; ${entry.capability} must not be advertised as complete`,
      ).not.toBe('available')
    }
  })
})
