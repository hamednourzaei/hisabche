// Google Search Console, 9 Nov 2026: «Not found (404) — validation failed»,
// «Redirect error», soft 404s. Root cause: a `loading.tsx` above an indexable
// public page turns it into a streamed response, and the 200 status line is
// sent with the skeleton BEFORE the page runs. So `notFound()` came out as
// 200 + noindex (soft 404: /fa/blog/<missing>, /fa/market) and
// `permanentRedirect()` came out as 200 instead of 308 (/fa/docs).
//
// Indexable public routes must not stream. Token pages (portal, invoice link,
// attendance link…) and auth forms are noindex and may keep their skeleton.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LANG = join(__dirname, '../../../../apps/web/app/[lang]')

const INDEXABLE_TREES = ['about', 'contact', 'blog', 'docs', 'features', 'legal', 'market']

function loadingFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...loadingFilesUnder(path))
    else if (name === 'loading.tsx' || name === 'loading.jsx') found.push(path)
  }
  return found
}

describe('indexable public pages answer with their real HTTP status', () => {
  it('has no loading boundary at [lang] level (it would wrap the landing and every public page)', () => {
    expect(existsSync(join(LANG, 'loading.tsx'))).toBe(false)
  })

  it('has no loading boundary anywhere in an indexable public tree', () => {
    const offending = INDEXABLE_TREES.flatMap((tree) => loadingFilesUnder(join(LANG, tree)))
    expect(offending).toEqual([])
  })

  it('still covers the trees it names (a renamed folder must not pass silently)', () => {
    for (const tree of INDEXABLE_TREES) expect(existsSync(join(LANG, tree))).toBe(true)
  })
})
