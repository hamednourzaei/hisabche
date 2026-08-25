// ============================================
// The static guard: user_id must never be the tenancy boundary.
//
// This test reads the backend source and fails CI if a query against one of
// the four shared business entities filters on `user_id`, or if a route that
// touches them forgets `requireWorkspaceContext`.
//
// WHY A SOURCE SCAN AND NOT A RUNTIME TEST
//
// A runtime test can only prove the paths it calls. The defect this guards
// against is a NEW query written months from now by someone who copied the
// shape of an old one — nobody writes a test for a leak they did not know they
// introduced. Reading the source catches it the moment it is written.
//
// The four entities are shared books: several members of one business see the
// same rows. `user_id` records who created a row and is never a filter for
// them. `workspace_id` is the boundary, and it comes only from a verified
// TenancyContext.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/** The shared business entities. Their tenancy is workspace_id, always. */
const SHARED_TABLES = ['invoices', 'customers', 'products', 'transactions']

/**
 * Files exempt from the query rule, each for a stated reason. This list may
 * shrink; adding to it requires a reason that survives review.
 */
const EXEMPT = new Set([
  // Resolves tenancy itself; reads workspace_members by user_id, which is the
  // correct and only key for that table.
  'services/tenancy.service.ts',
  'services/event-log.service.ts',
  'middleware/auth.middleware.ts',
  // The sync service filters by workspace and uses user_id only as the actor
  // on the mutation ledger; it has its own invariant suite.
  'services/sync.service.ts',
  // Platform-admin surface: deliberately outside workspace authorization and
  // guarded by platformAdminGuard instead.
  'services/admin.service.ts',
  // Counts rows a USER owns for quota purposes, not a tenancy read.
  'services/billing.service.ts',
])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out.push(...walk(full))
    } else if (entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

function relative(file: string): string {
  return file.slice(SRC.length + 1).replace(/\\/g, '/')
}

/** Strip comments so a `user_id` inside an explanatory note is not a finding. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * Supabase queries are chains: `.from('invoices')...eq('user_id', x)`. Take the
 * text from each `.from('<shared table>')` up to the next `.from(` and look for
 * a user_id filter inside that window.
 */
function offendingChains(source: string): Array<{ table: string; snippet: string }> {
  const code = stripComments(source)
  const found: Array<{ table: string; snippet: string }> = []

  const fromCall = /\.from\(\s*['"`](\w+)['"`]\s*\)/g
  const starts: Array<{ table: string; index: number }> = []
  let match: RegExpExecArray | null

  while ((match = fromCall.exec(code)) !== null) {
    starts.push({ table: match[1]!, index: match.index })
  }

  for (let i = 0; i < starts.length; i += 1) {
    const current = starts[i]!
    if (!SHARED_TABLES.includes(current.table)) continue

    const end = starts[i + 1]?.index ?? code.length
    const chain = code.slice(current.index, end)

    // `.eq('user_id', …)` / `.match({ user_id })` / `.filter('user_id', …)`
    if (/\b(eq|filter|match)\(\s*[{'"`]?\s*user_id\b/.test(chain)) {
      found.push({ table: current.table, snippet: chain.replace(/\s+/g, ' ').slice(0, 160) })
    }
  }

  return found
}

describe('user_id is never the tenancy boundary for shared business data', () => {
  const files = walk(SRC).filter((f) => !relative(f).startsWith('__tests__/'))

  it('finds source to scan', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(SHARED_TABLES)('no query filters %s by user_id', (table) => {
    const offenders: string[] = []

    for (const file of files) {
      const rel = relative(file)
      if (EXEMPT.has(rel)) continue

      for (const chain of offendingChains(readFileSync(file, 'utf8'))) {
        if (chain.table !== table) continue
        offenders.push(`${rel}\n    ${chain.snippet}`)
      }
    }

    expect(
      offenders,
      `${table} is a SHARED book. Filter it by workspace_id from a verified ` +
        `TenancyContext, never by user_id — user_id records the actor, not the tenant.` +
        `\n\n${offenders.join('\n\n')}`,
    ).toEqual([])
  })

  it('no service resolves a workspace by falling back to a user id', () => {
    // `workspaceId ?? userId` and friends fabricate a tenancy boundary in the
    // same UUID space as a real one. Missing workspace context must fail
    // closed, never narrow silently to the caller's own rows.
    const pattern =
      /workspace_?[iI]d\s*(\?\?|\|\|)\s*(user_?[iI]d|['"`]['"`])|(\?\?|\|\|)\s*user_?[iI]d\s*(;|\)|,|$)/m
    const offenders: string[] = []

    for (const file of files) {
      const rel = relative(file)
      if (rel === 'services/tenancy.service.ts') continue // documents the old shapes

      const code = stripComments(readFileSync(file, 'utf8'))
      for (const line of code.split('\n')) {
        if (!/workspace/i.test(line)) continue
        if (pattern.test(line)) offenders.push(`${rel}: ${line.trim()}`)
      }
    }

    expect(offenders, `workspace context must fail closed:\n${offenders.join('\n')}`).toEqual([])
  })

  it('every route touching a shared entity resolves a workspace first', () => {
    const routesDir = join(SRC, 'routes')
    const offenders: string[] = []

    for (const file of walk(routesDir)) {
      const source = readFileSync(file, 'utf8')
      const code = stripComments(source)

      const touchesShared = SHARED_TABLES.some((t) =>
        new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]`).test(code),
      )
      const usesSharedService = /(invoiceService|customerService|productService)\./.test(code)

      if (!touchesShared && !usesSharedService) continue
      if (code.includes('requireWorkspaceContext')) continue

      // A capability URL: unauthenticated by design, authorized by an
      // unguessable share token rather than by membership, and read-only.
      // There is no user to derive a workspace from, so requiring one would
      // make the feature impossible rather than safer.
      //
      // Its safety rests entirely on the token being the ONLY way in — see
      // getPublicByToken(), where a fallback to `.eq('id', token)` used to
      // defeat exactly that and has been removed.
      if (relative(file) === 'routes/invoice-public.routes.ts') continue

      offenders.push(relative(file))
    }

    expect(
      offenders,
      'these routes read or write shared business data without requireWorkspaceContext:\n' +
        offenders.join('\n'),
    ).toEqual([])
  })

  it('a workspace-scoped HTTP cache never falls back to a user key', () => {
    const cache = readFileSync(join(SRC, 'middleware/cache.middleware.ts'), 'utf8')
    const code = stripComments(cache)

    // The scope must be a required, explicit choice — a default would be a
    // fallback in disguise, silently wrong for half the routes.
    expect(code).toMatch(/scope:\s*CacheScope/)
    expect(code).not.toMatch(/tenancy\?\.workspaceId\s*\|\|/)
  })
})
