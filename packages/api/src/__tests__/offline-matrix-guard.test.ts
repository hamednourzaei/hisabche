// A client endpoint without a row in the offline endpoint matrix fails the build.
//
//   new endpoint → no feature, no status → RED
//
// The matrix (@hisabche/validation) is the only place that says whether the
// device can run an endpoint. An endpoint that is not in it would reach the
// engine as an unknown path and fail as a bare 501, with no feature to name and
// no status to word the notice from.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FEATURE_REGISTRY, OFFLINE_ENDPOINT_MATRIX } from '@hisabche/validation'
import { scanClientEndpoints } from './helpers/scan-client-endpoints'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const { endpoints, dynamic } = scanClientEndpoints(root)

describe('every client endpoint is in the offline endpoint matrix', () => {
  it('finds the client endpoints (the scan itself works)', () => {
    expect(endpoints.size).toBeGreaterThan(400)
  })

  it('has no endpoint without a feature and a status', () => {
    const missing = [...endpoints]
      .filter(([key]) => !(key in OFFLINE_ENDPOINT_MATRIX))
      .map(([key, file]) => `${key}   (${file})`)
    expect(missing, 'add each of these to offline-endpoint-matrix.ts').toEqual([])
  })

  it('has no row for an endpoint the client no longer calls', () => {
    const stale = Object.keys(OFFLINE_ENDPOINT_MATRIX).filter((key) => !endpoints.has(key))
    expect(stale, 'remove these rows or restore the call').toEqual([])
  })

  it('names every call whose path is a variable (nothing is skipped in silence)', () => {
    expect(dynamic).toEqual([])
  })

  it('points every row at a feature that exists in the registry', () => {
    for (const [key, [feature]] of Object.entries(OFFLINE_ENDPOINT_MATRIX)) {
      expect(feature in FEATURE_REGISTRY, key).toBe(true)
    }
  })
})
