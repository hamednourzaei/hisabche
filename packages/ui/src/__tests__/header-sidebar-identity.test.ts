// ============================================
// The header, the sidebar, and the things that were said twice.
//
// ---------------------------------------------------------------------------
// WHAT THESE GUARD
//
// 1. The business name was rendered in TWO places a few centimetres apart —
//    the header's «سازمان: …» chip and the sidebar's second line — and the
//    chip took the widest slot in the header from the search while offering a
//    dropdown of team members that no caller ever passed.
//
// 2. From `lg` up the app's mark and name were in the header AND directly
//    beneath it in the sidebar.
//
// 3. The avatar was `size-10` with no `shrink-0`: `size` is a BASIS, not a
//    floor, so a narrow row compressed it on one axis only — a circle
//    compressed on one axis is an egg.
//
// 4. A role sent to a browser is a value the browser can edit. It colours a
//    label here and NOTHING else; the guard is that it never becomes a
//    condition around a control.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..', 'components', 'ui')

/**
 * ⚠️ COMMENTS STRIPPED FIRST.
 *
 * Two of these assertions are `not.toMatch`, and they both failed on the
 * comments explaining why the thing they forbid is forbidden — «not
 * `document.documentElement.dir`» is prose ABOUT the defect, sitting directly
 * above the code that avoids it. A guard that reads its own documentation as
 * the violation fails exactly when the code is best explained.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const header = code(join(UI, 'dashboard-header.tsx'))
const sidebar = code(join(UI, 'dashboard-sidebar.tsx'))

describe('the business name is stated once', () => {
  it('⚠️ the header no longer renders an organization chip', () => {
    expect(header).not.toMatch(/<OrganizationMenu/)
    expect(header).not.toMatch(/organizationName\?:/)
  })

  it('⚠️ the sidebar no longer repeats it under the app name', () => {
    expect(sidebar).not.toMatch(/user\.businessName \|\| user\.fullName/)
  })
})

describe('the app is named once per breakpoint', () => {
  it('⚠️ the header hides the mark and the name where the sidebar shows them', () => {
    // `lg` is the breakpoint the sidebar itself appears at.
    expect(sidebar).toMatch(/lg:flex lg:flex-col/)
    expect(header).toMatch(/lg:hidden">\s*<BrandMark/)
  })

  it('the landing page, which has no sidebar, still shows both', () => {
    expect(header).toMatch(/variant === 'landing' && <BrandMark/)
  })
})

describe('the avatar is a circle', () => {
  it('⚠️ has a floor on both axes, not just a basis', () => {
    expect(header).toMatch(/size-10 shrink-0 aspect-square/)
  })
})

describe('the sidebar toggle survives RTL', () => {
  it('⚠️ chooses an icon instead of mirroring one', () => {
    // `scale-x-[-1]` on a directional icon points the wrong way the moment the
    // state changes, which is the exact flip this replaced.
    expect(header).not.toMatch(/scale-x-\[-1\]/)
    expect(header).toMatch(/const pointsStart = collapsed \? !isRtl : isRtl/)
  })

  it('⚠️ reads the direction it is rendered in, not the document root', () => {
    // The dashboard sets `dir` on its own wrapper; the root says `ltr` on a
    // Persian dashboard.
    expect(header).toMatch(/getComputedStyle\(node\)\.direction === 'rtl'/)
    expect(header).not.toMatch(/documentElement\.dir/)
  })

  it('collapsing changes the width, so the content reclaims the space', () => {
    expect(sidebar).toMatch(/collapsed \? 'w-16' : 'w-60'/)
    expect(sidebar).not.toMatch(/-translate-x-full/)
  })

  it('⚠️ a collapsed icon still carries its label', () => {
    expect(sidebar).toMatch(/aria-label=\{collapsed \? item\.label : undefined\}/)
    expect(sidebar).toMatch(/title=\{collapsed \? item\.label : undefined\}/)
  })
})

describe('the missing-name mark', () => {
  it('⚠️ shows nothing when the role is unknown', () => {
    // `null` is «not unambiguous» or «still loading» — guessing «owner» puts an
    // instruction in front of someone who cannot act on it.
    expect(sidebar).toMatch(/role === null \|\| \(hasName && hasBusiness\)\) return null/)
  })

  it('⚠️ treats a whitespace name as no name', () => {
    expect(sidebar).toMatch(/user\?\.fullName\?\.trim\(\)/)
    expect(sidebar).toMatch(/user\?\.businessName\?\.trim\(\)/)
  })

  it('⚠️ is only a button for the owner', () => {
    // A member has no field for their own name; sending them to settings sends
    // them looking for a control that is not there.
    expect(sidebar).toMatch(/isOwner && onOpenSettings \?/)
    expect(sidebar).toMatch(/nav\.missingFixStaff/)
  })
})

describe('the role is decoration', () => {
  it('⚠️ never gates a control in the header', () => {
    // The only permitted uses are the tone lookup and the label.
    const uses = header.match(/\brole\b/g) ?? []
    expect(uses.length).toBeGreaterThan(0)
    expect(header).not.toMatch(/role === 'owner' \?\s*<[A-Z]/)
    expect(header).toMatch(/ROLE_TONE\[role\]/)
  })

  it('an unknown role is uncoloured, not «viewer»', () => {
    expect(header).toMatch(/\(role && ROLE_TONE\[role\]\) \|\|/)
  })
})

describe('every new string exists in every locale', () => {
  const KEYS = [
    ['nav', 'collapseSidebar'],
    ['nav', 'expandSidebar'],
    ['nav', 'missingBoth'],
    ['nav', 'missingYourName'],
    ['nav', 'missingBusinessName'],
    ['nav', 'missingFixOwner'],
    ['nav', 'missingFixStaff'],
    ['team', 'roleOwner'],
    ['team', 'roleAdmin'],
    ['team', 'roleMember'],
    ['team', 'roleViewer'],
  ] as const

  for (const locale of ['fa', 'af', 'en']) {
    const bundle = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'i18n', 'messages', locale, 'common.json'),
        'utf8',
      ),
    ) as Record<string, Record<string, unknown>>

    it.each(KEYS)(`${locale}: %s.%s`, (group, key) => {
      expect(bundle[group]?.[key]).toBeTruthy()
    })
  }
})
