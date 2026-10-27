// Read-only: turns docs/audit/generated/write-route-authz.json plus the human determinations below into
// docs/audit/WRITE-ROUTE-AUTHORIZATION.md. The determinations were made by reading the route and the service
// method (see the "basis" column); the classifier output alone is only a heuristic.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const rows = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/audit/generated/write-route-authz.json'), 'utf8'),
)

// Final classes: SAFE · MISSING_AUTHORIZATION · MISSING_TENANCY · CLIENT_ONLY · UNKNOWN · OUT_OF_SCOPE
// MISSING_AUTHORIZATION has two sub-kinds: CAPABILITY_EXISTS (a capability for this action exists in CAPABILITIES but the
// route/service never asks for it) and NO_CAPABILITY_DEFINED (the role model has no capability for this domain).
const FAMILY = [
  {
    re: /workflow\.routes/,
    method: /PATCH|DELETE/,
    cls: 'MISSING_TENANCY',
    pri: 'P0',
    basis:
      'service takes only the id: workflow.service.ts updateWorkflow/deleteWorkflow query `.eq(id)` with no workspace; route passes only `id`',
  },
  {
    re: /workflow\.routes|escalation\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P2',
    basis:
      'workspace scoped (ctx / workspaceId in service), no capability exists for approvals/workflows',
  },
  {
    re: /project\.routes/,
    route: /members/,
    cls: 'MISSING_TENANCY',
    pri: 'P1',
    basis:
      '`project_members` has no workspace column; addMember/removeMember filter by project id and member id only (project.service.ts)',
  },
  {
    re: /project\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P2',
    basis: 'service scopes by `ctx.workspaceId`; no capability for projects',
  },
  {
    re: /human-resources\.routes/,
    route: /payroll|leave|employees|departments|attendance/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P1',
    basis:
      'service scopes by workspace; no capability for HR or payroll; a seller token can create employees and settle payroll',
  },
  {
    re: /warehouse\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'CAPABILITY_EXISTS',
    pri: 'P1',
    basis:
      '`inventory.configure` (owner) exists; warehouse create/update/delete never ask for it (warehouse.service.ts has no authz words)',
  },
  {
    re: /product\.routes/,
    route: /^\/api\/products$/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'CAPABILITY_EXISTS',
    pri: 'P2',
    basis:
      '`product.write` (manager) is asserted by update/delete (`scopes.assertMay`, product.service.ts:638,695,782…) but not by create',
  },
  {
    re: /transaction\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'CAPABILITY_EXISTS',
    pri: 'P3',
    basis:
      '`payment.record` exists and a seller holds it by default; the route does not ask, so a custom role that removes it is not enforced',
  },
  {
    re: /billing\.routes/,
    route: /offline-license|devices/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P1',
    basis:
      'issuing/revoking offline licences and activating devices only needs workspace membership (billing.routes.ts:425-500); `workspace.manage` exists',
  },
  {
    re: /cloud-migration\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'CAPABILITY_EXISTS',
    pri: 'P1',
    basis: '`data.import` exists; migration job create/chunk/confirm do not ask for it',
  },
  {
    re: /cycle-count\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P1',
    basis:
      'completing a count writes stock movements (cycle-count.service.ts complete); no capability',
  },
  {
    re: /purchasing\.routes|inventory-insights\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P2',
    basis: 'workspace scoped; no purchasing capability',
  },
  {
    re: /campaigns\.routes|crm\.routes|custom-fields\.routes|saved-views\.routes|notes\.routes|activity\.routes|personalization\.routes|attendance|marketplace\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'NO_CAPABILITY_DEFINED',
    pri: 'P3',
    basis: 'workspace scoped; personal or low-impact domain; no capability exists',
  },
  {
    re: /ai-pipeline|mcp\.routes/,
    cls: 'SAFE',
    pri: '-',
    basis:
      'PipelineService/MCP decide use `roleAtLeast(ctx.role, ...)` and `holds(ctx, capability)` (pipeline.service.ts:200-276; mcp.routes.ts:422)',
  },
  {
    re: /ai-chat|ai\.routes|translate\.routes/,
    cls: 'UNKNOWN',
    pri: 'P3',
    basis:
      'model-call endpoints gated by an AI quota; they write no business data; quota logic not read in depth',
  },
  {
    re: /permission\.routes/,
    cls: 'SAFE',
    pri: '-',
    basis: "`POST /permissions/check` reads the caller's own answer",
  },
  {
    re: /sync\.routes/,
    route: /lease/,
    cls: 'SAFE',
    pri: '-',
    basis:
      'an edit lease is scoped to the actor and workspace (`releaseLease` filters by holder); it grants no write by itself',
  },
  {
    re: /sync\.routes/,
    cls: 'MISSING_AUTHORIZATION',
    sub: 'CAPABILITY_EXISTS',
    pri: 'P0',
    basis:
      'push applies create/update on the allow-listed columns and DELETE on any of 9 entities with only a workspace check (sync.service.ts execute); no capability; see N-30',
  },
]

const out = []
const open = rows.filter((r) =>
  ['NO_AUTHORIZATION_MECHANISM', 'UNKNOWN', 'MISSING_TENANCY'].includes(r.cls),
)
const decided = []
for (const r of open) {
  const f = FAMILY.find(
    (x) =>
      x.re.test(r.file) &&
      (!x.method || x.method.test(r.method)) &&
      (!x.route || x.route.test(r.route)),
  )
  decided.push({
    ...r,
    final: f ? f.cls : 'UNKNOWN',
    sub: f?.sub ?? '',
    pri: f?.pri ?? '?',
    basis: f?.basis ?? 'not read',
  })
}
const auto = {}
for (const r of rows) auto[r.cls] = (auto[r.cls] || 0) + 1
const fin = {}
for (const d of decided)
  fin[d.final + (d.sub ? ':' + d.sub : '')] = (fin[d.final + (d.sub ? ':' + d.sub : '')] || 0) + 1

out.push('# Write-route authorization audit (GATE-12)')
out.push('')
out.push(
  'Generated by `scripts/audit/render-write-route-authz.mjs` from `generated/write-route-authz.json` (classifier) plus human reading of each family (basis column). 2026-10-26. Static only: no HTTP test as a second user was run.',
)
out.push('')
out.push('## How a request reaches the database')
out.push('')
out.push(
  '1. `authenticate`, then `requireWorkspaceContext` resolves membership and the capability set (`workspace.middleware.ts:82-110`). Roles are `owner` > `manager` > `seller`; a custom role replaces the base set for the capabilities that exist.',
)
out.push(
  '2. A capability is enforced only if the route calls `requireCapability(...)`, or the service calls `scopes.assertMay(...)` / `holds(...)`. `CAPABILITIES` has 27 entries (ledger, payment, inventory, invoice, customer, product, report, budget, data.import, member, workspace). **There is no capability for HR/payroll, projects, CRM, campaigns, purchasing, cycle counts, workflows, offline licences or custom fields.**',
)
out.push(
  '3. "Hidden modules" (owner blocks a person from a page) are returned to the client and applied there; the server does not deny by module.',
)
out.push('')
out.push('## Result')
out.push('')
out.push(
  'Write routes found: **' +
    rows.length +
    "** (the repository's own `audit-unwired-routes.mjs` finds the same 816 routes in total).",
)
out.push('')
out.push('| Automatic class | Count | Meaning |')
out.push('|---|---|---|')
const meaning = {
  SAFE_ROUTE_CAPABILITY: '`requireCapability` in the route',
  SAFE_HANDLER_CHECK:
    'inline role/capability words in the handler (heuristic; includes owner checks)',
  SAFE_SERVICE_AUTH: 'the service method asserts a capability',
  PLATFORM_ADMIN: 'platform-admin guard, not tenant API',
  PUBLIC_OR_TOKEN: 'token or public routes (storefront, attendance link, feedback)',
  USER_SCOPED_OR_PUBLIC:
    'authenticated but not workspace-scoped (own profile, notifications, workspace management)',
  USER_SCOPED_CHECKED: 'same, with inline checks',
  NO_AUTHORIZATION_MECHANISM:
    'workspace scoped, no capability or role check found in route or service method → read by hand below',
  UNKNOWN: 'service not resolved by the script → read by hand below',
  MISSING_TENANCY: 'service never receives the workspace → read by hand below',
}
for (const [k, v] of Object.entries(auto).sort((a, b) => b[1] - a[1]))
  out.push(`| ${k} | ${v} | ${meaning[k] ?? ''} |`)
out.push('')
out.push('After reading the ' + decided.length + ' open routes family by family:')
out.push('')
out.push('| Final class | Sub-kind | Routes |')
out.push('|---|---|---|')
for (const [k, v] of Object.entries(fin).sort((a, b) => b[1] - a[1])) {
  const [c, s] = k.split(':')
  out.push(`| ${c} | ${s ?? ''} | ${v} |`)
}
out.push('')
out.push(
  "**114 routes without `requireCapability` is not 114 vulnerabilities.** Of the routes the scan first called weak: some assert the capability inside the service, some act on the caller's own data, some are platform-admin; the rest fall into the two groups above. What the table shows is that the authorization model has **no capability at all** for several domains (a model gap, to be decided by the owner), plus a smaller set where a capability exists and is not applied (a defect).",
)
out.push('')
out.push('## Cross-tenant defects (MISSING_TENANCY)')
out.push('')
out.push('| Route | Basis |')
out.push('|---|---|')
for (const d of decided.filter((x) => x.final === 'MISSING_TENANCY'))
  out.push(
    `| \`${d.method} ${d.route}\` (${d.file.replace('backend/src/routes/', '')}:${d.line}) | ${d.basis} |`,
  )
out.push(
  '| `POST /api/sync/push` operation `delete` | `SyncService.execute` deletes by `id` + `workspace_id` for any of the 9 entities; no per-entity authorization (`sync.service.ts:503-512`). Not cross-tenant, but a capability bypass (see N-30). |',
)
out.push('')
out.push('## Capability exists but is not applied')
out.push('')
out.push('| Route | Priority | Basis |')
out.push('|---|---|---|')
for (const d of decided.filter(
  (x) => x.final === 'MISSING_AUTHORIZATION' && x.sub === 'CAPABILITY_EXISTS',
))
  out.push(`| \`${d.method} ${d.route}\` | ${d.pri} | ${d.basis} |`)
out.push('')
out.push('## No capability defined for the domain (model gap)')
out.push('')
out.push('| Route family | Routes | Priority | Basis |')
out.push('|---|---|---|---|')
const fam = {}
for (const d of decided.filter(
  (x) => x.final === 'MISSING_AUTHORIZATION' && x.sub === 'NO_CAPABILITY_DEFINED',
)) {
  const k = d.file.replace('backend/src/routes/', '')
  fam[k] = fam[k] || { n: 0, pri: d.pri, basis: d.basis, ex: [] }
  fam[k].n++
  if (fam[k].ex.length < 3) fam[k].ex.push(`${d.method} ${d.route}`)
}
for (const [k, v] of Object.entries(fam))
  out.push(
    `| ${k} (e.g. ${v.ex.map((e) => '`' + e + '`').join(', ')}) | ${v.n} | ${v.pri} | ${v.basis} |`,
  )
out.push('')
out.push('## Not decided')
out.push('')
for (const d of decided.filter((x) => x.final === 'UNKNOWN'))
  out.push(
    `- \`${d.method} ${d.route}\` (${d.file.replace('backend/src/routes/', '')}) — ${d.basis}`,
  )
out.push('')
out.push('## Limits')
out.push(
  "1. The \"SAFE\" automatic classes are heuristics (words found in a method body). `SAFE_HANDLER_CHECK` includes any handler mentioning `'owner'`/`'manager'`; a few may be false-safe.",
)
out.push('2. Each family was read once; individual routes inside a family can differ.')
out.push('3. Nothing was exercised over HTTP as a seller or a "no access" custom role.')
out.push(
  '4. Service-level tenancy of the 907 tenant query chains was scanned (`scripts/audit/tenancy-scan.mjs`); the 36 write candidates were triaged in `UNIVERSAL-CORE-GAP-LEDGER.md` N-18, N-31.',
)
fs.writeFileSync(path.join(ROOT, 'docs/audit/WRITE-ROUTE-AUTHORIZATION.md'), out.join('\n') + '\n')
console.log(JSON.stringify(fin, null, 1))
