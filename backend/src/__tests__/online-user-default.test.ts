// ============================================
// An online subscription seats 20 people unless the admin panel says otherwise.
//
// The default lives in one leaf file; the platform admin overrides it per plan
// or per workspace through the layers `effectiveLimits` already merges. This
// pins the default and the override, so «20» cannot silently become «unlimited»
// again and an admin's number still wins over it.
// ============================================

import { describe, expect, it } from 'vitest'

import { defaultsFor } from '../services/plan-limit-defaults'
import { mergeLimits } from '../services/plan-limits.service'

describe('online plans seat 20 people by default', () => {
  it.each(['ONLINE_500', 'ONLINE_1000', 'ONLINE_1500'])('%s', (plan) => {
    expect(defaultsFor(plan).users).toBe(20)
  })

  it('the offline plan is still a single login — its devices are the licence seats', () => {
    expect(defaultsFor('OFFLINE').users).toBe(1)
  })

  it('the admin panel’s number replaces it, and null makes it unlimited', () => {
    const base = defaultsFor('ONLINE_500')
    expect(mergeLimits(base, { users: 35 }).users).toBe(35)
    expect(mergeLimits(base, { users: null }).users).toBeNull()
    // A workspace override beats the plan setting, as before.
    expect(mergeLimits(base, { users: 35 }, { users: 5 }).users).toBe(5)
  })
})
