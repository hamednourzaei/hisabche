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
// ---------------------------------------------------------------------------
// ⚠️ CORRECTION — AN EARLIER VERSION OF THIS HEADER WAS WRONG
//
// It claimed Tailwind emits no CSS for an arbitrary value containing a comma,
// and that `grid-cols-[minmax(0,1fr)_…]` therefore silently does nothing.
// That is FALSE, and the repo's own build output disproves it:
//
//     apps/admin/.next/static/chunks/*.css
//       .grid-cols-\[minmax\(0\,1fr\)…\]
//         { grid-template-columns: minmax(0,1fr) … }
//
// plus 60 escaped commas (`\2c`) in the compiled desktop CSS. Commas compile.
// The real silent-failure trap is an unescaped SPACE inside `[...]` — use `_`.
//
// The layout below still uses `1fr` + `min-w-0`, because that is what it
// needs and it works; it is simply not a workaround for a bug that does not
// exist. The assertion that used to forbid commas is gone: enforcing an
// invented rule would make every future session rewrite ~40 working call
// sites believing it was fixing something.
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

  it('⚠️ no unescaped SPACE in the arbitrary value — that is the real trap', () => {
    // A space inside `[...]` ends the class name, so the rest is dropped and
    // the declaration is silently incomplete. `_` is the escape. (A comma is
    // fine — see the correction in this file's header.)
    expect(view).not.toMatch(/grid-cols-\[[^\]]* /)
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
