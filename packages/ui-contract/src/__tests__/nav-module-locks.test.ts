// ============================================
// Per-member page locks: the menu map must name REAL destinations and REAL
// server modules, or a lock silently does nothing (راهنمای سشن §۷٫۱).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { NAV_CONTRACT, NAV_MODULE, isNavLocked } from '../navigation'

const serverModules = [
  ...readFileSync(
    join(__dirname, '../../../../backend/src/services/authorization/authorization.domain.ts'),
    'utf8',
  ).matchAll(/^\s{4}key: '([a-z_]+)',$/gm),
].map((m) => m[1])

describe('NAV_MODULE', () => {
  it('every mapped path is a real menu destination', () => {
    const paths = new Set(NAV_CONTRACT.map((i) => i.path))
    for (const path of Object.keys(NAV_MODULE)) expect(paths.has(path)).toBe(true)
  })

  it('every module is one the server knows', () => {
    expect(serverModules.length).toBeGreaterThan(5)
    for (const module of Object.values(NAV_MODULE)) expect(serverModules).toContain(module)
  })

  it('home, settings, sync and conflicts are never lockable', () => {
    for (const path of ['/dashboard', '/settings', '/sync-center', '/conflicts']) {
      expect(NAV_MODULE[path]).toBeUndefined()
    }
  })
})

describe('isNavLocked', () => {
  it('locks what belongs to a blocked module, ignoring the query string', () => {
    expect(isNavLocked('/warehouse', ['inventory'])).toBe(true)
    expect(isNavLocked('/warehouse?add=true', ['inventory'])).toBe(true)
    expect(isNavLocked('/invoices', ['inventory'])).toBe(false)
  })
  it('no blocks: nothing is locked', () => {
    expect(isNavLocked('/accounting', [])).toBe(false)
  })
})
