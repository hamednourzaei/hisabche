// Read-only: classify every write route (POST/PUT/PATCH/DELETE) by the authorization and tenancy mechanism that
// actually stands between the HTTP call and the database.
//
// Layers examined per route:
//   1. route preHandler  (authenticate / requireWorkspaceContext / requireCapability / platformAdminGuard ...)
//   2. handler body      (inline role or capability checks, assertMay, holds)
//   3. service method    (the callee body: assertMay / holds / capability words; workspace scoping words)
// A service symbol is resolved through the route file's imports and "const x = new Y()" lines.
// Everything is a heuristic: a row marked UNKNOWN must be read by a human; a row marked SAFE_* is SAFE only for the
// layer named.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const rd = (p) => fs.readFileSync(p, 'utf8')
const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (p.endsWith('.ts') && !p.includes('__tests__')) o.push(p)
  }
  return o
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

const serviceFiles = walk(path.join(ROOT, 'backend/src/services'))
const serviceText = new Map(serviceFiles.map((f) => [f, rd(f)]))

function resolveImport(routeFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(routeFile), spec)
  for (const c of [base + '.ts', path.join(base, 'index.ts')]) if (fs.existsSync(c)) return c
  return null
}

function methodBody(text, name) {
  const re = new RegExp('(?:async\\s+)?' + name + '\\s*(?:<[^>]*>)?\\s*\\([^)]*\\)[^{;]*\\{', 'g')
  const m = re.exec(text)
  if (!m) return null
  let depth = 0
  let i = m.index + m[0].length - 1
  const start = i
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return text.slice(start, i + 1)
}

const AUTHZ =
  /assertMay|scopes\.|holds\(|requireCapability|capabilit|roleAtLeast|assertRole|tenancy\.role|ctx\.role|isOwner|assertOwner|'owner'|'manager'|ForbiddenError|FORBIDDEN/
const TENANT = /workspaceId|workspace_id|ctx\b|tenancy/

const rows = []
for (const rf of walk(path.join(ROOT, 'backend/src/routes'))) {
  const src = rd(rf)
  const imports = new Map()
  for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+'([^']+)'/g)) {
    for (const n of m[1].split(',')) {
      const nm = n
        .trim()
        .split(/\s+as\s+/)
        .pop()
      if (nm) imports.set(nm, m[2])
    }
  }
  const inst = new Map()
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*new\s+(\w+)\(/g)) inst.set(m[1], m[2])
  const consts = {}
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) consts[m[1]] = m[2]
  const fileHookAuth = /addHook\(\s*['"]preHandler['"]/.test(src)

  const re =
    /(?:fastify|server|app)\.(post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\2/g
  const starts = []
  let m
  while ((m = re.exec(src))) starts.push({ idx: m.index, method: m[1].toUpperCase(), route: m[3] })
  const allStarts = [
    ...src.matchAll(/(?:fastify|server|app)\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(/g),
  ]
    .map((x) => x.index)
    .sort((a, b) => a - b)
  for (const s of starts) {
    const next = allStarts.find((x) => x > s.idx) ?? src.length
    const block = src.slice(s.idx, next)
    const pm = block.match(/preHandler\s*:\s*(\[[^\]]*\]|\w+)/)
    const pre = pm ? (pm[1].startsWith('[') ? pm[1] : consts[pm[1]] || pm[1]) : ''
    const guards = {
      auth: /authenticate|apiKeyAuth/.test(pre) || fileHookAuth,
      workspace: /requireWorkspaceContext/.test(pre),
      capability: /requireCapability|requirePermission|requireRole/.test(pre),
      platform: /platformAdminGuard|requireAdmin|adminGuard/.test(pre),
      subscription: /requireActiveSubscription/.test(pre),
    }
    const inline = AUTHZ.test(block.replace(/preHandler\s*:[^\n]*/, ''))
    const calls = []
    for (const c of block.matchAll(/\b(\w+)\.(\w+)\(/g)) {
      const obj = c[1]
      if (
        [
          'request',
          'reply',
          'z',
          'Math',
          'JSON',
          'Object',
          'Array',
          'fastify',
          'console',
          'Number',
          'String',
          'Date',
          'Promise',
        ].includes(obj)
      )
        continue
      if (inst.has(obj) || imports.has(obj)) calls.push({ obj, method: c[2] })
    }
    let svcAuthz = false
    let svcTenant = false
    let svcResolved = false
    const bodies = []
    const svcNames = []
    for (const c of calls) {
      let file = null
      const spec = imports.get(c.obj)
      if (spec) file = resolveImport(rf, spec)
      const cls = inst.get(c.obj)
      if (!file && cls && imports.get(cls)) file = resolveImport(rf, imports.get(cls))
      if (!file) continue
      const text = serviceText.get(file) ?? (fs.existsSync(file) ? rd(file) : '')
      let body = methodBody(text, c.method)
      if (!body) {
        for (const ex of text.matchAll(/from\s+'(\.[^']+)'/g)) {
          const f2 = resolveImport(file, ex[1])
          if (f2) {
            const t2 = serviceText.get(f2) ?? rd(f2)
            body = methodBody(t2, c.method)
            if (body) break
          }
        }
      }
      if (!body) continue
      svcResolved = true
      svcNames.push(`${c.obj}.${c.method}`)
      bodies.push(rel(file) + '::' + c.method + ' ' + body.slice(0, 900))
      if (AUTHZ.test(body)) svcAuthz = true
      if (TENANT.test(body)) svcTenant = true
    }
    const passesTenancy = /request\.tenancy|workspaceId/.test(block)
    let cls
    if (guards.platform) cls = 'PLATFORM_ADMIN'
    else if (!guards.workspace) {
      cls = guards.auth
        ? inline
          ? 'USER_SCOPED_CHECKED'
          : 'USER_SCOPED_OR_PUBLIC'
        : 'PUBLIC_OR_TOKEN'
    } else if (guards.capability) cls = 'SAFE_ROUTE_CAPABILITY'
    else if (inline) cls = 'SAFE_HANDLER_CHECK'
    else if (svcResolved && svcAuthz) cls = 'SAFE_SERVICE_AUTH'
    else if (svcResolved && !svcTenant && !passesTenancy) cls = 'MISSING_TENANCY'
    else if (svcResolved) cls = 'NO_AUTHORIZATION_MECHANISM'
    else cls = 'UNKNOWN'
    rows.push({
      file: rel(rf),
      line: src.slice(0, s.idx).split('\n').length,
      method: s.method,
      route: s.route,
      cls,
      guards: Object.entries(guards)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join('+'),
      services: svcNames.slice(0, 3).join(','),
      passesTenancy,
      bodies,
    })
  }
}
fs.mkdirSync(path.join(ROOT, 'docs/audit/generated'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/write-route-authz.json'),
  JSON.stringify(rows, null, 1),
)
const count = {}
for (const r of rows) count[r.cls] = (count[r.cls] || 0) + 1
console.log('write routes:', rows.length)
console.log(count)
