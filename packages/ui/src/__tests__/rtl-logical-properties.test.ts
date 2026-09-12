// ============================================
// Physical-direction Tailwind classes are RTL bugs.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THIS GUARD EXISTS
//
// Persian and Dari are the primary locales and render `dir="rtl"`; English
// renders `dir="ltr"`. A class that names a PHYSICAL side — `ml-`, `pr-`,
// `left-`, `border-l`, `rounded-r`, `text-left` — is correct in at most one of
// those two and silently wrong in the other. The logical forms (`ms-`, `pe-`,
// `start-`, `border-s`, `rounded-e`, `text-start`) are correct in both.
//
// Real defects this caught:
//   · `mr-2` on the datagrid's select-all checkbox put the gap on the OUTER
//     edge in RTL, so the checkbox touched the first column heading.
//   · `ml-auto` on `ProgressValue` absorbs no free space in an RTL flex row,
//     so the value never reached the end of the bar.
//   · `mr-auto` on the language menu's ✓ did nothing in English.
//
// ---------------------------------------------------------------------------
// ⚠️ COMMENTS ARE STRIPPED BEFORE ASSERTING.
//
// Prose like «right-aligned», «left-to-right» and a comment naming the very
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
  'packages/ui/src/components/ui/landing/cinematic-hero.tsx': {
    classes: ['left-1/2', 'left-0', 'right-0'],
    why: 'Decorative orbit: four dots at the compass points of a concentric ring, aria-hidden. The geometry is physical and does not mirror.',
  },
  'packages/ui/src/components/ui/landing/trust-bar-scene.tsx': {
    classes: ['left-0', 'right-0'],
    why: 'Both edges at once — the two gradient fade masks over the marquee. A mirrored pair is direction-neutral.',
  },
  'packages/ui/src/components/ui/notification-bell.tsx': {
    classes: ['left-4', 'right-4'],
    why: 'Both edges at once — the mobile panel is inset equally from each side. The desktop branch beside it already uses end-0.',
  },
  'packages/ui/src/components/ui/landing/pain-scene.tsx': {
    classes: ['left-4', 'sm:left-1/2', 'ml-10', 'sm:ml-0', 'left-0', 'right-0'],
    why: 'Alternating timeline. sm:left-1/2 centres the rail; left-0/right-0 on the connector stubs are selected by `isLeft` and pair with a physical translateX. The mobile rail (left-4 + ml-10) IS direction-blind — see the report; flipping it moves the rail in Persian, so it is a layout decision, not a mechanism fix.',
  },
  'packages/ui/src/components/ui/landing/transform-scene.tsx': {
    classes: ['left-4', 'sm:left-1/2', 'right-2', 'sm:right-3'],
    why: 'Same mobile rail as pain-scene, plus the alert card close button. Both flip visibly in Persian if changed — reported, not silently altered.',
  },
  'packages/ui/src/components/ui/customers/datagrid/drawer.tsx': {
    classes: ['right-0', 'border-l'],
    why: 'Side panel. sheet.tsx (side="end" → end-0 + border-s) is the house pattern and this drawer is inconsistent with it, but switching sides is a visible move in Persian — reported, not silently altered.',
  },
  'packages/ui/src/components/ui/dashboard/date-range-picker.tsx': {
    classes: ['right-2.5', 'left-2.5'],
    why: 'Close button and format select in opposite top corners. dialog.tsx puts close at end-4; adopting that swaps both corners in Persian — reported, not silently altered.',
  },
  'packages/ui/src/components/ui/dashboard-header.tsx': {
    classes: ['left-0'],
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

/** Blank out comments so prose («right-aligned») cannot trip the pattern. */
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

  it('⚠️ no new ml-/pr-/left-/border-l/rounded-r/text-left outside the documented exceptions', () => {
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
