// ============================================
// The activities table's columns line up with their headings.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT WAS ON SCREEN
//
// The header had TWO cells — «رویداد» and «نقش» — over rows with THREE:
// event, role chip, date. So «نقش» sat above the DATE column and named the
// wrong thing.
//
// And the layout was `flex justify-between`, which gives no column to
// anything: the role chip landed wherever the event text happened to stop, so
// the chips staggered left and right down the list instead of forming a
// column. Both defects were plainly visible and neither was a rendering bug —
// the markup said exactly this.
//
// ⚠️ THE ARBITRARY VALUE MUST NOT CONTAIN A COMMA.
// `grid-cols-[minmax(0,1fr)_5rem_6rem]` is the textbook spelling, and
// Tailwind v3's JIT emits NO CSS for an arbitrary value containing a comma —
// the class silently does nothing and the grid falls back to one column. This
// codebase has been bitten by that before; `1fr` + `min-w-0` is the same
// behaviour, spelled so it compiles.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const view = code(join(__dirname, '..', 'components', 'ui', 'dashboard', 'dashboard-view.tsx'))

const TEMPLATE = 'grid-cols-[1fr_5rem_6rem]'

describe('the header and the rows share one template', () => {
  it('⚠️ both use the same grid, so they cannot drift apart', () => {
    const uses = view.split(TEMPLATE).length - 1
    expect(uses).toBe(2)
  })

  it('⚠️ no comma in the arbitrary value — it would compile to nothing', () => {
    expect(view).not.toMatch(/grid-cols-\[[^\]]*,/)
  })

  it('the event cell can shrink, so a long title does not push the columns', () => {
    // `1fr` alone overflows on long content; `min-w-0` is what lets it truncate.
    expect(view).toMatch(/<div className="min-w-0">/)
  })
})

describe('every column is named', () => {
  it('⚠️ there are three headings, not two', () => {
    expect(view).toMatch(/dashboard\.activityColumnEvent/)
    expect(view).toMatch(/dashboard\.activityColumnRole/)
    expect(view).toMatch(/dashboard\.activityColumnDate/)
  })

  it('the date heading exists in every locale', () => {
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'i18n', 'messages', locale, 'common.json'),
          'utf8',
        ),
      ) as { dashboard: Record<string, string> }

      expect(bundle.dashboard.activityColumnDate, `${locale}.activityColumnDate`).toBeTruthy()
    }
  })
})

describe('the cells sit at their column edge', () => {
  it('⚠️ the role chip is pinned, not floated by the text beside it', () => {
    expect(view).toMatch(/justify-self-start rounded-md/)
  })

  it('the dates share a digit width, so their edge is straight', () => {
    expect(view).toMatch(/justify-self-start text-\[11px\] tabular-nums/)
  })

  it('⚠️ the row is no longer justify-between', () => {
    // That is what scattered the chips in the first place.
    expect(view).not.toMatch(/w-full flex items-center justify-between gap-3 py-2\.5/)
  })
})
