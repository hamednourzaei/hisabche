// ============================================
// packages/ui/src/lib/authorization-message.ts
//
// Turning a refusal into a sentence a person can act on.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THE USER ACTUALLY SAW
//
// Every container surfaces a failed request through the same shape:
//
//     response?.data?.error ?? (error as Error)?.message ?? fallback
//
// and the backend's global handler sends `error: err.name`. So a refused
// action rendered the literal string «ForbiddenError» — a JavaScript class
// name, in English, in a Persian interface, telling nobody anything.
//
// The route guard's own body is no better on its own: `capability:
// 'ledger.post'` is an internal identifier. `authorization.domain.ts` says so
// itself, in the docstring above `minRoleFor`:
//
//     "nobody outside this codebase knows what `ledger.post` is, and a name
//      they cannot act on is not an explanation"
//
// `minRoleFor` was exported for exactly this and had no caller. The server now
// sends `requiredRole` alongside, and this is the half that reads it.
//
// ---------------------------------------------------------------------------
// TWO SHAPES, BECAUSE THERE ARE TWO SOURCES
//
//   route guard    { error: 'Forbidden', code: 'CAPABILITY_REQUIRED',
//                    capability, role, requiredRole }
//   thrown error   { statusCode: 403, error: 'ForbiddenError',
//                    message: 'OUT_OF_BRANCH_SCOPE' }
//
// The first comes from `requireCapability` replying directly; the second from
// `ForbiddenError` going through the global handler, which puts the reason
// code in `message` and the class name in `error`.
//
// ---------------------------------------------------------------------------
// PURE, AND IT TRANSLATES NOTHING ITSELF
//
// It returns a key and its parameters; the caller resolves them. This package
// holds no strings, and the same function has to work under next-intl on web
// and the desktop shim.
// ============================================

/** A refusal, reduced to something translatable. */
export interface AuthorizationMessage {
  /** i18n key. */
  key: string
  /** Substitutions the key expects, already resolved to display values. */
  params: Record<string, string>
  /** The machine reason, for a log or a bug report. Never shown alone. */
  code: string
}

/** The server's workspace roles. Not the client's display vocabulary. */
const ROLE_KEY: Record<string, string> = {
  owner: 'role.owner',
  manager: 'role.manager',
  seller: 'role.seller',
}

/**
 * The reasons `scope.domain.ts` can refuse with, plus the guard's own code.
 *
 * ⚠️ `WRONG_WORKSPACE` IS DELIBERATELY ABSENT. The server turns it into a 404
 * before it ever leaves — telling somebody a row exists but belongs to another
 * workspace confirms it exists, and the only person who benefits from that
 * confirmation is one probing for ids. If it ever appears here, something
 * upstream stopped doing that.
 */
const REASON_KEY: Record<string, string> = {
  MISSING_CAPABILITY: 'authz.missingCapability',
  OUT_OF_BRANCH_SCOPE: 'authz.outOfBranchScope',
  NOT_OWN_RECORD: 'authz.notOwnRecord',
  RESOURCE_NOT_GUARDED: 'authz.notGuarded',
  CAPABILITY_REQUIRED: 'authz.missingCapability',
}

function bodyOf(error: unknown): Record<string, unknown> | null {
  const response = (error as { response?: { data?: unknown } })?.response
  const data = response?.data
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

function statusOf(error: unknown): number | null {
  const response = (error as { response?: { status?: number } })?.response
  const status = response?.status ?? (bodyOf(error)?.statusCode as number | undefined)
  return typeof status === 'number' ? status : null
}

/**
 * The refusal behind `error`, or `null` if it is not an authorization failure.
 *
 * `null` rather than a generic message: a network timeout and a refused
 * permission need different words, and a helper that answers both would be
 * used for both.
 */
export function authorizationMessage(error: unknown): AuthorizationMessage | null {
  const body = bodyOf(error)
  const status = statusOf(error)
  if (status !== 403) return null

  // The guard's own reply. `code` is present only on this shape.
  const code =
    (typeof body?.code === 'string' ? body.code : null) ??
    // The thrown-error shape: the reason lives in `message`, because the
    // global handler puts the class name in `error`.
    (typeof body?.message === 'string' && body.message in REASON_KEY ? body.message : null)

  if (!code) {
    // A 403 that carries no reason we recognise. Still better than
    // «ForbiddenError»: say it was refused, and keep whatever the server sent
    // for a bug report.
    return {
      key: 'authz.forbidden',
      params: {},
      code: typeof body?.message === 'string' ? body.message : 'FORBIDDEN',
    }
  }

  const requiredRole = typeof body?.requiredRole === 'string' ? body.requiredRole : null

  return {
    key: REASON_KEY[code] ?? 'authz.forbidden',
    params: requiredRole ? { role: ROLE_KEY[requiredRole] ?? requiredRole } : {},
    code,
  }
}

/**
 * `authorizationMessage`, resolved to a string.
 *
 * `t` is passed in for the same reason it is everywhere else in this package:
 * web and desktop resolve keys through different libraries.
 *
 * ⚠️ The role parameter is itself a KEY, so it is translated before it is
 * substituted — otherwise a Persian sentence ends in the word «manager».
 */
export function authorizationText(
  error: unknown,
  t: (key: string, fallback?: string) => string,
): string | null {
  const message = authorizationMessage(error)
  if (!message) return null

  const role = message.params.role ? t(message.params.role) : ''
  const text = t(message.key)

  // `{role}` is substituted here rather than through the i18n library's own
  // interpolation, because the two renderers disagree about its syntax and
  // this package cannot depend on either.
  return role ? text.replace('{role}', role) : text.replace(' {role}', '').replace('{role}', '')
}
