// ============================================
// BUG-NEW-007: payroll, employee and leave writes need a capability.
//
// They were guarded by membership alone: a seller or a viewer could record a
// paid salary (which books to the ledger) or change an employee's pay. Two
// checks — the capability table says who holds what, and a scan proves that no
// write route in the HR file is left without one, so a route added next year
// cannot quietly go back to «any member».
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { can } from '../services/authorization/authorization.domain'

const SOURCE = readFileSync(join(__dirname, '../routes/human-resources.routes.ts'), 'utf8')
  // Comments are not code: a guard named in a comment is not a guard.
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('HR capabilities', () => {
  it.each(['payroll.write', 'payroll.post', 'employee.write', 'leave.write'] as const)(
    '%s is not held by a seller, and is held by a manager and the owner',
    (capability) => {
      expect(can('seller', capability)).toBe(false)
      expect(can('manager', capability)).toBe(true)
      expect(can('owner', capability)).toBe(true)
    },
  )
})

describe('every write route in the HR file names a capability', () => {
  const routes = [...SOURCE.matchAll(/fastify\.(post|put|patch|delete)\(\s*'([^']+)'/g)]

  it('finds the write routes it is supposed to check', () => {
    expect(routes.length).toBeGreaterThanOrEqual(10)
  })

  for (const match of routes) {
    const at = match.index ?? 0
    // The options object of this route: from the path to the handler.
    const options = SOURCE.slice(at, at + 700).split('async (request')[0] ?? ''
    it(`${match[1]?.toUpperCase()} ${match[2]}`, () => {
      expect(options).toContain('requireCapability(')
    })
  }
})
