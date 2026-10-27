// ============================================
// Nobody reads a list FLAG by hand again.
//
// `'' === 'true'` is false, `z.coerce.boolean()` makes the text 'false' TRUE, and
// `query.x !== undefined` passes for `''` — each turns an UNSET filter into a
// real one («inactive products only»; 26 Oct 2026). One definition decides:
// `flagFilter` in @hisabche/validation (schemas/filter-contract.ts).
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..')
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

function sources(dir: string): Array<{ file: string; code: string }> {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({
      file: join(dir, name),
      code: stripComments(readFileSync(join(dir, name), 'utf8')),
    }))
}

const ROUTES = [
  ...sources(join(REPO, 'backend', 'src', 'routes')),
  ...sources(join(REPO, 'packages', 'local-engine', 'src', 'routes')),
]

describe('list flags go through the filter contract', () => {
  it('no route coerces a boolean from text', () => {
    const offenders = ROUTES.filter(({ code }) => /z\.coerce\.boolean\(/.test(code)).map(
      (r) => r.file,
    )
    expect(offenders).toEqual([])
  })

  it('no route compares a list flag with the text «true» by hand', () => {
    const flag = /\b(isActive|lowStock|hasBalance|includeSummary)\b\s*===\s*['"]true['"]/
    const offenders = ROUTES.filter(({ code }) => flag.test(code)).map((r) => r.file)
    expect(offenders).toEqual([])
  })

  it('the routes that list products, customers and suppliers use flagFilter', () => {
    for (const rel of [
      ['backend', 'src', 'routes', 'product.routes.ts'],
      ['backend', 'src', 'routes', 'customer.routes.ts'],
      ['backend', 'src', 'routes', 'supplier.routes.ts'],
      ['packages', 'local-engine', 'src', 'routes', 'products.ts'],
      ['packages', 'local-engine', 'src', 'routes', 'customers.ts'],
      ['packages', 'local-engine', 'src', 'routes', 'purchasing.ts'],
    ]) {
      expect(readFileSync(join(REPO, ...rel), 'utf8'), rel.join('/')).toContain('flagFilter(')
    }
  })

  it('the engine drops an unset parameter once, at its door', () => {
    const door = readFileSync(join(REPO, 'packages', 'local-engine', 'src', 'index.ts'), 'utf8')
    expect(door).toContain('isUnsetValue(v)')
    expect(door).not.toMatch(/String\(v \?\? ''\)/)
  })
})
