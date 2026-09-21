// ============================================
// The desktop auth gate — hydration decides whether the app opens.
//
// ---------------------------------------------------------------------------
// ⚠️ THE DEFECT
//
// `hydrate()` read the persisted session, called `isSession()` on it, stored
// the answer in `isSessionValid`, used it to pick an error message — and then
// set the actual gate from something else:
//
//     isAuthenticated: session !== null
//
// `RequireAuth` checks `isAuthenticated` alone. So ANY non-null blob in the
// secure store opened the app straight into the dashboard: a truncated write,
// a session from an older shape, a file left behind by a previous install.
// Every request then 401s against a UI that believes it is signed in, and the
// person never sees the login screen they needed.
//
// The validation was there. It was simply not the thing being asked.
// ============================================

import { isSession, isSessionExpired, type Session } from '@hisabche/auth-core'

describe('isSession is a real validator', () => {
  // If this ever degenerates into a null check, the gate below becomes the
  // same bug wearing the correct variable name.
  it('accepts a complete session', () => {
    expect(isSession({ token: 'abc', user: { id: 'u1', email: 'a@b.c' } })).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not-a-session'],
    ['an empty object', {}],
    ['no token', { user: { id: 'u1', email: 'a@b.c' } }],
    ['an empty token', { token: '', user: { id: 'u1', email: 'a@b.c' } }],
    ['no user', { token: 'abc' }],
    ['a user with no id', { token: 'abc', user: { email: 'a@b.c' } }],
    ['a user with no email', { token: 'abc', user: { id: 'u1' } }],
  ])('rejects %s', (_label, value) => {
    expect(isSession(value)).toBe(false)
  })
})

describe('the gate is the validation result', () => {
  /** What `hydrate()` now computes, in the same order. */
  function gate(stored: unknown) {
    const hasShape = isSession(stored)
    const hasExpired = hasShape && isSessionExpired(stored)
    const isValid = hasShape && !hasExpired
    return {
      session: isValid ? stored : null,
      isAuthenticated: isValid,
      isSessionValid: isValid,
      shouldClear: stored !== null && !isValid,
      // ⚠️ `hasShape`, not `isValid`: a session that simply ran out is not a
      // corrupt one, and saying so would accuse the person's data of a fault
      // it does not have.
      error: stored !== null && !hasShape ? 'INVALID_SESSION_DATA' : null,
    }
  }

  it('a valid session opens the app', () => {
    const stored = { token: 'abc', user: { id: 'u1', email: 'a@b.c' } }
    expect(gate(stored).isAuthenticated).toBe(true)
    expect(gate(stored).session).toBe(stored)
  })

  // The exact shape of the bug: every one of these is truthy, so the old
  // `session !== null` gate let all of them in. `it.each` rather than a loop
  // because this suite runs under Jest, whose `expect` takes no message
  // argument — a failing case has to be named by the test itself.
  it.each([
    ['an empty object', {}],
    ['an empty token', { token: '' }],
    ['a token with no user', { token: 'abc' }],
    ['a string', 'garbage'],
    ['a number', 42],
  ])('⚠️ %s does NOT open the app', (_label, blob) => {
    expect(gate(blob).isAuthenticated).toBe(false)
  })

  it('⚠️ an invalid session is DROPPED, not kept alongside the refusal', () => {
    // Keeping it would let anything downstream read a `session` the app has
    // already decided not to trust.
    expect(gate({ token: 'abc' }).session).toBeNull()
  })

  it('an invalid blob is cleared so the next launch starts clean', () => {
    expect(gate({ token: 'abc' }).shouldClear).toBe(true)
  })

  it('an empty store is not an error — it is a machine nobody signed in on', () => {
    expect(gate(null).error).toBeNull()
    expect(gate(null).shouldClear).toBe(false)
    expect(gate(null).isAuthenticated).toBe(false)
  })

  it('a malformed payload IS an error', () => {
    expect(gate({ token: '' }).error).toBe('INVALID_SESSION_DATA')
  })

  it('isAuthenticated and isSessionValid can never disagree', () => {
    // They disagreed before, and the gate read the wrong one.
    for (const blob of [null, {}, { token: 'x' }, { token: 'x', user: { id: 'i', email: 'e' } }]) {
      const g = gate(blob)
      expect(g.isAuthenticated).toBe(g.isSessionValid)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ THE SECOND WAY THE DASHBOARD OPENED FOR SOMEONE WHO WAS NOT SIGNED IN.
//
// The gate above was fixed to ask `isSession` instead of `!== null`. But
// `isSession` is a SHAPE check, and a shape cannot expire: a token issued
// last month still has a string `token`, a `user.id` and a `user.email`, so
// it passed exactly as a fresh one does. The app opened on the dashboard, the
// login screen never appeared, and every request behind it 401'd.
//
// Offline there is no 401 to correct it — the app just sits there, signed in
// to nothing.
// ═══════════════════════════════════════════════════════════════════════════

describe('a session that has run out is not a session', () => {
  /** A JWT with the given `exp`. Only the payload segment is ever read. */
  function tokenExpiring(at: number | null): string {
    const claims = at === null ? { sub: 'u1' } : { sub: 'u1', exp: Math.floor(at / 1000) }
    const payload = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_')
    return `header.${payload}.signature`
  }

  const sessionWith = (token: string): Session => ({
    token,
    user: { id: 'u1', email: 'a@b.c', fullName: 'Someone', createdAt: '2026-01-01T00:00:00Z' },
  })

  const HOUR = 60 * 60 * 1000
  const now = Date.UTC(2026, 8, 21, 12, 0, 0)

  it('⚠️ an expired token passes isSession — which is exactly the problem', () => {
    // If this ever fails, the shape check grew an expiry check of its own and
    // the two are now duplicating a rule. One of them has to go.
    expect(isSession(sessionWith(tokenExpiring(now - HOUR)))).toBe(true)
  })

  it('⚠️ an expired session does NOT open the app', () => {
    expect(gateFor(sessionWith(tokenExpiring(now - HOUR)), now).isAuthenticated).toBe(false)
  })

  it('an unexpired session still opens the app', () => {
    expect(gateFor(sessionWith(tokenExpiring(now + HOUR)), now).isAuthenticated).toBe(true)
  })

  it('⚠️ a session with NO exp claim is left alone', () => {
    // We cannot read an end date that was never written. Inventing one would
    // sign a real person out of a session that is still good (§12).
    expect(isSessionExpired(sessionWith(tokenExpiring(null)), now)).toBe(false)
  })

  it.each([
    ['not a JWT at all', 'opaque-token'],
    ['a payload that is not base64', 'a.!!!.c'],
    ['a payload that is not JSON', `a.${btoa('not json')}.c`],
    ['exp that is not a number', `a.${btoa(JSON.stringify({ exp: 'soon' }))}.c`],
  ])('an unreadable token (%s) is not treated as expired', (_label, token) => {
    // Same rule: absence of an answer is not an answer (§7.5).
    expect(isSessionExpired(sessionWith(token), now)).toBe(false)
  })

  it('⚠️ expiry is not an error — it is the ordinary passage of time', () => {
    // Showing «your saved data was invalid» to someone whose week simply
    // ended blames their data for a fault it does not have.
    expect(gateFor(sessionWith(tokenExpiring(now - HOUR)), now).error).toBeNull()
  })

  it('a malformed blob is still an error', () => {
    expect(gateFor({ token: '' }, now).error).toBe('INVALID_SESSION_DATA')
  })

  it('⚠️ the expired session is cleared, so the next launch starts clean', () => {
    expect(gateFor(sessionWith(tokenExpiring(now - HOUR)), now).shouldClear).toBe(true)
  })

  /** The same computation `hydrate()` performs, with time injected. */
  function gateFor(stored: unknown, at: number) {
    const hasShape = isSession(stored)
    const hasExpired = hasShape && isSessionExpired(stored, at)
    const isValid = hasShape && !hasExpired
    return {
      isAuthenticated: isValid,
      shouldClear: stored !== null && !isValid,
      error: stored !== null && !hasShape ? 'INVALID_SESSION_DATA' : null,
    }
  }
})
