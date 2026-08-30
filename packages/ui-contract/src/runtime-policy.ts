// ============================================
// packages/ui-contract/src/runtime-policy.ts
//
// How much work the client is allowed to do, given the device it is on.
//
// ---------------------------------------------------------------------------
// THE RULE THIS FILE SERVES
//
//   Client complexity must not scale with total product complexity.
//
// What a session costs to run is a function of what is VISIBLE, the current
// business context, what the user is AUTHORIZED to see, the device, and the
// network — never of how much Hisabche happens to contain. A shopkeeper on a
// three-year-old Android opening the invoice list should pay for the invoice
// list, not for manufacturing, payroll and the ledger existing.
//
// ---------------------------------------------------------------------------
// WHAT A DEVICE CLASS MAY NEVER DO
//
//   * change a permission
//   * change a financial figure, or how one is computed
//   * change which records exist, or which are correct
//
// It decides page sizes, prefetching, animation, and how much is rendered at
// once. Nothing else. `assertPolicyIsPresentationOnly` below makes that a
// test-enforced property rather than a convention, because the failure mode —
// a slow phone quietly getting a different total — is invisible until it is
// catastrophic.
//
// Pure data and pure functions. No React, no DOM, no platform APIs: the
// caller measures the device and passes the numbers in.
// ============================================

export type DeviceClass = 'low' | 'balanced' | 'high'
export type Platform = 'web' | 'desktop' | 'mobile'
export type NetworkQuality = 'offline' | 'poor' | 'good'
export type PerformanceMode = 'balanced' | 'fast' | 'battery_saver'

/** What the caller measured. Every field optional: absence means unknown. */
export interface DeviceSignals {
  /** GB of RAM, from navigator.deviceMemory or the native equivalent. */
  memoryGb?: number
  /** Logical cores, from navigator.hardwareConcurrency. */
  cores?: number
  network?: NetworkQuality
  /** 0–1. Below 0.2 with no charger is treated as a constraint. */
  batteryLevel?: number
  charging?: boolean
  /** The device is thermally throttling, if the platform will say so. */
  thermalPressure?: boolean
}

/**
 * Classify the device.
 *
 * Unknown signals classify as `balanced`, never as `high`. A browser that
 * declines to report its memory is usually a privacy-hardened one, not a
 * powerful one, and guessing high is the guess that makes the app unusable.
 */
export function classifyDevice(signals: DeviceSignals): DeviceClass {
  if (signals.thermalPressure) return 'low'

  // A phone under 20% with no charger is a low-power device whatever its specs.
  if (
    signals.batteryLevel !== undefined &&
    signals.batteryLevel < 0.2 &&
    signals.charging === false
  ) {
    return 'low'
  }

  const memory = signals.memoryGb
  const cores = signals.cores

  if (memory === undefined && cores === undefined) return 'balanced'

  if ((memory !== undefined && memory <= 2) || (cores !== undefined && cores <= 2)) return 'low'
  if (memory !== undefined && memory >= 8 && (cores === undefined || cores >= 8)) return 'high'

  return 'balanced'
}

/**
 * What the client may do at this device class, on this platform.
 *
 * Every number here is a PRESENTATION budget. None of them appears in a
 * calculation, a permission, or a stored value.
 */
export interface RuntimePolicy {
  deviceClass: DeviceClass
  platform: Platform
  /** Dashboard widgets rendered at once. The rest load on demand. */
  maxWidgets: number
  /** Rows kept in the DOM by a virtualised list. */
  maxRenderedRows: number
  /** Rows fetched per page. */
  pageSize: number
  /** May the client fetch what it merely expects to need? */
  prefetch: boolean
  /** Mutations per sync batch. Smaller batches survive a poor link. */
  syncBatchSize: number
  /** Charts render at all. A hidden chart is never initialised regardless. */
  charts: boolean
  /** Aggregate chart data server-side down to this many points. */
  maxChartPoints: number
  animations: boolean
  /** Realtime subscriptions for the ACTIVE workspace only, when true. */
  realtime: boolean
}

const BASE: Record<DeviceClass, Omit<RuntimePolicy, 'deviceClass' | 'platform'>> = {
  low: {
    maxWidgets: 3,
    maxRenderedRows: 20,
    pageSize: 20,
    prefetch: false,
    syncBatchSize: 25,
    charts: false,
    maxChartPoints: 30,
    animations: false,
    realtime: false,
  },
  balanced: {
    maxWidgets: 5,
    maxRenderedRows: 35,
    pageSize: 30,
    prefetch: false,
    syncBatchSize: 50,
    charts: true,
    maxChartPoints: 60,
    animations: true,
    realtime: true,
  },
  high: {
    maxWidgets: 8,
    maxRenderedRows: 50,
    pageSize: 50,
    prefetch: true,
    syncBatchSize: 100,
    charts: true,
    maxChartPoints: 100,
    animations: true,
    realtime: true,
  },
}

/**
 * Platform ceilings applied on top of the device class.
 *
 * A phone is not a small desktop. Even a fast one shows fewer widgets and
 * denser pages, because the constraint there is the screen and the battery
 * rather than the processor.
 */
const PLATFORM_CEILING: Record<Platform, Partial<RuntimePolicy>> = {
  mobile: { maxWidgets: 5, maxRenderedRows: 30, pageSize: 25, syncBatchSize: 50 },
  web: {},
  desktop: { maxWidgets: 12, maxRenderedRows: 50 },
}

export function runtimePolicy(
  platform: Platform,
  signals: DeviceSignals,
  mode: PerformanceMode = 'balanced',
): RuntimePolicy {
  const deviceClass = classifyDevice(signals)
  const base = { ...BASE[deviceClass], deviceClass, platform }

  const ceiling = PLATFORM_CEILING[platform]
  const capped: RuntimePolicy = {
    ...base,
    maxWidgets: Math.min(base.maxWidgets, ceiling.maxWidgets ?? base.maxWidgets),
    maxRenderedRows: Math.min(
      base.maxRenderedRows,
      ceiling.maxRenderedRows ?? base.maxRenderedRows,
    ),
    pageSize: Math.min(base.pageSize, ceiling.pageSize ?? base.pageSize),
    syncBatchSize: Math.min(base.syncBatchSize, ceiling.syncBatchSize ?? base.syncBatchSize),
  }

  // A poor or absent link changes the batching and stops speculative work,
  // whatever the hardware can do.
  if (signals.network === 'poor' || signals.network === 'offline') {
    capped.prefetch = false
    capped.syncBatchSize = Math.min(capped.syncBatchSize, 25)
    capped.realtime = signals.network !== 'offline' && capped.realtime
  }

  return applyPerformanceMode(capped, mode)
}

/** The user's own choice, which overrides what the device would have picked. */
export function applyPerformanceMode(policy: RuntimePolicy, mode: PerformanceMode): RuntimePolicy {
  if (mode === 'balanced') return policy

  if (mode === 'battery_saver') {
    return {
      ...policy,
      prefetch: false,
      animations: false,
      charts: false,
      realtime: false,
      maxWidgets: Math.min(policy.maxWidgets, 3),
      maxRenderedRows: Math.min(policy.maxRenderedRows, 20),
      syncBatchSize: Math.min(policy.syncBatchSize, 25),
    }
  }

  // 'fast' — spend more to feel quicker. Still bounded: the point of the
  // budget is that it holds even when the user asks for more.
  return {
    ...policy,
    prefetch: true,
    animations: true,
    charts: true,
    maxWidgets: Math.min(policy.maxWidgets + 2, 12),
    maxRenderedRows: Math.min(policy.maxRenderedRows + 15, 60),
  }
}

/**
 * What a session actually costs, in the only terms that matter.
 *
 * The number depends on visible modules, the row count on screen and the
 * device — NOT on how many modules Hisabche has. The test suite asserts that
 * adding modules to the product leaves this unchanged.
 */
export function sessionCost(input: {
  visibleModules: number
  renderedRows: number
  policy: RuntimePolicy
}): number {
  const { visibleModules, renderedRows, policy } = input
  const rows = Math.min(renderedRows, policy.maxRenderedRows)
  const widgets = Math.min(visibleModules, policy.maxWidgets)

  return widgets * 10 + rows + (policy.charts ? 20 : 0) + (policy.prefetch ? 15 : 0)
}

/**
 * The property that must never break: a runtime policy is presentation only.
 *
 * Exported rather than kept in the test file so any caller can assert it —
 * and so the list of forbidden keys lives next to the type it guards.
 */
export const FINANCIAL_OR_SECURITY_KEYS = [
  'role',
  'permission',
  'permissions',
  'capability',
  'capabilities',
  'workspaceId',
  'branchId',
  'total',
  'amount',
  'price',
  'cost',
  'balance',
  'rounding',
  'precision',
  'currency',
  'taxRate',
] as const

export function assertPolicyIsPresentationOnly(policy: RuntimePolicy): string[] {
  return Object.keys(policy).filter((key) =>
    (FINANCIAL_OR_SECURITY_KEYS as readonly string[]).includes(key),
  )
}
