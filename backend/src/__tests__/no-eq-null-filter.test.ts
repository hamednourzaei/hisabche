// ============================================
// `.eq('column', null)` is never what was meant.
//
// PostgREST sends it as `column=eq.null`, i.e. SQL `column = NULL`, which is
// never true: the query succeeds and returns NO ROWS. A mocked supabase client
// returns its fixture whatever the filter, so unit tests stay green.
//
// Third time in this codebase: listWarehouses (`deleted_at`), walk-in payments
// (`customer_id`), and the depreciation worker (`cancelled_at`, BUG-084) —
// which therefore never found a schedule row and never posted depreciation.
// The filter for NULL is `.is('column', null)`.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : sources(full)
    return entry.endsWith('.ts') ? [full] : []
  })
}

describe('no filter compares a column to null with eq/neq', () => {
  const files = sources(SRC)

  it('found the backend sources', () => {
    expect(files.length).toBeGreaterThan(200)
  })

  it('every NULL filter uses .is / .not(…, "is", null)', () => {
    const offenders: string[] = []
    for (const file of files) {
      const lines = strip(readFileSync(file, 'utf8')).split('\n')
      lines.forEach((line, index) => {
        if (/\.(eq|neq)\(\s*['"`][\w.]+['"`]\s*,\s*null\s*\)/.test(line)) {
          offenders.push(`${file.slice(SRC.length)}:${index + 1}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
