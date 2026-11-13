// The device bundles (Android/iOS via Metro, the app-shell) load these packages. Metro has no
// Node built-ins: one `import { randomUUID } from 'node:crypto'` in
// services/repair-transitions.ts stopped the Android release build at
// `createBundleReleaseJsAndAssets` (12 Nov 2026) while every test stayed green — Node runs the
// tests and has the module. Ids on the device come from `newId()` (routes/people-common.ts).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const packagesDir = join(__dirname, '..', '..', '..')
const SHIPPED = ['local-engine', 'validation', 'formatting', 'api', 'ui', 'app-shell']

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'node_modules' ? [] : sources(path)
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('code that ships to a phone imports no Node built-in', () => {
  it.each(SHIPPED)('%s', (pkg) => {
    const offenders = sources(join(packagesDir, pkg, 'src')).filter((file) =>
      /(from|import|require\()\s*['"]node:/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders.map((file) => file.slice(packagesDir.length))).toEqual([])
  })
})
