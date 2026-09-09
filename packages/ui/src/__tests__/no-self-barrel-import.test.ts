// ============================================
// A file inside a package never imports that package by name.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A REAL BUG AND NOT A STYLE RULE
//
// `auth-container.tsx` lives inside `@hisabche/ui` and imported `AuthShell`
// from `@hisabche/ui`. That makes the barrel depend on the module and the
// module depend on the barrel — a cycle whose evaluation order is decided by
// the bundler.
//
// When the bundler puts the barrel first, every binding the module needs is
// still in its temporal dead zone, and the app throws
//
//     ReferenceError: Cannot access 'Q' before initialization
//
// from inside whichever hook happens to run first. Nothing points at the
// import; the stack names a minified letter in a shared chunk.
//
// ⚠️ THE WORST PART IS THAT IT IS STABLE UNTIL IT IS NOT. The order holds
// until the export list in `index.ts` changes — so a cycle introduced months
// ago surfaces as a crash caused by an apparently unrelated edit somewhere
// else entirely.
//
// A relative import cannot have this problem: it names the module, not the
// package that re-exports it.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const SELF = '@hisabche/ui'

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Tests are not shipped, so a cycle through one cannot reach a browser
      // — and this file necessarily contains the string it is looking for.
      if (entry === '__tests__') continue
      sourceFiles(full, out)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      if (entry.includes('.test.')) continue
      out.push(full)
    }
  }
  return out
}

/** Windows paths, normalised for a readable failure message. */
function toPosix(path: string): string {
  return path.split(String.fromCharCode(92)).join('/')
}

const files = sourceFiles(SRC)

describe('no module imports its own package', () => {
  it('found the source tree', () => {
    // A moved directory would make the rule below vacuous.
    expect(files.length).toBeGreaterThan(100)
  })

  it('⚠️ nothing inside @hisabche/ui imports @hisabche/ui', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')

      // Plain string matching rather than a regex: this catches
      // `from '@hisabche/ui'`, the subpath form, and `import('@hisabche/ui')`
      // alike. A subpath is still the package and still routes through its
      // entry, so it carries the same cycle.
      if (source.includes(`'${SELF}'`) || source.includes(`'${SELF}/`)) {
        offenders.push(toPosix(file.slice(SRC.length + 1)))
      }
    }

    expect(
      [...new Set(offenders)],
      'these files import their own package — a barrel cycle whose evaluation order the bundler decides, producing "Cannot access X before initialization"',
    ).toEqual([])
  })
})
