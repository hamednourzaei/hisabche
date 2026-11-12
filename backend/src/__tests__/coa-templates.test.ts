import { describe, expect, it } from 'vitest'
import {
  CHART_TEMPLATES_BY_TRADE,
  STANDARD_ACCOUNT_FOR_ROLE,
  type AccountRole,
} from '@hisabche/validation'

describe('B.2.3 Chart-of-accounts templates per trade', () => {
  it('every trade template covers every AccountRole and uses i18n keys', () => {
    const expectedRoles = Object.keys(STANDARD_ACCOUNT_FOR_ROLE) as AccountRole[]
    for (const [trade, entries] of Object.entries(CHART_TEMPLATES_BY_TRADE)) {
      const roles = entries.map((e) => e.role)
      for (const role of expectedRoles) {
        expect(roles, `${trade} missing role ${role}`).toContain(role)
      }
      for (const entry of entries) {
        expect(entry.nameKey).toBe(`accounting.coa.roles.${entry.role}`)
      }
    }
  })
})
