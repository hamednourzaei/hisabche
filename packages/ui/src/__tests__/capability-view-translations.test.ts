// ============================================
// T6 — every key a capability screen asks for must exist in every language.
//
// ---------------------------------------------------------------------------
// WHY THIS IS THE «نامفهوم» DEFECT CLASS
//
// These views call `t(key, fallback)`. When the key is missing, the fallback
// renders — and the fallback is Persian written by whoever added the line. So
// a missing key is invisible to a Persian reader and shows PERSIAN TEXT to an
// English or Dari one, in the middle of an otherwise translated page.
//
// Worse, some fallbacks are the raw technical value: `t('governance.mode_off',
// 'off')` renders the English word «off» as a button label. A page whose
// controls are labelled off / warn / strict in an otherwise Persian UI is
// unreadable, and nothing fails.
//
// The audit that produced this test found one real gap — `conflicts.openRecord`
// was missing from all three languages.
//
// ---------------------------------------------------------------------------
// This covers the CAPABILITY screens specifically: the ones the owner listed
// as «نامفهوم» plus their siblings on the same kit. They are the screens whose
// vocabulary is most technical, so an untranslated key costs the most there.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..', 'components', 'ui')
const MESSAGES = join(__dirname, '..', '..', '..', 'i18n', 'messages')

/** The screens built on `capability-kit`. */
const VIEWS = [
  'conflicts/conflicts-view.tsx',
  'data-and-sync/data-and-sync-view.tsx',
  'data-migration/data-migration-view.tsx',
  'governance/governance-view.tsx',
  'till/till-view.tsx',
  'expiry/expiry-view.tsx',
  'budgets/budgets-view.tsx',
  'timesheets/timesheets-view.tsx',
  'assets/assets-view.tsx',
  'bank/bank-view.tsx',
  'workflow/approvals-view.tsx',
]

const languages = readdirSync(MESSAGES).filter((entry) =>
  statSync(join(MESSAGES, entry)).isDirectory(),
)

const bundles = new Map<string, Record<string, unknown>>(
  languages.map((lang) => [
    lang,
    JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')) as Record<
      string,
      unknown
    >,
  ]),
)

/** A key resolves only when it lands on a STRING — an object node renders as `[object Object]`. */
function resolves(bundle: Record<string, unknown>, key: string): boolean {
  let node: unknown = bundle
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

/** Keys passed as a literal first argument to `t(...)`. */
function keysUsed(file: string): string[] {
  const source = readFileSync(join(UI, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '')
  return [...new Set([...source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]!))]
}

describe('the capability screens are fully translated', () => {
  it('there is more than one language bundle to compare', () => {
    // A run that found zero bundles would pass every test below silently.
    expect(languages.length).toBeGreaterThan(1)
    expect(bundles.get('fa')).toBeDefined()
  })

  it('each view actually uses translation keys', () => {
    // If the regex stops matching — someone renames `t`, or switches to a
    // template literal — this suite would report perfect coverage of nothing.
    for (const view of VIEWS) {
      expect(keysUsed(view).length, `${view} yielded no keys`).toBeGreaterThan(10)
    }
  })

  it.each(VIEWS)('%s resolves every key in every language', (view) => {
    const missing: string[] = []

    for (const key of keysUsed(view)) {
      for (const [lang, bundle] of bundles) {
        if (!resolves(bundle, key)) missing.push(`${lang}: ${key}`)
      }
    }

    expect(missing, 'a missing key renders its Persian fallback to an English reader').toEqual([])
  })
})

describe('no control is labelled with its raw technical value', () => {
  it('governance mode labels are words, not enum members', () => {
    // `t('governance.mode_off', 'off')` — if the key were ever removed, the
    // button would read «off» in a Persian UI. The keys exist; this pins that
    // they still do, because that fallback is the one that reads as broken.
    for (const [lang, bundle] of bundles) {
      for (const mode of ['off', 'warn', 'strict']) {
        expect(resolves(bundle, `governance.mode_${mode}`), `${lang} governance.mode_${mode}`).toBe(
          true,
        )
        // The explanation under the mode buttons falls back to an EMPTY
        // string, so a missing key here leaves the page silent about what the
        // selected mode actually does.
        expect(
          resolves(bundle, `governance.mode_${mode}_explains`),
          `${lang} governance.mode_${mode}_explains`,
        ).toBe(true)
      }
    }
  })
})
