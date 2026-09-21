// ============================================
// ⚠️ ONE UI, ONE CONTRACT, TWO HOSTS.
//
// This app used to draw its own React Native version of every screen. The
// same product existed three times — web, Electron, React Native — and the
// three drifted with every change: different labels, different columns,
// different empty states, and an i18n catalog that only the mobile copy used.
//
// It now hosts `@hisabche/app-shell`, the exact bundle Electron loads, and
// implements `HisabcheBridge` so that UI never learns which machine it is on.
//
// These tests exist because the drift is easy to restart: one screen
// component «just for mobile» is all it takes.
// ============================================

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const mobileRoot = join(__dirname, '..', '..')
const repoRoot = join(mobileRoot, '..', '..')

const pkg = JSON.parse(readFileSync(join(mobileRoot, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }
  return out
}

describe('the mobile app hosts the shared UI', () => {
  it('⚠️ depends on the shared shell, not on a private copy of the product', () => {
    expect(pkg.dependencies['@hisabche/app-shell']).toBeTruthy()
    expect(pkg.dependencies['@hisabche/app-bridge']).toBeTruthy()
  })

  it('⚠️ draws no screens of its own', () => {
    // A `screens/` folder here is the third UI coming back. Everything a
    // person sees comes from the shell; this app renders one WebView.
    const screenFiles = filesUnder(join(mobileRoot, 'src')).filter(
      (f) => f.includes(`${'screens'}`) || /-screen\.tsx$/.test(f),
    )
    expect(screenFiles).toEqual([])
  })

  it('⚠️ has exactly one route, and it is the host', () => {
    const routes = readdirSync(join(mobileRoot, 'app'))
    expect(routes).toEqual(['_layout.tsx'])
  })

  it('⚠️ keeps the offline engine native, where it outlives the WebView', () => {
    // Android reclaims a backgrounded WebView. A queue of invoices written
    // offline that lived in the page would go with it — and so would the
    // cache the app reads when there is no signal.
    expect(existsSync(join(mobileRoot, 'src/host/local-db.ts'))).toBe(true)
    expect(existsSync(join(mobileRoot, 'src/features/offline/sync-runner.ts'))).toBe(true)

    // ⚠️ The AsyncStorage store it replaced must be GONE, not left beside it.
    // Two queues is an invoice queued where nothing drains it.
    expect(existsSync(join(mobileRoot, 'src/features/offline/outbox.store.ts'))).toBe(false)

    // ⚠️ Comments stripped FIRST. The runner's own header explains why it no
    // longer holds a QueryClient, and a `not.toContain` that reads comments
    // fails on the sentence describing the fix (راهنمای سشن §۹).
    const runner = readFileSync(join(mobileRoot, 'src/features/offline/sync-runner.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    // It must not hold a query client: that cache belongs to a page which may
    // already have been destroyed when the drain finishes.
    expect(runner).not.toContain('QueryClient')
    expect(runner).toContain('export function onSynced')

    // ⚠️ And it drains SQLite, not the old AsyncStorage store. Two queues is
    // an invoice nobody sends, or one sent twice.
    expect(runner).toContain('localDb.queue()')
    expect(runner).not.toContain('useOutboxStore')
  })

  it('⚠️ the shared UI names no host', () => {
    const shellSrc = join(repoRoot, 'packages/app-shell/src')
    const offenders = filesUnder(shellSrc)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => {
        const code = readFileSync(f, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
        // `electron` in an import is the tell: the UI reaching into one host.
        return /from\s+'[^']*electron[^']*'/.test(code) || /require\(['"]electron/.test(code)
      })
    expect(offenders).toEqual([])
  })

  it('⚠️ both hosts build the shell from the same declaration', () => {
    const mobileConfig = readFileSync(join(mobileRoot, 'vite.shell.config.ts'), 'utf8')
    const desktopConfig = readFileSync(
      join(repoRoot, 'apps/desktop/electron.vite.config.ts'),
      'utf8',
    )
    for (const config of [mobileConfig, desktopConfig]) {
      expect(config).toContain('shellRendererConfig')
      // A host that starts declaring aliases itself has started forking the UI.
      expect(config).not.toContain("'next-intl':")
    }
  })
})
