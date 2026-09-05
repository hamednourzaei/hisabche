// ============================================
// A function that calls hooks must be RENDERED, never CALLED conditionally.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS CATCHES — it reached production
//
// `warehouseContainer` is written as a plain function that calls a dozen hooks.
// Calling it inline runs those hooks as part of the CALLER's hook list, which
// is fine when it happens unconditionally and fatal when it does not:
//
//     active === 'products' ? <ProductListContainer /> : warehouseContainer()
//
// On one tab the parent rendered ~12 hooks, on the other 3. Switching tabs
// changed the count between renders — React error #300, "rendered fewer hooks
// than during the previous render" — and the error boundary took the page down.
//
// TypeScript cannot see it: calling a function that returns JSX is perfectly
// well typed. `eslint-plugin-react-hooks` cannot see it either, because the
// lowercase name means it is not recognised as a component.
//
// So: a static check. Any lowercase `xxxContainer()` / `xxxView()` called
// inside a ternary or after `&&` is flagged.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(full)
    }
    return entry.endsWith('.tsx') ? [full] : []
  })
}

/** Strip comments so a comment ABOUT the bug does not read as the bug. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * `? someContainer()` , `: someContainer()` , `&& someContainer()`
 *
 * Lowercase first letter only — an uppercase name is a component and would be
 * rendered as `<Name />`, which is safe.
 */
const CONDITIONAL_CALL = /(\?|:|&&)\s*([a-z][A-Za-z0-9_]*(?:Container|View|Page))\s*\(\s*\)/g

describe('hook-calling functions are rendered, not called conditionally', () => {
  it('no lowercase container/view function is invoked inside a conditional', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(join(ROOT, 'components'))) {
      const code = stripComments(readFileSync(file, 'utf8'))

      for (const match of code.matchAll(CONDITIONAL_CALL)) {
        offenders.push(`${relative(ROOT, file)} -> ${match[2]}()`)
      }
    }

    expect(
      offenders,
      'calling a hook-using function conditionally changes the parent hook count between renders (React #300)',
    ).toEqual([])
  })
})
