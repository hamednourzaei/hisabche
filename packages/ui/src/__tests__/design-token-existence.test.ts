// ============================================
// T3 — every design token a component names must actually exist.
//
// ---------------------------------------------------------------------------
// THE BUG THIS CATCHES, WHICH SHIPPED AND WAS VISIBLE
//
// Eight screens — `/till`, `/expiry`, `/budgets`, `/timesheets`, `/assets`,
// `/bank`, `/conflicts`, `/governance` — wrote:
//
//     border-[hsl(var(--border))]
//     text-[hsl(var(--muted-foreground))]
//
// Neither `--border` nor `--muted-foreground` is defined in `globals.css`. The
// project's names are `--border-default` and `--fg-tertiary`.
//
// ⚠️ AN UNDEFINED CSS VARIABLE DOES NOT FALL BACK. It makes the whole
// declaration invalid, and the browser DROPS it:
//
//   · `border-[hsl(var(--border))]` → the border does not render at all
//   · `text-[hsl(var(--muted-foreground))]` → the text inherits its parent's
//     colour, so «secondary» text is the same weight as primary text
//
// So those eight pages rendered borderless cards and flat, undifferentiated
// text while every other page had crisp borders and a clear hierarchy. That is
// precisely the report: «ظاهرشان با بقیه‌ی داشبورد یکی نیست».
//
// Nothing else catches this. It type-checks, it lints, the class name looks
// correct, and only a rendered pixel tells you. Hence a test.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const CSS = join(SRC, 'styles', 'globals.css')

/** Every `--name:` declared anywhere in the stylesheet. */
function declaredTokens(): Set<string> {
  const css = readFileSync(CSS, 'utf8')
  return new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]!))
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'styles') continue
      sourceFiles(full, out)
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Variables supplied at RUNTIME rather than by our stylesheet.
 *
 * ⚠️ Every entry needs a reason. This list is how a genuinely broken token
 * would be waved through, so «it was already failing» is not one.
 */
const RUNTIME_SUPPLIED = [
  // Radix sets these on the element it positions — trigger widths, available
  // heights, transform origins. They exist only while a popover is open.
  /^--radix-/,
  // Tailwind's own transform/filter plumbing.
  /^--tw-/,
  // Recharts derives one per series from the chart config: `--color-value`,
  // `--color-invoiceCount`, `--color-customerCount` are the series names.
  /^--color-(value|invoiceCount|customerCount)$/,
  // `marquee.tsx` sets `[--gap:1rem]` on itself and reads it back.
  /^--gap$/,
  // Set inline by the component that reads it (animation durations).
  /^--duration$/,
]

const isRuntime = (token: string): boolean => RUNTIME_SUPPLIED.some((re) => re.test(token))

/** Every `var(--name)` a component references. */
function referencedTokens(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  return [...source.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]!)
}

describe('no component names a token that does not exist', () => {
  const declared = declaredTokens()

  it('the stylesheet parses into a plausible token set', () => {
    // A regex that silently matched nothing would make every test below pass.
    expect(declared.size).toBeGreaterThan(20)
    expect(declared.has('--border-default')).toBe(true)
    expect(declared.has('--fg-tertiary')).toBe(true)
  })

  it('every var(--token) in every component resolves', () => {
    const missing: string[] = []

    for (const file of sourceFiles(SRC)) {
      for (const token of referencedTokens(file)) {
        if (!declared.has(token) && !isRuntime(token)) {
          missing.push(`${file.slice(SRC.length + 1)} → ${token}`)
        }
      }
    }

    expect(
      [...new Set(missing)],
      'these render as NOTHING — an invalid declaration is dropped, not defaulted',
    ).toEqual([])
  })

  it('the four names that caused this are still absent from the stylesheet', () => {
    // If someone ever DEFINES `--border` to make the old code work, the two
    // naming schemes come back and the drift starts again. The fix was to use
    // the real names, not to add aliases.
    for (const alias of ['--border', '--muted-foreground', '--muted', '--card']) {
      expect(declared.has(alias), `${alias} is an alias for an existing token`).toBe(false)
    }
  })
})
