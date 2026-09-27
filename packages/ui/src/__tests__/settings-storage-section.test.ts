// ============================================
// Settings → storage shows measured numbers and its button does something.
//
// It showed a constant «24 MB» and «clear cache» ran `console.log` (G1: UI
// theater). Now the cache count comes from the TanStack Query cache, the size
// from `navigator.storage.estimate()`, and clearing resets that cache — and
// nothing else: the outbox, drafts and the session are other stores.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const strip = (s: string) =>
  s
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

const page = strip(
  readFileSync(join(__dirname, '../components/ui/settings/settings-page.tsx'), 'utf8'),
)
const start = page.indexOf('const StorageSection = memo(')
const section = page.slice(start, page.indexOf("StorageSection.displayName = 'StorageSection'"))

describe('StorageSection', () => {
  it('found the section', () => {
    expect(start).toBeGreaterThan(-1)
  })

  it('⚠️ no invented size, no placeholder handler', () => {
    expect(section).not.toMatch(/\d+\s*MB/)
    expect(section).not.toContain('console.log')
    expect(section).not.toContain('TODO')
  })

  it('measures: query-cache entries and the browser’s own storage estimate', () => {
    expect(section).toContain('getQueryCache()')
    expect(section).toContain('storage.estimate()')
    // A browser that cannot report a size says so instead of guessing.
    expect(section).toContain("t('settings.storageUnavailable')")
  })

  it('⚠️ clearing resets the read cache and touches nothing else', () => {
    expect(section).toContain('queryClient.resetQueries()')
    expect(section).not.toMatch(/localStorage|indexedDB|\.clear\(\)|removeItem/)
  })
})
