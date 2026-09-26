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
    ['products.ts', "apiClient.get<Page>('/products', { params: mergedFilters, signal })"],
    ['customers.ts', 'params: filters,\n        signal,'],
    ['invoices.ts', 'params: filters,\n        signal,'],
    ['invoices.ts', 'queryFn: async ({ pageParam, signal })'],
  ])('%s', (file, needle) => {
    expect(code(file).split('\r\n').join('\n')).toContain(needle)
  })

  it('an aborted product search never falls back to the device database', () => {
    expect(code('products.ts')).toContain('if (signal.aborted) throw error')
  })
})
