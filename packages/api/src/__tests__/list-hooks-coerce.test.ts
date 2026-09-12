// ============================================
// A hook that promises a list must return one.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT HAPPENED
//
// Every list hook in this package declared its shape and never checked it:
//
//     queryFn: async (): Promise<BOM[]> => { … return data }
//     return data as StockBatch[]
//     return (data as RateQuote[]) ?? []
//
// A type annotation is not a runtime check, and `??` substitutes only for
// `null`/`undefined` — so anything else the endpoint returns passes through
// wearing the type of an array. The first `.map` over it throws:
//
//     TypeError: (boms ?? []).map is not a function
//     TypeError: (quotes ?? []) is not iterable
//
// and React Router's boundary replaces the whole screen with an error page.
// The dashboard went down through `useExchangeRates`; manufacturing went down
// through `useBoms`. It was ONE defect copied across twenty-seven call sites,
// and fixing the two that were reported would have left twenty-five.
//
// ⚠️ THE COMPILER CANNOT CATCH THIS. Both sides are `any` at the network
// boundary — `apiClient.get` returns whatever arrived, and the annotation on
// the queryFn asserts rather than narrows. Only reading the source finds it.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { asList } from '../lib/as-list'

const HOOKS = join(__dirname, '..', 'hooks')

describe('asList', () => {
  it('passes an array through unchanged', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    expect(asList(rows)).toBe(rows)
  })

  it('⚠️ turns the shapes that crashed into an empty list', () => {
    // Each of these reached a `.map` in production.
    expect(asList({})).toEqual([])
    expect(asList({ error: 'Forbidden' })).toEqual([])
    expect(asList({ data: [1, 2] })).toEqual([])
    expect(asList('<!doctype html>')).toEqual([])
    expect(asList(42)).toEqual([])
  })

  it('handles the ordinary empty cases', () => {
    expect(asList(null)).toEqual([])
    expect(asList(undefined)).toEqual([])
  })

  it('the result is always safe to map and iterate', () => {
    for (const value of [null, undefined, {}, 'x', 7, { data: [] }]) {
      expect(() => asList(value).map((x) => x)).not.toThrow()
      expect(() => [...asList(value)]).not.toThrow()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('every list hook coerces', () => {
  const files = readdirSync(HOOKS).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

  it('found the hooks', () => {
    // A moved directory would make the rule below vacuous.
    expect(files.length).toBeGreaterThan(20)
  })

  it('⚠️ no queryFn promising a list returns an unchecked value', () => {
    const offenders: string[] = []

    for (const file of files) {
      const lines = readFileSync(join(HOOKS, file), 'utf8').split('\n')

      lines.forEach((line, index) => {
        // `queryFn: async (…): Promise<X[]> =>`
        const declaresList =
          /queryFn:\s*async\s*\([^)]*\)\s*:\s*Promise<\s*[A-Za-z_][\w.]*\[\]\s*>/.test(line)

        if (declaresList) {
          // The first `return` inside the function body is the one that matters.
          for (let j = index; j < Math.min(index + 30, lines.length); j++) {
            const body = lines[j] ?? ''
            if (!/^\s*return\s/.test(body)) continue
            if (!/asList|Array\.isArray/.test(body)) {
              offenders.push(`${file}:${j + 1}  ${body.trim()}`)
            }
            break
          }
        }

        // `return data as X[]` — the same assertion written inline.
        if (
          /^\s*return \(?data as [A-Za-z_][\w.]*\[\]/.test(line) &&
          !/asList|Array\.isArray/.test(line)
        ) {
          offenders.push(`${file}:${index + 1}  ${line.trim()}`)
        }
      })
    }

    expect(
      [...new Set(offenders)],
      'these return the network payload as a list without checking it is one — the first .map() over the result throws and takes the screen down',
    ).toEqual([])
  })

  it('⚠️ `?? []` is never used as the check on its own', () => {
    // It only covers null/undefined. It reads like a guard and is not one,
    // which is why the defect survived so long in plain sight.
    const offenders: string[] = []

    for (const file of files) {
      const lines = readFileSync(join(HOOKS, file), 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (
          /^\s*return \(?data[^)]*\)? \?\? \[\]/.test(line) &&
          !/asList|Array\.isArray/.test(line)
        ) {
          offenders.push(`${file}:${index + 1}  ${line.trim()}`)
        }
      })
    }

    expect(offenders, '`?? []` does not make a non-array safe').toEqual([])
  })
  it('⚠️ no network payload is iterated or returned through `?? []`', () => {
    // The same defect not on a `return data` line: `(data ?? []).map(...)`
    // inside a queryFn, `return body?.history ?? []`, and a derived
    // `(query.data?.units ?? []).filter(...)`. All four shapes were in this
    // directory — `/interactions`, `/units`, the record history and the
    // workflow instances. Comments are stripped so an explanation of the bug
    // does not read as the bug.
    const ITERATED =
      /\(\s*(?:data|body|query\.data)[\w?.]*\s*(?:\?\?|\|\|)\s*\[\]\s*\)\s*\.(?:map|filter|reduce|forEach|find|some|every|slice|sort|flatMap)\(/
    const RETURNED = /return\s+(?:data|body)\??\.[\w?.]+\s*\?\?\s*\[\]\s*$/
    const offenders: string[] = []

    for (const file of files) {
      const code = readFileSync(join(HOOKS, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      code.split(String.fromCharCode(10)).forEach((line, index) => {
        if ((ITERATED.test(line) || RETURNED.test(line)) && !/asList|Array\.isArray/.test(line)) {
          offenders.push(`${file}:${index + 1}  ${line.trim()}`)
        }
      })
    }

    expect(offenders, '`?? []` does not make a non-array safe').toEqual([])
  })
})
