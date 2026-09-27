// ⚠️ SECURITY (27 Sep 2026). Every database function the BACKEND calls must be
// revoked from clients. Supabase grants EXECUTE on public functions to anon and
// authenticated by default, PostgREST serves them at /rest/v1/rpc/<name>, and
// the anon key is in the web bundle. Ten backend-only functions had no REVOKE —
// eight of them SECURITY DEFINER with the workspace as a parameter, so anyone
// with the public key could post journal entries, cancel payments or move stock
// in any business (docs/rpc-client-revoke-migration.sql).
//
// A new `supabase.rpc('x')` without a REVOKE for `x` in docs/ fails here.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const DOCS = join(__dirname, '..', '..', '..', 'docs')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

const calledByBackend = new Set<string>()
for (const file of walk(SRC)) {
  // Direct calls, and the analytics aggregates, which go through callAggregate('name', …).
  for (const m of readFileSync(file, 'utf8').matchAll(
    /(?:\.rpc|callAggregate(?:<[^>]*>)?)\(\s*'([a-z_0-9]+)'/g,
  )) {
    calledByBackend.add(m[1]!)
  }
}

const migrations = readdirSync(DOCS)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('_') && f !== 'SETUP-COMPLETE.sql')
  .map((f) => readFileSync(join(DOCS, f), 'utf8'))
  .join('\n')

const defined = (name: string) =>
  new RegExp(`FUNCTION\\s+(public\\.)?${name}\\s*\\(`, 'i').test(migrations)

/** A REVOKE naming the function from a client role, or the loop migration's list. */
const revoked = (name: string) =>
  new RegExp(`REVOKE[^;]*\\b${name}\\b[^;]*FROM[^;]*\\b(PUBLIC|anon|authenticated)\\b`, 'i').test(
    migrations,
  ) || new RegExp(`FOREACH v_name IN ARRAY ARRAY\\[[^\\]]*'${name}'`, 'i').test(migrations)

describe('backend-only database functions are not callable by clients', () => {
  it('the scan found the backend RPCs', () => {
    expect(calledByBackend.size).toBeGreaterThan(30)
  })

  it('every RPC the backend calls (and a migration defines) is revoked from clients', () => {
    const exposed = [...calledByBackend].filter((n) => defined(n) && !revoked(n)).sort()
    expect(exposed).toEqual([])
  })
})
