// Every backend route, and whether any client code calls it.
import fs from 'node:fs'
import path from 'node:path'
// Run from the repo root: `node scripts/audit-unwired-routes.mjs`.
// A route listed here has no caller in any client — a decision nobody can make
// on screen (payroll «paid», leave «approved» were both found this way).
const ROOT = process.cwd().split(path.sep).join('/') + '/'

function files(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    if (
      ['node_modules', '__tests__', '.next', 'dist', 'out', 'build', 'android', 'ios'].includes(
        name,
      )
    )
      continue
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) files(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

// ── server ──
const routes = []
for (const file of files(ROOT + 'backend/src/routes')) {
  const src = fs.readFileSync(file, 'utf8')
  const re =
    /\b(?:fastify|app|server|instance)\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src))) {
    routes.push({ method: m[1].toUpperCase(), path: m[2], file: path.basename(file) })
  }
}

// ── clients ──
const CLIENT_ROOTS = [
  'packages/api/src',
  'packages/ui/src',
  'packages/app-shell/src',
  'packages/app-bridge/src',
  'packages/store/src',
  'apps/web/app',
  'apps/web/lib',
  'apps/desktop/src',
  'apps/desktop/electron',
  'apps/mobile/src',
  'apps/mobile/app',
  'apps/admin/hooks',
  'apps/admin/app',
  'apps/admin/components',
  'apps/admin/lib',
]
const calls = []
for (const root of CLIENT_ROOTS) {
  for (const file of files(ROOT + root)) {
    const src = fs.readFileSync(file, 'utf8')
    // Any string or template that looks like an API path.
    const re =
      /['"`](\/(?:api\/)?[a-z][a-z0-9\-_/]*(?:\$\{[^}`]*\}[a-z0-9\-_/]*)*(?:\/[a-z0-9\-_]*)*)(?:\?[^'"`]*)?['"`]/gi
    let m
    while ((m = re.exec(src))) calls.push(m[1])
  }
}
const norm = (p) =>
  ('/' + p.replace(/^\/api\//, '/').replace(/^\//, ''))
    .replace(/\$\{[^}]*\}/g, ':p')
    .replace(/\/+$/, '')
const callSet = new Set(calls.map(norm))
const callList = [...callSet]

function served(route) {
  const bare = norm(route.path)
  const pattern = new RegExp(
    '^' + bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]+\??/g, '[^/]+') + '$',
  )
  return callList.some((call) => pattern.test(call) || pattern.test(call.replace(/:p/g, 'x')))
}

const missing = routes.filter((route) => route.path.startsWith('/api/') && !served(route))
const byFile = {}
for (const route of missing) (byFile[route.file] ||= []).push(route.method + ' ' + route.path)
console.log(
  'routes:',
  routes.length,
  '· client path strings:',
  callSet.size,
  '· with no caller:',
  missing.length,
)
for (const file of Object.keys(byFile).sort()) {
  console.log('\n' + file)
  for (const line of byFile[file]) console.log('  ' + line)
}
