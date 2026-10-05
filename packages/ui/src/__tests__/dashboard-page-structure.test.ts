// ============================================
// Every signed-in page is the same shape: metadata, and a container from
// `@hisabche/ui`. Nothing else lives in the web app.
//
// ---------------------------------------------------------------------------
// WHY IT MATTERS
//
// Windows and Android render `packages/app-shell`, which mounts the SAME
// containers. Anything a web `page.tsx` does besides mounting one — wiring a
// router, drawing a skeleton, wrapping it in a local `*-client.tsx` — is
// something only web does. The audit that produced this file found:
//
//   · four domain workspaces that were BLANK on Windows and Android: web
//     passed each its domain, the desktop route handed it `''`
//   · the approvals screen sending desktop users to `/fa/…`, a route only web
//     has, because its locale fallback was a hard-coded 'fa'
//   · three hand-drawn skeletons and three local client wrappers in the web
//     app, one of them the only reason a shadowed `page.tsx` still existed
//
// Navigation is the container's job now (`useLocalePush`): the prefix is
// added where a `[lang]` segment exists and nowhere else.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const DASHBOARD = join(ROOT, 'apps/web/app/[lang]/(dashboard)')
const UI = join(ROOT, 'packages/ui/src')

// Line comments FIRST (BUG-029): a path glob in one must not open a block.
const strip = (s: string) =>
  s
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const webFiles = walk(DASHBOARD).map((path) => ({
  path,
  rel: relative(DASHBOARD, path),
  code: strip(readFileSync(path, 'utf8')),
}))
const pages = webFiles.filter((f) => f.rel.endsWith('page.tsx'))

/** Next's own file conventions — the only files a route folder may hold. */
const ROUTE_FILES = new Set(['page.tsx', 'loading.tsx', 'layout.tsx', 'error.tsx', 'not-found.tsx'])
/**
 * The web shell (sidebar, header, auth gate). Desktop has its own frame in
 * app-shell; the two are hosts, not screens.
 */
const HOST_SHELL = new Set(['dashboard-layout.tsx'])

/** What a page may import: the screen, its contract, and the framework. */
const PAGE_IMPORTS = new Set([
  '@hisabche/ui',
  '@hisabche/ui-contract',
  'react',
  'next-intl/server',
  // Only for `permanentRedirect` — a moved route is not a screen.
  'next/navigation',
])

describe('the dashboard route tree holds routes, not components', () => {
  it('found the pages', () => {
    // Without this the suite passes vacuously the day the path changes.
    expect(pages.length).toBeGreaterThan(25)
  })

  it('⚠️ no local component beside a page (no *-client.tsx, no skeleton.tsx)', () => {
    const stray = webFiles
      .map((f) => f.rel)
      .filter((rel) => {
        const name = rel.split(/[\\/]/).pop()!
        return !ROUTE_FILES.has(name) && !HOST_SHELL.has(name)
      })
    expect(stray).toEqual([])
  })

  it('⚠️ a page imports only the screen, its contract and the framework', () => {
    const offending = pages.flatMap((page) =>
      [...page.code.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)]
        .map((m) => m[1]!)
        .filter((source) => !PAGE_IMPORTS.has(source))
        .map((source) => `${page.rel} ← ${source}`),
    )
    expect(offending).toEqual([])
  })

  it('⚠️ a page is a server component with no navigation wiring', () => {
    const offending = pages
      .filter(
        (page) =>
          /^\s*['"]use client['"]/.test(page.code) ||
          /\bonNavigate=|\buseRouter\(|\buseParams\(/.test(page.code),
      )
      .map((page) => page.rel)
    expect(offending).toEqual([])
  })

  it('⚠️ exactly one <main>: the layout owns it, a page never adds a second', () => {
    // Every page used to wrap itself in `<main className="section">` inside the
    // layout's own `<main>` — two main landmarks on every screen, and `.section`
    // was defined nowhere.
    const inLayout = webFiles.filter((f) => f.rel === 'dashboard-layout.tsx')
    expect(inLayout.map((f) => (f.code.match(/<main\b/g) ?? []).length)).toEqual([1])
    const offending = webFiles
      .filter((f) => f.rel !== 'dashboard-layout.tsx' && /<main\b/.test(f.code))
      .map((f) => f.rel)
    expect(offending).toEqual([])
  })

  it('⚠️ a server file renders a UI function as an element, never calls it', () => {
    // `customersSkeleton()` inside a server page is a CLIENT function invoked
    // on the server: Next logs «Attempted to call customersSkeleton() from the
    // server», the page still answers 200, and no test sees it. Only a real
    // `next start` did. `<CustomersSkeleton />` is the same thing, legally.
    const offending = webFiles
      .filter((f) => !/^\s*['"]use client['"]/.test(f.code))
      .flatMap((f) => {
        const fromUi = [...f.code.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'@hisabche\/ui'/gm)]
          .flatMap((m) => m[1]!.split(','))
          .map((name) =>
            name
              .trim()
              .split(/\s+as\s+/)
              .pop()!,
          )
          .filter(Boolean)
        return fromUi
          .filter((name) => new RegExp(`\\b${name}\\(`).test(f.code))
          .map((name) => `${f.rel} calls ${name}()`)
      })
    expect(offending).toEqual([])
  })

  it('next/navigation appears only in redirect-only routes', () => {
    const offending = pages
      .filter((page) => page.code.includes("'next/navigation'"))
      .filter((page) => !/permanentRedirect\(|redirect\(/.test(page.code) || /<\w/.test(page.code))
      .map((page) => page.rel)
    expect(offending).toEqual([])
  })
})

describe('shared screens navigate through the locale rule', () => {
  const uiFiles = walk(UI).map((path) => ({
    rel: relative(UI, path),
    code: strip(readFileSync(path, 'utf8')),
  }))

  /**
   * The sign-in flow is public, sits outside the dashboard and owns its own
   * redirect target; it is the one place a bare path is still pushed.
   */
  const OWN_ROUTING = /^components[\\/]ui[\\/]auth[\\/]/

  it('⚠️ no bare `router.push("/…")` / `router.replace("/…")` in a screen', () => {
    const offending = uiFiles
      .filter((f) => !OWN_ROUTING.test(f.rel))
      .flatMap((f) => [...f.code.matchAll(/router\.(push|replace)\(\s*['`]\//g)].map(() => f.rel))
    expect(offending).toEqual([])
  })

  it('⚠️ no bare `href="/…"` link in a signed-in screen', () => {
    // Public pages (landing, blog, docs, sign-in) always live under `[lang]` on
    // web and build their prefix from the page locale. Signed-in screens also
    // run on Windows/Android, so their links go through `localizePath`.
    const PUBLIC = /^components[\\/]ui[\\/](landing|blog|docs|auth)[\\/]/
    const offending = uiFiles
      .filter((f) => !PUBLIC.test(f.rel))
      .flatMap((f) => [...f.code.matchAll(/href=(?:"|\{\s*['`])\/[a-z]/g)].map(() => f.rel))
    expect(offending).toEqual([])
  })

  it("⚠️ no hard-coded 'fa' fallback for the route language", () => {
    // `params?.lang ?? 'fa'` is the exact line that sent Windows to /fa/….
    const offending = uiFiles
      .filter((f) => /params\??\.lang\s*(\?\?|\?[^?]|:)[^;\n]*['"]fa['"]/.test(f.code))
      .map((f) => f.rel)
    expect(offending).toEqual([])
  })
})
