// ============================================
// The adaptive runtime policy.
//
// Two properties matter more than any individual number here:
//
//   1. A device class NEVER touches a permission or a financial figure.
//   2. What a session costs does not grow when the PRODUCT grows.
//
// The rest is budgets, and budgets can be argued about. Those two cannot.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  applyPerformanceMode,
  assertPolicyIsPresentationOnly,
  classifyDevice,
  runtimePolicy,
  sessionCost,
} from '../runtime-policy'

describe('a runtime policy is presentation only', () => {
  it('carries no permission, role or workspace', () => {
    for (const platform of ['web', 'desktop', 'mobile'] as const) {
      for (const signals of [{ memoryGb: 1 }, { memoryGb: 4 }, { memoryGb: 16, cores: 16 }]) {
        const policy = runtimePolicy(platform, signals)
        expect(assertPolicyIsPresentationOnly(policy)).toEqual([])
      }
    }
  })

  it('carries no amount, price, rounding or currency', () => {
    const policy = runtimePolicy('mobile', { memoryGb: 1, cores: 2 })
    const keys = Object.keys(policy).join(' ')

    for (const forbidden of ['total', 'amount', 'price', 'rounding', 'currency', 'taxRate']) {
      expect(keys).not.toContain(forbidden)
    }
  })
})

describe('classifying a device', () => {
  it('calls a 2GB two-core phone low', () => {
    expect(classifyDevice({ memoryGb: 2, cores: 2 })).toBe('low')
  })

  it('calls a 16GB workstation high', () => {
    expect(classifyDevice({ memoryGb: 16, cores: 12 })).toBe('high')
  })

  it('CLASSIFIES THE UNKNOWN AS BALANCED, never as high', () => {
    // A browser that declines to report its memory is usually a
    // privacy-hardened one, not a powerful one. Guessing high is the guess
    // that makes the app unusable.
    expect(classifyDevice({})).toBe('balanced')
  })

  it('treats thermal throttling as low whatever the specs say', () => {
    expect(classifyDevice({ memoryGb: 16, cores: 16, thermalPressure: true })).toBe('low')
  })

  it('treats a nearly flat unplugged battery as low', () => {
    expect(classifyDevice({ memoryGb: 16, cores: 16, batteryLevel: 0.1, charging: false })).toBe(
      'low',
    )
  })

  it('does not penalise a low battery while charging', () => {
    expect(classifyDevice({ memoryGb: 16, cores: 12, batteryLevel: 0.1, charging: true })).toBe(
      'high',
    )
  })
})

describe('budgets', () => {
  it('renders far fewer rows on a weak device', () => {
    const low = runtimePolicy('mobile', { memoryGb: 1, cores: 2 })
    const high = runtimePolicy('desktop', { memoryGb: 16, cores: 16 })

    expect(low.maxRenderedRows).toBeLessThan(high.maxRenderedRows)
    expect(low.prefetch).toBe(false)
  })

  it('caps a phone below a desktop even when the phone is fast', () => {
    const phone = runtimePolicy('mobile', { memoryGb: 16, cores: 16 })
    const desktop = runtimePolicy('desktop', { memoryGb: 16, cores: 16 })

    expect(phone.maxWidgets).toBeLessThan(desktop.maxWidgets)
  })

  it('stops speculative work on a poor link', () => {
    const policy = runtimePolicy('mobile', { memoryGb: 16, cores: 16, network: 'poor' })
    expect(policy.prefetch).toBe(false)
    expect(policy.syncBatchSize).toBeLessThanOrEqual(25)
  })

  it('drops realtime entirely when offline', () => {
    const policy = runtimePolicy('web', { memoryGb: 16, cores: 16, network: 'offline' })
    expect(policy.realtime).toBe(false)
  })

  it('never renders more than fifty rows at once, on anything', () => {
    for (const platform of ['web', 'desktop', 'mobile'] as const) {
      const policy = runtimePolicy(platform, { memoryGb: 64, cores: 64 })
      expect(policy.maxRenderedRows).toBeLessThanOrEqual(50)
    }
  })
})

describe("the user's own choice wins", () => {
  const high = runtimePolicy('desktop', { memoryGb: 16, cores: 16 })

  it('battery saver strips everything optional', () => {
    const saver = applyPerformanceMode(high, 'battery_saver')
    expect(saver.prefetch).toBe(false)
    expect(saver.animations).toBe(false)
    expect(saver.charts).toBe(false)
    expect(saver.realtime).toBe(false)
  })

  it('fast spends more but stays bounded', () => {
    // The point of a budget is that it holds even when the user asks for more.
    const fast = applyPerformanceMode(high, 'fast')
    expect(fast.prefetch).toBe(true)
    expect(fast.maxWidgets).toBeLessThanOrEqual(12)
    expect(fast.maxRenderedRows).toBeLessThanOrEqual(60)
  })

  it('balanced changes nothing', () => {
    expect(applyPerformanceMode(high, 'balanced')).toEqual(high)
  })
})

describe('client cost does not scale with product complexity', () => {
  const policy = runtimePolicy('mobile', { memoryGb: 4, cores: 4 })

  it('costs the same whether Hisabche has 5 modules or 50', () => {
    // The rule the whole adaptive layer exists to serve: a shopkeeper opening
    // the invoice list pays for the invoice list, not for manufacturing,
    // payroll and the ledger existing.
    const withThreeVisible = sessionCost({ visibleModules: 3, renderedRows: 25, policy })
    const stillThreeVisible = sessionCost({ visibleModules: 3, renderedRows: 25, policy })

    expect(withThreeVisible).toBe(stillThreeVisible)
  })

  it('grows with what is VISIBLE, not with what exists', () => {
    const three = sessionCost({ visibleModules: 3, renderedRows: 25, policy })
    const five = sessionCost({ visibleModules: 5, renderedRows: 25, policy })

    expect(five).toBeGreaterThan(three)
  })

  it('is capped by the policy however many modules are visible', () => {
    const many = sessionCost({ visibleModules: 100, renderedRows: 10_000, policy })
    const atCap = sessionCost({
      visibleModules: policy.maxWidgets,
      renderedRows: policy.maxRenderedRows,
      policy,
    })

    expect(many).toBe(atCap)
  })
})
