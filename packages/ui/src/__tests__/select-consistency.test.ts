// ============================================
// T7 — one select in the product, and the trap that made it worth centralising.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// Nineteen files rendered a native `<select>` — 26 dropdowns with a different
// height, a different focus ring, no RTL arrow handling, and a different feel
// on mobile from the `select.tsx` used everywhere else.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THIS IS NOT A COSMETIC CHANGE
//
// Radix's `SelectItem` THROWS on an empty string value, because `''` is what
// it reserves for «nothing selected». And `<option value="">همه</option>` is
// how every filter dropdown in this product offered «all».
//
// So the obvious conversion — swap the tags, keep the options — compiles
// cleanly, renders cleanly, and crashes the page the moment someone opens the
// list. A type-check cannot see it and a screenshot would not show it.
//
// `SelectField` owns that translation in one place. These tests pin both the
// translation and the fact that nothing reintroduces the native element.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue
      walk(full, out)
    } else if (entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/** Comments stripped — this file and several others discuss `<select>`. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '')
}

describe('the native element is gone and stays gone', () => {
  it('no component renders a bare <select>', () => {
    const offenders = walk(ROOT)
      .filter((file) => /<select[\s>]/.test(code(file)))
      .map((file) => file.slice(ROOT.length + 1))

    expect(offenders, `use <SelectField> instead:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no component renders a bare <option> outside a <datalist>', () => {
    // The other half: an `<option>` left behind means a half-finished
    // conversion, which renders nothing at all.
    //
    // ⚠️ `<datalist>` is excluded, and it is NOT an exception grudgingly made
    // for one file. A datalist is an autocomplete hint attached to a text
    // input — the user can still type anything. It has nothing to do with
    // Select, has no Radix equivalent, and converting it would turn a free
    // text field into a closed list. crm-view's subject suggestions are
    // exactly that.
    const offenders = walk(ROOT)
      .filter((file) => {
        const stripped = code(file).replace(/<datalist[\s\S]*?<\/datalist>/g, '')
        return /<option[\s>]/.test(stripped)
      })
      .map((file) => file.slice(ROOT.length + 1))

    expect(offenders).toEqual([])
  })
})

describe('SelectField owns the empty-string translation', () => {
  const source = readFileSync(join(ROOT, 'components/ui/select-field.tsx'), 'utf8')

  it('maps the empty string to a sentinel before Radix sees it', () => {
    // The whole reason this component exists rather than 26 hand-conversions.
    expect(source).toContain("value === '' ? EMPTY")
  })

  it('maps it back on the way out, so callers still receive ""', () => {
    // Without this, choosing «همه» would hand the caller the sentinel and
    // every filter would search for a literal string nobody has.
    expect(source).toContain("value === EMPTY ? ''")
  })

  it('the sentinel is not a plausible domain value', () => {
    // `all` and `none` are both real ids elsewhere in this product; either
    // would collide with a genuine option and silently select the wrong row.
    const sentinel = /const EMPTY = '([^']+)'/.exec(source)?.[1]
    expect(sentinel).toBeDefined()
    expect(sentinel).not.toBe('all')
    expect(sentinel).not.toBe('none')
    expect(sentinel!.length).toBeGreaterThan(8)
  })
})

describe('there is only ONE select control', () => {
  it('capability-kit delegates rather than reimplementing', () => {
    // Two components with one purpose is the parallel-architecture guardrail.
    // capability-kit had its own SelectField — and it carried exactly the
    // empty-string defect described above.
    const kit = readFileSync(join(ROOT, 'components/ui/capability/capability-kit.tsx'), 'utf8')
    expect(kit).toContain('SharedSelectField')
    // It must not build its own Radix structure any more.
    expect(kit).not.toContain('<SelectTrigger')
  })
})
