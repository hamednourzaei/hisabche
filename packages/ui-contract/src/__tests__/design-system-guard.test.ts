// ============================================
// PHASE 1 / PHASE 11 — the rules §1.4, §1.6 and §1.7 state, enforced.
//
// ---------------------------------------------------------------------------
// WHY THIS READS SOURCE FILES
//
// "No arbitrary colours" and "respect prefers-reduced-motion" are properties of
// what got WRITTEN, and TypeScript cannot see either. A reviewer can, once —
// and then the twentieth screen slips one through on a Friday.
//
// Scope is deliberately narrow: only the components added for the roadmap
// phases. Sweeping the whole of `packages/ui` would fail on years of existing
// code and be turned off within a week, which is worse than a test that covers
// less and stays on. New work does not get to add to the debt.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const UI = join(ROOT, 'packages', 'ui', 'src', 'components', 'ui')

/** The directories this session added. Each one is new work, held to the rule. */
const GOVERNED = ['state', 'work-queue', 'data-and-sync', 'data-migration', 'entity']

function filesIn(directory: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return []
  }

  return entries.flatMap((entry) => {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) return filesIn(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const GOVERNED_FILES = GOVERNED.flatMap((name) => filesIn(join(UI, name)))

/** Comments first — a rule explained in prose is not a rule broken in code. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('the governed components exist', () => {
  it('finds files to check', () => {
    // Without this, every test below passes vacuously the day someone renames
    // a directory.
    expect(GOVERNED_FILES.length).toBeGreaterThan(5)
  })
})

describe('§1.4 — no arbitrary visual tokens', () => {
  it.each(GOVERNED_FILES)('%s uses no raw colour', (file) => {
    const source = code(readFileSync(file, 'utf8'))

    // A hex literal, or a bare rgb()/hsl() with numbers in it. The permitted
    // form is `hsl(var(--token))`, which names a role rather than a colour.
    const hex = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    const raw = source.match(/\b(?:rgb|rgba|hsl|hsla)\(\s*\d/g) ?? []

    expect([...hex, ...raw]).toEqual([])
  })

  it.each(GOVERNED_FILES)('%s sets no font size or family by hand', (file) => {
    const source = code(readFileSync(file, 'utf8'))
    expect(source.match(/fontSize:|fontFamily:|font-\[/g) ?? []).toEqual([])
  })
})

describe('§1.6 — minimal motion', () => {
  it.each(GOVERNED_FILES)('%s adds no animation without a reduced-motion escape', (file) => {
    const source = code(readFileSync(file, 'utf8'))

    // `transition-colors` on a hover is the one exception the design system
    // already makes everywhere: it communicates state and costs nothing to a
    // vestibular system. Anything that MOVES has to answer to the setting.
    const moves = /\banimate-|\btranslate-|\bscale-(?!\[)|\banimation:/.test(source)
    if (!moves) return

    expect(/motion-reduce:/.test(source), `${file} animates but never mentions motion-reduce`).toBe(
      true,
    )
  })
})

describe('§1.3 — no user-facing text in the contract layer', () => {
  const CONTRACTS = ['work-state.ts', 'work-queue.ts', 'shell.ts', 'entity-views.ts']

  it.each(CONTRACTS)('%s contains no Persian or Arabic text', (name) => {
    // The contracts are where a stray sentence does the most damage: it would
    // reach web, desktop and mobile at once, untranslatable, with no key for a
    // translator to find. A Persian character in a pure-policy file is the
    // clearest possible signal that a label was pasted in rather than keyed.
    //
    // Comments are stripped first — the files are annotated in English, but a
    // future annotation in Persian is documentation, not a shipped string.
    const source = code(readFileSync(join(ROOT, 'packages', 'ui-contract', 'src', name), 'utf8'))

    expect(source.match(/[؀-ۿ]+/g) ?? [], `${name} carries Persian text`).toEqual([])
  })

  it.each(CONTRACTS)('%s declares every label as a dotted i18n key', (name) => {
    const source = code(readFileSync(join(ROOT, 'packages', 'ui-contract', 'src', name), 'utf8'))

    // Every `labelKey:` must be `namespace.key`, never a sentence. This is the
    // positive form of the rule: not "no prose" but "always a key".
    for (const [, value] of source.matchAll(/labelKey: '([^']*)'/g)) {
      expect(value, `${name} has a labelKey that is not a key`).toMatch(/^[a-z][\w]*\.[\w.]+$/i)
    }
  })
})

describe('§1.7 — accessibility', () => {
  it.each(GOVERNED_FILES.filter((file) => file.endsWith('.tsx')))(
    '%s gives every icon-only element an accessible name or hides it',
    (file) => {
      const source = readFileSync(file, 'utf8')

      // Every decorative glyph must be hidden from assistive tech; anything
      // conveying meaning needs a label. Both are satisfied by SOME attribute
      // being present, so what is checked is that no bare emoji span exists.
      const bareEmojiSpan =
        /<span(?![^>]*aria-hidden)(?![^>]*aria-label)[^>]*>\s*\{?\s*(?:destination\.emoji|item\.emoji)/.test(
          source,
        )

      expect(bareEmojiSpan, `${file} renders an emoji with no aria treatment`).toBe(false)
    },
  )

  it('never conveys a state by colour alone', () => {
    // A11Y_CONTRACT promises this. The work-state presentation is where it is
    // most tempting to break: every state carries a translated label, not just
    // a tone.
    const source = readFileSync(
      join(ROOT, 'packages', 'ui-contract', 'src', 'work-state.ts'),
      'utf8',
    )
    const tones = source.match(/tone: '/g) ?? []
    const labels = source.match(/labelKey: '/g) ?? []

    expect(labels.length).toBe(tones.length)
  })
})
