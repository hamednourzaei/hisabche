// ============================================
// A refusal has to say something a person can act on.
//
// ⚠️ WHAT THIS REPLACED: every container surfaced a failed request as
// `response.data.error`, and the backend's global handler sends
// `error: err.name`. So being refused rendered the literal string
// «ForbiddenError» — a JavaScript class name, in English, in a Persian
// interface.
//
// The route guard's own body was no better on its own: `capability:
// 'ledger.post'` is an internal identifier. `minRoleFor` existed in the domain
// specifically to translate that into "a manager can do this" and had no
// caller until now.
// ============================================

import { describe, expect, it } from 'vitest'

import { authorizationMessage, authorizationText } from '../authorization-message'

/** Stands in for next-intl. Returns the key so substitution stays visible. */
const KEYS: Record<string, string> = {
  'authz.forbidden': 'اجازه‌ی این کار را ندارید.',
  'authz.missingCapability': 'این کار نیاز به دسترسی {role} دارد.',
  'authz.outOfBranchScope': 'این رکورد مربوط به شعبه‌ی دیگری است.',
  'authz.notOwnRecord': 'فقط روی رکوردهای خودتان.',
  'role.owner': 'مالک',
  'role.manager': 'مدیر',
  'role.seller': 'فروشنده',
}
const t = (key: string, fallback?: string) => KEYS[key] ?? fallback ?? key

/** The shape `requireCapability` replies with directly. */
function guardRefusal(capability: string, requiredRole: string) {
  return {
    response: {
      status: 403,
      data: {
        error: 'Forbidden',
        code: 'CAPABILITY_REQUIRED',
        capability,
        role: 'seller',
        requiredRole,
      },
    },
  }
}

/** The shape a thrown `ForbiddenError` takes through the global handler. */
function thrownRefusal(reason: string) {
  return {
    response: {
      status: 403,
      data: { statusCode: 403, error: 'ForbiddenError', message: reason },
    },
  }
}

describe('it answers only for authorization failures', () => {
  it('⚠️ returns null for anything that is not a 403', () => {
    // A network timeout and a refused permission need different words. A
    // helper that answered both would be used for both.
    expect(authorizationMessage({ response: { status: 500, data: {} } })).toBeNull()
    expect(authorizationMessage(new Error('Network Error'))).toBeNull()
    expect(authorizationMessage(null)).toBeNull()
    expect(authorizationMessage(undefined)).toBeNull()
  })

  it('reads the status from the body when the client did not set one', () => {
    expect(authorizationMessage({ response: { data: { statusCode: 403 } } })).not.toBeNull()
  })
})

describe("the route guard's refusal", () => {
  it('⚠️ names the ROLE, never the capability', () => {
    const message = authorizationMessage(guardRefusal('ledger.post', 'manager'))
    expect(message?.key).toBe('authz.missingCapability')
    expect(message?.params.role).toBe('role.manager')
    // The internal identifier must not be what the sentence is built from.
    expect(JSON.stringify(message?.params)).not.toContain('ledger.post')
  })

  it('⚠️ the role is translated before it is substituted', () => {
    // Otherwise a Persian sentence ends in the English word «manager».
    expect(authorizationText(guardRefusal('ledger.post', 'manager'), t)).toBe(
      'این کار نیاز به دسترسی مدیر دارد.',
    )
  })

  it('handles every workspace role', () => {
    for (const [role, expected] of [
      ['owner', 'مالک'],
      ['manager', 'مدیر'],
      ['seller', 'فروشنده'],
    ] as const) {
      expect(authorizationText(guardRefusal('invoice.delete', role), t)).toContain(expected)
    }
  })

  it('an unknown role is passed through rather than dropped', () => {
    // Better a sentence naming a role we do not have a word for than one with
    // a hole where the requirement should be.
    expect(authorizationText(guardRefusal('x.y', 'auditor'), t)).toContain('auditor')
  })
})

describe('a thrown ForbiddenError', () => {
  it('⚠️ reads the reason from `message`, not from `error`', () => {
    // The global handler puts the CLASS NAME in `error` and the reason in
    // `message`. Reading the wrong one is the original bug.
    expect(authorizationText(thrownRefusal('OUT_OF_BRANCH_SCOPE'), t)).toBe(
      'این رکورد مربوط به شعبه‌ی دیگری است.',
    )
    expect(authorizationText(thrownRefusal('NOT_OWN_RECORD'), t)).toBe('فقط روی رکوردهای خودتان.')
  })

  it('⚠️ never renders the string «ForbiddenError»', () => {
    for (const reason of ['OUT_OF_BRANCH_SCOPE', 'NOT_OWN_RECORD', 'SOMETHING_NEW']) {
      expect(authorizationText(thrownRefusal(reason), t)).not.toContain('ForbiddenError')
    }
  })

  it('an unrecognised reason still produces a sentence, and keeps the code', () => {
    const message = authorizationMessage(thrownRefusal('SOME_NEW_RULE'))
    expect(message?.key).toBe('authz.forbidden')
    // Kept for a bug report — shown to nobody on its own.
    expect(message?.code).toBe('SOME_NEW_RULE')
  })
})

describe('the {role} placeholder', () => {
  it('⚠️ is removed, not left in the text, when there is no role', () => {
    // A refusal reading «این کار نیاز به دسترسی {role} دارد.» is worse than
    // the class name it replaced.
    const text = authorizationText(thrownRefusal('OUT_OF_BRANCH_SCOPE'), t)
    expect(text).not.toContain('{role}')
  })

  it('leaves no double space behind', () => {
    const withPlaceholder = (key: string) =>
      key === 'authz.forbidden' ? 'شما {role} اجازه ندارید.' : (KEYS[key] ?? key)
    const text = authorizationText(thrownRefusal('UNKNOWN'), withPlaceholder)
    expect(text).not.toMatch(/\s{2}/)
    expect(text).not.toContain('{role}')
  })
})

describe('WRONG_WORKSPACE', () => {
  it('⚠️ is deliberately not translatable here', () => {
    // The server turns it into a 404 before it leaves. Telling somebody a row
    // exists but belongs to another workspace confirms it exists, and the only
    // person who benefits is one probing for ids. If this ever starts
    // resolving to a specific sentence, something upstream stopped doing that.
    const message = authorizationMessage(thrownRefusal('WRONG_WORKSPACE'))
    expect(message?.key).toBe('authz.forbidden')
  })
})
