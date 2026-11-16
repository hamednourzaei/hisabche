// ============================================
// A hook that returns a function returns the SAME function across renders.
//
// `useSaveOnboardingProgress` returned a new function every render; onboarding lists it in an
// effect's dependencies, so every render sent PUT /workspace/onboarding-progress — a storm that
// reached the per-person limit and refused the final «ورود به حسابچه» (browser journeys, 14 Nov 2026).
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'hooks', 'workspace-profile.ts'), 'utf8')

describe('stable functions from workspace-profile hooks', () => {
  it.each(['useSaveWorkspaceProfile', 'useSaveOperationalDna', 'useSaveOnboardingProgress'])(
    '%s returns useCallback, never a bare async function',
    (name) => {
      const start = source.indexOf(`export function ${name}() {`)
      expect(start).toBeGreaterThan(-1)
      const body = source.slice(start, source.indexOf('\n}\n', start))
      // Flattened first: the formatter breaks a long signature after the
      // opening parenthesis, and the exact one-line form then never matches.
      const flat = body.split(/\s+/).join(' ')
      expect(flat).toMatch(/return useCallback\( ?async \(/)
      expect(body).not.toMatch(/\n {2}return async \(/)
    },
  )

  it('no hook in this file returns a bare async function', () => {
    expect(source).not.toMatch(/\n {2}return async \(/)
  })
})
