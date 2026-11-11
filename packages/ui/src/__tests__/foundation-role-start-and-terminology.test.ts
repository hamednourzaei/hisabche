import { describe, expect, it } from 'vitest'
import { ARCHETYPE_PRESETS, inferOperationalDna } from '@hisabche/validation'
import {
  resolveRoleStartScreen,
  type StartScreenRole,
} from '../components/ui/dashboard/DashboardRegistry'

describe('W4: Role × Archetype Start Screen Matrix', () => {
  const roles: StartScreenRole[] = [
    'owner',
    'branch_manager',
    'cashier',
    'storekeeper',
    'salon_reception',
    'stylist',
    'exchange_dealer',
    'repair_technician',
    'accountant',
  ]

  it('never infers permission from a manager/stylist/dealer role name — capability gates win', () => {
    const denyAll = () => false
    for (const role of roles) {
      const resolved = resolveRoleStartScreen({
        role,
        dna: ARCHETYPE_PRESETS.SALON_MULTI_STAFF,
        can: denyAll,
        blockedModules: [],
      })
      const withRequiredCaps = resolved.widgets.filter((w) => w.requiredCapability !== null)
      expect(withRequiredCaps).toEqual([])
    }
  })

  it('hides inventory widgets for service businesses with NONE inventory and flags UNRESOLVED gaps', () => {
    const resolved = resolveRoleStartScreen({
      role: 'storekeeper',
      dna: inferOperationalDna({ holdsStock: 'no' }),
      can: () => true,
    })
    expect(resolved.widgets).toEqual([])

    const unresolved = resolveRoleStartScreen({
      role: 'owner',
      dna: inferOperationalDna({ holdsStock: 'unknown' }),
      can: () => true,
    })
    expect(unresolved.setupGaps).toEqual(
      expect.arrayContaining([
        'OFFERING_UNRESOLVED',
        'INVENTORY_UNRESOLVED',
        'WORKFORCE_UNRESOLVED',
      ]),
    )
  })

  it('filters destinations against NAV_MODULE blockedModules', () => {
    const resolved = resolveRoleStartScreen({
      role: 'exchange_dealer',
      dna: ARCHETYPE_PRESETS.RETAIL_STORE,
      can: () => true,
      blockedModules: ['payments'],
    })
    expect(resolved.widgets).toEqual([])
  })
})
