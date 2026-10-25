// The offline endpoint matrix: every client endpoint has ONE feature and ONE
// status, and the registry, the resolver and the matrix agree.
import { describe, expect, it } from 'vitest'
import {
  FEATURE_REGISTRY,
  NOT_SUPPORTED_REASONS,
  OFFLINE_ENDPOINT_MATRIX,
  endpointAvailability,
  endpointsOfFeature,
  featureOfflineAvailability,
  normalizeEndpoint,
  resolveEntitlement,
  type FeatureKey,
  type OfflineAvailability,
} from '../index'

const STATUSES: readonly OfflineAvailability[] = ['available', 'online_required', 'not_supported']
const rows = Object.entries(OFFLINE_ENDPOINT_MATRIX)

describe('offline endpoint matrix', () => {
  it('has rows, each one feature and one of the three statuses', () => {
    expect(rows.length).toBeGreaterThan(400)
    for (const [key, [feature, status]] of rows) {
      expect(feature in FEATURE_REGISTRY, `${key} → unknown feature ${feature}`).toBe(true)
      expect(STATUSES.includes(status), `${key} → ${status}`).toBe(true)
      expect(/^(GET|POST|PATCH|PUT|DELETE) \//.test(key), key).toBe(true)
    }
  })

  it('records why a not_supported feature is not an offline capability', () => {
    for (const [key, [feature, status]] of rows) {
      if (status === 'not_supported') {
        expect(NOT_SUPPORTED_REASONS[feature], `${key} has no reason`).toBeTruthy()
      }
    }
  })

  it('never lets a server-only feature be available on the device', () => {
    for (const [key, [feature, status]] of rows) {
      if (FEATURE_REGISTRY[feature].execution === 'server') {
        expect(status, `${key} is ${feature}, a server feature`).not.toBe('available')
      }
    }
  })

  it('never splits a local feature: all of its endpoints run on the device or none do', () => {
    const byFeature = new Map<FeatureKey, Set<OfflineAvailability>>()
    for (const [, [feature, status]] of rows) {
      if (FEATURE_REGISTRY[feature].execution !== 'local') continue
      byFeature.set(feature, (byFeature.get(feature) ?? new Set()).add(status))
    }
    const split: string[] = []
    for (const [feature, statuses] of byFeature) {
      if (statuses.has('available') && statuses.size > 1) {
        const open = endpointsOfFeature(feature).filter(
          (key) => OFFLINE_ENDPOINT_MATRIX[key]?.[1] !== 'available',
        )
        split.push(`${feature}: not on the device → ${open.join(' | ')}`)
      }
    }
    expect(split).toEqual([])
  })

  it('matches a literal segment before a parameter', () => {
    expect(endpointAvailability('GET', '/products/categories')?.key).toBe(
      'GET /products/categories',
    )
    expect(endpointAvailability('GET', '/products/9b2f4c1e-0000-4000-8000-000000000001')?.key).toBe(
      'GET /products/:x',
    )
    expect(endpointAvailability('GET', '/invoices?limit=20')?.key).toBe('GET /invoices')
    expect(endpointAvailability('GET', '/nothing/here')).toBeNull()
    expect(normalizeEndpoint('get', '/invoices/12/related/')).toBe('GET /invoices/:x/related')
  })

  it('answers per feature', () => {
    expect(featureOfflineAvailability('invoice.create')).toBe('available')
    expect(featureOfflineAvailability('invoice.print')).toBe('online_required')
    expect(featureOfflineAvailability('auth.cloud_session')).toBe('not_supported')
    // A feature none of whose endpoints the client calls follows its registry row.
    expect(featureOfflineAvailability('sync.queue')).toBe('available')
  })

  it("is the resolver's offline answer: registered local but not built is online_required", () => {
    const offline = { state: 'OFFLINE_ACTIVE', plan: 'OFFLINE', edition: 'local' } as const
    expect(resolveEntitlement(offline, 'invoice.create')).toEqual({ kind: 'AVAILABLE' })
    expect(FEATURE_REGISTRY['invoice.print'].execution).toBe('local')
    expect(resolveEntitlement(offline, 'invoice.print')).toEqual({ kind: 'REQUIRES_ONLINE' })
    // The cloud edition is unchanged by the matrix.
    const cloud = { state: 'ONLINE_ACTIVE', plan: 'ONLINE_500', edition: 'cloud' } as const
    expect(resolveEntitlement(cloud, 'invoice.print')).toEqual({ kind: 'AVAILABLE' })
  })
})
