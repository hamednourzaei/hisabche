// ============================================
// A request that is no longer wanted is cancelled — and a cancellation is never
// mistaken for "no network".
//
// None of the 131 queries passed React Query's `signal`, so a search that
// changed mid-flight still finished its old request. The search-driven lists
// now pass it. And the API client used to wrap an aborted request like any
// response-less failure — as NETWORK_ERROR, the code the offline paths read as
// "queue it / read the device database".
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import axios from 'axios'
import { describe, expect, it } from 'vitest'

import apiClient from '../lib/client'

describe('an aborted request', () => {
  it('rejects as a cancellation, not as NETWORK_ERROR', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = await apiClient
      .get('/products', { signal: controller.signal, baseURL: 'http://127.0.0.1:9' })
      .catch((e: unknown) => e)
    expect(axios.isCancel(error)).toBe(true)
    expect((error as { code?: string }).code).not.toBe('NETWORK_ERROR')
  })
})

describe("the search-driven lists pass React Query's signal", () => {
  const code = (f: string) =>
    readFileSync(join(__dirname, '..', 'hooks', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it.each([
    ['invoices.ts', 'params: filters,\n        signal,'],
    ['invoices.ts', 'queryFn: async ({ pageParam, signal })'],
  ])('%s', (file, needle) => {
    expect(code(file).split('\r\n').join('\n')).toContain(needle)
  })

  it('products.ts: the signal still travels with the filters', () => {
    // The product list moved into the shared reader (fetchProducts) and the
    // response type gained a name, so the call is written across lines now.
    // The rule is unchanged: the signal travels with the filters.
    expect(code('products.ts')).toMatch(
      /apiClient\.get<[^>]+>\('\/products', \{\s*params: mergedFilters,\s*signal,?\s*\}\)/,
    )
  })

  it('customers.ts: the signal still travels with the filters', () => {
    // The customers' request moved into the shared reader (fetchCustomers), so
    // the request is written there now. The rule this guard exists for — the
    // signal travels with the filters — is unchanged; only the indentation of
    // the call moved, so the check no longer counts spaces.
    expect(code('customers.ts')).toMatch(/params: filters,\s*signal,/)
  })

  it('an aborted product search never falls back to the device database', () => {
    expect(code('products.ts')).toContain('if (signal.aborted) throw error')
  })
})
