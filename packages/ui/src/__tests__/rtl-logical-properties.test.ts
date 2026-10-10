// ============================================
// Physical-direction Tailwind classes are RTL bugs.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THIS GUARD EXISTS
//
// Persian and Dari are the primary locales and render `dir="rtl"`; English
// renders `dir="ltr"`. A class that names a PHYSICAL side — `ml-`, `pr-`,
// `left-`, `border-s`, `rounded-r`, `text-left` — is correct in at most one of
// those two and silently wrong in the other. The logical forms (`ms-`, `pe-`,
// `start-`, `border-s`, `rounded-e`, `text-start`) are correct in both.
//
// Real defects this caught:
//   · `me-2` on the datagrid's select-all checkbox put the gap on the OUTER
//     edge in RTL, so the checkbox touched the first column heading.
//   · `ms-auto` on `ProgressValue` absorbs no free space in an RTL flex row,
//     so the value never reached the end of the bar.
//   · `me-auto` on the language menu's ✓ did nothing in English.
//
// ---------------------------------------------------------------------------
// ⚠️ COMMENTS ARE STRIPPED BEFORE ASSERTING.
//
// Prose like «end-aligned», «start-to-right» and a comment naming the very
// class a fix removed would all match the pattern. `activities-table-columns`
// hit this first; the stripping below is the same approach.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS FILE DELIBERATELY DOES NOT BAN COMMAS IN ARBITRARY VALUES.
//
// The folklore is that Tailwind v3's JIT emits nothing for an arbitrary value
// containing a comma. That is NOT true of this build, and the repository's own
// compiled CSS is the proof — e.g. in `apps/admin/.next/static/chunks/*.css`:
//
//   .grid-cols-\[minmax\(0\,1\.2fr\)_minmax\(0\,1\.4fr\)_minmax\(0\,1fr\)\]
//     { grid-template-columns: minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,1fr) }
//
// and in `apps/desktop/out/renderer/assets/index-*.css` the comma is escaped as
// `\2c ` for `ring-[rgba(...)]`, `pb-[max(...,env(safe-area-inset-bottom))]`
// and `animate-[...cubic-bezier(...)]`. Commas compile. What genuinely breaks
// an arbitrary value is an unescaped SPACE — use `_`. A guard banning commas
// would fail on ~40 working call sites and push people to rewrite live CSS for
// no reason, which is worse than no guard at all.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO = join(__dirname, '..', '..', '..', '..')

const ROOTS = [
  join('packages', 'ui', 'src'),
  join('apps', 'web'),
  join('apps', 'admin'),
  join('apps', 'desktop', 'src'),
]

const SKIP =
  /node_modules|[\\/]\.next[\\/]|[\\/]out[\\/]|[\\/]dist[\\/]|[\\/]\.claude[\\/]|[\\/]__tests__[\\/]/

/**
 * Physical-direction utilities, with any variant prefix (`sm:`, `hover:`,
 * `data-[state=open]:` …). `-e`/`-s` and `text-start`/`text-end` are the
 * logical spellings and are deliberately absent.
 */
const PHYSICAL =
  /(?:^|[\s"'`{(])((?:[a-z0-9-]+(?:\[[^\]]*\])?:)*(?:m[lr]-[\w./%[\]-]+|p[lr]-[\w./%[\]-]+|(?:left|right)-[\w./%[\]-]+|text-(?:left|right)|border-[lr](?:-[\w.[\]-]+)?|rounded-[lr](?:-[\w.[\]-]+)?))(?=$|[\s"'`})])/g

/**
 * ⚠️ NOT A TODO LIST — these are the cases where a PHYSICAL side is the
 * correct answer, keyed by file and by the exact class allowed there.
 *
 * A physical class is right when the thing genuinely has a physical side that
 * does not mirror with the writing direction: a shape centred with
 * `left-1/2 -translate-x-1/2` (symmetric, so identical in both directions), a
 * decorative ring's compass points, a gradient mask on both edges at once, or
 * a layout whose sibling `translateX` is itself physical.
 *
 * `dashboard-header.tsx`'s `SidebarToggle` is the canonical example of getting
 * this right WITHOUT a physical class at all: it reads
 * `getComputedStyle(node).direction` and CHOOSES the icon, rather than
 * mirroring one with `scale-x-[-1]`. Prefer that over adding an entry here.
 *
 * Adding an entry requires a reason. Growing this list is not a fix.
 */
const ALLOWED: Record<string, { classes: string[]; why: string }> = {
  'packages/ui/src/components/ui/navigation/top-nav.tsx': {
    classes: ['start-0'],
    why: 'Section-highlight pill: its sibling translateX is itself physical (offset = button.left − list.left from getBoundingClientRect), so the anchor must be the physical left edge in both directions.',
  },
  'packages/ui/src/components/ui/dialog.tsx': {
    classes: ['left-1/2'],
    why: 'Centring: paired with -translate-x-1/2, so it is symmetric and identical under rtl and ltr.',
  },
  'packages/ui/src/components/ui/invite-modal.tsx': {
    classes: ['left-1/2'],
    why: 'Centring the modal: paired with -translate-x-1/2, so it is symmetric and identical under rtl and ltr.',
  },
  'packages/ui/src/components/ui/landing/pricing-scene.tsx': {
    classes: ['left-1/2'],
    why: 'Centring the «محبوب‌ترین» ribbon over the card, paired with -translate-x-1/2.',
  },
  'packages/ui/src/components/ui/notification-bell.tsx': {
    classes: ['start-4', 'end-4'],
    why: 'Both edges at once — the mobile panel is inset equally from each side. The desktop branch beside it already uses end-0.',
  },
  'packages/ui/src/components/ui/landing/transform-scene.tsx': {
    classes: ['start-4', 'sm:left-1/2', 'end-2', 'sm:end-3'],
    why: 'Alternating timeline rail, plus the alert card close button. Both flip visibly in Persian if changed — reported, not silently altered.',
  },
  'packages/ui/src/components/ui/customers/datagrid/drawer.tsx': {
    classes: ['end-0', 'border-s'],
    why: 'Side panel. sheet.tsx (side="end" → end-0 + border-s) is the house pattern and this drawer is inconsistent with it, but switching sides is a visible move in Persian — reported, not silently altered.',
  },
  'packages/ui/src/components/ui/dashboard/date-range-picker.tsx': {
    classes: ['end-2.5', 'start-2.5'],
    why: 'Close button and format select in opposite top corners. dialog.tsx puts close at end-4; adopting that swaps both corners in Persian — reported, not silently altered.',
  },
  'packages/ui/src/components/ui/dashboard-header.tsx': {
    classes: ['start-0'],
    why: 'Language menu anchored to the trigger. start-0 is almost certainly correct, but it moves a 140px popover in Persian — reported, not silently altered.',
  },
}

function sources(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (SKIP.test(full)) continue
      if (entry.isDirectory()) walk(full)
      else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) out.push(full)
    }
  }
  for (const root of ROOTS) walk(join(REPO, root))
  return out
}

/** Blank out comments so prose («end-aligned») cannot trip the pattern. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))
}

describe('layout uses logical properties, not physical sides', () => {
  const files = sources()

  it('the scan actually reaches the source tree', () => {
    // A broken path would make every assertion below pass vacuously.
    expect(files.length).toBeGreaterThan(300)
  })

  it('⚠️ no new ml-/pr-/left-/border-s/rounded-r/text-left outside the documented exceptions', () => {
    const offences: string[] = []

    for (const file of files) {
      const rel = file.slice(REPO.length + 1).replace(/\\/g, '/')
      const allowed = ALLOWED[rel]?.classes ?? []
      const body = code(file)

      body.split('\n').forEach((line, i) => {
        let m: RegExpExecArray | null
        PHYSICAL.lastIndex = 0
        while ((m = PHYSICAL.exec(line))) {
          const cls = m[1]!
          PHYSICAL.lastIndex = m.index + 1
          if (allowed.includes(cls)) continue
          offences.push(`${rel}:${i + 1}  ${cls}`)
        }
      })
    }

    expect(
      offences,
      `use the logical form (ms-/me-, ps-/pe-, start-/end-, border-s/-e, rounded-s/-e, text-start/-end), or add a reasoned entry to ALLOWED:\n${offences.join('\n')}`,
    ).toEqual([])
  })

  it('every exception carries a reason', () => {
    for (const [file, entry] of Object.entries(ALLOWED)) {
      expect(entry.classes.length, `${file} lists no classes`).toBeGreaterThan(0)
      expect(entry.why.length, `${file} has no reason`).toBeGreaterThan(40)
    }
  })
})

describe('the fixed call sites stay fixed', () => {
  const read = (...p: string[]) => code(join(__dirname, '..', ...p))

  it('the datagrid checkboxes space themselves logically', () => {
    const src = read('components', 'ui', 'customers', 'datagrid', 'datagrid.tsx')
    expect(src).toMatch(/className="me-2 size-4 accent-/)
    expect(src).toMatch(/className="ms-4 me-2 size-4 accent-/)
  })

  it('ProgressValue reaches the end of the bar in both directions', () => {
    expect(read('components', 'ui', 'progress.tsx')).toMatch(/'ms-auto text-sm/)
  })

  it('the audit search icon follows the house start-3 + ps-9 pattern', () => {
    const src = read('components', 'ui', 'audit', 'audit-view.tsx')
    expect(src).toMatch(/absolute start-3 top-1\/2/)
    expect(src).toMatch(/ps-9 pe-3 py-2/)
  })
})

// ============================================
// ⚠️ THE ARBITRARY-VALUE TRAP IS A SPACE, NOT A COMMA.
//
// The header of this file explains why a comma ban would be wrong; the
// compiled CSS proves commas work. What genuinely produces NO CSS AT ALL is an
// unescaped space inside `[...]`, because the space ends the class token. The
// class name still looks plausible in the source and in devtools' class list,
// nothing errors, and the element simply falls back to its default layout.
//
// Tailwind's own answer is `_` for a space, which it converts back.
// ============================================

/** `[` … unescaped space … `]` inside an arbitrary value. */
const ARBITRARY_WITH_SPACE = /(?:^|[\s"'`{(])((?:[a-z0-9-]+:)*[a-z-]+-\[[^\]"'`]*\s[^\]"'`]*\])/g

describe('arbitrary values compile', () => {
  it('⚠️ no unescaped space inside [...] — use _ , or the class emits nothing', () => {
    const offences: string[] = []

    for (const file of sources()) {
      if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue
      const rel = file.slice(REPO.length + 1).replace(/\\/g, '/')
      code(file)
        .split('\n')
        .forEach((line, i) => {
          ARBITRARY_WITH_SPACE.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = ARBITRARY_WITH_SPACE.exec(line))) {
            ARBITRARY_WITH_SPACE.lastIndex = m.index + 1
            offences.push(`${rel}:${i + 1}  ${m[1]!}`)
          }
        })
    }

    expect(
      offences,
      `replace each space with _ — Tailwind emits NOTHING for these:\n${offences.join('\n')}`,
    ).toEqual([])
  })
})

// ============================================
// ⚠️ RAW COLOUR LITERALS DO NOT FOLLOW THE THEME.
//
// `--color-primary`, `--surface-*`, `--fg-*` and the rest are redefined under
// the dark and high-contrast themes. A literal `#14b8a6` or `rgba(18,200,160,
// 0.18)` is not, so it stays its light-theme value while everything beside it
// shifts — the defect that made the focus ring the wrong teal in dark mode on
// ten controls (see `components/ui/focus-ring.ts`).
//
// Comments are stripped first: React error codes («throws #418», «error #300»)
// and an example invoice id («فاکتور #a3f19c2b») all look like hex otherwise.
// ============================================

/** `#abc` / `#aabbcc` / `#aabbccdd`, and `rgb(…)` / `rgba(…)` with numbers. */
const RAW_COLOUR =
  /(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b|rgba?\(\s*[0-9][0-9\s.,%/]*\))/g

/**
 * ⚠️ ACHROMATIC DROP-SHADOW TINTS ARE NOT A THEME BUG, so they are not flagged.
 *
 * `rgba(0,0,0,0.04)` and friends appear in eight shadow utilities, including
 * the canonical `stat-surface.ts`. Unlike the focus ring, a shadow tint has no
 * token to drift away from: the stylesheet declares no `--shadow-tint`, and
 * the nearest candidate `--color-black` is `213 29% 6%` — a BLUE-tinted near
 * black, not `#000`. Rewriting eight shadows onto it would change how every
 * card's shadow reads for no mechanism gain, which is exactly the visible
 * churn this pass is meant to avoid. Introducing a real shadow token and
 * migrating them is a separate, deliberate change — see the report.
 */
const ACHROMATIC_SHADOW = /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/

/**
 * ⚠️ NOT A TODO LIST — the places where a raw literal is the correct answer,
 * because the colour is consumed somewhere CSS custom properties do not reach.
 *
 * Everything else must use a token: `hsl(var(--color-primary) / 0.18)`,
 * `bg-[hsl(var(--surface-elevated))]`, and so on. The token names are declared
 * in `packages/ui/src/styles/globals.css` and `design-token-existence.test.ts`
 * asserts the ones components name actually exist.
 */
const COLOUR_ALLOWED: Record<string, string> = {
  'apps/admin/tailwind.config.ts':
    'This IS the token definition. The admin panel deliberately carries its own blue/violet identity rather than the teal product brand; the scales have to be written out as literals somewhere, and this is that somewhere.',
  'apps/web/app/[lang]/opengraph-image.tsx':
    'Rendered by Satori into a static PNG on the server. There is no document, no stylesheet and no custom properties — an unresolved var() would render as nothing at all.',
  'apps/web/app/[lang]/layout.tsx':
    'theme-color meta and the pre-hydration background. Both are read by the browser chrome BEFORE any stylesheet loads, so a var() has nothing to resolve against.',
  'packages/ui/src/lib/print/receipt-html.ts':
    'A standalone HTML receipt handed to the printer (or a print frame). It does not import globals.css, and paper is white with black ink whatever the app theme — a dark-mode receipt would print a black strip on a thermal roll.',
  'packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx':
    'html2canvas backgroundColor: a rasteriser option, not CSS. The exported PNG needs an opaque white ground whatever theme the app is in.',
  'packages/ui/src/components/ui/chart.tsx':
    "A SELECTOR, not a colour: [&_.recharts-dot[stroke='#fff']] matches the literal attribute Recharts writes. Changing it stops the rule matching.",
}

describe('colours come from tokens, not literals', () => {
  it('⚠️ no raw #hex / rgb() outside the documented exceptions', () => {
    const offences: string[] = []

    for (const file of sources()) {
      if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue
      const rel = file.slice(REPO.length + 1).replace(/\\/g, '/')
      if (COLOUR_ALLOWED[rel]) continue
      code(file)
        .split('\n')
        .forEach((line, i) => {
          RAW_COLOUR.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = RAW_COLOUR.exec(line))) {
            if (ACHROMATIC_SHADOW.test(m[1]!)) continue
            offences.push(`${rel}:${i + 1}  ${m[1]!}`)
          }
        })
    }

    expect(
      offences,
      `use a design token — hsl(var(--color-…) / alpha) — or add a reasoned entry to COLOUR_ALLOWED:\n${offences.join('\n')}`,
    ).toEqual([])
  })

  it('every colour exception carries a reason', () => {
    for (const [file, why] of Object.entries(COLOUR_ALLOWED)) {
      expect(why.length, `${file} has no reason`).toBeGreaterThan(40)
    }
  })
})

describe('shared class strings stay shared', () => {
  const read = (...p: string[]) => code(join(__dirname, '..', ...p))

  it('the brand focus ring has exactly one definition', () => {
    // Ten call sites used to spell rgba(18,200,160,0.18) by hand.
    expect(read('components', 'ui', 'focus-ring.ts')).toMatch(
      /focus-visible:ring-\[hsl\(var\(--color-primary\)\/0\.18\)\]/,
    )
    const copies = sources().filter(
      (f) => !/focus-ring\.ts$/.test(f) && /focus-visible:ring-\[(?!hsl\(var\()/.test(code(f)),
    )
    expect(copies.map((f) => f.slice(REPO.length + 1))).toEqual([])
  })

  it('the ghost icon button and the compact outline button each have one definition', () => {
    const home = read('components', 'ui', 'button-classes.ts')
    expect(home).toMatch(/export const GHOST_ICON_BUTTON/)
    expect(home).toMatch(/export const OUTLINE_BUTTON/)

    // Four identical `ghostBtn` and two identical `outlineBtn` used to sit in
    // customers, invoice-detail and warehouse-detail with nothing linking them.
    const copies = sources().filter((f) => /const (ghostBtn|outlineBtn)\s*=/.test(code(f)))
    expect(copies.map((f) => f.slice(REPO.length + 1).replace(/\\/g, '/'))).toEqual([
      // ⚠️ NOT THE SAME STRING — these three are genuinely different outline
      // buttons, kept apart on purpose. The two in customers/ are the roomier
      // px-4 py-2.5 pill; invoice-sidebar's is a full-width rounded-xl row.
      // Folding any of them into OUTLINE_BUTTON would move real padding or
      // real width on those screens, which is a design decision rather than a
      // de-duplication. Reported, not silently changed.
      'packages/ui/src/components/ui/customers/AddCustomerModal.tsx',
      'packages/ui/src/components/ui/customers/customer-detail-view.tsx',
      'packages/ui/src/components/ui/invoice-detail/invoice-sidebar.tsx',
    ])
  })
})
