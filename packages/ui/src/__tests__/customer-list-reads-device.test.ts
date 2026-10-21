// ============================================
// The customer list reads the DEVICE, even while the network is up.
//
// This is the Always-Local milestone: one existing screen proving that its
// data can come from the local database alone, with no request for it. The
// guard is on the SOURCE, because what regressed here was a coding choice
// ("which source does this screen read?"), and that is exactly what source
// inspection catches.
//
// The behaviour itself — that the device answers, that no request goes out,
// that an empty device falls back to the network — is proved in
// packages/api/src/__tests__/offline-customer-read.test.ts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/** Comments are stripped first: the file explains what it replaced. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const source = stripComments(
  readFileSync(
    join(
      __dirname,
      '..',
      'components',
      'ui',
      'customers',
      'containers',
      'customer-list-container.tsx',
    ),
    'utf8',
  ),
)

describe('the customer list', () => {
  it('asks for the device first, even while the network is up', () => {
    expect(source).toContain('preferDevice: true')
  })

  it('still asks the network for nothing else — the same hook, one option', () => {
    // One hook, one option. A second hook for the device would be a second
    // list that behaves differently from the first.
    expect(source).toMatch(
      /useCustomers\(\s*\{[\s\S]*?\},\s*\{\s*preferDevice: true\s*\}\s*,?\s*\)/,
    )
  })
})
