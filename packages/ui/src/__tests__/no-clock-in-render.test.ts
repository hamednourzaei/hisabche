// ============================================
// Server-rendered components do not read the clock during render.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT BROKE — React #418 (hydration TEXT mismatch) on hisabche.com
//
// `new Date().getFullYear()` in the landing footer and `Date.now()` in every
// «۵ دقیقه پیش» helper ran twice: on the server (UTC, and on ISR pages hours
// earlier) and again in the browser (Kabul, +4:30). The text differed, React
// discarded the server tree and re-rendered it from scratch.
//
// The fix is one shared hook, `useNow()` (hooks/use-now.ts): null on the
// server and on the first client paint, the real time from an effect. This
// test fails if any of the fixed files reads the clock again anywhere except
// inside an effect or a timer callback.
//
// `new Date(x)` WITH an argument is deterministic and allowed; only the two
// zero-argument clock reads are forbidden.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..', 'components', 'ui')

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*/g, '$1')
}

/** Removes every `useEffect( … )` call, balanced on parentheses. */
function withoutEffects(src: string): string {
  let out = src
  for (;;) {
    const start = out.indexOf('useEffect(')
    if (start === -1) return out
    let depth = 0
    let end = start + 'useEffect'.length
    for (; end < out.length; end++) {
      if (out[end] === '(') depth++
      else if (out[end] === ')' && --depth === 0) break
    }
    out = out.slice(0, start) + out.slice(end + 1)
  }
}

function renderClockReads(src: string): string[] {
  return withoutEffects(src).match(/new Date\(\s*\)|Date\.now\(\s*\)/g) ?? []
}

const FIXED = [
  ['landing', 'site-footer.tsx'],
  ['activity', 'ActivityGroupCard.tsx'],
  ['notification-bell.tsx'],
  ['notification-bell', 'EntityActivityCard.tsx'],
  ['sync-status.tsx'],
  ['data-and-sync', 'data-and-sync-view.tsx'],
]

describe('no clock read during render (React #418)', () => {
  it.each(FIXED.map((p) => [p.join('/'), p] as const))('%s', (_name, parts) => {
    const src = code(join(UI, ...parts))
    expect(renderClockReads(src)).toEqual([])
    expect(src).toContain('useNow(')
  })

  it('useNow reads the clock only inside its effect', () => {
    const src = code(join(__dirname, '..', 'hooks', 'use-now.ts'))
    expect(src).toContain('Date.now()')
    expect(renderClockReads(src)).toEqual([])
    expect(src).toContain('useState<number | null>(null)')
  })

  it('the helper itself catches a clock read in render', () => {
    expect(renderClockReads('const y = new Date().getFullYear()')).toHaveLength(1)
    expect(renderClockReads('useEffect(() => { setNow(Date.now()) }, [])')).toEqual([])
  })
})
