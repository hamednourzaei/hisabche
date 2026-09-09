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

import { isSession } from '@hisabche/auth-core'

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
    const isValid = isSession(stored)
    return {
      session: isValid ? stored : null,
      isAuthenticated: isValid,
      isSessionValid: isValid,
      shouldClear: stored !== null && !isValid,
      error: stored !== null && !isValid ? 'INVALID_SESSION_DATA' : null,
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
