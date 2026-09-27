// ============================================
// Every literal translation key the product asks for exists in fa, af and en.
//
// ---------------------------------------------------------------------------
// WHAT WAS ON SCREEN
//
// 185 keys used by live screens were in no catalog. 22 had no fallback, so the
// raw key was the label — the dashboard's notification bell read
// «notifications.markAllRead», «notifications.viewAll». The other 163 passed a
// Persian fallback, which hid the gap from anyone reading Persian and showed
// Persian to everybody reading English or Dari.
//
// The key is resolved through its translator's namespace
// (`useTranslations('blog')` → `blog.<key>`); a `t` received as a prop is the
// root translator, which is how every container here hands it to its view.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const LOCALES = ['fa', 'af', 'en'] as const
const SCAN = ['packages/ui/src', 'apps/web/app', 'apps/admin/app', 'apps/admin/components']

/**
 * Files nothing imports (a barrel re-export aside). Their keys were not added —
 * translating a screen nobody can open is work for no reader. Reported for
 * deletion; the day one of them is mounted, remove it from here and this test
 * lists the keys it needs.
 */
const UNUSED_FILES = new Set([
  'packages/ui/src/components/ui/customers/containers/customer-360-container.tsx',
  'packages/ui/src/components/ui/dashboard/dashboard-invoices.tsx',
  'packages/ui/src/components/ui/invoice-detail/containers/invoice-360-container.tsx',
  'packages/ui/src/components/ui/landing-preview.tsx',
  'packages/ui/src/components/ui/landing/transform-scene.tsx',
  'packages/ui/src/components/ui/notification-bell/EntityActivityCard.tsx',
  'packages/ui/src/components/ui/permissions/permissions-view.tsx',
  'packages/ui/src/components/ui/workflow/approval-actions.tsx',
])

const catalogs = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(
      readFileSync(join(ROOT, 'packages/i18n/messages', l, 'common.json'), 'utf8'),
    ) as unknown,
  ]),
)
const lookup = (catalog: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog)

function walk(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return ['__tests__', 'node_modules', '.next'].includes(entry) ? [] : walk(full)
    }
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

// Line comments first (BUG-029).
const strip = (s: string) =>
  s
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

interface Use {
  file: string
  key: string
}

function keysIn(file: string, source: string): Use[] {
  const src = strip(source)
  // Desktop's own react-i18next catalog is a different system.
  if (src.includes("from 'react-i18next'") && !src.includes("from 'next-intl'")) return []

  const ns: Record<string, string> = {}
  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:'([\w.]+)'|\{[^}]*?namespace:\s*'([\w.]+)'[^}]*\}|\{[^}]*\})?\s*\)/g,
  )) {
    ns[m[1]!] = m[2] ?? m[3] ?? ''
  }
  // `const t = (key, fallback) => … tOriginal(key …)` inherits tOriginal's namespace.
  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*(?:useCallback\()?\s*\(\s*key[^)]*\)[^=]*=>[\s\S]{0,200}?\b(\w+)\(\s*key/g,
  )) {
    if (m[2]! in ns && !(m[1]! in ns)) ns[m[1]!] = ns[m[2]!]!
  }
  if (!('t' in ns) && /\bt\s*[:,}]|\{\s*t\b|\(\s*\{[^)]*\bt\b/.test(src)) ns.t = ''

  const uses: Use[] = []
  for (const [name, space] of Object.entries(ns)) {
    const call = new RegExp(`(?<![\\w.])${name}\\(\\s*'([a-zA-Z][\\w.]*)'\\s*[,)]`, 'g')
    for (const m of src.matchAll(call)) {
      const key = space ? `${space}.${m[1]}` : m[1]!
      if (key.includes('.')) uses.push({ file, key })
    }
  }
  return uses
}

const uses = SCAN.flatMap((dir) => walk(join(ROOT, dir))).flatMap((path) =>
  keysIn(relative(ROOT, path).replace(/\\/g, '/'), readFileSync(path, 'utf8')),
)
const live = uses.filter((use) => !UNUSED_FILES.has(use.file))

describe('translation keys exist in every language', () => {
  it('found the keys (the scan is not vacuous)', () => {
    expect(live.length).toBeGreaterThan(1500)
  })

  it.each(LOCALES)('⚠️ every key a live screen uses is in %s', (locale) => {
    const missing = [
      ...new Set(
        live
          .filter((use) => lookup(catalogs[locale], use.key) === undefined)
          .map((use) => `${use.key}  ←  ${use.file}`),
      ),
    ].sort()
    expect(missing).toEqual([])
  })

  it('the unused-file list names files that still exist', () => {
    for (const file of UNUSED_FILES) {
      expect(() => statSync(join(ROOT, file))).not.toThrow()
    }
  })
})
