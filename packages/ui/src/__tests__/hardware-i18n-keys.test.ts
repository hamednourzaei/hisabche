// Barcode + receipt + hardware settings: every key the code asks for exists in
// fa, af AND en — `t()` throws on a missing key and takes the page down.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const MESSAGES = join(__dirname, '../../../i18n/messages')
const NAMESPACES = ['barcode', 'receipt', 'hardware']

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

const used = new Set<string>()
for (const file of files(SRC)) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*'((?:barcode|receipt|hardware)\.[A-Za-z]+)'/g))
    used.add(m[1]!)
}

const lookup = (json: Record<string, unknown>, key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], json)

describe('hardware / barcode / receipt i18n keys', () => {
  it('the code uses these namespaces at all', () => {
    expect(used.size).toBeGreaterThan(40)
  })

  it.each(['fa', 'af', 'en'])('every used key exists in %s', (lang) => {
    const json = JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')) as Record<
      string,
      unknown
    >
    const missing = [...used].filter((key) => typeof lookup(json, key) !== 'string')
    expect(missing).toEqual([])
  })

  it('the three locales define the same keys in these namespaces', () => {
    const keysOf = (lang: string) => {
      const json = JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')) as Record<
        string,
        Record<string, string>
      >
      return NAMESPACES.flatMap((ns) => Object.keys(json[ns] ?? {}).map((k) => `${ns}.${k}`)).sort()
    }
    expect(keysOf('af')).toEqual(keysOf('fa'))
    expect(keysOf('en')).toEqual(keysOf('fa'))
  })
})
