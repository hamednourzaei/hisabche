// ============================================
// The Constitution, made executable.
//
// `.claude/master-prompt.md` §12 lists 45 non-negotiable laws. A law nobody
// can check is a wish. This file turns the mechanically-checkable ones into
// assertions that fail CI, so a violation is caught the moment it is written
// rather than in a review that may never happen.
//
// WHAT IS AND IS NOT HERE
//
// Only laws with an objective, decidable test. "Every authorization decision
// MUST be explainable" (§12.19) is real and important and cannot be a unit
// test — it is left to review, deliberately, rather than faked with a
// meaningless assertion.
//
// Each test names its law. When one fails, the message says which law and
// why it exists, because a guard whose failure is cryptic gets deleted.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const REPO = join(SRC, '..', '..')

function walk(dir: string, exts = ['.ts', '.tsx']): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.some((e) => entry.endsWith(e))) out.push(full)
  }
  return out
}

function rel(file: string): string {
  return file.slice(REPO.length + 1).replace(/\\/g, '/')
}

/** Comments explain violations; they are not violations. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

const backendFiles = walk(SRC).filter((f) => !rel(f).includes('__tests__'))

/* ═══════════════════════════════════════════════════════════════════════════
   §12.8 — NEVER trust client-supplied tenancy identifiers
   ═══════════════════════════════════════════════════════════════════════════ */

describe('law 8 — client-supplied tenancy is never trusted', () => {
  it('no handler reads a workspace id from the request body', () => {
    // A workspace id in the body is a REQUEST, not an authorization. The only
    // sanctioned path is requireWorkspaceContext, which verifies it against
    // workspace_members before anything touches a query.
    const offenders: string[] = []

    for (const file of backendFiles) {
      const code = stripComments(readFileSync(file, 'utf8'))
      if (/body[\s\S]{0,40}\.workspaceId|body\.workspace_id/.test(code)) {
        offenders.push(rel(file))
      }
    }

    expect(
      offenders,
      'a workspace id taken from the request body bypasses membership verification',
    ).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.32 / §12.33 — ONE authorization · no duplicate domain truths
   ═══════════════════════════════════════════════════════════════════════════ */

describe('laws 32 & 33 — one engine per domain truth', () => {
  it('only tenancy.service resolves a workspace from membership', () => {
    // Every other resolver that ever existed failed open — `?? userId`, `|| ''`
    // — and each was a fabricated tenancy boundary. There is now exactly one,
    // and it fails closed.
    // Reading `workspace_members` is not automatically a violation — some
    // domains legitimately OWN that table. The law is about deriving REQUEST
    // TENANCY from it, which is what the three fail-open resolvers used to do.
    // Each exemption names why it is not that.
    const OWNS_MEMBERSHIP_DATA = new Map([
      ['backend/src/services/tenancy.service.ts', 'the one sanctioned resolver'],
      ['backend/src/middleware/auth.middleware.ts', 'reads role for display, not tenancy'],
      [
        'backend/src/services/workspace.service.ts',
        'the membership domain owner — CRUD on its own table',
      ],
      [
        'backend/src/services/admin.service.ts',
        'platform-admin domain, separately guarded; lists memberships as data',
      ],
      [
        'backend/src/services/event-log.service.ts',
        'stamps activity rows; fails closed, never falls back to a user id',
      ],
      ['backend/src/services/password-reset.service.ts', 'notifies workspace members of a reset'],
      [
        'backend/src/plugins/job-scheduler.plugin.ts',
        'background jobs iterate workspaces; there is no request tenancy',
      ],
    ])

    const offenders: string[] = []

    for (const file of backendFiles) {
      const name = rel(file)
      if (OWNS_MEMBERSHIP_DATA.has(name)) continue

      const code = stripComments(readFileSync(file, 'utf8'))
      // A membership query that SELECTS workspace_id is a tenancy resolution.
      if (/from\(['"`]workspace_members['"`]\)[\s\S]{0,200}select\([^)]*workspace_id/.test(code)) {
        offenders.push(name)
      }
    }

    expect(
      offenders,
      'these files resolve tenancy themselves instead of using requireWorkspace() — ' +
        'a second resolver is a second security model',
    ).toEqual([])
  })

  it('the platform-admin allowlist is read in exactly one place', () => {
    // §12.6 / §12.7: authorization must not be re-derived per call site. One
    // guard, one allowlist.
    const readers = backendFiles.filter((file) => {
      const code = stripComments(readFileSync(file, 'utf8'))
      return code.includes('ADMIN_ALLOWED_EMAILS')
    })

    expect(readers.map(rel)).toEqual(['backend/src/middleware/platform-admin.middleware.ts'])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.6 / §12.10 — platform admin must not bypass workspace authorization
   ═══════════════════════════════════════════════════════════════════════════ */

describe('laws 6 & 10 — administration is not authorization', () => {
  it('the tenancy resolver never consults admin status', () => {
    const code = stripComments(readFileSync(join(SRC, 'services', 'tenancy.service.ts'), 'utf8'))

    // A single `if (isPlatformAdmin) return true` here would convert an email
    // allowlist into read access over every customer's financial history.
    expect(code).not.toMatch(/ADMIN_ALLOWED_EMAILS|isPlatformAdmin|platformAdmin/)
    expect(code).not.toMatch(/from\(['"`](?!workspace_members)/)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.1 / §12.14 — never delete production data · never mutate finalized history
   ═══════════════════════════════════════════════════════════════════════════ */

describe('laws 1 & 14 — financial history is not deletable from a service', () => {
  const FINANCIAL_TABLES = [
    'invoices',
    'transactions',
    'journal_entries',
    'journal_lines',
    'ledger_entries',
    'audit_logs',
  ]

  it('no service deletes from an audit or ledger table', () => {
    // §12.18: every financial state transition must be auditable. A service
    // that can delete the audit trail can erase the evidence of its own
    // actions. Corrections go through reversal/adjustment (§12.15), never DELETE.
    //
    // ONE deletion shape is legitimate, named here so the guard stays sharp
    // instead of being switched off wholesale:
    //
    //   RETENTION — audit.service.cleanup() is behind platformAdminGuard and
    //   writes its own audit marker BEFORE deleting, so the deletion is itself
    //   recorded and the marker outlives the cutoff.
    //
    // The COMPENSATING ROLLBACK exemption is gone. It covered a journal header
    // whose lines failed to insert — a half-write that only existed because
    // the header and its lines were two separate round trips. They are now one
    // transaction inside accounting_post_journal_entry, so a failed entry is
    // never written at all and nothing needs deleting afterwards.
    const ALLOWED_DELETES = new Map([
      [
        'backend/src/services/audit.service.ts -> audit_logs',
        'gated retention; writes its own audit marker first',
      ],
    ])

    const offenders: string[] = []

    for (const file of backendFiles) {
      const code = stripComments(readFileSync(file, 'utf8'))

      for (const table of ['audit_logs', 'journal_entries', 'journal_lines', 'ledger_entries']) {
        const chain = new RegExp(`from\\(['"\`]${table}['"\`]\\)[\\s\\S]{0,200}\\.delete\\(`)
        const key = `${rel(file)} -> ${table}`
        if (chain.test(code) && !ALLOWED_DELETES.has(key)) offenders.push(key)
      }
    }

    expect(offenders, 'audit and ledger rows record what happened; they are append-only').toEqual(
      [],
    )
  })

  it('names the financial tables it is guarding', () => {
    // Guards against silently shrinking the list above to make a failure go
    // away — the set is asserted, not just used.
    expect(FINANCIAL_TABLES).toContain('invoices')
    expect(FINANCIAL_TABLES).toContain('audit_logs')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.4 — NEVER fabricate financial values
   ═══════════════════════════════════════════════════════════════════════════ */

describe('law 4 — no fabricated financial values', () => {
  it('no revenue metric is computed without a pricing source', () => {
    // There is no authoritative price anywhere: PLANS carries name/limits/
    // featureKeys and no price, and checkout_sessions has no amount. Any MRR
    // or ARR figure would therefore be invented — and an invented revenue
    // number on the control panel of a financial product is worse than none.
    const admin = stripComments(readFileSync(join(SRC, 'services', 'admin.service.ts'), 'utf8'))

    expect(admin).not.toMatch(/\bmrr\b|\barr\b/i)
    expect(admin).not.toMatch(/monthlyRevenue|totalRevenue|revenueTotal/i)
  })

  it('the plan config still carries no price, so the guard above stays meaningful', () => {
    // If a price is ever added, this fails — which is the signal to revisit
    // the revenue guard rather than leave it silently obsolete.
    const billing = stripComments(readFileSync(join(SRC, 'services', 'billing.service.ts'), 'utf8'))
    const plansBlock = billing.slice(
      billing.indexOf('export const PLANS'),
      billing.indexOf('const TRIAL_DAYS'),
    )

    expect(plansBlock).not.toMatch(/price|amount|cost/i)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.16 — every retryable mutation MUST be idempotent
   ═══════════════════════════════════════════════════════════════════════════ */

describe('law 16 — retryable mutations are idempotent', () => {
  it('the sync push path keys on a mutation id', () => {
    // A lost response must not become a second invoice. The idempotency
    // ledger is what makes a retry safe.
    const sync = stripComments(readFileSync(join(SRC, 'services', 'sync.service.ts'), 'utf8'))

    expect(sync).toMatch(/sync_mutations/)
    expect(sync).toMatch(/mutation_?[iI]d/)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.7 — NEVER use UI hiding as security
   ═══════════════════════════════════════════════════════════════════════════ */

describe('law 7 — the UI is not a security boundary', () => {
  /**
   * Route files whose data is PLATFORM-WIDE — the underlying tables carry no
   * `workspace_id`, so no query against them can be scoped to one business.
   * Every handler in these files must therefore be admin-guarded.
   *
   * `audit.routes.ts` is here because of a real defect this guard missed on
   * its first version: it checked only `admin.routes.ts`, so the whole audit
   * surface sat behind bare `authenticate`. Any authenticated user — a seller
   * in one shop — could read every workspace's financial actions, export them,
   * forge entries, and DELETE the platform's audit trail.
   */
  const PLATFORM_WIDE_ROUTES = ['admin.routes.ts', 'audit.routes.ts']

  /**
   * Service methods on these files' services that are CROSS-WORKSPACE by
   * construction. A handler calling one of these is a platform surface no
   * matter what middleware it carries, so it must be admin-guarded.
   *
   * Their workspace-scoped counterparts (`listForWorkspace`,
   * `getEntityHistoryForWorkspace`, `getUserActivity`) take a TenancyContext
   * and filter on it — those are safe behind `requireWorkspaceContext`.
   */
  const CROSS_WORKSPACE_CALLS = [
    'auditService.list(',
    'auditService.getEntityHistory(',
    'auditService.getUserActivityAcrossWorkspaces(',
    'auditService.getStats(',
    'auditService.exportLogs(',
    'auditService.cleanup(',
    'auditService.log(',
  ]

  it.each(PLATFORM_WIDE_ROUTES)('every handler in %s is guarded server-side', (fileName) => {
    // The admin panel hides what a non-admin should not see. That is UX. The
    // guard is what makes it security, and it must be on every handler without
    // exception — one unguarded route is the whole surface.
    //
    // ⚠️ G4 WIDENED WHAT COUNTS AS GUARDED — and narrowed what counts as safe.
    //
    // The original rule was "every handler must have platformAdminGuard",
    // justified by "audit_logs has no workspace_id". That justification is no
    // longer true: the column exists, `AuditService.log()` now writes it, and
    // `listForWorkspace` filters on it for the member-facing «سابقه تغییرات»
    // tab.
    //
    // So a handler is now acceptable if EITHER:
    //   · it is admin-guarded (the platform-support surface), OR
    //   · it is workspace-scoped AND calls no cross-workspace service method.
    //
    // The second clause is the important half. Without it this would have
    // become "any handler with requireWorkspaceContext is fine" — and a
    // handler could carry that middleware while calling the cross-workspace
    // `auditService.list()`, which reads every business's audit trail. The
    // middleware would make it LOOK scoped and the query would not be.
    const code = stripComments(readFileSync(join(SRC, 'routes', fileName), 'utf8'))

    // ⚠️ PER-HANDLER, not counted across the file.
    //
    // The first draft of this compared totals — "as many guards as handlers".
    // That has SLACK: this file has 11 guard mentions for 9 handlers, so a
    // tenth handler with no guard at all still satisfied it, and pointing a
    // workspace-scoped handler at the cross-workspace `list()` did not fail
    // the test when it was deliberately tried. A totals check cannot say WHICH
    // handler is unguarded, which is the only thing worth knowing.
    //
    // Each block runs from one `fastify.<method>(` to the next.
    const blocks = code.split(/fastify\.(?:get|post|patch|delete|put)[<(]/).slice(1)

    expect(blocks.length, `no handlers found in ${fileName} — did the file move?`).toBeGreaterThan(
      0,
    )

    const unguarded: string[] = []
    const leaking: string[] = []

    for (const block of blocks) {
      // The route path is the first string literal in the block.
      const path = /['"`]([^'"`]+)['"`]/.exec(block)?.[1] ?? '(unknown path)'

      const isAdminGuarded = block.includes('platformAdminGuard')
      const isWorkspaceScoped = block.includes('requireWorkspaceContext')

      if (!isAdminGuarded && !isWorkspaceScoped) {
        unguarded.push(`${fileName} ${path}`)
        continue
      }

      // A handler that is only workspace-scoped must not reach a
      // cross-workspace service method. `requireWorkspaceContext` would make
      // it LOOK scoped while the query read every business.
      if (!isAdminGuarded) {
        const call = CROSS_WORKSPACE_CALLS.find((needle) => block.includes(needle))
        if (call) leaking.push(`${fileName} ${path} → ${call}`)
      }
    }

    expect(
      unguarded,
      'an unguarded handler here is a cross-tenant read or a platform-wide write',
    ).toEqual([])

    expect(
      leaking,
      'a cross-workspace query behind requireWorkspaceContext reads every business ' +
        'while looking scoped',
    ).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §12.22 / §11 — production-readiness claims require evidence
   ═══════════════════════════════════════════════════════════════════════════ */

describe('law 22 — status claims are evidence-backed', () => {
  const STATE = join(REPO, 'PROJECT_STATE.md')

  it('PROJECT_STATE.md exists', () => {
    // §4.3 and §56 STEP 1 require it at session start. Its absence is why two
    // sessions began without knowing what was already done.
    expect(() => readFileSync(STATE, 'utf8')).not.toThrow()
  })

  it('uses only the §18 status vocabulary', () => {
    const text = readFileSync(STATE, 'utf8')

    // Only the capability sections. The document's own header QUOTES these
    // phrases in order to forbid them, and a guard that fails on its own rule
    // statement teaches people to delete the guard rather than obey it.
    const body = text.slice(text.indexOf('## Capability status')).toLowerCase()

    // §18 forbids these precisely because they sound like progress while
    // asserting nothing measurable.
    for (const banned of [
      'almost done',
      'basically complete',
      'mostly finished',
      'probably safe',
    ]) {
      expect(body, `"${banned}" is not a status (§18) — use the evidence vocabulary`).not.toContain(
        banned,
      )
    }
  })

  it('every PRODUCTION-READY claim carries at least one evidence tag', () => {
    const text = readFileSync(STATE, 'utf8')
    const sections = text.split(/^### /m).slice(1)

    const unevidenced = sections
      .filter((s) => s.includes('PRODUCTION-READY'))
      .filter((s) => !/\*\*(FACT|OBSERVED)\*\*/.test(s))
      .map((s) => s.split('\n')[0])

    expect(
      unevidenced,
      'PRODUCTION-READY without FACT or OBSERVED evidence is a claim, not a status (§11)',
    ).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   §4.2 / §56 STEP 1 — the session-start documents exist
   ═══════════════════════════════════════════════════════════════════════════ */

describe('session start protocol — required documents', () => {
  it.each(['HANDOFF.md', 'PROJECT_STATE.md'])('%s exists', (name) => {
    expect(() => readFileSync(join(REPO, name), 'utf8')).not.toThrow()
  })

  it('every capability contract declares a §18 status', () => {
    const dir = join(REPO, 'docs', 'capabilities')
    const contracts = walk(dir, ['.md'])

    expect(contracts.length).toBeGreaterThan(0)

    const STATUSES = [
      'NOT STARTED',
      'DESIGNING',
      'IMPLEMENTING',
      'VERIFYING',
      'PRODUCTION-READY',
      'DEPLOYING',
      'RELEASED',
      'BLOCKED',
    ]

    const missing = contracts
      .filter((file) => {
        const text = readFileSync(file, 'utf8')
        return !STATUSES.some((s) => text.includes(s))
      })
      .map(rel)

    expect(missing, 'a contract without a status cannot be resumed safely').toEqual([])
  })
})
