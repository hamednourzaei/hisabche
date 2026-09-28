// ============================================
// Every key a screen reads from the `desktop` namespace exists in every bundle.
//
// The outbox screen asked for `sync.col.record`, `sync.stage.rejected`,
// `sync.committedHint` … none of which the bundles defined, so Windows and
// Android showed the raw keys as column headings and hints. `DesktopBundle`
// makes each locale complete, but only against its own type — nothing checked
// that the type covers what the screens actually ask for.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { desktopStrings } from '../desktop-strings'

const SRC = join(__dirname, '..', '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const lookup = (bundle: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

const used = walk(SRC).flatMap((file) => {
  const src = readFileSync(file, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  if (!src.includes("from 'react-i18next'") || !/useTranslation\(\s*'desktop'\s*\)/.test(src))
    return []
  return [...src.matchAll(/(?<![\w.])t\(\s*'([\w.]+)'/g)].map((m) => ({
    key: m[1] as string,
    file: file.slice(SRC.length + 1),
  }))
})

describe('desktop namespace keys', () => {
  it('found the keys (the scan is not vacuous)', () => {
    expect(used.length).toBeGreaterThan(15)
  })

  it.each(Object.keys(desktopStrings))('⚠️ every key a screen reads exists in %s', (code) => {
    const bundle = desktopStrings[code as keyof typeof desktopStrings]
    const missing = used
      .filter((use) => typeof lookup(bundle, use.key) !== 'string')
      .map((use) => `${use.key} ← ${use.file}`)
    expect(missing).toEqual([])
  })
})
