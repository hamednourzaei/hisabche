// ============================================
// The shared Supabase client must stay `service_role`.
//
// Calling `signInWithPassword` (or `setSession`) on the module-level client
// attaches that user's access token to it in memory, so every later query in
// the process is sent as that user instead of `service_role`. That produced
// `42501 new row violates row-level security policy for table
// "workspace_members"` on member creation — reads still passed because the
// owner's own row matches the SELECT policy, while the INSERT had no policy for
// `authenticated`.
//
// It is invisible in review (`persistSession: false` looks like it prevents it)
// and invisible at startup (the role claim is logged before anyone logs in), so
// it is pinned here as a source check rather than left to discipline.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/** Every .ts file under backend/src, excluding tests. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') return []
      return sourceFiles(full)
    }
    return entry.endsWith('.ts') ? [full] : []
  })
}

const files = sourceFiles(SRC)

describe('shared Supabase client isolation', () => {
  it('finds backend sources to scan', () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(20)
  })

  it('never calls signInWithPassword on the shared client', () => {
    const offenders = files.filter((file) =>
      /supabase\s*\.\s*auth\s*\.\s*signInWithPassword/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders, 'Use createAuthClient() from ../db — see the comment on it for why').toEqual(
      [],
    )
  })

  it('never calls setSession on the shared client', () => {
    const offenders = files.filter((file) =>
      /supabase\s*\.\s*auth\s*\.\s*setSession/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders).toEqual([])
  })

  it('exposes createAuthClient for session-establishing calls', () => {
    const db = readFileSync(join(SRC, 'db.ts'), 'utf8')
    expect(db).toMatch(/export function createAuthClient/)
  })

  it('creates that client with sessions disabled', () => {
    const db = readFileSync(join(SRC, 'db.ts'), 'utf8')
    // A fresh client that still persisted or refreshed a session would leak the
    // same way the shared one did.
    expect(db).toMatch(/persistSession:\s*false,\s*autoRefreshToken:\s*false/)
  })
})
