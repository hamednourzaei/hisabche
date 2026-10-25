// scripts/generate-capability-matrix-csv.mjs
//
// Generates docs/architecture/capability-matrix.csv from the REAL codebase.
//
// ⚠️ TWO THINGS IN THE PREVIOUS VERSION OF THIS SCRIPT WERE MADE UP, NOT DERIVED:
//
//   1. `evidence` fell back to a hard-coded `offline-endpoint-matrix.ts:41` —
//      the line where the array opens — for 273 of 462 rows. Those rows pointed
//      at a line that proves nothing about the row.
//   2. `server_reason` was classified by substring-matching the endpoint NAME
//      ('/ai', '/billing', …). That files a capability under a reason because of
//      how its URL is spelled, not because of what the code does: 392 of 462
//      rows came out `other`, including every AI and marketplace row, which are
//      the clearest cloud-only capabilities in the product.
//
// This version derives both from source:
//
//   evidence      = the exact `file:line` of the matrix row itself, plus the
//                   server route's `file:line` when one registers it, plus the
//                   local-engine route's `file:line` when one serves it.
//   server_reason = the feature's OWNING service file(s) — taken from the real
//                   route handlers — scanned for the concrete external
//                   dependency that forbids local execution (a provider fetch,
//                   a storage call, a mail provider, a billing gateway). The
//                   rule applied and the line it was found on are recorded.
//
// A row that cannot be proven keeps `server_reason=unproven` rather than a
// guess, so the gap is visible in the CSV instead of hidden behind `other`.
//
// Run: node scripts/generate-capability-matrix-csv.mjs
// Check: node scripts/generate-capability-matrix-csv.mjs --check   (CI: exit 1 if stale)

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CHECK_ONLY = process.argv.includes('--check')
const OUT = path.join(ROOT, 'docs/architecture/capability-matrix.csv')
const MATRIX_FILE = 'packages/validation/src/schemas/offline-endpoint-matrix.ts'
const REGISTRY_FILE = 'packages/validation/src/schemas/feature-registry.ts'

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/')

// ───────────────────────────────────────────────────────────────────────────
// 1. The matrix rows, each with the LINE IT IS ON.
// ───────────────────────────────────────────────────────────────────────────
const matrixLines = read(MATRIX_FILE).split('\n')
const rows = []
const rowRegex = /^\s*'([A-Z]+ (?:\/[^']*))':\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/

matrixLines.forEach((line, index) => {
  const m = line.match(rowRegex)
  if (!m) return
  rows.push({
    endpoint: m[1],
    feature: m[2],
    status: m[3],
    matrixLine: index + 1,
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 2. Feature registry: the declared execution intent (not the reality).
// ───────────────────────────────────────────────────────────────────────────
const registrySource = read(REGISTRY_FILE)
const registryIntent = new Map()
for (const m of registrySource.matchAll(
  /'(?<key>[a-z][a-z0-9_]*\.[a-z0-9_.]+)'\s*:\s*\{(?<body>[\s\S]*?)\n {2}\}/g,
)) {
  const exec = m.groups.body.match(/execution:\s*'([a-z]+)'/)
  if (exec) registryIntent.set(m.groups.key, exec[1])
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Server routes: METHOD+normalised path → file:line of the registration.
//    Fastify registers as fastify.get/post/...('/api/...', …) in backend/src/routes.
// ───────────────────────────────────────────────────────────────────────────
const routesDir = path.join(ROOT, 'backend/src/routes')
const serverRouteEvidence = new Map()
const serverRouteFile = new Map()

// ⚠️ MOUNT PREFIXES ARE PART OF THE PATH. `accounting.routes.ts` registers
// `'/accounts'`, but the client calls `/accounting/accounts` because index.ts
// mounts the plugin as `server.register(accountingRoutes, { prefix:
// '/api/accounting' })`. Reading only the route file reported 108 endpoints as
// having no server route — all of them prefixed plugins. The prefixes are read
// from index.ts, not typed by hand, so a new prefix is picked up automatically.
const indexSource = read('backend/src/index.ts')
const pluginPrefix = new Map()
for (const m of indexSource.matchAll(
  /register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*'([^']+)'\s*\}\s*\)/g,
)) {
  pluginPrefix.set(m[1], m[2])
}

// route file basename → exported plugin function name(s), from its export line
function pluginNamesOf(file, source) {
  const names = []
  for (const m of source.matchAll(/export\s+async\s+function\s+(\w+Routes)\s*\(/g)) names.push(m[1])
  return names
}

// ⚠️ THE PATH IS OFTEN ON THE NEXT LINE. Fastify registrations in this repo are
// written as:
//     fastify.get(
//       '/api/invoices',
// so a single-line regex found only the handlers that happened to fit on one
// line and reported 430 rows as "no server route". The match below spans the
// newline and keeps the line number of the handler — the line a reader jumps to.
const ROUTE_ANY_REGEX = /\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*['"`]([^'"`]+)['"`]/gi

const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'))
for (const file of routeFiles) {
  const abs = path.join(routesDir, file)
  const source = fs.readFileSync(abs, 'utf8')
  const prefix = pluginNamesOf(file, source)
    .map((name) => pluginPrefix.get(name))
    .find((p) => typeof p === 'string')
  for (const m of source.matchAll(ROUTE_ANY_REGEX)) {
    const verb = m[1].toUpperCase()
    // The line the match STARTS on must be code. A section comment like
    // `// ─── GET / ─────────` matches the same pattern and would be recorded as
    // evidence for the next route — pointing a reader at a comment instead of
    // the handler.
    const lineStart = source.lastIndexOf('\n', m.index) + 1
    const lineEnd = source.indexOf('\n', m.index)
    const matchedLine = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
    if (
      matchedLine.startsWith('//') ||
      matchedLine.startsWith('*') ||
      matchedLine.startsWith('/*')
    ) {
      continue
    }
    const lineNumber = source.slice(0, m.index).split('\n').length
    const rawPath = m[2]
      .split('?')[0]
      .replace(/\$\{[^}]+\}/g, ':x')
      .replace(/:[A-Za-z0-9_]+/g, ':x')
    // The registered path, and the same path as the client sees it (with the
    // plugin's mount prefix and the global `/api` prefix).
    const withMountRaw = prefix && !rawPath.startsWith(prefix) ? `${prefix}${rawPath}` : rawPath
    // `prefix + '/'` would be `/api/branches/`; Fastify treats it as the
    // collection root, which the matrix spells `/branches`.
    const withMount = withMountRaw.length > 1 ? withMountRaw.replace(/\/+$/, '') : withMountRaw
    const forms = new Set([
      rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath,
      withMount,
      withMount.startsWith('/api/') ? withMount.slice(4) : `/api${withMount}`,
    ])
    for (const form of forms) {
      const key = `${verb} ${form}`
      if (!serverRouteEvidence.has(key)) {
        serverRouteEvidence.set(key, `${rel(abs)}:${lineNumber}`)
        serverRouteFile.set(key, rel(abs))
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Local engine routes: the engines that actually serve a row offline.
// ───────────────────────────────────────────────────────────────────────────
const engineRoutesDir = path.join(ROOT, 'packages/local-engine/src/routes')
const engineEvidence = new Map()
if (fs.existsSync(engineRoutesDir)) {
  for (const file of fs.readdirSync(engineRoutesDir).filter((f) => f.endsWith('.ts'))) {
    const abs = path.join(engineRoutesDir, file)
    fs.readFileSync(abs, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        const m = line.match(/router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/i)
        if (!m) return
        const verb = m[1].toUpperCase()
        const normalised = `${verb} ${m[2].replace(/\$\{[^}]+\}/g, ':x').replace(/:[A-Za-z0-9_]+/g, ':x')}`
        for (const key of [normalised, normalised.replace(' /api/', ' /')]) {
          if (!engineEvidence.has(key)) engineEvidence.set(key, `${rel(abs)}:${index + 1}`)
        }
      })
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Local schema tables (SQLite) — does the device even have the data?
// ───────────────────────────────────────────────────────────────────────────
const localSchema = read('packages/app-bridge/src/local-schema.ts')
const localTables = new Set(
  [...localSchema.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?([A-Za-z0-9_]+)"?/g)].map((m) =>
    m[1].toLowerCase(),
  ),
)

// ───────────────────────────────────────────────────────────────────────────
// 6. PROOF RULES for `server_reason`.
//
// Each rule is: a reason, the concrete thing that makes it cloud-only, and a
// predicate over the feature's owning source files. A reason is only assigned
// when its evidence is FOUND IN CODE — the pattern and the file:line are then
// written into the CSV, so anyone can check the claim.
// ───────────────────────────────────────────────────────────────────────────
const dirCache = new Map()
function filesUnder(relDir) {
  if (dirCache.has(relDir)) return dirCache.get(relDir)
  const abs = path.join(ROOT, relDir)
  const out = []
  if (fs.existsSync(abs)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) out.push(rel(full))
      }
    }
    walk(abs)
  }
  dirCache.set(relDir, out)
  return out
}

const PROOF_RULES = [
  {
    reason: 'ai-provider',
    what: 'an external AI provider is called over the network',
    pattern:
      /fetch\(\s*buildProviderEndpoint|https:\/\/api\.(anthropic|openai)\.com|openrouter\.ai/,
    dirs: ['backend/src/services/ai'],
  },
  {
    reason: 'payment-gateway',
    what: 'a payment gateway / card processor is called',
    pattern: /stripe|zibal|idpay|zarinpal|gateway/i,
    dirs: ['backend/src/services', 'backend/src/routes'],
  },
  {
    reason: 'subscription-billing',
    what: 'the subscription/billing engine is server-authoritative (a plan limit is read from the server)',
    // A plan gate read in the request path, not merely the word "subscription".
    pattern: /\.plan\s*(===|!==|\.includes|\)|&&)|\bplanLimits\.|isTrial|getCurrentSubscription\(/,
    dirs: ['backend/src/services', 'backend/src/routes'],
  },
  {
    reason: 'sms-email',
    what: 'an email/SMS provider delivers the message',
    // ⚠️ THE SEND, NOT THE CLIENT OR A PREFERENCE READ.
    // `const resend = … new Resend(key)` proved only that the provider is
    // configured, and `emailService.getUserLanguage(...)` proved only that a
    // language is looked up — neither delivers anything. `POST
    // /workspaces/:x/leave` was filed as email-delivering on the back of both.
    // The proof is now a call to one of the service's actual `send*` methods.
    pattern: /emailService\.send[A-Z]\w*\(|await\s+resend\.emails\.send\(|kavenegar\.|twilio\./,
    dirs: ['backend/src/services'],
  },
  {
    reason: 'file-storage',
    what: 'objects are stored in remote object storage',
    pattern: /\.storage\.from\(/,
    dirs: ['backend/src/services', 'backend/src/routes'],
  },
  {
    reason: 'auth',
    what: 'the cloud identity/session provider owns the credential',
    pattern: /supabase\.auth\.|signInWithPassword|createUser\(/,
    dirs: ['backend/src/routes'],
  },
  {
    reason: 'webhook-delivery',
    what: 'a signed webhook is delivered to a customer-owned external URL',
    // The delivery call itself, not the type that describes it.
    pattern:
      /await\s+signWebhookPayload\(|await\s+post\(|await\s+postWebhook\(|const\s+signature\s*=\s*await\s+signWebhookPayload\(/,
    dirs: ['backend/src/services/developer'],
  },
  {
    reason: 'server-worker',
    what: 'a background worker on the server owns the job (outbox/queue/scheduler), so it cannot run on a device',
    pattern: /claimDue|complete_outbox|dispatch\(|runDue\(/,
    dirs: ['backend/src/services'],
  },
  {
    reason: 'cross-device',
    what: 'the operation coordinates state that several devices must agree on, decided by the server',
    // ⚠️ THE MEMBERSHIP TABLE IS THE SIGNAL. A bare `from('workspaces')` read is
    // any workspace lookup, including a signature URL; what makes an operation
    // cross-device is that it reads or writes WHO BELONGS — the table every
    // device's answer is derived from.
    pattern: /from\('workspace_members'\)/,
    dirs: ['backend/src/services'],
  },
]

/**
 * The files a route's handler actually reaches: the route file itself plus what
 * it imports (one hop into services/*). This is what makes a `reason@` proof
 * about THIS endpoint instead of about its whole domain.
 *
 * ⚠️ WHY THIS EXISTS. The previous prover scanned a whole service DIRECTORY, so
 * `GET /developer/catalog` was "proved" cloud-only by a line in
 * `signWebhookPayload` — a different operation in the same folder — and
 * `POST /auth/logout` by `createUser`, which the logout handler never calls. The
 * reason was right; the evidence did not support it for that row. A proof a
 * reader follows to the wrong function is worse than no proof.
 */
function filesReachedBy(routeFile) {
  if (!routeFile) return []
  const out = new Set([routeFile])
  const source = read(routeFile)
  for (const m of source.matchAll(/from\s+'(\.[^']+)'/g)) {
    const spec = m[1]
    const base = path.posix.join(path.posix.dirname(routeFile), spec)
    for (const candidate of [`${base}.ts`, `${base}/index.ts`, base]) {
      if (fs.existsSync(path.join(ROOT, candidate)) && candidate.endsWith('.ts')) {
        out.add(candidate)
        // one hop further, into the service the route delegates to
        const inner = read(candidate)
        for (const j of inner.matchAll(/from\s+'(\.\.?\/[^']+)'/g)) {
          const jbase = path.posix.join(path.posix.dirname(candidate), j[1])
          for (const jc of [`${jbase}.ts`, `${jbase}/index.ts`]) {
            if (fs.existsSync(path.join(ROOT, jc)) && jc.endsWith('.ts')) out.add(jc)
          }
        }
      }
    }
  }
  return [...out]
}

function proveReason(rule, scopedFiles) {
  // Scoped first: the endpoint's own handler and the services it delegates to.
  // Falls back to the rule's directories only when the scope yields nothing,
  // and the caller records which happened.
  const searchSets = []
  if (scopedFiles && scopedFiles.length > 0) searchSets.push({ files: scopedFiles, scoped: true })
  searchSets.push({ files: rule.dirs.flatMap(filesUnder), scoped: false })

  for (const set of searchSets) {
    for (const file of set.files) {
      const lines = read(file).split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // ⚠️ A COMMENT IS NOT EVIDENCE. The first match for the AI rule was
        // `* \`https://openrouter.ai/api/v1\`, so the request went to …` — a
        // sentence about the provider inside a doc comment. Pointing a proof at
        // it would say "the code calls a provider" without the code present.
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
          continue
        if (rule.pattern.test(line)) {
          return {
            file,
            line: i + 1,
            what: rule.what,
            scoped: set.scoped,
            code: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
          }
        }
      }
    }
  }
  return null
}

const proofCache = new Map()
function provenReason(reason, scopedFiles) {
  const key = `${reason}|${(scopedFiles ?? []).join(',')}`
  if (proofCache.has(key)) return proofCache.get(key)
  const rule = PROOF_RULES.find((r) => r.reason === reason)
  const proof = rule ? proveReason(rule, scopedFiles) : null
  proofCache.set(key, proof)
  return proof
}

// Which rule applies, decided by the feature's OWN area first and only then by
// the endpoint's shape. Every assignment carries the proof.
function classifyReason(feature, endpoint, status, scopedFiles) {
  // ⚠️ A ROW THE ENGINE ALREADY RUNS HAS NO CLOUD REASON, WHATEVER ITS NAME
  // SAYS. `GET /v1/notifications` is served by the local engine's feed
  // (`local-engine/src/routes/feed.ts`) and still matched the substring rule
  // for "notification", so it was filed `sms-email` — a cloud reason on a row
  // that needs no cloud. Status wins.
  if (status === 'available') return null

  const order = []
  if (feature.startsWith('ai.')) order.push('ai-provider')
  // ⚠️ NOT EVERY /developer/* ROW DELIVERS A WEBHOOK. `GET /developer/catalog`
  // returns a static list of scopes and event types; scanning its service file
  // for `signWebhookPayload` proved a different operation in the same folder.
  // A delivery reason is only claimed for a row that carries a delivery: an
  // endpoint that mentions a webhook and is not a read, or the delivery worker
  // itself.
  if (
    feature.startsWith('developer.') &&
    (/webhook|deliver/i.test(endpoint) || /^POST \/developer\/webhooks/.test(endpoint))
  ) {
    order.push('webhook-delivery')
  }
  if (feature.startsWith('billing.') || feature.startsWith('subscription.'))
    order.push('subscription-billing')
  if (feature.startsWith('auth.')) order.push('auth')
  // ⚠️ TEAM MANAGEMENT IS CLOUD-BOUND, AND THE REASON IS COORDINATION — NOT
  // ALWAYS EMAIL. Only some of these operations send a message: `createInvite`
  // does, `leaveWorkspace` does not. What is true of ALL of them is that the
  // answer (who is in the business, with which role, suspended or not) must be
  // the same on every device of that business, and only the server can be the
  // one authority for that. So `cross-device` is the reason that fits the whole
  // group; `sms-email` is offered second, for the ones that really deliver.
  if (feature.startsWith('team.') || /\/workspaces\/.+\/(invites|members)/.test(endpoint)) {
    order.push('cross-device', 'sms-email')
  }
  if (/email|sms|invite|notification/i.test(feature)) order.push('sms-email')
  if (/image|document|media|screenshot|receipt/i.test(feature)) order.push('file-storage')
  if (feature.startsWith('marketplace.') || feature.startsWith('storefront.'))
    order.push('file-storage')
  if (/notification|email/i.test(endpoint)) order.push('sms-email')

  for (const reason of order) {
    const proof = provenReason(reason, scopedFiles)
    if (proof) return { reason, proof }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// 7. Data the device would need, from the feature's own domain.
// ───────────────────────────────────────────────────────────────────────────
const DOMAIN_TABLES = {
  invoice: ['invoices', 'invoice_items', 'customers', 'products'],
  payment: ['payments', 'payment_allocations', 'customers'],
  till: ['pos_sessions', 'pos_orders', 'payments'],
  product: ['products', 'product_stock', 'price_lists'],
  inventory: ['products', 'product_stock', 'cost_layers', 'stock_movements'],
  stock: ['products', 'product_stock', 'cost_layers', 'stock_movements'],
  warehouse: ['warehouses', 'product_stock', 'stock_movements'],
  accounting: ['accounts', 'journal_entries', 'journal_lines'],
  ledger: ['accounts', 'journal_entries', 'journal_lines'],
  customer: ['customers'],
  crm: ['customers', 'interactions'],
  payroll: ['employees', 'payrolls', 'attendance', 'leaves'],
  hr: ['employees', 'attendance', 'leaves', 'work_shifts'],
  branch: ['branches'],
  settings: ['workspaces', 'exchange_rates'],
  expiry: ['batches', 'products'],
  manufacturing: ['boms', 'bom_items', 'work_orders'],
  approvals: ['workflow_templates', 'workflow_instances'],
}

function tablesFor(feature) {
  const domain = feature.split('.')[0]
  const wanted = DOMAIN_TABLES[domain]
  if (!wanted) return { needed: 'none', exist: 'n/a' }
  const present = wanted.filter((t) => localTables.has(t))
  return {
    needed: wanted.join(' '),
    exist: present.length === wanted.length ? 'yes' : present.length > 0 ? 'partial' : 'no',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Build the rows.
// ───────────────────────────────────────────────────────────────────────────
const FAILURE_GUARDS = {
  'invoice.create': 'golden-vector + property-test + chaos',
  'payment.record': 'golden-vector + property-test + chaos',
  'stock.movement': 'golden-vector + property-test + chaos',
}

const built = rows.map((row) => {
  const domain = row.feature.split('.')[0]
  const matrixEvidence = `${MATRIX_FILE}:${row.matrixLine}`
  const serverEvidence = serverRouteEvidence.get(row.endpoint) ?? null
  const engine = engineEvidence.get(row.endpoint) ?? null
  const proof = classifyReason(
    row.feature,
    row.endpoint,
    row.status,
    filesReachedBy(serverRouteFile.get(row.endpoint) ?? null),
  )
  const tables = tablesFor(row.feature)

  // Evidence is composed of real locations only. A missing server route is
  // reported as `no server route` — never replaced by a made-up line.
  const evidenceParts = [`matrix@${matrixEvidence}`]
  evidenceParts.push(serverEvidence ? `server@${serverEvidence}` : 'server@none')
  if (engine) evidenceParts.push(`engine@${engine}`)
  if (proof) {
    // `reason@` means the proof is in THIS endpoint's own reach. `reason~` means
    // it was only found domain-wide, which is weaker — kept visible rather than
    // silently upgraded to the same-looking claim.
    evidenceParts.push(
      `reason${proof.proof.scoped ? '@' : '~'}${proof.proof.file}:${proof.proof.line}`,
    )
  }

  let canRunLocally
  if (row.status === 'available') canRunLocally = 'yes'
  else if (proof) canRunLocally = 'no'
  else canRunLocally = 'partly'

  let targetPath
  if (row.status === 'available') targetPath = 'LOCAL_FIRST'
  else if (canRunLocally === 'no') targetPath = 'SERVER_ONLY'
  else targetPath = 'HYBRID'

  let conflictRisk = 'low'
  const writes = /^(POST|PUT|PATCH|DELETE) /.test(row.endpoint)
  if (writes && ['inventory', 'stock', 'warehouse'].includes(domain)) conflictRisk = 'high'
  else if (writes && ['invoice', 'payment', 'accounting', 'till', 'ledger'].includes(domain))
    conflictRisk = 'med'

  let wave
  if (targetPath === 'SERVER_ONLY') wave = 'N/A'
  else if (row.status === 'available') wave = 'Wave 0 (already local)'
  else if (!writes) wave = 'Wave 1 (read models)'
  else if (['customer', 'crm', 'settings', 'product'].includes(domain))
    wave = 'Wave 2 (single-writer)'
  else if (['invoice', 'payment', 'till'].includes(domain)) wave = 'Wave 3 (shared ledger)'
  else if (['inventory', 'stock', 'warehouse'].includes(domain)) wave = 'Wave 4 (movement ledger)'
  else wave = 'Wave 5 (HR / closed period)'

  return {
    endpoint: row.endpoint,
    feature: row.feature,
    status: row.status,
    domain,
    server_reason: proof ? proof.reason : row.status === 'available' ? 'none' : 'unproven',
    can_run_locally: canRunLocally,
    data_needed_locally: tables.needed,
    local_tables_exist: tables.exist,
    conflict_risk: conflictRisk,
    target_path: targetPath,
    wave,
    registry_intent: registryIntent.get(row.feature) ?? 'unregistered',
    tests_required: FAILURE_GUARDS[row.feature] ?? (writes ? 'parity-test' : 'unit-test'),
    evidence: evidenceParts.join(' '),
  }
})

const HEADERS = [
  'endpoint',
  'feature',
  'status',
  'domain',
  'server_reason',
  'can_run_locally',
  'data_needed_locally',
  'local_tables_exist',
  'conflict_risk',
  'target_path',
  'wave',
  'registry_intent',
  'tests_required',
  'evidence',
]

const escape = (value) => {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const csv =
  [HEADERS.join(','), ...built.map((r) => HEADERS.map((h) => escape(r[h])).join(','))].join('\n') +
  '\n'

// ───────────────────────────────────────────────────────────────────────────
// 9. Report what could NOT be proven (never silently called `other`).
// ───────────────────────────────────────────────────────────────────────────
const unproven = built.filter((r) => r.server_reason === 'unproven')
const noServerRoute = built.filter((r) => r.evidence.includes('server@none'))
const counts = {}
for (const r of built) counts[r.server_reason] = (counts[r.server_reason] ?? 0) + 1

console.log(`rows=${built.length}`)
console.log(`server_reason: ${JSON.stringify(counts)}`)
console.log(`unproven (not cloud-proven, not local)=${unproven.length}`)
console.log(`rows with no registering server route=${noServerRoute.length}`)

if (CHECK_ONLY) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (current !== csv) {
    console.error('STALE: docs/architecture/capability-matrix.csv does not match the code.')
    process.exit(1)
  }
  console.log('OK: capability-matrix.csv is up to date')
} else {
  fs.writeFileSync(OUT, csv, 'utf8')
  console.log(`wrote ${OUT}`)
}
