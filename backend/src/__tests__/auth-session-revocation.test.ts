// ============================================
// MODULE AUTH — signing out has to actually sign you out.
//
// ---------------------------------------------------------------------------
// THE TWO DEFECTS THIS LOCKS DOWN
//
// 1. LOGOUT REVOKED NOTHING.
//    `POST /api/auth/logout` called `supabase.auth.signOut()` on the
//    SERVICE-ROLE client — a client that has never signed anyone in and holds
//    no session. The call succeeded and did nothing. The access token stayed
//    valid until it expired, and this backend's own auth cache (up to an hour,
//    keyed by token) kept serving it regardless.
//
// 2. A PASSWORD RESET LEFT ACTIVE SESSIONS ALONE.
//    Only the reset TOKENS were revoked. Someone who changes their password
//    because they think another person is in their account did not put that
//    person out.
//
// Neither failed loudly. Both are the kind of thing you only find by asking
// "what does this call actually do", which is why they get a test rather than
// a comment.
//
// ---------------------------------------------------------------------------
// ⚠️ THESE ARE UNIT TESTS OVER THE REAL SOURCE, NOT AN HTTP SUITE.
//
// Standing rule in this repo: green tests are not proof — proof is real HTTP or
// a real database. These assert the LOGIC and the WIRING; the session epoch
// still needs the migration run and a real revoked-token request to be called
// verified end to end.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/** Comments stripped — both defects are discussed at length in comments. */
function code(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const logoutRoute = code('routes/auth.routes.ts')
const middleware = code('middleware/auth.middleware.ts')
const resetService = code('services/password-reset.service.ts')

describe('logout revokes the session', () => {
  it('⚠️ does NOT call signOut on the service-role client', () => {
    // `supabase.auth.signOut()` — no `admin`, no argument — is the original
    // no-op. It must never come back.
    expect(logoutRoute).not.toMatch(/supabase\.auth\.signOut\s*\(\s*\)/)
  })

  it("revokes the caller's own token at the identity provider", () => {
    expect(logoutRoute).toMatch(/supabase\.auth\.admin\.signOut\s*\(\s*token\s*\)/)
  })

  it("⚠️ also drops this backend's cached verification", () => {
    // Revoking upstream is not enough on its own: `authenticate` serves a
    // verified token from cache for up to an hour without asking again.
    expect(logoutRoute).toMatch(/invalidateAuthToken\s*\(\s*token\s*\)/)
  })

  it('the cache key it clears is the one authenticate writes', () => {
    // A mismatched prefix would clear nothing and fail silently — the exact
    // failure mode of the bug being fixed.
    // Both through the one key function.
    expect(middleware).toMatch(/const cacheKey = authCacheKey\(token\)/)
    expect(middleware).toMatch(/invalidate\(authCacheKey\(token\)\)/)
  })

  it('⚠️ the bearer token itself is never a cache key — only its hash', () => {
    // `auth:<token>` put every live session in Redis's keyspace in plain text.
    expect(middleware).not.toMatch(/`auth:\$\{token\}`/)
    expect(middleware).toMatch(
      /`auth:\$\{createHash\('sha256'\)\.update\(token\)\.digest\('hex'\)\}`/,
    )
  })

  it('a failed revocation does not fail the request', () => {
    // Reporting an error on logout leaves people clicking it again on a
    // machine they are trying to walk away from.
    expect(logoutRoute).toMatch(/signOut failed to revoke the session/)
  })
})

describe('the session epoch', () => {
  it('is enforced on the FRESH verification path', () => {
    expect(middleware).toMatch(/isBeforeSessionEpoch\(token, user\.id\)/)
  })

  it('⚠️ is enforced on the CACHED path too', () => {
    // Checking only after a fresh verification would make the lock take up to
    // an hour to apply. The cache is the gate, not an optimisation in front of
    // one.
    expect(middleware).toMatch(/isBeforeSessionEpoch\(token, cached\.user\.id\)/)
  })

  it('rejects with the same message as an expired token', () => {
    // A distinct message would tell an attacker their access was deliberately
    // cut, which is information they do not need.
    const rejections = middleware.match(/error: 'Invalid or expired token'/g) ?? []
    expect(rejections.length).toBeGreaterThanOrEqual(3)
  })

  it('⚠️ compares iat, not exp', () => {
    // `exp` is when a token dies on its own. The line being drawn is about
    // when it was ISSUED.
    expect(middleware).toMatch(/getTokenIssuedAtSeconds/)
    expect(middleware).toMatch(/issuedAt < epoch/)
  })

  it('⚠️ a missing column means NO LOCK, not a lockout', () => {
    // Before the migration runs the column does not exist. Treating that as
    // "reject" would lock every user out of the product on deploy.
    expect(middleware).toMatch(/42703/)
    expect(middleware).toMatch(/PGRST204/)
  })

  it('a token with no iat is not rejected', () => {
    // Absence of the claim is "unknown", not "forbidden".
    expect(middleware).toMatch(/if \(issuedAt === null\) return false/)
  })

  it('no epoch recorded means every token passes', () => {
    expect(middleware).toMatch(/if \(epoch === null\) return false/)
  })
})

describe('password reset closes active sessions', () => {
  it('⚠️ writes the epoch, not just the reset-token revocations', () => {
    expect(resetService).toMatch(/sessions_valid_from: new Date\(\)\.toISOString\(\)/)
  })

  it('still revokes the other reset tokens', () => {
    // The original behaviour is correct and must survive the addition.
    expect(resetService).toMatch(/revoked_at: new Date\(\)\.toISOString\(\)/)
  })

  it('drops the cached epoch so the lock applies immediately', () => {
    expect(resetService).toMatch(/invalidateSessionEpoch\(resetToken\.user_id\)/)
  })

  it('⚠️ a failure to lock does not fail the reset', () => {
    // The password HAS changed by that point. Reporting failure would send the
    // person back to a form whose job is already done.
    expect(resetService).toMatch(/Failed to invalidate active sessions/)
    const epochBlock = resetService.slice(
      resetService.indexOf('sessions_valid_from'),
      resetService.indexOf('updateResult'),
    )
    expect(epochBlock).not.toMatch(/return\s*\{\s*success:\s*false/)
  })
})

describe('the migration exists and is additive', () => {
  const sql = readFileSync(
    join(SRC, '..', '..', 'docs', 'module-auth-session-epoch-migration.sql'),
    'utf8',
  )

  it('adds the column the code reads', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS sessions_valid_from/)
  })

  it('is nullable — an existing row must not be locked out by the migration', () => {
    expect(sql).not.toMatch(/sessions_valid_from timestamptz NOT NULL/)
  })

  it('is re-runnable', () => {
    expect(sql).toMatch(/IF NOT EXISTS/)
  })

  it('carries a rollback block, as every migration here must', () => {
    expect(sql).toMatch(/ROLLBACK \/ MITIGATION/)
    expect(sql).toMatch(/DROP COLUMN IF EXISTS sessions_valid_from/)
  })

  it('reloads the PostgREST schema cache', () => {
    // Without this the column stays invisible to the API until a restart, and
    // the code would keep taking the "column does not exist" branch.
    expect(sql).toMatch(/NOTIFY pgrst/)
  })

  it('ships a verification query, since a human runs this', () => {
    expect(sql).toMatch(/VERIFICATION/)
    expect(sql).toMatch(/column_exists/)
  })
})
