// ============================================
// Every key the breadcrumb asks for exists in fa, af and en.
//
// The trail labels a record's id segment with `t('common.details')`. The key
// did not exist in any catalog, and the configured fallback prints the key —
// so every customer, invoice and product page showed «common.details» in its
// breadcrumb, on web and on Windows/Android alike.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) =>
  s
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

const source = strip(
  readFileSync(join(ROOT, 'packages/ui/src/components/ui/breadcrumb.tsx'), 'utf8'),
)
const keys = [...source.matchAll(/\bt\(\s*'([\w.]+)'\s*\)/g)].map((m) => m[1]!)

const has = (catalog: unknown, key: string) =>
  typeof key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalog,
    ) === 'string'

describe('breadcrumb labels', () => {
  it('found the literal keys', () => {
    expect(keys).toContain('common.details')
  })

  it.each(['fa', 'af', 'en'])('⚠️ every literal key exists in %s', (locale) => {
    const catalog = JSON.parse(
      readFileSync(join(ROOT, 'packages/i18n/messages', locale, 'common.json'), 'utf8'),
    ) as unknown
    expect(keys.filter((key) => !has(catalog, key))).toEqual([])
  })
})
