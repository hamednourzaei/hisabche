// BUG-004 — dates sent to the API are LOCAL calendar days, never the UTC day
// from toISOString(). East of Greenwich local midnight is the previous UTC day.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toIsoDay } from '@hisabche/formatting'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('toIsoDay is the local day', () => {
  it('local midnight stays on its own day', () => {
    const midnight = new Date(2026, 8, 14, 0, 0, 0)
    expect(toIsoDay(midnight)).toBe('2026-09-14')
  })
})

describe('guard: no UTC day slicing in client code', () => {
  const roots = [
    join(__dirname, '..'),
    join(__dirname, '../../../api/src'),
    join(__dirname, '../../../../apps/mobile/src'),
  ]
  // Deliberately UTC: moves a `YYYY-MM-DD` string by whole days in UTC.
  const ALLOWED = ['use-dashboard-data.ts', 'shared/lib/format.ts'] // display fallback only
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '__tests__') continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name)) files.push(full)
    }
  }
  roots.forEach(walk)

  it('every hit is on the allow-list', () => {
    const offenders = files.filter((file) => {
      const src = strip(readFileSync(file, 'utf8'))
      const hits =
        src.match(/toISOString\(\)\.(slice\(0, ?10\)|split\('T'\)\[0\]|substring\(0, ?10\))/g) ?? []
      if (hits.length === 0) return false
      return !ALLOWED.some((suffix) => file.split('\\').join('/').endsWith(suffix))
    })
    expect(offenders.map((f) => f.split(/packages|apps/).pop())).toEqual([])
  })

  it('the dashboard range uses the local day (the shiftDay helper is the only UTC use there)', () => {
    const src = strip(
      readFileSync(join(__dirname, '../hooks/dashboard/use-dashboard-data.ts'), 'utf8'),
    )
    expect(src).toContain('toIsoDay(dateRange.from)')
    expect(src.match(/toISOString\(\)\.slice\(0, 10\)/g)).toHaveLength(1)
  })
})
