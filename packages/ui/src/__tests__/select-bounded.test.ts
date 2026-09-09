// ============================================
// The select popup must never be able to grow the page.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// `SelectContent` had no height bound and its viewport carried
// `h-[var(--radix-select-trigger-height)]` — a FIXED height, copied from
// shadcn, not a maximum. The dashboard's «ثبت نرخ» form feeds it
// CURRENCY_CODES: 25 options. The popup rendered all 25 at full height with
// nowhere to scroll, so it grew past the viewport and took the page with it.
//
// And the trigger carried `min-h-[44px]`, which is why the two dashboard
// pickers asking for `h-9` — the height the sidebar rows and header controls
// use — got a 44px control anyway. `min-height` beats `height`.
//
// ---------------------------------------------------------------------------
// ⚠️ COMMENTS ARE STRIPPED BEFORE ASSERTING
//
// Same reason as `header-sidebar-identity.test.ts`: this file and select.tsx
// itself both DISCUSS the defective classes above, so a `not.toMatch` run
// against raw source would fail on the explanation rather than on the code.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const LOCALES = ['fa', 'af', 'en'] as const

function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const select = code(join(ROOT, 'components/ui/select.tsx'))

describe('the dropdown is bounded and scrolls inside itself', () => {
  it('the content is capped at the space Radix measured', () => {
    expect(select).toContain('max-h-[var(--radix-select-content-available-height)]')
  })

  it('the viewport scrolls rather than growing', () => {
    expect(select).toMatch(/max-h-72[^']*overflow-y-auto|overflow-y-auto/)
    expect(select).toContain('max-h-72')
  })

  it('the viewport no longer carries a FIXED height', () => {
    // The exact class that made the list unscrollable.
    expect(select).not.toContain('h-[var(--radix-select-trigger-height)]')
  })

  it('the popup is portalled, so it is outside document flow', () => {
    expect(select).toContain('SelectPrimitive.Portal')
  })

  it('no arbitrary value contains a comma', () => {
    // Tailwind v3 JIT emits NO CSS for `max-h-[min(18rem,var(--x))]`, which is
    // how a height bound gets silently deleted while still reading correctly.
    const arbitrary = select.match(/(?:^|[\s'"`])[a-z-]+-\[[^\]]*\]/g) ?? []
    expect(arbitrary.filter((cls) => cls.includes(','))).toEqual([])
  })
})

describe('the trigger has one fixed height', () => {
  it('the standard size is h-9, the height the rest of the shell uses', () => {
    expect(select).toMatch(/default:\s*'h-9/)
  })

  it('there is a compact variant and nothing else', () => {
    const sizes = /const TRIGGER_SIZE = \{([\s\S]*?)\} as const/.exec(select)?.[1] ?? ''
    const keys = [...sizes.matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
    expect(keys).toEqual(['default', 'compact'])
  })

  it('no min-height overrides the height a caller asks for', () => {
    expect(select).not.toContain('min-h-[44px]')
  })

  it('no caller re-declares a trigger height', () => {
    // A height passed at the call site is how the scale drifts back apart.
    for (const file of [
      'components/ui/dashboard/display-basis-picker.tsx',
      'components/ui/docs/docs-view.tsx',
    ]) {
      const source = code(join(ROOT, file))
      expect(source, file).not.toMatch(/className="[^"]*\bh-1?[01]\b[^"]*"[^>]*/)
    }
  })
})

describe('search is the component’s decision', () => {
  it('the threshold lives in select.tsx, not at the call sites', () => {
    expect(select).toMatch(/const SEARCH_THRESHOLD = \d+/)
    expect(select).toContain('searchable ?? total >= SEARCH_THRESHOLD')
  })

  it('the filter box is RTL-correct — logical properties only', () => {
    expect(select).toContain('paddingInlineStart')
    expect(select).toContain('insetInlineStart')
    // `left`/`right` in a class would pin the magnifier to the wrong edge in
    // Persian and Dari.
    expect(select).not.toMatch(/\b(left|right)-[0-9]/)
  })
})

describe('the search strings exist in every locale', () => {
  // A key missing from ONE catalog makes next-intl's t() throw and takes out
  // the whole page for that language — the failure mode is not a blank label.
  for (const locale of LOCALES) {
    it(`${locale} has select.searchPlaceholder and select.noResults`, () => {
      const messages = JSON.parse(
        readFileSync(join(ROOT, '../../i18n/messages', locale, 'common.json'), 'utf8'),
      ) as { select?: Record<string, unknown> }

      expect(messages.select, `add a "select" block to ${locale}/common.json`).toBeDefined()
      expect(typeof messages.select!.searchPlaceholder).toBe('string')
      expect(typeof messages.select!.noResults).toBe('string')
    })
  }
})

describe('there is still exactly one select implementation', () => {
  it('nothing outside select.tsx builds its own Radix select', () => {
    // The parallel-architecture guardrail: a second content/trigger pair is
    // how the height and the scroll bound diverge again.
    const offenders: string[] = []
    for (const file of ['components/ui/select-field.tsx', 'components/ui/product-picker.tsx']) {
      if (/SelectPrimitive\.(Content|Trigger|Viewport)/.test(code(join(ROOT, file)))) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it('product-picker keeps its SERVER search and opts out of the client one', () => {
    // Not an inconsistency: its box drives `useProducts({ search })`, so it can
    // reach a product outside the loaded page. Filtering the loaded page too
    // would hide a product that does exist.
    const picker = code(join(ROOT, 'components/ui/product-picker.tsx'))
    expect(picker).toContain('searchable={false}')
  })
})
