// ============================================
// A `contains` filter on jsonb must be sent as JSON TEXT.
//
// postgrest-js (@supabase/postgrest-js v2) builds the filter as:
//   typeof value === 'string'  -> `cs.${value}`
//   Array.isArray(value)       -> `cs.{${value.join(',')}}`
//   otherwise                  -> `cs.${JSON.stringify(value)}`
//
// So `.contains('customers_snapshot', [{ id }])` became `cs.{[object Object]}`,
// PostgREST answered 22P02 and the CRM tab of EVERY customer showed
// «اطلاعات CRM این مشتری خوانده نشد» (20 Nov 2026). The same trap applies to
// `containedBy` and `overlaps`, which join their array argument the same way.
//
// Passing `JSON.stringify([...])` hits the string branch and sends valid jsonb.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..')
const SRC = join(REPO, 'backend', 'src')

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : sources(full)
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : []
  })
}

describe('postgrest containment is text, never an array', () => {
  it('no containment filter receives an array literal', () => {
    // `[` right after the value is the shape postgrest-js joins by hand:
    // contains/containedBy/overlaps do it themselves, and `filter`/`not`
    // interpolate the value with Template String — same `[object Object]`.
    const direct = /\.(contains|containedBy|overlaps)\(\s*(['"`])[^'"`]+\2\s*,\s*\[/
    const generic = /\.(filter|not)\(\s*(['"`])[^'"`]+\2\s*,\s*(['"`])(cs|cd|ov)\3\s*,\s*\[/
    const offenders = sources(SRC)
      .filter((file) => {
        const code = stripComments(readFileSync(file, 'utf8'))
        return direct.test(code) || generic.test(code)
      })
      .map((file) => file.slice(REPO.length + 1).replace(/\\/g, '/'))
    expect(offenders).toEqual([])
  })

  it('the customer snapshot filter sends JSON text', () => {
    const repo = stripComments(
      readFileSync(join(SRC, 'services', 'crm', 'crm.repository.ts'), 'utf8'),
    )
    expect(repo).toContain(".contains('customers_snapshot', JSON.stringify([{ id: customerId }]))")
  })

  it('a database without the snapshot column still answers with the primary matches', () => {
    const repo = stripComments(
      readFileSync(join(SRC, 'services', 'crm', 'crm.repository.ts'), 'utf8'),
    )
      .replace(/\s+/g, ' ')
      .trim()
    // 42703 on the snapshot-only read is «no task was sent to a snapshot», and
    // must not take the whole CRM tab down.
    expect(repo).toContain(
      'if (onSnapshot.error) { if (!isMissingColumn(onSnapshot.error)) { throw new DatabaseError(',
    )
    expect(repo).toContain('return primary.rows')
  })
})
