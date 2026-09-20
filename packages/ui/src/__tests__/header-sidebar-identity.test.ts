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

describe('there is ONE identity control in the bar', () => {
  // ⚠️ THE AVATAR IS GONE, ON PURPOSE.
  //
  // The header used to have two places that both meant «you»: the pill at one
  // end said which role you had, and an avatar at the other end held the
  // account address and sign-out. Neither mentioned the other. The owner asked
  // for them merged into the pill, and for the avatar's place removed — so the
  // old «the avatar is a circle» guard is replaced rather than deleted, and
  // what it protected (one deliberate, reachable control) is asserted here.

  it('⚠️ the pill IS the menu — no second account control', () => {
    expect(header).toContain('const IdentityMenu = memo(')
    expect(header).not.toContain('const AccountMenu = memo(')
    expect(header).not.toContain('<AccountMenu')
  })

  it('sign-out lives inside it, not as a bare button in the bar', () => {
    // It used to sit one mis-aimed click from the theme toggle.
    const menu = header.slice(header.indexOf('const IdentityMenu'))
    expect(menu).toContain('onClick={onLogout}')
    expect(menu).toContain('text-[hsl(var(--color-destructive))]')
  })

  it('⚠️ the roster is withheld politely, never rendered as «nobody is online»', () => {
    // An empty list to somebody without `people.presence.read` would be a
    // statement about their colleagues instead of about their permissions.
    const menu = header.slice(header.indexOf('const IdentityMenu'))
    expect(menu).toContain('{!canSeePeople ? (')
    expect(menu).toContain('people.presenceNotAllowed')
  })

  it('⚠️ offline says «offline», never an invented last-seen time', () => {
    // Presence knows the socket is closed, not when it closed.
    const menu = header.slice(header.indexOf('const IdentityMenu'))
    expect(menu).toContain("t('people.offline')")
    expect(menu).not.toMatch(/lastSeen|آخرین بازدید/)
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
  // ⚠️ THE PALETTE MOVED, AND THAT IS CORRECT. It was defined inside the
  // header, where only the header could reach it; the recent-activities feed
  // needed the same colours, and the choice was to copy the map or to share
  // it. A copied palette drifts — one surface gets a new role colour, the
  // other keeps the old one, and the same person is two colours on one screen.
  // These assertions follow it to `lib/role-tone.ts` rather than being
  // relaxed: the rule they protect has not changed.
  const tone = code(join(__dirname, '..', 'lib', 'role-tone.ts'))

  it('⚠️ never gates a control in the header', () => {
    // The only permitted uses are the tone lookup and the label.
    expect(header).toMatch(/roleTone\(role\)/)
    expect(header).not.toMatch(/role === 'owner' \?\s*<[A-Z]/)
  })

  it('⚠️ an unknown role is uncoloured, not «viewer»', () => {
    // Falling back to the lowest role states something about a real person
    // that may be false — an owner shown as view-only while their role loads,
    // or someone who has LEFT the workspace described as a member.
    expect(tone).toMatch(/isRoleName\(role\) \? ROLE_TONE\[role\] : ROLE_TONE_UNKNOWN/)
    expect(tone).toMatch(/roleLabelKey/)
    expect(tone).toMatch(/return 'team\.roleUnknown'/)
  })

  it('there is exactly one role palette', () => {
    // A second literal map is the drift this extraction exists to prevent.
    expect(header).not.toMatch(/const ROLE_TONE/)
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
    // The label for a role the client cannot name. `t()` THROWS on a missing
    // key, so an absent one here takes out the header AND the activity feed.
    ['team', 'roleUnknown'],
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

// ─────────────────────────────────────────────────────────────────────────────
// The logo, and the URL that only worked on the web.
// ─────────────────────────────────────────────────────────────────────────────

describe('the product mark', () => {
  const brand = code(join(UI, 'brand-mark.tsx'))

  it('⚠️ the shell components do not hardcode a root-absolute path', () => {
    // `file:///C:/logo-icon.png` is where `/logo-icon.png` points in the
    // packaged desktop build. The file ships beside index.html.
    expect(header).not.toMatch(/src="\/logo-icon\.png"/)
    expect(sidebar).not.toMatch(/src="\/logo-icon\.png"/)
  })

  it('⚠️ chooses the path by protocol, not by platform', () => {
    // The desktop DEV server is http, where the absolute path is right; only
    // the packaged build reads from disk.
    expect(brand).toMatch(/window\.location\.protocol === 'file:'/)
    expect(brand).toMatch(/'\.\/logo-icon\.png'/)
  })

  it('the server and the browser agree, so hydration survives', () => {
    // `typeof window === 'undefined'` must fall through to the SAME value the
    // browser computes over http, or React 19 throws the tree away.
    expect(brand).toMatch(/typeof window !== 'undefined'/)
  })

  it('⚠️ both surfaces fall back instead of showing a broken image', () => {
    // The sidebar had no `onError` — that is what rendered the broken-image
    // glyph while the header quietly showed its tile.
    expect(brand).toMatch(/onError=\{\(\) => setFailed\(true\)\}/)
    expect(sidebar).toMatch(/<BrandMark/)
    expect(header).toMatch(/<BrandMark/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Where an expired session sends you, and in which language.
// ─────────────────────────────────────────────────────────────────────────────

describe('the redirect guard keeps the locale', () => {
  const layout = code(
    join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'apps',
      'web',
      'app',
      '[lang]',
      '(dashboard)',
      'dashboard-layout.tsx',
    ),
  )

  it('⚠️ never sends a bare path to login', () => {
    // `router.replace('/login')` in an app configured `localePrefix: 'always'`
    // bounced an English or Dari user to the DEFAULT locale's login page. They
    // signed in again and the product was suddenly in another language, with
    // no indication why. Every other navigation in that file already went
    // through `withLocale()`.
    expect(layout).not.toMatch(/router\.replace\('\/login'\)/)
    expect(layout).not.toMatch(/router\.replace\('\/onboarding'\)/)
  })

  it('prefixes both destinations with the active locale', () => {
    expect(layout).toMatch(/const to = \(path: string\) => `\/\$\{currentLang\}\$\{path\}`/)
    expect(layout).toMatch(/router\.replace\(to\('\/login'\)\)/)
    expect(layout).toMatch(/router\.replace\(to\('\/onboarding'\)\)/)
  })

  it('⚠️ the guard reacts to a session that expires mid-visit', () => {
    // `packages/store`'s `setOnUnauthorized` clears the session on any 401, so
    // `isAuthenticated` flips and this effect runs. That is the path an
    // EXPIRED token takes — valid at page load, invalid later, which is what
    // «every request 401s while the dashboard keeps rendering» looked like.
    expect(layout).toMatch(/isAuthenticated/)
    expect(layout).toMatch(/currentLang\]\)/)
  })
})
