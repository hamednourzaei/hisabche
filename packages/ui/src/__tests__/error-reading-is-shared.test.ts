// Request #101/#102 — one way to read a refused request, everywhere.
//
// ⚠️ `response.data.error` IS THE HTTP STATUS NAME, NOT THE REASON.
//
// Eight containers had their own copy of `data.error ?? err.message`, so a
// 400 whose `message` named the bad field was shown as «Bad Request» — or, in
// the employee form, as a bare «Error» with nothing to act on. This guard
// fails if a ninth copy appears.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI_ROOT = join(__dirname, '..', 'components', 'ui')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.tsx') || entry.endsWith('.ts') ? [full] : []
  })
}

// Source assertions must not match the comments that describe the bug.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const files = walk(UI_ROOT).filter((f) => !f.includes('__tests__'))

describe('every screen reads a refusal the same way', () => {
  it('nobody hand-rolls `data.error` as the message any more', () => {
    const offenders = files.filter((file) => {
      const src = code(readFileSync(file, 'utf8'))
      // The pattern that hid the reason: data.error as the message, with no
      // look at `message` or `details`.
      const readsErrorOnly =
        /data\?\.error\s*\?\?/.test(src) || /response\?\.data\?\.error\s*\|\|/.test(src)
      const readsTheRest = src.includes('apiErrorMessage') || src.includes('apiErrorFields')
      return readsErrorOnly && !readsTheRest
    })

    expect(offenders.map((f) => f.replace(UI_ROOT, ''))).toEqual([])
  })
})

describe('the employee form can be pointed at a field', () => {
  const view = readFileSync(join(UI_ROOT, 'team-and-payroll', 'team-and-payroll-view.tsx'), 'utf8')

  it('every bound control carries the API’s name for it', () => {
    // Without `name`/`data-field` the server can name a field all it likes and
    // nothing on the page can be found, scrolled to or focused.
    const bound = view.match(/setField\('(\w+)'\)/g) ?? []
    const named = new Set(
      [...view.matchAll(/(?:name|data-field)="(\w+)"/g)].map((match) => match[1]),
    )
    const missing = [...new Set(bound.map((b) => /setField\('(\w+)'\)/.exec(b)?.[1]))].filter(
      (field) => field && !named.has(field),
    )
    expect(missing).toEqual([])
  })

  it('renders the server’s complaint under the field it belongs to', () => {
    expect(view).toContain('employeeFieldErrors')
    expect(view).toContain('const fieldError = (name: string) =>')
    expect((view.match(/\{fieldError\('/g) ?? []).length).toBeGreaterThanOrEqual(10)
  })
})
