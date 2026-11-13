// ============================================
// backend/src/utils/admin-route-audit.ts
//
// Reads the admin guard chain OUT OF SOURCE, so a route that ships without
// RBAC/AAL2/step-up fails a guard test instead of a customer.
//
// ⚠️ V63 · S-7 — the systemic hole was that nothing prevented a NEW admin
// route from being registered with only the email allow-list. This analyzer is
// the single reader used by `admin-route-chain.test.ts`; it is deliberately
// pure (string in, findings out) so the test can also feed it a synthetic
// source with a missing guard and prove it reports one.
//
// It understands the four real shapes in this repository:
//
//   const read  = [authenticate, platformAdminGuard, requireAdminPermission('x')]
//   const write = adminRoute('x', { stepUp: true })
//   const admin = { preHandler: adminRouteByMethod('r', 'w', { stepUpOnWrite: true }) }
//   fastify.get('/api/admin/x', { preHandler: read }, …)
//   fastify.get('/api/admin/x', read, …)        ← positional guard
//   fastify.get('/api/admin/x', admin = …, …)   ← positional array
// ============================================

export interface AdminRouteRecord {
  file: string
  method: string
  path: string
  /** The resolved guard expression, comments stripped. */
  guardText: string
  /** True when the expression carries an admin permission check. */
  hasPermission: boolean
  /** True when the expression requires a fresh TOTP step-up. */
  hasStepUp: boolean
  /** True when the expression keeps the platform-admin allow-list guard. */
  hasPlatformGuard: boolean
  /** True when the path is under `/api/admin/` or the guard is an admin chain. */
  isAdminRoute: boolean
}

export interface AdminRouteViolation {
  file: string
  method: string
  path: string
  reason: 'no_permission' | 'no_step_up' | 'no_platform_guard'
}

/** Non-GET admin routes that MUST require a fresh step-up. */
const STEP_UP_REQUIRED: RegExp[] = [
  /^\/api\/ai\/config$/,
  /^\/api\/ai\/config\/test$/,
  /^\/api\/ai\/quota\//,
  /^\/api\/admin\/instances\/scale$/,
  /^\/api\/admin\/subscriptions\/[^/]+\/(plan|status)$/,
  /^\/api\/admin\/memberships\//,
  /^\/api\/admin\/accounts/,
  /^\/api\/admin\/sessions\/[^/]+\/revoke$/,
  /^\/api\/admin\/billing\//,
  /^\/api\/admin\/blog\//,
  /^\/api\/admin\/market/,
  /^\/api\/admin\/oauth/,
  /^\/api\/admin\/ops\//,
  /^\/api\/admin\/secrets/,
  /^\/api\/admin\/gateways/,
  /^\/api\/admin\/monitor\/wall/,
  /^\/api\/admin\/security\/ip-allowlist/,
  /^\/api\/admin\/security\/posture/,
]

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** The slice of `source` starting at `start`, including balanced brackets. */
function readBalanced(source: string, start: number): string {
  const open = source[start]
  if (open !== '[' && open !== '{' && open !== '(') return ''
  const pairs: Record<string, string> = { '[': ']', '{': '}', '(': ')' }
  const close = pairs[open]!
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === open) depth += 1
    else if (ch === close) {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return source.slice(start)
}

/** The expression assigned to a name or a `preHandler` key. */
function readExpression(source: string, start: number): string {
  let i = start
  while (i < source.length && /\s/.test(source[i]!)) i += 1
  const first = source[i]
  if (first === undefined) return ''
  if (first === '[' || first === '{') return readBalanced(source, i)
  if (first === '(') return readBalanced(source, i)
  // `adminRoute('x', { stepUp: true })` — an identifier followed by a call.
  const identMatch = /^[A-Za-z_$][\w$]*/.exec(source.slice(i))
  if (!identMatch) return ''
  const ident = identMatch[0]
  const after = i + ident.length
  let j = after
  while (j < source.length && /\s/.test(source[j]!)) j += 1
  if (source[j] === '(') return ident + readBalanced(source, j)
  return ident
}

function collectConstants(source: string): Map<string, string> {
  const map = new Map<string, string>()
  const regex = /const\s+([A-Za-z_$][\w$]*)\s*=\s*/g
  for (const match of source.matchAll(regex)) {
    const valueStart = match.index! + match[0].length
    map.set(match[1]!, readExpression(source, valueStart))
  }
  return map
}

function resolve(text: string, constants: Map<string, string>, depth = 0): string {
  const value = text.trim()
  if (depth > 5) return value
  if (/^[A-Za-z_$][\w$]*$/.test(value)) {
    const next = constants.get(value)
    return next ? resolve(next, constants, depth + 1) : value
  }
  // `{ preHandler: X }`
  const objPre = /preHandler\s*:\s*/.exec(value)
  if (value.startsWith('{') && objPre) {
    return resolve(value.slice(objPre.index + objPre[0].length), constants, depth + 1)
  }
  return value
}

function classify(guardText: string): {
  hasPermission: boolean
  hasStepUp: boolean
  hasPlatformGuard: boolean
} {
  return {
    hasPermission:
      /requireAdminPermission\s*\(/.test(guardText) ||
      /(^|[^\w.])adminRoute\s*\(/.test(guardText) ||
      /(^|[^\w.])adminRouteByMethod\s*\(/.test(guardText),
    hasStepUp:
      /requireAdminStepUp/.test(guardText) ||
      /stepUp\s*:\s*true/.test(guardText) ||
      /stepUpOnWrite\s*:\s*true/.test(guardText),
    hasPlatformGuard:
      /platformAdminGuard/.test(guardText) ||
      /(^|[^\w.])adminRoute\s*\(/.test(guardText) ||
      /(^|[^\w.])adminRouteByMethod\s*\(/.test(guardText),
  }
}

/**
 * Every admin route registration in one file source, with its resolved chain.
 * A registration whose `preHandler` is not found at all is still reported, with
 * an empty guard text — that is the worst case, not a missing case.
 */
export function analyzeAdminRoutes(file: string, source: string): AdminRouteRecord[] {
  const code = stripComments(source)
  const constants = collectConstants(code)
  const records: AdminRouteRecord[] = []

  const registrations = [
    ...code.matchAll(/(?:fastify|server)\.(get|post|put|patch|delete)\(\s*'([^']+)'/g),
  ]
  for (let index = 0; index < registrations.length; index += 1) {
    const match = registrations[index]!
    const method = match[1]!.toUpperCase()
    const path = match[2]!
    const after = match.index! + match[0].length
    // Never read into the NEXT registration: a public route followed by an
    // admin one would otherwise inherit its `preHandler` and pass.
    const next = registrations[index + 1]
    const segment = code.slice(after, next ? next.index : undefined)

    const pre = /preHandler\s*:\s*/.exec(segment)
    let guardText = ''
    if (pre) {
      guardText = resolve(readExpression(segment, pre.index + pre[0].length), constants)
    } else {
      // Positional form: `fastify.get(path, <guard>, handler)`. The segment
      // starts with the path, a comma, then the second argument. Read that
      // argument only when it is a real guard — an array, a known constant, or
      // an `adminRoute`/`authenticate` call. An inline handler (`async () => …`)
      // is not a guard and must not be reported as one.
      const comma = segment.indexOf(',')
      if (comma !== -1) {
        let i = comma + 1
        while (i < segment.length && /\s/.test(segment[i]!)) i += 1
        const candidate = readExpression(segment, i)
        const isArray = candidate.startsWith('[')
        const isAdminCall = /^(?:adminRoute|adminRouteByMethod|authenticate)\s*\(/.test(candidate)
        const isKnownConstant = /^[A-Za-z_$][\w$]*$/.test(candidate) && constants.has(candidate)
        if (isArray || isAdminCall || isKnownConstant) {
          guardText = resolve(candidate, constants)
        }
      }
    }

    const flags = classify(guardText)
    records.push({
      file,
      method,
      path,
      guardText,
      ...flags,
      isAdminRoute: path.startsWith('/api/admin/') || flags.hasPlatformGuard,
    })
  }

  return records
}

/** True when this route must carry a fresh step-up. */
export function requiresStepUp(record: AdminRouteRecord): boolean {
  if (record.method === 'GET' || record.method === 'HEAD') return false
  return STEP_UP_REQUIRED.some((pattern) => pattern.test(record.path))
}

/**
 * Exactly one route is allowed to sit outside the permission guard:
 * `POST /api/admin/security/step-up` is what MINTS the fresh step-up every
 * other write needs. Requiring a permission there would lock an admin with a
 * narrow role out of their own second factor.
 *
 * The test asserts this list has exactly one entry, so it cannot grow quietly.
 */
export const ADMIN_CHAIN_EXEMPT_PERMISSION = new Set(['/api/admin/security/step-up'])

/**
 * Every reason an admin route must not ship as it is.
 */
export function auditAdminRouteChain(records: AdminRouteRecord[]): AdminRouteViolation[] {
  const violations: AdminRouteViolation[] = []
  for (const record of records) {
    if (!record.isAdminRoute) continue
    const exemptFromPermission = ADMIN_CHAIN_EXEMPT_PERMISSION.has(record.path)
    if (!record.hasPermission && !exemptFromPermission) {
      violations.push({
        file: record.file,
        method: record.method,
        path: record.path,
        reason: 'no_permission',
      })
      continue
    }
    if (!record.hasPlatformGuard) {
      violations.push({
        file: record.file,
        method: record.method,
        path: record.path,
        reason: 'no_platform_guard',
      })
      continue
    }
    if (requiresStepUp(record) && !record.hasStepUp) {
      violations.push({
        file: record.file,
        method: record.method,
        path: record.path,
        reason: 'no_step_up',
      })
    }
  }
  return violations
}
