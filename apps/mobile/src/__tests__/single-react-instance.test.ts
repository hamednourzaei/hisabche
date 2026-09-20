// ============================================
// ⚠️ ONE REACT IN THE BUNDLE, AND IT IS REACT NATIVE'S.
//
// A release APK built from this app installed, opened, and died on the first
// render:
//
//   TypeError: Cannot read property 'ReactCurrentDispatcher' of undefined
//   js engine: hermes
//
// React Native 0.74's renderer reads `ReactCurrentDispatcher` off React's
// internals. React 19 removed that field. Web and desktop are on React 19, so
// the moment mobile resolves React from the workspace root — or a workspace
// package like `@hisabche/ui` drags its own React 19 in — the bundle carries
// two Reacts and the app cannot render at all.
//
// Nothing else catches this: tsc is clean, every unit test is green, Metro
// bundles 1500 modules without a warning, and the APK builds and installs.
// Only the device says so. Hence this file.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mobileRoot = join(__dirname, '..', '..')

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

const pkg = readJson(join(mobileRoot, 'package.json'))
const deps = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) } as Record<
  string,
  string
>

const metroConfigSource = readFileSync(join(mobileRoot, 'metro.config.js'), 'utf8')
// Comments explain the bug and name the very things asserted against, so they
// must go before any `not.toContain` (راهنمای سشن §۹).
const metroConfig = metroConfigSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the mobile app renders at all', () => {
  it('⚠️ pins the exact React that react-native declares as its peer', () => {
    const rnPeers = readJson(require.resolve('react-native/package.json'))
      .peerDependencies as Record<string, string>

    expect(rnPeers.react).toBeTruthy()
    // `18.2.0`, not `^18` — a caret here would let React 19 back in on the
    // next install, and the failure only shows up on a real device.
    expect(deps.react).toBe(rnPeers.react)
    expect(deps['react-dom']).toBe(rnPeers.react)
  })

  it('⚠️ resolves React to 18 at runtime, not to the workspace root', () => {
    const resolved = readJson(require.resolve('react/package.json')).version as string
    expect(resolved).toBe(deps.react)
    expect(resolved.startsWith('19.')).toBe(false)
  })

  it('⚠️ forces React through resolveRequest, not extraNodeModules alone', () => {
    // `extraNodeModules` is only a FALLBACK — Metro consults it when normal
    // resolution fails, so a workspace package that declares its own React
    // never reaches it. `resolveRequest` runs first and unconditionally.
    expect(metroConfig).toContain('config.resolver.resolveRequest')
    expect(metroConfig).toContain("react: path.resolve(projectRoot, 'node_modules', 'react')")
    // The root is where React 19 lives. Aliasing React there is the bug.
    expect(metroConfig).not.toContain("react: path.resolve(workspaceRoot, 'node_modules', 'react')")
    expect(metroConfig).not.toContain(
      "'react-dom': path.resolve(workspaceRoot, 'node_modules', 'react-dom')",
    )
  })

  it('⚠️ every package this app declares wins for the whole bundle', () => {
    // Forcing React alone left `@tanstack/react-query` duplicated, and the
    // device answered «No QueryClient set» with the provider plainly in the
    // tree above it. pnpm duplicates by peer graph, so the rule has to be
    // general: if this app has a copy, that copy is what gets bundled.
    expect(metroConfig).toContain('appCopyOf(pkg)')
    expect(metroConfig).toContain('const appModules = path.resolve(projectRoot')
    // Workspace packages resolve through symlinks to their source; rewriting
    // those would break Metro's view of them.
    expect(metroConfig).toContain("pkg.startsWith('@hisabche/')")
  })

  it('⚠️ names the libraries whose duplicate is a crash, not merely waste', () => {
    // Each of these keeps state — a React context or a configured module
    // singleton — so a second copy is an empty one: no QueryClient, an i18n
    // with no catalogs, a store nobody writes to.
    for (const singleton of [
      "'@tanstack/react-query'",
      'i18next:',
      "'react-i18next'",
      'zustand:',
    ]) {
      expect(metroConfig).toContain(singleton)
    }
  })
})
