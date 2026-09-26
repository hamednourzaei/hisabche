// ============================================
// T13 — the boundaries a connected AI provider must not cross.
//
// Phase O's `ai-boundary-guard.test.ts` checks the DATABASE surface: no view
// takes a workspace parameter, RLS applies, columns are an allow-list. That
// file was written while no provider existed.
//
// This one checks the CODE that now calls a provider. The two questions it
// answers are the two that would end this product:
//
//   1. Can the AI read another workspace's data?
//   2. Can the provider key leave the server?
//
// ---------------------------------------------------------------------------
// ⚠️ WHY (1) IS NOT OBVIOUSLY SAFE
//
// The reporting views isolate through `auth_workspace_ids()`, which reads
// `auth.uid()` from the session. The backend's shared `supabase` client is the
// SERVICE ROLE and bypasses RLS entirely. So the straightforward
// implementation — `supabase.schema('reporting').from('sales_summary')` —
// returns EVERY workspace in the database, and the views cannot defend
// themselves because they deliberately expose no `workspace_id` column to
// filter on afterwards.
//
// The answer would look completely normal and would be assembled from other
// people's books. Nothing would error. That is why this is a test and not a
// code comment.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const AI = join(SRC, 'services', 'ai')

/** Comments stripped — this suite documents the patterns it forbids. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const aiFiles = walk(AI)

describe('the AI reads data AS THE USER, never as the service role', () => {
  it('there are AI service files to check', () => {
    // A rename that emptied this list would make every test below vacuous.
    expect(aiFiles.length).toBeGreaterThan(2)
  })

  it('only the reporting reader touches the reporting schema', () => {
    const offenders = aiFiles
      .filter((file) => !file.endsWith('reporting-reader.ts'))
      .filter((file) => /\.schema\(\s*['"]reporting['"]\s*\)/.test(code(file)))
      .map((file) => file.slice(SRC.length + 1))

    expect(
      offenders,
      'reporting access must go through ReportingReader, which uses a user-scoped client',
    ).toEqual([])
  })

  it('⚠️ the reporting reader does NOT import the shared service client', () => {
    const reader = code(join(AI, 'reporting-reader.ts'))

    // `createUserScopedClient` — yes. `supabase` — never. Importing the shared
    // client here is the single change that would silently turn isolation off.
    expect(reader).toContain('createUserScopedClient')
    expect(reader).not.toMatch(/import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from/)
  })

  it('the view name is validated against a closed list before any query', () => {
    const reader = code(join(AI, 'reporting-reader.ts'))
    expect(reader).toContain('AI_VIEW_NOT_ALLOWED')

    // The check must come BEFORE the query builder, not after — a name that
    // reaches `.from()` has already been sent.
    const guardAt = reader.indexOf('AI_VIEW_NOT_ALLOWED')
    const queryAt = reader.indexOf('.from(')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(queryAt)
  })

  it('no AI file composes SQL or calls rpc with a string', () => {
    // ⛔ The rule from docs/ai-integration-readme.md: an AI layer may read the
    // reporting views and may not run SQL it composed.
    for (const file of aiFiles) {
      const source = code(file)
      expect(source, `${file} calls rpc()`).not.toMatch(/\.rpc\(/)
      expect(source, `${file} builds SQL`).not.toMatch(/\bSELECT\s+.*\bFROM\b/i)
    }
  })

  it('no AI file accepts a workspace id as a parameter to a data read', () => {
    // The shape Phase O designed away: a workspace supplied by the caller is
    // what an injection aims at. `ReportingReader` takes a token instead.
    const reader = code(join(AI, 'reporting-reader.ts'))
    expect(reader).not.toMatch(/workspaceId\s*[:,)]/)
  })
})

describe('the user-scoped client cannot silently degrade', () => {
  const db = code(join(SRC, 'db.ts'))

  it('exists and uses the anon key', () => {
    expect(db).toContain('createUserScopedClient')
    expect(db).toContain('SUPABASE_ANON_KEY')
  })

  it('⚠️ throws rather than falling back to the service key', () => {
    // A fallback here would turn RLS off for every AI read while everything
    // continued to work — the worst possible failure mode, because it is
    // invisible.
    const start = db.indexOf('export function createUserScopedClient')
    const body = db.slice(start)
    expect(body).toContain('throw new Error')
    expect(body).not.toContain('SUPABASE_SERVICE_KEY')
  })

  it('sends the caller token as the Authorization header', () => {
    const start = db.indexOf('export function createUserScopedClient')
    const body = db.slice(start)
    expect(body).toMatch(/Authorization.*Bearer \$\{accessToken\}/)
  })
})

describe('⚠️ the provider key never leaves the server', () => {
  const routes = code(join(SRC, 'routes', 'ai-chat.routes.ts'))
  const settings = code(join(AI, 'ai-settings.service.ts'))

  it('the admin route returns the STATUS, never the config', () => {
    // `getConfig` carries `apiKey`; `getStatus` carries `hasApiKey: boolean`.
    expect(routes).toContain('settings.getStatus()')
    expect(routes).not.toContain('settings.getConfig()')
  })

  it('the status shape carries a boolean, not the key or part of it', () => {
    const start = settings.indexOf('async getStatus')
    const body = settings.slice(start, settings.indexOf('async save'))

    expect(body).toContain('hasApiKey: Boolean(')
    // No masking. A masked key is still a piece of a secret plus proof the
    // rest exists, and it invites a UI to hold something it should not.
    expect(body).not.toMatch(/\.slice\(|substring\(|\*{3}/)
  })

  it('an absent apiKey on save keeps the stored one', () => {
    // The form cannot show the current key, so it submits an empty field
    // whenever the admin edits the model or the prompt. Writing that through
    // would erase the key on every unrelated edit.
    const start = settings.indexOf('async save')
    const body = settings.slice(start)
    expect(body).toMatch(/if \(input\.apiKey && input\.apiKey\.trim\(\)\)/)
  })

  it('the provider error body is not forwarded to the client', () => {
    const chat = code(join(AI, 'ai-chat.service.ts'))
    // A provider error body can echo the request and, on some failures,
    // key metadata.
    expect(chat).toContain('AI_PROVIDER_ERROR')
    // Read in ONE place — for the server log and the admin's «test» — and the
    // error a user's question fails with carries only the status code.
    expect(chat.match(/response\.text\(\)/g) ?? []).toHaveLength(1)
    expect(chat).toMatch(/async function providerErrorDetail[\s\S]{0,160}response\.text\(\)/)
    expect(chat).toContain('new ValidationError(`AI_PROVIDER_ERROR: ${response.status}`)')
    // The detail reaches a client only through the admin-guarded test route.
    const routes = code(join(__dirname, '..', 'routes', 'ai-chat.routes.ts'))
    expect(routes).not.toContain('providerDetail')
    expect(routes).toMatch(/'\/api\/ai\/config\/test',\s*\{ preHandler: adminOnly/)
  })

  it('the caller access token is never sent to the provider', () => {
    const chat = code(join(AI, 'ai-chat.service.ts'))
    const start = chat.indexOf('private async call')
    const body = chat.slice(start)
    expect(body).not.toContain('accessToken')
  })
})

describe('the admin surface is platform-level, not workspace-level', () => {
  const routes = code(join(SRC, 'routes', 'ai-chat.routes.ts'))

  it('config routes are behind the platform admin guard', () => {
    // A workspace `owner` must not reach these: the key bills the product
    // owner, not the shop.
    expect(routes).toContain('platformAdminGuard')

    const configAt = routes.indexOf("'/api/ai/config'")
    const adminAt = routes.indexOf('const adminOnly')
    expect(adminAt).toBeGreaterThan(-1)
    expect(configAt).toBeGreaterThan(adminAt)
  })

  it('quota is checked BEFORE the provider is called', () => {
    // Otherwise an over-quota question still costs the owner a request.
    const chat = code(join(AI, 'ai-chat.service.ts'))
    const ask = chat.slice(chat.indexOf('async ask('))
    const quotaAt = ask.indexOf('AI_QUOTA_EXCEEDED')
    const firstProviderCall = ask.indexOf('this.chooseViews(')
    expect(quotaAt).toBeGreaterThan(-1)
    expect(quotaAt).toBeLessThan(firstProviderCall)
    // And whether the server can read AS THE USER — a missing anon key was
    // found after a 22-second model call (reported 26 Sep 2026).
    expect(ask.indexOf('createReader(accessToken)')).toBeGreaterThan(-1)
    expect(ask.indexOf('createReader(accessToken)')).toBeLessThan(firstProviderCall)
  })

  it('usage is counted from the log, not stored in a counter', () => {
    // The `paid_amount` defect in a new place: a derived number with its own
    // writer drifts from the rows it summarises (T9).
    const quotaService = code(join(AI, 'ai-quota.service.ts'))
    expect(quotaService).toContain("from('ai_query_log')")
    expect(quotaService).toContain("count: 'exact'")
    expect(quotaService).not.toMatch(/used_this_month|usage_count/)
  })

  it('an override of 0 is honoured rather than treated as unset', () => {
    // `?? planLimit` would silently restore the plan allowance for an account
    // an admin deliberately cut off.
    const quotaService = code(join(AI, 'ai-quota.service.ts'))
    expect(quotaService).toContain('override === null ? planLimit : override')
  })
})
