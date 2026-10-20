// ============================================
// No hook below the «this needs the internet» early return.
//
// The offline-edition pass added, to ~24 components,
//
//   const availability = useActionAvailability('…')
//   if (availability.requiresOnline) return <CloudRequiredNotice … />
//   const report = useManufacturingReport(…)     ← a hook AFTER a return
//
// A hook that runs on some renders only shifts every hook after it: React
// hands one hook's state to the next. On the device edition the dashboard
// died with «Cannot read properties of undefined (reading 'runs')».
// Either every hook runs before the return, or the screen's hooks live in a
// child component that is mounted only when the screen runs.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', 'components')

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  )
}

/** Hooks called after a top-level `if (… requiresOnline) { … return … }` in the same component. */
export function hooksAfterOnlineReturn(source: string): string[] {
  const lines = source.split('\n')
  const found: string[] = []
  for (let i = 0; i < lines.length; i++) {
    // Top level of a component body = two-space indent; a return inside a
    // callback (deeper) is not an early return of the component.
    if (!/^ {2}if \(.*requiresOnline/.test(lines[i] ?? '')) continue
    let depth = 0
    let j = i
    let returns = false
    for (; j < lines.length; j++) {
      const line = lines[j] ?? ''
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
      if (/\breturn\b/.test(line)) returns = true
      if (j > i && depth <= 0) break
    }
    if (!returns) continue
    for (let k = j + 1; k < lines.length; k++) {
      const line = lines[k] ?? ''
      if (/^\}/.test(line)) break // the component ended
      const hook = line.match(/^ {2}\S.*\b(use[A-Z]\w*)\(/)
      if (hook) {
        found.push(`${k + 1}:${hook[1]}`)
        break
      }
    }
  }
  return found
}

describe('no hook after the online-only early return', () => {
  it('finds the pattern it guards (self-check)', () => {
    const bad = [
      'function Card() {',
      "  const availability = useActionAvailability('x')",
      '  if (availability.requiresOnline) {',
      '    return null',
      '  }',
      '  const report = useReport()',
      '}',
    ].join('\n')
    expect(hooksAfterOnlineReturn(bad)).toEqual(['6:useReport'])
  })

  it('no component in packages/ui calls a hook after it', () => {
    const offenders = files(ROOT).flatMap((file) =>
      hooksAfterOnlineReturn(readFileSync(file, 'utf8')).map(
        (at) => `${relative(ROOT, file)}:${at}`,
      ),
    )
    expect(offenders).toEqual([])
  })
})
