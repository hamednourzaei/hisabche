// ============================================
// ⚠️ THE PACKAGED APP DIED ON STARTUP AND DEV NEVER NOTICED.
//
//   A JavaScript error occurred in the main process
//   Error: Cannot find module '@hisabche/app-bridge'
//
// `externalizeDepsPlugin` leaves every dependency as a bare `require()` and
// trusts it to exist in `node_modules` beside the packaged app. That is right
// for anything published to npm — Electron ships those. It is WRONG for a
// workspace package, which lives in this repository and is never copied into
// the installer.
//
// Nothing catches it before a user does: `electron-vite dev` resolves the
// workspace from disk and works perfectly, every test here passes, and the
// failure exists only in the built `.exe`.
//
// So this reads the BUILT OUTPUT, not the source.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const desktopRoot = join(__dirname, '..', '..')
const outDir = join(desktopRoot, 'out')

/** Every `require('…')` the built file leaves for Node to resolve at runtime. */
function externalRequires(file: string): string[] {
  if (!existsSync(file)) return []
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1] ?? '')
}

const BUILT = [join(outDir, 'main/index.js'), join(outDir, 'preload/index.js')]

describe('the packaged build carries its own workspace code', () => {
  // The build is not a prerequisite of the test suite, so say so rather than
  // passing silently on a machine that has not run it.
  const built = BUILT.filter((file) => existsSync(file))

  it('⚠️ the build output exists to be checked', () => {
    expect(built.length).toBeGreaterThan(0)
  })

  it('⚠️ no workspace package is left as a runtime require', () => {
    for (const file of built) {
      const workspace = externalRequires(file).filter((id) => id.startsWith('@hisabche/'))

      // `@hisabche/*` resolves from this repository. Anything still required
      // by name will be missing the moment the app is installed somewhere
      // else — which is every user.
      expect({ file: file.replace(desktopRoot, ''), workspace }).toEqual({
        file: file.replace(desktopRoot, ''),
        workspace: [],
      })
    }
  })

  it('⚠️ every workspace import in main and preload is listed as bundled', () => {
    // The config's `exclude` list is what does the bundling. A new workspace
    // import added to main without a matching entry is the bug returning.
    const config = readFileSync(join(desktopRoot, 'electron.vite.config.ts'), 'utf8')

    const sources = ['electron/main', 'electron/preload']
    const imported = new Set<string>()
    for (const dir of sources) {
      const walk = (path: string): void => {
        const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
        for (const entry of readdirSync(path)) {
          const full = join(path, entry)
          if (statSync(full).isDirectory()) walk(full)
          else if (full.endsWith('.ts') && !full.includes('__tests__')) {
            const code = readFileSync(full, 'utf8')
            for (const m of code.matchAll(/from\s+'(@hisabche\/[a-z-]+)'/g)) {
              imported.add(m[1] ?? '')
            }
          }
        }
      }
      walk(join(desktopRoot, dir))
    }

    expect(imported.size).toBeGreaterThan(0)
    for (const pkg of imported) {
      expect(config).toContain(`'${pkg}'`)
    }
  })
})
