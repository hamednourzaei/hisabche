// ============================================
// backend/src/__tests__/subscription-upgrade-requests.test.ts
// Unit Tests for Self-Service Commercial Upgrade Flow
// ============================================

import { describe, expect, it } from 'vitest'
import { subscriptionUpgradeService } from '../services/subscription-upgrade.service'

describe('subscriptionUpgradeService contract and exports', () => {
  it('exposes request, history, cancel, listForAdmin, approve, and reject methods', () => {
    expect(subscriptionUpgradeService).toBeDefined()
    expect(typeof subscriptionUpgradeService.request).toBe('function')
    expect(typeof subscriptionUpgradeService.history).toBe('function')
    expect(typeof subscriptionUpgradeService.cancel).toBe('function')
    expect(typeof subscriptionUpgradeService.listForAdmin).toBe('function')
    expect(typeof subscriptionUpgradeService.approve).toBe('function')
    expect(typeof subscriptionUpgradeService.reject).toBe('function')
  })
})
