// Read-only whole-repository inventory for the audit. Writes JSON + markdown under docs/audit/generated/.
// Nothing here changes product code. Heuristics are stated in each section header of the output.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/audit/generated')
fs.mkdirSync(OUT, { recursive: true })

const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  'graphify-out',
  '.git',
  'coverage',
  '.pgtest',
  'out',
])
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
const read = (p) => fs.readFileSync(p, 'utf8')
const isCode = (p) => /\.(ts|tsx)$/.test(p)
const isTest = (p) => /(__tests__|\.test\.|\.spec\.|\/e2e\/)/.test(rel(p))

// ───────── 1. file inventory per workspace ─────────
const roots = ['backend/src', 'packages', 'apps', 'scripts', 'docs']
const inv = {}
for (const r of roots) {
  const files = walk(path.join(ROOT, r))
  const byExt = {}
  for (const f of files)
    byExt[path.extname(f) || 'none'] = (byExt[path.extname(f) || 'none'] || 0) + 1
  inv[r] = { files: files.length, ext: byExt }
}
const pkgDirs = fs
  .readdirSync(path.join(ROOT, 'packages'))
  .filter((d) => fs.statSync(path.join(ROOT, 'packages', d)).isDirectory())
const appDirs = fs
  .readdirSync(path.join(ROOT, 'apps'))
  .filter((d) => fs.statSync(path.join(ROOT, 'apps', d)).isDirectory())
const perWs = {}
for (const d of [
  ...pkgDirs.map((x) => 'packages/' + x),
  ...appDirs.map((x) => 'apps/' + x),
  'backend',
]) {
  const files = walk(path.join(ROOT, d)).filter(isCode)
  perWs[d] = { code: files.filter((f) => !isTest(f)).length, tests: files.filter(isTest).length }
}

// ───────── 2. backend routes + security ─────────
const routeFiles = walk(path.join(ROOT, 'backend/src/routes')).filter(
  (f) => /\.ts$/.test(f) && !isTest(f),
)
const routes = []
for (const f of routeFiles) {
  const src = read(f)
  const consts = {}
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) consts[m[1]] = m[2]
  const fileHook =
    /addHook\(\s*['"]preHandler['"]/.test(src) || /addHook\(\s*['"]onRequest['"]/.test(src)
  const re =
    /(?:fastify|server|app|instance)\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\2/g
  let m
  while ((m = re.exec(src))) {
    const start = m.index
    const end = src.indexOf('async', start)
    const head = src.slice(start, end > start ? end : start + 600)
    let pre = head
    const pm = head.match(/preHandler\s*:\s*(\[[^\]]*\]|\w+)/)
    if (pm) pre = pm[1].startsWith('[') ? pm[1] : consts[pm[1]] || pm[1]
    const flags = {
      auth: /authenticate|apiKeyAuth|authenticateOptional|publicRoute/.test(pre),
      workspace: /requireWorkspaceContext/.test(pre),
      capability:
        /requireCapability|requirePermission|requireRole|platformAdminGuard|requireAdmin/.test(pre),
      stepUp: /requireStepUp/.test(pre),
    }
    routes.push({
      file: rel(f),
      method: m[1].toUpperCase(),
      path: m[3],
      ...flags,
      fileHook,
      line: src.slice(0, start).split('\n').length,
    })
  }
}
const writeRoutes = routes.filter((r) => r.method !== 'GET')
const weak = writeRoutes.filter((r) => !r.fileHook && (!r.workspace || !r.capability))

// ───────── 3. hooks → consumers ─────────
// A hook counts as consumed when its name appears in ANY other production file (UI, shell, apps, or another hook).
const hookFiles = walk(path.join(ROOT, 'packages/api/src/hooks'))
  .filter(isCode)
  .filter((f) => !isTest(f))
const prodFiles = [...walk(path.join(ROOT, 'packages')), ...walk(path.join(ROOT, 'apps'))].filter(
  (f) => isCode(f) && !isTest(f),
)
const prodTexts = new Map(prodFiles.map((f) => [f, read(f)]))
const hooks = []
for (const f of hookFiles) {
  const src = prodTexts.get(f) ?? read(f)
  const names = new Set([
    ...[...src.matchAll(/export[ ]+(?:async[ ]+)?function[ ]+(use[A-Z][A-Za-z0-9_]*)/g)].map(
      (m) => m[1],
    ),
    ...[...src.matchAll(/export[ ]+const[ ]+(use[A-Z][A-Za-z0-9_]*)[ ]*=/g)].map((m) => m[1]),
  ])
  for (const name of names) {
    const re = new RegExp('(^|[^A-Za-z0-9_])' + name + '([^A-Za-z0-9_]|$)')
    let consumers = 0
    for (const [pf, txt] of prodTexts) {
      if (pf === f) continue
      if (
        pf.endsWith('packages/api/src/index.ts') ||
        pf.endsWith('packages\\api\\src\\index.ts') ||
        /hooks[/\\]index[.]ts$/.test(pf)
      )
        continue
      if (re.test(txt)) consumers++
    }
    hooks.push({ file: rel(f), name, consumers })
  }
}
const orphanHooks = hooks.filter((h) => h.consumers === 0)

// ───────── 4. domain matrix ─────────
const svcDir = path.join(ROOT, 'backend/src/services')
const domains = []
for (const e of fs.readdirSync(svcDir, { withFileTypes: true })) {
  const name = e.isDirectory() ? e.name : e.name.replace(/\.service\.ts$|\.ts$/, '')
  if (!e.isDirectory() && !/\.service\.ts$/.test(e.name)) continue
  const key = name.toLowerCase()
  const has = (arr, fn) => arr.some(fn)
  const routeHit = has(routeFiles, (f) =>
    path.basename(f).toLowerCase().includes(key.split('-')[0]),
  )
  const hookHit = has(hookFiles, (f) => path.basename(f).toLowerCase().includes(key.split('-')[0]))
  const engineDir = walk(path.join(ROOT, 'packages/local-engine/src/routes'))
  const engineHit = has(engineDir, (f) =>
    path.basename(f).toLowerCase().includes(key.split('-')[0]),
  )
  const uiDir = path.join(ROOT, 'packages/ui/src/components/ui')
  const uiHit =
    fs.existsSync(path.join(uiDir, key)) || fs.existsSync(path.join(uiDir, key.split('-')[0]))
  const files = e.isDirectory()
    ? walk(path.join(svcDir, e.name)).filter(isCode)
    : [path.join(svcDir, e.name)]
  const testCount = walk(path.join(ROOT, 'backend/src/__tests__')).filter(
    (f) => isCode(f) && path.basename(f).toLowerCase().includes(key.split('-')[0]),
  ).length
  domains.push({
    domain: name,
    files: files.length,
    route: routeHit,
    hook: hookHit,
    engine: engineHit,
    ui: uiHit,
    tests: testCount,
  })
}

// ───────── 5. tests classification ─────────
const allTests = [
  ...walk(path.join(ROOT, 'backend/src')),
  ...walk(path.join(ROOT, 'packages')),
  ...walk(path.join(ROOT, 'apps')),
].filter((f) => isCode(f) && isTest(f))
const tcls = { pg: 0, e2e: 0, http: 0, unit: 0 }
const skipped = []
let mockHeavy = 0
const mockAuth = []
for (const f of allTests) {
  const s = read(f)
  const r = rel(f)
  if (/\.pg\.test\./.test(r)) tcls.pg++
  else if (/\/e2e\/|\.e2e\.|playwright/.test(r)) tcls.e2e++
  else if (/\.inject\(|supertest|buildApp|createServer\(/.test(s)) tcls.http++
  else tcls.unit++
  for (const m of s.matchAll(/\b(it|test|describe)\.(skip|todo)\b|\bxit\(|\bxdescribe\(/g))
    skipped.push(r + ':' + s.slice(0, m.index).split('\n').length)
  const mocks = (s.match(/vi\.mock\(/g) || []).length
  if (mocks >= 3) mockHeavy++
  if (/vi\.mock\([^)]*(auth|authorize|workspace)\.middleware/.test(s)) mockAuth.push(r)
}

// ───────── 6. database (docs/*.sql) ─────────
const sqlFiles = walk(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.sql'))
const tables = {}
for (const f of sqlFiles) {
  const s = read(f)
  for (const m of s.matchAll(
    /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/gi,
  )) {
    const t = m[1]
    const body = m[2]
    tables[t] = tables[t] || { files: new Set(), fk: 0, check: 0, workspace: false, unique: 0 }
    tables[t].files.add(rel(f))
    tables[t].fk += (body.match(/REFERENCES\s/gi) || []).length
    tables[t].check += (body.match(/\bCHECK\s*\(/gi) || []).length
    tables[t].unique += (body.match(/\bUNIQUE\b/gi) || []).length
    if (/workspace_id/i.test(body)) tables[t].workspace = true
  }
  for (const m of s.matchAll(
    /ALTER TABLE\s+(?:public\.)?"?(\w+)"?\s+ADD CONSTRAINT[^;]*?FOREIGN KEY/gi,
  )) {
    tables[m[1]] = tables[m[1]] || {
      files: new Set(),
      fk: 0,
      check: 0,
      workspace: false,
      unique: 0,
    }
    tables[m[1]].fk++
    tables[m[1]].files.add(rel(f))
  }
}
const tableList = Object.entries(tables).map(([t, v]) => ({
  table: t,
  files: [...v.files].slice(0, 2).join(' '),
  fk: v.fk,
  check: v.check,
  unique: v.unique,
  workspace: v.workspace,
}))

// ───────── 7. i18n key parity ─────────
const flat = (o, p = '', out = []) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? p + '.' + k : k
    if (v && typeof v === 'object') flat(v, key, out)
    else out.push(key)
  }
  return out
}
const msgs = {}
for (const l of ['fa', 'af', 'en']) {
  const p = path.join(ROOT, 'packages/i18n/messages', l, 'common.json')
  msgs[l] = new Set(flat(JSON.parse(read(p).replace(/^\uFEFF/, ''))))
}
const diff = (a, b) => [...msgs[a]].filter((k) => !msgs[b].has(k))
const i18n = {
  fa: msgs.fa.size,
  af: msgs.af.size,
  en: msgs.en.size,
  faNotEn: diff('fa', 'en'),
  enNotFa: diff('en', 'fa'),
  faNotAf: diff('fa', 'af'),
  afNotFa: diff('af', 'fa'),
}

// ───────── 8. hard-coded text in UI that is not behind t() (Persian letters in TSX string literals) ─────────
const uiFiles = walk(path.join(ROOT, 'packages/ui/src/components')).filter(
  (f) => f.endsWith('.tsx') && !isTest(f),
)
const hardPersian = []
for (const f of uiFiles) {
  const lines = read(f).split('\n')
  lines.forEach((ln, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return
    if (/[؀-ۿ]/.test(ln) && !/\bt\(|translateOr|\.json|label:\s*['"]/.test(ln))
      hardPersian.push(rel(f) + ':' + (i + 1))
  })
}

// ───────── 9. offline matrix vs engine ─────────
const matrixSrc = read(
  path.join(ROOT, 'packages/validation/src/schemas/offline-endpoint-matrix.ts'),
)
const matrixRows = [
  ...matrixSrc.matchAll(/'(GET|POST|PUT|PATCH|DELETE) ([^']+)':\s*\[\s*'([^']+)',\s*'([^']+)'/g),
].map((m) => ({ method: m[1], path: m[2], feature: m[3], status: m[4] }))
const mstat = {}
for (const r of matrixRows) mstat[r.status] = (mstat[r.status] || 0) + 1
const engineSrc = walk(path.join(ROOT, 'packages/local-engine/src'))
  .filter(isCode)
  .filter((f) => !isTest(f))
  .map((f) => read(f))
  .join('\n')
const availableNoEngine = matrixRows
  .filter((r) => r.status === 'available')
  .filter((r) => {
    const tail = r.path
      .replace(/:x/g, '')
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .slice(-2)
      .join('/')
    return !engineSrc.includes(tail) && !engineSrc.includes(r.path.replace(/:x/g, ':'))
  })

// ───────── 10. declared but unused exports in validation domain files ─────────
const domFiles = walk(path.join(ROOT, 'packages/validation/src/schemas')).filter(
  (f) => /\.(domain)\.ts$/.test(f) || /universal-core\//.test(rel(f)),
)
const prodText = [
  ...walk(path.join(ROOT, 'backend/src')),
  ...walk(path.join(ROOT, 'packages')),
  ...walk(path.join(ROOT, 'apps')),
]
  .filter((f) => isCode(f) && !isTest(f) && !/validation\/src\/(index|schemas)\//.test(rel(f)))
  .map((f) => read(f))
  .join('\n')
const orphanFns = []
for (const f of domFiles) {
  const src = read(f)
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    const re = new RegExp('\\b' + m[1] + '\\b')
    if (!re.test(prodText)) orphanFns.push({ file: rel(f), fn: m[1] })
  }
}

// ───────── output ─────────
const out = {
  inv,
  perWs,
  routeCount: routes.length,
  writeRoutes: writeRoutes.length,
  weakWriteRoutes: weak.length,
  hooks: hooks.length,
  orphanHooks: orphanHooks.length,
  tests: {
    total: allTests.length,
    ...tcls,
    skippedMarkers: skipped.length,
    mockHeavy,
    mockAuth: mockAuth.length,
  },
  tables: tableList.length,
  i18n: {
    ...i18n,
    faNotEn: i18n.faNotEn.length,
    enNotFa: i18n.enNotFa.length,
    faNotAf: i18n.faNotAf.length,
    afNotFa: i18n.afNotFa.length,
  },
  hardPersian: hardPersian.length,
  matrix: { rows: matrixRows.length, ...mstat, availableNoEngine: availableNoEngine.length },
  orphanFns: orphanFns.length,
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(out, null, 2))
fs.writeFileSync(path.join(OUT, 'routes.json'), JSON.stringify(routes, null, 1))
fs.writeFileSync(path.join(OUT, 'weak-write-routes.json'), JSON.stringify(weak, null, 1))
fs.writeFileSync(path.join(OUT, 'orphan-hooks.json'), JSON.stringify(orphanHooks, null, 1))
fs.writeFileSync(path.join(OUT, 'domains.json'), JSON.stringify(domains, null, 1))
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tableList, null, 1))
fs.writeFileSync(path.join(OUT, 'skipped-tests.json'), JSON.stringify(skipped, null, 1))
fs.writeFileSync(path.join(OUT, 'mock-auth-tests.json'), JSON.stringify(mockAuth, null, 1))
fs.writeFileSync(path.join(OUT, 'orphan-functions.json'), JSON.stringify(orphanFns, null, 1))
fs.writeFileSync(
  path.join(OUT, 'available-without-engine.json'),
  JSON.stringify(availableNoEngine, null, 1),
)
fs.writeFileSync(path.join(OUT, 'i18n-diff.json'), JSON.stringify(i18n, null, 1))
fs.writeFileSync(path.join(OUT, 'hard-persian.json'), JSON.stringify(hardPersian, null, 1))
console.log(JSON.stringify(out, null, 2))
