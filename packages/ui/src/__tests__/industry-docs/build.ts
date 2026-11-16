// ============================================
// docs/industries — the builder.
//
// Every file under docs/industries (except INDUSTRY-REGISTRY.md, which has its
// own generator) is RENDERED here from the code itself:
//
//   profiles, DNA, capabilities, engines     @hisabche/validation
//   menu, module locks, labels               @hisabche/ui-contract
//   shell routes, moved addresses            read from their source files
//   offline status of every endpoint         OFFLINE_ENDPOINT_MATRIX
//   journey evidence per trade               docs/architecture/industry/*.json
//   what a person wrote                      ./content.ts
//
// Nothing here writes to disk: `industry-specs-complete.test.ts` compares the
// result with the files, and rewrites them only when asked to
// (UPDATE_INDUSTRY_DOCS=1). A document therefore cannot drift from the code,
// and a route or an endpoint that does not exist cannot be written down.
// ============================================

import fs from 'node:fs'
import path from 'node:path'

import { BUSINESS_MODELS, BUSINESS_TYPES, BUSINESS_TYPE_OTHER } from '@hisabche/ui-contract'
import { NAV_CONTRACT, NAV_MODULE, isPageDisabled } from '@hisabche/ui-contract'
import {
  CAPABILITIES,
  DASHBOARD_PART_IDS,
  ENGINES,
  FEATURE_PACKS,
  INDUSTRY_KEYS,
  OFFLINE_ENDPOINT_MATRIX,
  PROFILES,
  REPAIR_MOVES,
  REPAIR_STATUSES,
  SALES_MODEL_KEYS,
  SERVICE_DELIVERY_STATUSES,
  inferOperationalDna,
  isPayrollFinal,
  isValidSessionStatusTransition,
  packForRoute,
  resolveBusinessProfile,
  type CapabilityKey,
  type IndustryKey,
} from '@hisabche/validation'

import { can, ROLE_RANK, type Capability } from '../../../../auth-core/src/permissions'
import { dnaActiveModules, suggestedNavigationContext } from '../../lib/menu/dna-menu-suggestion'
import {
  FAMILIES,
  FAMILY_IDS,
  FAMILY_OF,
  PAGE_STATES,
  REPRESENTATIVES,
  ROLE_NOTE,
  type FamilyId,
  type RepresentativeSpec,
} from './content'

export interface DocFile {
  /** Relative to docs/industries. */
  readonly path: string
  readonly content: string
}

export const STATUS_LABELS = [
  'EXISTING_AND_VERIFIED',
  'EXISTING_BUT_INCOMPLETE',
  'CONFIGURATION_REQUIRED',
  'NEW_CAPABILITY_REQUIRED',
  'NOT_SUPPORTED',
  'BLOCKED_EXTERNAL',
] as const
export type StatusLabel = (typeof STATUS_LABELS)[number]

/** The eight headings every trade README carries, in this order. */
export const README_HEADINGS = [
  'هویت و مدل کسب‌وکار',
  'گردش کار روزانه',
  'صفحه‌به‌صفحه',
  'عملیات و تراکنش',
  'KPI و گزارش',
  'نقش‌ها و دسترسی',
  'آفلاین و دستگاه',
  'شکاف‌ها و نیازمندی‌ها',
] as const

export const REPRESENTATIVE_FILES = [
  'README.md',
  'DAILY-WORKFLOW.md',
  'PAGE-BY-PAGE-UX.md',
  'OPERATIONS-AND-TRANSACTIONS.md',
  'KPI-AND-REPORTS.md',
  'ROLES-AND-PERMISSIONS.md',
  'OFFLINE-AND-DEVICE.md',
  'GAPS-AND-REQUIREMENTS.md',
] as const

const GENERATED =
  '<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->'

const SAME_AS_FAMILY = (family: string) => `مانند خانواده‌ی «${family}» — تفاوتی نیست.`

// ─── Sources read from files ────────────────────────────────────────────────

interface Sources {
  readonly root: string
  readonly routes: ReadonlySet<string>
  /** Every address with a query that the product itself already uses. */
  readonly addresses: ReadonlySet<string>
  readonly moved: readonly (readonly [string, string])[]
  readonly messages: Readonly<Record<'fa' | 'af' | 'en', Record<string, unknown>>>
  readonly evidence: ReadonlyMap<string, IndustryEvidence>
  readonly criteria: readonly { code: string; title: string; industriesMeeting: number }[]
  readonly evidenceCommit: string
  /** The `DeviceOperation`s some hook really asks `executionSiteFor` about. */
  readonly deviceOperationsInUse: ReadonlySet<string>
}

interface IndustryEvidence {
  readonly status: string
  readonly sellable: boolean
  readonly tests: readonly string[]
  readonly criteria: Readonly<Record<string, boolean>>
  readonly missingEvidence: readonly string[]
}

function loadSources(root: string): Sources {
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

  // JSX comments and line comments only: a route such as `path="x/*"` holds a
  // slash-star, and a block-comment stripper would eat the routes after it.
  const shell = read('packages/app-shell/src/app/app.tsx')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const routes = new Set<string>()
  // The shell declares routes as objects (`{ path: 'invoices/new', … }`).
  for (const match of shell.matchAll(/\bpath(?::\s*|=)["']([^"']+)["']/g)) {
    const value = String(match[1])
    if (value === '*') continue
    routes.add(value.startsWith('/') ? value : `/${value}`)
  }
  for (const item of NAV_CONTRACT) routes.add(String(item.path.split('?')[0]))

  // Only line comments are dropped here: this file has slash-star inside strings.
  const config = read('apps/web/next.config.js').replace(/^\s*\/\/.*$/gm, '')
  const block = /const moved = \[([\s\S]*?)\]\s*return moved\.map/.exec(config)
  if (!block) throw new Error('industry docs: the `moved` table was not found in next.config.js')
  const moved = [...String(block[1]).matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)].map(
    (match) => [`/${String(match[1])}`, `/${String(match[2])}`] as const,
  )
  if (moved.length < 20) throw new Error(`industry docs: only ${moved.length} moved pairs parsed`)

  const addresses = new Set<string>()
  for (const [, to] of moved) addresses.add(to)
  for (const item of NAV_CONTRACT) addresses.add(item.path)

  const messages = {
    fa: JSON.parse(read('packages/i18n/messages/fa/common.json')) as Record<string, unknown>,
    af: JSON.parse(read('packages/i18n/messages/af/common.json')) as Record<string, unknown>,
    en: JSON.parse(read('packages/i18n/messages/en/common.json')) as Record<string, unknown>,
  }

  const sellable = JSON.parse(read('docs/architecture/industry/sellable-industries.json')) as {
    acceptanceCommit: string
    criteria: { code: string; title: string; industriesMeeting: number }[]
    industries: ({ key: string } & IndustryEvidence)[]
  }
  const evidence = new Map<string, IndustryEvidence>()
  for (const row of sellable.industries) evidence.set(row.key, row)

  // An operation the contract declares but no hook asks about is not a device
  // path: the document must say so instead of promising a `device` answer.
  const hooksDir = path.join(root, 'packages/api/src/hooks')
  const deviceOperationsInUse = new Set<string>()
  for (const name of fs.readdirSync(hooksDir)) {
    if (!name.endsWith('.ts')) continue
    const source = fs.readFileSync(path.join(hooksDir, name), 'utf8')
    for (const match of source.matchAll(/executionSiteFor\('([a-zA-Z.]+)'\)/g)) {
      deviceOperationsInUse.add(String(match[1]))
    }
  }

  return {
    root,
    routes,
    addresses,
    moved,
    messages,
    evidence,
    criteria: sellable.criteria,
    evidenceCommit: sellable.acceptanceCommit,
    deviceOperationsInUse,
  }
}

// ─── The two notations of content.ts ────────────────────────────────────────

const OFFLINE_FA: Readonly<Record<string, string>> = {
  available: 'آفلاین: در دسترس',
  online_required: 'فقط آنلاین',
  not_supported: 'در نسخه‌ی آفلاین نیست',
}

/**
 * The execution-site contract names three operations and nothing else
 * (`packages/api/src/lib/execution-site.ts`). Kept here as data, with a guard
 * (`industry-offline-device.test.ts`) that fails if either side changes alone.
 */
const DEVICE_OPERATION_BY_ENDPOINT: Readonly<Record<string, string>> = {
  'POST /invoices': 'invoice.create',
  'POST /payments': 'payment.record',
  'POST /invoices/:x/returns': 'invoice.return',
}

function endpointStatus(endpoint: string): string {
  const row = OFFLINE_ENDPOINT_MATRIX[endpoint]
  if (!row) throw new Error(`industry docs: no such endpoint in the offline matrix: ${endpoint}`)
  return row[1]
}

function checkRoute(sources: Sources, address: string): void {
  const [base, query] = address.split('?')
  const normal = String(base).replace(/\/$/, '') || '/'
  if (!sources.routes.has(normal)) {
    throw new Error(`industry docs: no such app route: ${address}`)
  }
  if (query !== undefined && !sources.addresses.has(address)) {
    throw new Error(
      `industry docs: «${address}» names a tab or view the product itself does not link to`,
    )
  }
}

/** `[[/route]]` → a checked address; `{{METHOD /path}}` → a checked endpoint with its offline status. */
function render(sources: Sources, text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, (_, address: string) => {
      checkRoute(sources, address)
      return `\`${address}\``
    })
    .replace(/\{\{([^}]+)\}\}/g, (_, endpoint: string) => {
      const status = endpointStatus(endpoint)
      return `\`${endpoint}\` (${OFFLINE_FA[status]})`
    })
}

// ─── Facts about one trade ──────────────────────────────────────────────────

function messageAt(catalog: Record<string, unknown>, key: string): string | null {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : null
}

const OPTIONS = new Map(
  [...BUSINESS_MODELS, ...BUSINESS_TYPES, BUSINESS_TYPE_OTHER].map((option) => [option.id, option]),
)

function labelsOf(sources: Sources, id: IndustryKey): { fa: string; af: string; en: string } {
  const option = OPTIONS.get(id)
  if (!option) throw new Error(`industry docs: «${id}» is registered but has no onboarding option`)
  const read = (lang: 'fa' | 'af' | 'en') => {
    const value = messageAt(sources.messages[lang], option.labelKey)
    if (value === null) {
      throw new Error(`industry docs: label «${option.labelKey}» is missing in ${lang}`)
    }
    return value
  }
  return { fa: read('fa'), af: read('af'), en: read('en') }
}

function exists(sources: Sources, relative: string): boolean {
  return fs.existsSync(path.join(sources.root, relative))
}

/** A capability is «verified» only when its registry names a test file that is really there. */
function capabilityLabel(
  sources: Sources,
  key: CapabilityKey,
): { label: StatusLabel; test: string | null } {
  const definition = CAPABILITIES[key]
  if (definition.status === 'planned') return { label: 'NEW_CAPABILITY_REQUIRED', test: null }
  if (definition.status === 'partial') return { label: 'EXISTING_BUT_INCOMPLETE', test: null }
  const test = definition.evidence.tests.find((file) => exists(sources, file)) ?? null
  return test
    ? { label: 'EXISTING_AND_VERIFIED', test }
    : { label: 'EXISTING_BUT_INCOMPLETE', test: null }
}

interface Facts {
  readonly id: IndustryKey
  readonly labels: { fa: string; af: string; en: string }
  readonly kind: 'مدل فروش' | 'صنف' | 'سایر'
  readonly family: FamilyId
  readonly profileKind: 'specialized' | 'generic'
  readonly archetype: string | null
  readonly dna: ReturnType<typeof inferOperationalDna>
  readonly modules: readonly string[]
  readonly hiddenPaths: readonly string[]
  readonly on: readonly CapabilityKey[]
  readonly unsupported: readonly CapabilityKey[]
  readonly dashboard: readonly string[]
  readonly unit: string
  readonly emphasized: readonly string[]
  readonly invoiceColumns: readonly string[]
  readonly vocabulary: Readonly<Record<string, string | undefined>>
  readonly evidence: IndustryEvidence | null
}

function factsOf(sources: Sources, id: IndustryKey): Facts {
  const profile = resolveBusinessProfile([id])
  const dna = inferOperationalDna({ tradeKey: id })
  const navigation = suggestedNavigationContext(dna, id)
  return {
    id,
    labels: labelsOf(sources, id),
    kind: SALES_MODEL_KEYS.includes(id) ? 'مدل فروش' : id === 'other' ? 'سایر' : 'صنف',
    family: FAMILY_OF[id],
    profileKind: PROFILES[id].kind,
    archetype: dna.archetypeHint ?? null,
    dna,
    modules: [...dnaActiveModules(dna)].sort(),
    hiddenPaths: [...navigation.hiddenPaths].sort(),
    on: profile.capabilities,
    unsupported: profile.unsupported,
    dashboard: profile.dashboard,
    unit: profile.productDefaults.unit,
    emphasized: profile.productDefaults.emphasizedFields,
    invoiceColumns: profile.invoiceDefaults.extraVisibleColumns,
    vocabulary: { ...profile.vocabulary },
    evidence: sources.evidence.get(id) ?? null,
  }
}

/** The six generic parts; anything else in a profile is the trade's own part. */
const GENERIC_PARTS = new Set([
  'workQueue',
  'kpis',
  'chart',
  'insights',
  'activities',
  'manufacturing',
])

function journeyLabel(
  sources: Sources,
  facts: Facts,
): { label: StatusLabel; tests: readonly string[] } {
  const tests = (facts.evidence?.tests ?? []).filter((file) => exists(sources, file))
  if (facts.evidence?.sellable && tests.length > 0) return { label: 'EXISTING_AND_VERIFIED', tests }
  return { label: 'EXISTING_BUT_INCOMPLETE', tests }
}

function experienceLabel(sources: Sources, facts: Facts): StatusLabel {
  const ownParts = facts.dashboard.filter((part) => !GENERIC_PARTS.has(part))
  // Nothing of its own switched on: the trade runs on the shared core.
  if (facts.on.length === 0 && ownParts.length === 0) return 'CONFIGURATION_REQUIRED'
  // A dashboard part of its own exists in code, but no browser run has shown
  // it on a real workspace yet — never «verified» on the strength of a unit test.
  if (ownParts.length > 0) return 'EXISTING_BUT_INCOMPLETE'
  const labels = facts.on.map((key) => capabilityLabel(sources, key).label)
  return labels.every((label) => label === 'EXISTING_AND_VERIFIED')
    ? 'EXISTING_AND_VERIFIED'
    : 'EXISTING_BUT_INCOMPLETE'
}

const list = (values: readonly string[]) =>
  values.length ? values.map((v) => `\`${v}\``).join('، ') : '—'

// ─── One trade's README ─────────────────────────────────────────────────────

function capabilityRows(sources: Sources, keys: readonly CapabilityKey[]): string[] {
  return keys.map((key) => {
    const definition = CAPABILITIES[key]
    const { label, test } = capabilityLabel(sources, key)
    const engine = definition.engine ? ENGINES[definition.engine] : null
    const proof = test
      ? `\`${test}\``
      : definition.limitations.length
        ? list(definition.limitations)
        : '—'
    return `| \`${key}\` | \`${label}\` | ${engine ? `\`${engine.key}\` · ${engine.offlineStatus}` : '—'} | ${proof} |`
  })
}

function generatedSection(sources: Sources, facts: Facts): string {
  const journey = journeyLabel(sources, facts)
  const lines: string[] = []
  lines.push(`| | |`, `| --- | --- |`)
  lines.push(`| شناسه | \`${facts.id}\` |`)
  lines.push(`| نام | ${facts.labels.fa} · ${facts.labels.af} · ${facts.labels.en} |`)
  lines.push(`| نوع | ${facts.kind} |`)
  lines.push(`| خانواده | [${FAMILIES[facts.family].title}](../families/${facts.family}.md) |`)
  lines.push(`| پروفایل | \`${facts.profileKind}\` |`)
  lines.push(`| archetype | ${facts.archetype ? `\`${facts.archetype}\`` : '— (تعیین نشده)'} |`)
  lines.push('')
  lines.push('**وضعیت**', '')
  lines.push(
    `- سفر پایه (ثبت‌نام → اولین فروش → سود و زیان): \`${journey.label}\`${journey.tests.length ? ` — ${list(journey.tests)}` : ''}`,
  )
  lines.push(
    `- تجربه‌ی اختصاصی صنف: \`${experienceLabel(sources, facts)}\`${facts.profileKind === 'generic' ? ' — پروفایل عمومی است؛ چیزی جز هسته‌ی مشترک وعده داده نشده.' : ''}`,
  )
  lines.push('')
  lines.push('**DNA عملیاتی** (از `inferOperationalDna`)', '')
  lines.push('| محور | مقدار |', '| --- | --- |')
  for (const axis of [
    'offering',
    'intake',
    'inventory',
    'settlement',
    'workforce',
    'customer',
    'topology',
  ] as const) {
    lines.push(`| ${axis} | ${list(facts.dna[axis])} |`)
  }
  if (facts.dna.unitTracking) lines.push(`| unitTracking | \`${facts.dna.unitTracking}\` |`)
  lines.push('')
  lines.push(`**ماژول‌های فعال:** ${list(facts.modules)}`, '')
  lines.push(`**منوی پیشنهادی — پنهان می‌شود:** ${list(facts.hiddenPaths)}`, '')
  lines.push(`**داشبورد (ترتیب):** ${list(facts.dashboard)}`, '')
  lines.push(`**کالای تازه:** واحد \`${facts.unit}\` · فیلدهای جلو: ${list(facts.emphasized)}`, '')
  lines.push(`**ستون‌های اضافه‌ی فاکتور:** ${list(facts.invoiceColumns)}`, '')
  if (facts.on.length > 0) {
    lines.push('**قابلیت‌های روشن**', '')
    lines.push('| قابلیت | وضعیت | موتور · آفلاین | شاهد یا محدودیت |', '| --- | --- | --- | --- |')
    lines.push(...capabilityRows(sources, facts.on), '')
  } else {
    lines.push('**قابلیت‌های روشن:** هیچ قابلیت اختصاصی — فقط هسته‌ی مشترک.', '')
  }
  if (facts.unsupported.length > 0) {
    lines.push(
      `**خواسته‌شده و ساخته‌نشده** (\`NEW_CAPABILITY_REQUIRED\`): ${list(facts.unsupported)}`,
      '',
    )
  }
  return lines.join('\n')
}

function differences(
  sources: Sources,
  facts: Facts,
): Record<(typeof README_HEADINGS)[number], string> {
  const family = FAMILIES[facts.family].title
  const same = SAME_AS_FAMILY(family)
  const representative = REPRESENTATIVES[facts.id]
  const covering = (Object.entries(REPRESENTATIVES) as [IndustryKey, RepresentativeSpec][]).find(
    ([, spec]) => spec.alsoCovers.includes(facts.id),
  )
  const link = (file: string) => `سند کامل: [${file}](./${file})`
  const withLink = (text: string, file: string) => `${text} سند: [${file}](./${file})`
  const ownParts = facts.dashboard.filter((part) => !GENERIC_PARTS.has(part))

  const identity = [
    facts.profileKind === 'specialized'
      ? `پروفایل اختصاصی دارد (${facts.on.length} قابلیت روشن).`
      : 'پروفایل عمومی: همان هسته‌ی مشترک با نام این صنف.',
    covering ? `نزدیک‌ترین سند کامل: [${covering[0]}](../${covering[0]}/README.md).` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const pages: string[] = []
  if (facts.emphasized.length)
    pages.push(`فرم کالا این فیلدها را جلو می‌گذارد: ${list(facts.emphasized)}.`)
  if (facts.invoiceColumns.length)
    pages.push(`فاکتور این ستون‌ها را از اول نشان می‌دهد: ${list(facts.invoiceColumns)}.`)
  if (facts.hiddenPaths.length)
    pages.push(`منوی پیشنهادی این نشانی‌ها را پنهان می‌کند: ${list(facts.hiddenPaths)}.`)
  if (facts.unit !== 'piece') pages.push(`واحد کالای تازه \`${facts.unit}\` است.`)

  const offline = facts.on
    .map((key) => CAPABILITIES[key].engine)
    .filter((engine): engine is NonNullable<typeof engine> => engine !== null)
    .map((engine) => ENGINES[engine])
    .filter((engine) => engine.offline === 'online_required')
    .map((engine) => `\`${engine.key}\``)

  const gaps: string[] = []
  if (facts.unsupported.length) gaps.push(`ساخته‌نشده: ${list(facts.unsupported)}.`)
  const partial = facts.on.filter((key) => CAPABILITIES[key].status === 'partial')
  if (partial.length)
    gaps.push(
      `نیمه‌کاره: ${partial.map((key) => `\`${key}\` (${list(CAPABILITIES[key].limitations)})`).join('؛ ')}.`,
    )

  return {
    'هویت و مدل کسب‌وکار': identity,
    'گردش کار روزانه': representative
      ? link('DAILY-WORKFLOW.md')
      : withLink(same, 'DAILY-WORKFLOW.md'),
    صفحه‌به‌صفحه: representative
      ? link('PAGE-BY-PAGE-UX.md')
      : withLink(pages.length ? pages.join(' ') : same, 'PAGE-BY-PAGE-UX.md'),
    'عملیات و تراکنش': representative
      ? link('OPERATIONS-AND-TRANSACTIONS.md')
      : withLink(same, 'OPERATIONS-AND-TRANSACTIONS.md'),
    'KPI و گزارش': representative
      ? link('KPI-AND-REPORTS.md')
      : withLink(
          ownParts.length ? `قطعه‌ی اختصاصی داشبورد: ${list(ownParts)}.` : same,
          'KPI-AND-REPORTS.md',
        ),
    'نقش‌ها و دسترسی': representative
      ? link('ROLES-AND-PERMISSIONS.md')
      : withLink(same, 'ROLES-AND-PERMISSIONS.md'),
    'آفلاین و دستگاه': representative
      ? link('OFFLINE-AND-DEVICE.md')
      : withLink(
          offline.length
            ? `موتورهای این صنف که فقط آنلاین کار می‌کنند: ${[...new Set(offline)].join('، ')}.`
            : same,
          'OFFLINE-AND-DEVICE.md',
        ),
    'شکاف‌ها و نیازمندی‌ها': representative
      ? link('GAPS-AND-REQUIREMENTS.md')
      : withLink(
          gaps.length
            ? gaps.join(' ')
            : 'شکاف اختصاصی ثبت نشده؛ شکاف‌های خانواده در سند خانواده آمده است.',
          'GAPS-AND-REQUIREMENTS.md',
        ),
  }
}

function readme(sources: Sources, facts: Facts): string {
  const sections = differences(sources, facts)
  const out = [
    `# ${facts.labels.fa} (\`${facts.id}\`)`,
    '',
    GENERATED,
    '',
    '## حقایق از کد',
    '',
    generatedSection(sources, facts),
  ]
  out.push(`## تفاوت با خانواده‌ی «${FAMILIES[facts.family].title}»`, '')
  for (const heading of README_HEADINGS) out.push(`### ${heading}`, '', sections[heading], '')
  return out.join('\n')
}

// ─── The four representatives: seven more files ─────────────────────────────

function representativeFiles(sources: Sources, facts: Facts, spec: RepresentativeSpec): DocFile[] {
  const r = (text: string) => render(sources, text)
  const head = (title: string) => [`# ${facts.labels.fa} — ${title}`, '', GENERATED, '']
  const covers = spec.alsoCovers.length
    ? [
        `این سند برای این صنف‌ها هم خوانده می‌شود: ${spec.alsoCovers.map((id) => `[${id}](../${id}/README.md)`).join('، ')}.`,
        '',
      ]
    : []
  const dir = facts.id

  const daily = [
    ...head('گردش کار روزانه'),
    ...covers,
    ...spec.day.map((step, index) => `${index + 1}. ${r(step)}`),
    '',
  ]

  const pages = [...head('صفحه‌به‌صفحه'), ...covers]
  for (const page of spec.pages) {
    checkRoute(sources, page.route)
    pages.push(`## \`${page.route}\``, '', `**برای چه:** ${page.purpose}`, '')
    pages.push('**چیدمان، از بالا به پایین** (زیر ۷۶۸px همان ترتیب، جدول‌ها کارت می‌شوند):', '')
    pages.push(...page.layout.map((row, index) => `${index + 1}. ${row}`), '')
    pages.push('**داده از:**', '', ...page.data.map((source) => `- ${r(source)}`), '')
    pages.push(`**تغییر برای این صنف:** ${r(page.changes)}`, '')
  }
  pages.push(
    '## حالت‌های هر صفحه',
    '',
    'ده حالت مشترک در [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md) آمده و برای همه‌ی صفحه‌های بالا یکی است.',
    '',
  )

  const operations = [...head('عملیات و تراکنش'), ...covers]
  operations.push(
    '| اقدام | endpoint | اثر در دفاتر | اثر در انبار | آفلاین | وقتی نشد |',
    '| --- | --- | --- | --- | --- | --- |',
  )
  for (const op of spec.operations) {
    operations.push(
      `| ${op.action} | \`${op.endpoint}\` | ${op.books} | ${op.stock} | ${OFFLINE_FA[endpointStatus(op.endpoint)]} | ${op.onFailure} |`,
    )
  }
  operations.push('', 'ستون «آفلاین» از `OFFLINE_ENDPOINT_MATRIX` خوانده شده، نه نوشته.', '')

  const kpis = [...head('KPI و گزارش'), ...covers, '| شاخص | از کجا می‌آید |', '| --- | --- |']
  kpis.push(...spec.kpis.map((kpi) => `| ${kpi.what} | ${r(kpi.source)} |`), '')
  kpis.push(
    'شاخصی که منبع ندارد «شکاف» نوشته شده و عددی برایش ساخته نمی‌شود. «نامعلوم» صفر نیست.',
    '',
  )

  const roles = [...head('نقش‌ها و دسترسی'), ...covers, '| نقش | چه می‌کند |', '| --- | --- |']
  roles.push(...spec.roles.map((row) => `| ${row.role} | ${r(row.does)} |`), '', r(ROLE_NOTE), '')
  roles.push('جدول کامل نقش × مجوز: [ROLE-PERMISSION-MATRIX.md](../ROLE-PERMISSION-MATRIX.md).', '')

  const offline = [...head('آفلاین و دستگاه'), ...covers]
  const local = spec.operations.filter((op) => endpointStatus(op.endpoint) === 'available')
  const cloud = spec.operations.filter((op) => endpointStatus(op.endpoint) !== 'available')
  offline.push(
    '## بدون اینترنت انجام می‌شود',
    '',
    ...(local.length ? local.map((op) => `- ${op.action} — \`${op.endpoint}\``) : ['- هیچ‌کدام']),
    '',
  )
  offline.push(
    '## اینترنت می‌خواهد',
    '',
    ...(cloud.length ? cloud.map((op) => `- ${op.action} — \`${op.endpoint}\``) : ['- هیچ‌کدام']),
    '',
  )
  offline.push(
    '## هر اقدام اصلی: آفلاین یا نه، و کجا اجرا می‌شود',
    '',
    '| اقدام | endpoint | آفلاین (ماتریس) | مکان اجرا (`executionSiteFor`) |',
    '| --- | --- | --- | --- |',
  )
  for (const op of spec.operations) {
    const deviceOperation = DEVICE_OPERATION_BY_ENDPOINT[op.endpoint]
    const inUse = deviceOperation ? sources.deviceOperationsInUse.has(deviceOperation) : false
    offline.push(
      `| ${op.action} | \`${op.endpoint}\` | ${OFFLINE_FA[endpointStatus(op.endpoint)]} | ${
        !deviceOperation
          ? '— (قرارداد مکان اجرا این عمل را نام نمی‌برد)'
          : inUse
            ? `\`${deviceOperation}\` → \`device\` اگر میزبان آماده باشد، وگرنه \`server\``
            : `\`${deviceOperation}\` در قرارداد هست، ولی هیچ hook آن را صدا نمی‌زند؛ امروز \`server\``
      } |`,
    )
  }
  offline.push(
    '',
    "ستون‌های بالا از `OFFLINE_ENDPOINT_MATRIX` و `packages/api/src/lib/execution-site.ts` خوانده شده‌اند، نه نوشته؛ «در دست استفاده» را هم اسکن `executionSiteFor('<op>')` در `packages/api/src/hooks` می‌گوید.",
    '',
    '## مکان اجرا: یک قرارداد، نه یک انتخاب',
    '',
    '- `executionSiteFor` فقط سه عمل را می‌شناسد: `invoice.create`، `payment.record`، `invoice.return`. عمل چهارم یعنی مسیر سوم، و مسیر سوم ساخته نمی‌شود.',
    '- `device` تنها وقتی پاسخ است که میزبان (ویندوز/اندروید) یک بررسی آمادگی ثبت کرده باشد، کسب‌وکار فعال باشد و میزبان برای همین عمل در همین کسب‌وکار آماده باشد؛ وگرنه پاسخ `server` است. وب هرگز ثبت نمی‌کند، پس روی وب همیشه `server` است.',
    '- تصمیم از روی داده گرفته می‌شود، نه از روی سخت‌افزار؛ گوشی ضعیف با همان ردیف‌ها همان اعداد را می‌سازد.',
    '',
  )
  if (spec.operations.some((op) => op.endpoint === 'POST /resource-bookings')) {
    offline.push(
      '## رزرو: تعارض صریح، نه آخرین‌نویسنده',
      '',
      `\`POST /resource-bookings\` در ماتریس «${OFFLINE_FA[endpointStatus('POST /resource-bookings')]}» است: دو دستگاه آفلاین می‌توانند هم‌زمان یک منبع و یک بازه را بگیرند.`,
      '',
      '- هنگام ارسال، سرور برای هم‌پوشانی `409` می‌دهد و `pushEntry` در `packages/app-shell/src/features/sync/sync-engine.ts` آن را به `handleBookingSyncConflict` می‌دهد.',
      '- نتیجه `conflictState: PENDING_REVIEW` و `reason: RESOURCE_SLOT_OVERLAP` است، و خطا `permanent = true` می‌گیرد؛ پس صف تا بی‌نهایت دوباره تلاش نمی‌کند.',
      '- هیچ‌کدام از دو رزرو دور ریخته یا بازنویسی نمی‌شود؛ یک آدم در مرکز سینک تصمیم می‌گیرد. این همان چیزی است که تست `resource-capacity-race.test.ts` می‌سنجد.',
      '',
    )
  }
  offline.push(
    '## روی دستگاه (ویندوز و اندروید)',
    '',
    '- فروش روی دستگاهِ آماده اول در SQLite خود دستگاه ثبت می‌شود، حتی آنلاین؛ ارسال به سرور در پس‌زمینه است و سرور همان فاکتور را دوباره اعتبارسنجی و شماره‌گذاری می‌کند.',
    '- آنچه دستگاه نپذیرد، وقتی آنلاین است از سرور پرسیده می‌شود: سریال، سری تاریخ‌دار، اعتبار بسته و لایه‌ی بها روی دستگاه کامل نیست.',
    `- عمل‌هایی که hook امروز از قرارداد مکان اجرا می‌پرسد: ${list([...sources.deviceOperationsInUse].sort())}؛ بقیه‌ی عمل‌های قرارداد مسیر سرور می‌روند.`,
    '- دو دستگاه آفلاین که یک زمان/منبع را بگیرند تعارض صریح می‌سازند، نه آخرین‌نویسنده.',
    '',
  )

  const gaps = [
    ...head('شکاف‌ها و نیازمندی‌ها'),
    ...covers,
    '| نیاز | وضعیت | طرح |',
    '| --- | --- | --- |',
  ]
  gaps.push(...spec.gaps.map((gap) => `| ${gap.need} | \`${gap.status}\` | ${gap.plan} |`), '')
  if (facts.unsupported.length)
    gaps.push(`قابلیت‌های خواسته‌شده‌ی رجیستری که ساخته نشده‌اند: ${list(facts.unsupported)}.`, '')
  gaps.push(
    'هیچ‌کدام از این‌ها در این دور ساخته نشده است؛ فهرست یکجا در `docs/architecture/V70-BACKLOG.md`.',
    '',
  )

  const file = (name: string, lines: string[]): DocFile => ({
    path: `${dir}/${name}`,
    content: lines.join('\n'),
  })
  return [
    file('DAILY-WORKFLOW.md', daily),
    file('PAGE-BY-PAGE-UX.md', pages),
    file('OPERATIONS-AND-TRANSACTIONS.md', operations),
    file('KPI-AND-REPORTS.md', kpis),
    file('ROLES-AND-PERMISSIONS.md', roles),
    file('OFFLINE-AND-DEVICE.md', offline),
    file('GAPS-AND-REQUIREMENTS.md', gaps),
  ]
}

// ─── Every other trade: the same seven files, from its family and its code ──
//
// A trade without a hand-written representative still gets all eight files,
// but nothing in them is invented: each file is the trade's own facts read
// from code (profile, DNA, capabilities, engines, evidence) laid over its
// family's specification, which a person wrote once in content.ts. Where the
// trade adds nothing to its family, the file says so instead of repeating it.

const EVIDENCE_FA: Readonly<Record<string, string>> = {
  POSTGRES_JOURNEY: 'سفر کامل روی Postgres واقعی اجرا نشده',
  BROWSER_JOURNEY: 'سفر کامل در مرورگر روی یک workspace واقعی اجرا نشده',
  EVIDENCE_NOT_ON_COMMITTED_TREE:
    'شاهد روی درخت commit‌نشده گرفته شده؛ بعد از commit باید دوباره تولید شود',
}

const ENGINE_MODE_FA: Readonly<Record<string, string>> = {
  local: 'روی دستگاه هم اجرا می‌شود',
  online_required: 'فقط آنلاین',
}

function vocabularyRows(sources: Sources, facts: Facts): string[] {
  const rows: string[] = []
  for (const [slot, key] of Object.entries(facts.vocabulary)) {
    if (!key) continue
    const fa = messageAt(sources.messages.fa, key)
    if (fa === null) throw new Error(`industry docs: vocabulary «${key}» is missing in fa`)
    rows.push(`| \`${slot}\` | ${fa} | \`${key}\` |`)
  }
  return rows
}

function engineRows(facts: Facts): string[] {
  const seen = new Set<string>()
  const rows: string[] = []
  for (const key of facts.on) {
    const engineKey = CAPABILITIES[key].engine
    if (!engineKey || seen.has(engineKey)) continue
    seen.add(engineKey)
    const engine = ENGINES[engineKey]
    rows.push(
      `| \`${engine.key}\` | ${list(facts.on.filter((k) => CAPABILITIES[k].engine === engineKey))} | ${ENGINE_MODE_FA[engine.offline]} · \`${engine.offlineStatus}\` |`,
    )
  }
  return rows
}

function memberFiles(sources: Sources, facts: Facts): DocFile[] {
  const r = (text: string) => render(sources, text)
  const family = FAMILIES[facts.family]
  const familyLink = `[خانواده‌ی «${family.title}»](../families/${facts.family}.md)`
  const covering = (Object.entries(REPRESENTATIVES) as [IndustryKey, RepresentativeSpec][]).find(
    ([, spec]) => spec.alsoCovers.includes(facts.id),
  )
  const ownParts = facts.dashboard.filter((part) => !GENERIC_PARTS.has(part))
  const head = (title: string, file: string) => [
    `# ${facts.labels.fa} — ${title}`,
    '',
    GENERATED,
    '',
    `این صنف سند دستی جدا ندارد. این سند از ${familyLink} و از پروفایل همین صنف در کد ساخته شده و چیزی بیش از کد وعده نمی‌دهد.${
      covering
        ? ` نزدیک‌ترین سند دستی: [${covering[0]}/${file}](../${covering[0]}/${file}) — همان مشخصات را می‌خواند.`
        : ''
    }`,
    '',
  ]
  const file = (name: string, lines: string[]): DocFile => ({
    path: `${facts.id}/${name}`,
    content: lines.join('\n'),
  })

  // ── DAILY-WORKFLOW ──
  const daily = [...head('گردش کار روزانه', 'DAILY-WORKFLOW.md')]
  daily.push('## چرخه‌ی تراکنش اصلی', '', ...family.cycle.map((s, i) => `${i + 1}. ${s}`), '')
  for (const workflow of family.workflows) {
    daily.push(`## ${workflow.title}`, '', ...workflow.steps.map((s, i) => `${i + 1}. ${r(s)}`), '')
  }
  const dayDelta: string[] = []
  if (facts.unit !== 'piece') dayDelta.push(`- کالای تازه با واحد \`${facts.unit}\` ساخته می‌شود.`)
  if (facts.emphasized.length)
    dayDelta.push(`- هنگام ثبت کالا این فیلدها جلو هستند: ${list(facts.emphasized)}.`)
  if (facts.invoiceColumns.length)
    dayDelta.push(`- فاکتور این ستون‌ها را از اول نشان می‌دهد: ${list(facts.invoiceColumns)}.`)
  if (facts.dna.unitTracking)
    dayDelta.push(`- ردیابی واحد: \`${facts.dna.unitTracking}\` (از DNA).`)
  daily.push(
    '## آنچه این صنف در روز متفاوت دارد',
    '',
    ...(dayDelta.length ? dayDelta : [`- ${SAME_AS_FAMILY(family.title)}`]),
    '',
  )

  // ── PAGE-BY-PAGE-UX ──
  const pages = [...head('صفحه‌به‌صفحه', 'PAGE-BY-PAGE-UX.md')]
  pages.push(
    '## صفحه‌های این صنف',
    '',
    '| نشانی | این صنف آنجا چه می‌خواند | پنهان در منوی پیشنهادی؟ |',
    '| --- | --- | --- |',
  )
  for (const page of family.pages) {
    checkRoute(sources, page.route)
    const base = String(page.route.split('?')[0])
    pages.push(
      `| \`${page.route}\` | ${r(page.use)} | ${facts.hiddenPaths.includes(base) ? 'بله — با آچار برمی‌گردد' : 'خیر'} |`,
    )
  }
  pages.push('')
  pages.push('## تفاوت صفحه‌ها برای این صنف (از پروفایل)', '')
  const pageDelta: string[] = []
  if (ownParts.length)
    pageDelta.push(
      `- **داشبورد**: قطعه‌ی اختصاصی ${list(ownParts)}؛ ترتیب کامل: ${list(facts.dashboard)}.`,
    )
  else pageDelta.push(`- **داشبورد**: فقط قطعه‌های مشترک — ${list(facts.dashboard)}.`)
  if (facts.emphasized.length || facts.unit !== 'piece')
    pageDelta.push(
      `- **فرم کالا** (\`/warehouse\`): واحد پیش‌فرض \`${facts.unit}\`؛ فیلدهای جلو: ${list(facts.emphasized)}.`,
    )
  if (facts.invoiceColumns.length)
    pageDelta.push(`- **فاکتورساز** (\`/invoices\`): ستون‌های اضافه ${list(facts.invoiceColumns)}.`)
  if (facts.hiddenPaths.length)
    pageDelta.push(
      `- **منو**: منوی پیشنهادی از DNA این نشانی‌ها را پنهان می‌کند: ${list(facts.hiddenPaths)}. پنهان‌کردن، قاعده‌ی حسابداری یا ممیزی را برنمی‌دارد.`,
    )
  pages.push(...pageDelta, '')
  const vocab = vocabularyRows(sources, facts)
  if (vocab.length) {
    pages.push(
      '## واژگان این صنف',
      '',
      '| جا | برچسب | کلید |',
      '| --- | --- | --- |',
      ...vocab,
      '',
    )
  } else {
    pages.push('## واژگان این صنف', '', 'واژه‌ی اختصاصی ندارد؛ برچسب‌های مشترک.', '')
  }
  pages.push(
    '## چیدمان، اقدام‌ها و حالت‌ها',
    '',
    'چیدمان از بالا به پایین، اقدام‌های هر صفحه و ده حالت (خالی، عادی، بارگذاری، آفلاین، بی‌اجازه، خطای اعتبارسنجی، داده‌ی ناقص، تعارض، تکمیل، بایگانی) برای همه‌ی صنف‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). زیر ۷۶۸px جدول‌ها کارت می‌شوند؛ ویندوز و اندروید همان صفحه را از `packages/app-shell` نشان می‌دهند.',
    '',
  )

  // ── OPERATIONS-AND-TRANSACTIONS ──
  const operations = [...head('عملیات و تراکنش', 'OPERATIONS-AND-TRANSACTIONS.md')]
  operations.push(
    '## قواعد حسابداری خانواده',
    '',
    ...family.accounting.map((rule) => `- ${r(rule)}`),
    '',
  )
  const engines = engineRows(facts)
  operations.push('## موتورهای اختصاصی که این صنف روشن می‌کند', '')
  if (engines.length) {
    operations.push('| موتور | قابلیت‌ها | آفلاین |', '| --- | --- | --- |', ...engines, '')
  } else {
    operations.push('هیچ — فاکتور، پرداخت، انبار و دفتر کل مشترک.', '')
  }
  operations.push(
    '## DNA عملیاتی',
    '',
    `- عرضه: ${list(facts.dna.offering)} · دریافت سفارش: ${list(facts.dna.intake)} · انبار: ${list(facts.dna.inventory)}`,
    `- تسویه: ${list(facts.dna.settlement)} · نیروی کار: ${list(facts.dna.workforce)} · مشتری: ${list(facts.dna.customer)}`,
    '',
  )

  // ── KPI-AND-REPORTS ──
  const kpis = [...head('KPI و گزارش', 'KPI-AND-REPORTS.md')]
  kpis.push('## پنج اولویت خانواده', '', '| چه چیزی | از کجا می‌آید |', '| --- | --- |')
  kpis.push(...family.dashboard.map((row) => `| ${row.what} | ${r(row.source)} |`), '')
  kpis.push('## داشبورد این صنف در کد (به ترتیب)', '', list(facts.dashboard), '')
  kpis.push(
    'شاخصی که منبع ندارد عددی نمی‌گیرد؛ «نامعلوم» صفر نیست. گزارش‌ها همان `/reports` و `/accounting` مشترک‌اند.',
    '',
  )

  // ── ROLES-AND-PERMISSIONS ──
  const roles = [...head('نقش‌ها و دسترسی', 'ROLES-AND-PERMISSIONS.md')]
  roles.push(r(ROLE_NOTE), '')
  roles.push('## بر اساس اندازه', '', r(family.bySize), '')
  roles.push('جدول کامل نقش × مجوز: [ROLE-PERMISSION-MATRIX.md](../ROLE-PERMISSION-MATRIX.md).', '')

  // ── OFFLINE-AND-DEVICE ──
  const offline = [...head('آفلاین و دستگاه', 'OFFLINE-AND-DEVICE.md')]
  offline.push('## موتورهای این صنف', '')
  offline.push(
    ...(engines.length
      ? ['| موتور | قابلیت‌ها | آفلاین |', '| --- | --- | --- |', ...engines]
      : ['موتور اختصاصی ندارد؛ وضعیت آفلاین همان هسته‌ی مشترک است.']),
    '',
  )
  offline.push('## مکان اجرای سه عمل قرارداد', '', '| عمل | امروز |', '| --- | --- |')
  for (const operation of Object.values(DEVICE_OPERATION_BY_ENDPOINT)) {
    offline.push(
      `| \`${operation}\` | ${
        sources.deviceOperationsInUse.has(operation)
          ? '`device` اگر میزبان (ویندوز/اندروید) برای همین کسب‌وکار آماده باشد، وگرنه `server`؛ وب همیشه `server`'
          : 'در قرارداد هست ولی هیچ hook آن را صدا نمی‌زند؛ امروز `server`'
      } |`,
    )
  }
  offline.push(
    '',
    'وضعیت هر endpoint در [OFFLINE-WORKFLOW-MATRIX.md](../OFFLINE-WORKFLOW-MATRIX.md) است (از `OFFLINE_ENDPOINT_MATRIX`، نه نوشته).',
    '',
  )

  // ── GAPS-AND-REQUIREMENTS ──
  const gaps = [...head('شکاف‌ها و نیازمندی‌ها', 'GAPS-AND-REQUIREMENTS.md')]
  gaps.push('| نیاز | وضعیت |', '| --- | --- |')
  if (facts.profileKind === 'generic')
    gaps.push('| تجربه‌ی اختصاصی صنف (پروفایل عمومی است) | `CONFIGURATION_REQUIRED` |')
  for (const key of facts.unsupported) gaps.push(`| \`${key}\` | \`NEW_CAPABILITY_REQUIRED\` |`)
  for (const key of facts.on.filter((k) => CAPABILITIES[k].status === 'partial')) {
    gaps.push(
      `| \`${key}\`: ${list(CAPABILITIES[key].limitations)} | \`EXISTING_BUT_INCOMPLETE\` |`,
    )
  }
  for (const missing of facts.evidence?.missingEvidence ?? []) {
    gaps.push(`| ${EVIDENCE_FA[missing] ?? missing} | \`EXISTING_BUT_INCOMPLETE\` |`)
  }
  gaps.push(
    '',
    'فهرست یکجای کارهای ساخته‌نشده: `docs/architecture/V70-BACKLOG.md`. شکاف‌های مشترک خانواده در سند خانواده آمده است.',
    '',
  )

  return [
    file('DAILY-WORKFLOW.md', daily),
    file('PAGE-BY-PAGE-UX.md', pages),
    file('OPERATIONS-AND-TRANSACTIONS.md', operations),
    file('KPI-AND-REPORTS.md', kpis),
    file('ROLES-AND-PERMISSIONS.md', roles),
    file('OFFLINE-AND-DEVICE.md', offline),
    file('GAPS-AND-REQUIREMENTS.md', gaps),
  ]
}

// ─── The thirteen families ──────────────────────────────────────────────────

function familyDoc(sources: Sources, family: FamilyId, all: readonly Facts[]): DocFile {
  const spec = FAMILIES[family]
  const members = all.filter((facts) => facts.family === family)
  const r = (text: string) => render(sources, text)
  const out = [`# خانواده‌ی ${spec.title} (\`${family}\`)`, '', GENERATED, '']
  out.push('## مدل عملیاتی', '', spec.model, '')
  out.push(
    '## چرخه‌ی تراکنش',
    '',
    spec.cycle.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    '',
  )

  out.push(
    '## صنف‌های این خانواده',
    '',
    '| صنف | پروفایل | archetype | قابلیت‌های روشن | ساخته‌نشده |',
    '| --- | --- | --- | --- | --- |',
  )
  for (const facts of members) {
    out.push(
      `| [${facts.labels.fa}](../${facts.id}/README.md) (\`${facts.id}\`) | \`${facts.profileKind}\` | ${facts.archetype ? `\`${facts.archetype}\`` : '—'} | ${list(facts.on)} | ${list(facts.unsupported)} |`,
    )
  }
  out.push('')

  out.push('## پنج گردش کار', '')
  for (const workflow of spec.workflows) {
    out.push(
      `### ${workflow.title}`,
      '',
      ...workflow.steps.map((step, index) => `${index + 1}. ${r(step)}`),
      '',
    )
  }

  out.push('## پنج اولویت داشبورد', '', '| چه چیزی | از کجا می‌آید |', '| --- | --- |')
  out.push(...spec.dashboard.map((row) => `| ${row.what} | ${r(row.source)} |`), '')

  out.push('## صفحه‌ها', '', '| نشانی | این خانواده آنجا چه می‌خواند |', '| --- | --- |')
  for (const page of spec.pages) {
    checkRoute(sources, page.route)
    out.push(`| \`${page.route}\` | ${r(page.use)} |`)
  }
  out.push(
    '',
    'چیدمان، اقدام‌ها و ده حالت هر صفحه برای همه‌ی خانواده‌ها یکی است: [SHARED-PAGE-CATALOG.md](../SHARED-PAGE-CATALOG.md). موبایل و ویندوز همان صفحه و همان قرارداد را دارند؛ زیر ۷۶۸px جدول‌ها کارت می‌شوند.',
    '',
  )

  out.push('## قواعد حسابداری', '', ...spec.accounting.map((rule) => `- ${r(rule)}`), '')

  const unsupported = [...new Set(members.flatMap((facts) => facts.unsupported))].sort()
  out.push('## شکاف‌های خانواده', '')
  out.push(
    unsupported.length
      ? `قابلیت‌هایی که صنف‌های این خانواده خواسته‌اند و ساخته نشده (\`NEW_CAPABILITY_REQUIRED\`): ${list(unsupported)}.`
      : 'هیچ قابلیت ساخته‌نشده‌ای در رجیستری برای این خانواده ثبت نیست.',
    '',
  )
  out.push('## بر اساس اندازه', '', r(spec.bySize), '')
  return { path: `families/${family}.md`, content: out.join('\n') }
}

// ─── Shared documents ───────────────────────────────────────────────────────

function sharedPageCatalog(sources: Sources): DocFile {
  const fa = sources.messages.fa
  const out = ['# کاتالوگ صفحه‌های مشترک', '', GENERATED, '']
  out.push(
    '## مقصدهای منو',
    '',
    '| نام | نشانی | گروه | قفل ماژول | بسته | وضعیت |',
    '| --- | --- | --- | --- | --- | --- |',
  )
  for (const item of NAV_CONTRACT) {
    const base = String(item.path.split('?')[0])
    out.push(
      `| ${messageAt(fa, item.labelKey) ?? item.labelKey} | \`${item.path}\` | ${item.group} | ${NAV_MODULE[base] ? `\`${NAV_MODULE[base]}\`` : '—'} | \`${packForRoute(base)}\` | ${isPageDisabled(base) ? 'خاموش' : 'فعال'} |`,
    )
  }
  out.push('')

  const menu = new Set(NAV_CONTRACT.map((item) => String(item.path.split('?')[0])))
  const movedFrom = new Map(sources.moved.map(([from, to]) => [from, to]))
  out.push('## همه‌ی نشانی‌های پوسته', '', '| نشانی | چیست |', '| --- | --- |')
  for (const route of [...sources.routes].sort()) {
    const to = movedFrom.get(route)
    const what = to
      ? `نشانی قدیمی → \`${to}\``
      : menu.has(route)
        ? 'مقصد منو'
        : route.includes(':token')
          ? 'صفحه‌ی عمومی با لینک'
          : route.includes('/:') || route.endsWith('/new') || route.endsWith('/preview')
            ? 'صفحه‌ی جزئیات یا ساخت'
            : 'صفحه'
    out.push(`| \`${route}\` | ${what} |`)
  }
  out.push('')
  out.push(
    `نشانی‌های قدیمی که به تب یا بخش یک هاب رفته‌اند: ${sources.moved.length} جفت (\`apps/web/next.config.js\` و همان‌ها در پوسته).`,
    '',
  )

  out.push('## ده حالت هر صفحه', '', '| حالت | قاعده |', '| --- | --- |')
  out.push(...PAGE_STATES.map((row) => `| ${row.state} | ${row.rule} |`), '')
  out.push(
    '## آنچه در این فهرست نیست',
    '',
    'صفحه‌ای که اینجا نیامده وجود ندارد. نیازی که صفحه ندارد در سند خانواده یا صنف با `NEW_CAPABILITY_REQUIRED` یا `NOT_SUPPORTED` آمده و صفحه‌ای برایش ساخته نشده است.',
    '',
  )
  return { path: 'SHARED-PAGE-CATALOG.md', content: out.join('\n') }
}

function capabilityMatrix(sources: Sources, all: readonly Facts[]): DocFile {
  const out = ['# ماتریس قابلیت‌ها', '', GENERATED, '']
  out.push(
    '| قابلیت | وضعیت رجیستری | برچسب | موتور | آفلاین موتور | صنف‌هایی که روشنش دارند |',
    '| --- | --- | --- | --- | --- | --- |',
  )
  for (const key of Object.keys(CAPABILITIES) as CapabilityKey[]) {
    const definition = CAPABILITIES[key]
    const engine = definition.engine ? ENGINES[definition.engine] : null
    const users = all.filter((facts) => facts.on.includes(key)).map((facts) => facts.id)
    out.push(
      `| \`${key}\` | ${definition.status} | \`${capabilityLabel(sources, key).label}\` | ${engine ? `\`${engine.key}\`` : '—'} | ${engine ? engine.offlineStatus : '—'} | ${users.length ? users.length : '۰'} |`,
    )
  }
  out.push(
    '',
    '`EXISTING_AND_VERIFIED` فقط وقتی است که رجیستری یک فایل تست نام برده و آن فایل واقعاً هست.',
    '',
  )
  return { path: 'SHARED-CAPABILITY-MATRIX.md', content: out.join('\n') }
}

function roleMatrix(sources: Sources): DocFile {
  const roles = (Object.keys(ROLE_RANK) as (keyof typeof ROLE_RANK)[]).sort(
    (a, b) => ROLE_RANK[b] - ROLE_RANK[a],
  )
  const capabilities: Capability[] = [
    'record.read',
    'record.create',
    'record.update',
    'record.delete',
    'member.invite',
    'workspace.manage',
  ]
  const out = ['# ماتریس نقش × مجوز', '', GENERATED, '']
  out.push(
    `| مجوز | ${roles.map((role) => `\`${role}\``).join(' | ')} |`,
    `| --- | ${roles.map(() => '---').join(' | ')} |`,
  )
  for (const capability of capabilities) {
    out.push(
      `| \`${capability}\` | ${roles.map((role) => (can(role, capability) ? '✓' : '—')).join(' | ')} |`,
    )
  }
  out.push(
    '',
    'این جدول نقش‌های پایه‌ی دستگاه است (`packages/auth-core`).',
    '',
    render(sources, ROLE_NOTE),
    '',
  )
  out.push(
    'نقش را همیشه سرور از عضویت می‌خواند؛ آنچه به مرورگر رسیده فقط برای نمایش است. دسترسی انبار همان دسترسی شعبه است.',
    '',
  )
  return { path: 'ROLE-PERMISSION-MATRIX.md', content: out.join('\n') }
}

function offlineMatrix(): DocFile {
  const byFeature = new Map<
    string,
    { available: number; online_required: number; not_supported: number }
  >()
  for (const [feature, status] of Object.values(OFFLINE_ENDPOINT_MATRIX)) {
    const row = byFeature.get(feature) ?? { available: 0, online_required: 0, not_supported: 0 }
    row[status] += 1
    byFeature.set(feature, row)
  }
  const total = Object.keys(OFFLINE_ENDPOINT_MATRIX).length
  const count = (status: string) =>
    Object.values(OFFLINE_ENDPOINT_MATRIX).filter((row) => row[1] === status).length
  const out = ['# ماتریس آفلاین', '', GENERATED, '']
  out.push(
    `${total} endpoint: ${count('available')} آفلاین در دسترس · ${count('online_required')} فقط آنلاین · ${count('not_supported')} در نسخه‌ی آفلاین نیست.`,
    '',
  )
  out.push('| قابلیت | در دسترس | فقط آنلاین | نیست |', '| --- | ---: | ---: | ---: |')
  for (const [feature, row] of [...byFeature].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(
      `| \`${feature}\` | ${row.available} | ${row.online_required} | ${row.not_supported} |`,
    )
  }
  out.push(
    '',
    'منبع: `packages/validation/src/schemas/offline-endpoint-matrix.ts`. صفحه فقط از `useActionAvailability` / `<OfflineGate>` می‌پرسد.',
    '',
  )
  return { path: 'OFFLINE-WORKFLOW-MATRIX.md', content: out.join('\n') }
}

function crossPlatform(sources: Sources): DocFile {
  const out = ['# ماتریس سه پلتفرم', '', GENERATED, '']
  out.push('| نشانی | صفحه‌ی وب | پوسته (ویندوز و اندروید) | بسته |', '| --- | --- | --- | --- |')
  for (const item of NAV_CONTRACT) {
    const base = String(item.path.split('?')[0])
    const web = exists(sources, `apps/web/app/[lang]/(dashboard)${base}/page.tsx`)
    out.push(
      `| \`${base}\` | ${web ? '✓' : '—'} | ${sources.routes.has(base) ? '✓' : '—'} | \`${packForRoute(base)}\` |`,
    )
  }
  out.push(
    '',
    'ویندوز و اندروید یک پوسته را نشان می‌دهند (`packages/app-shell`) و هر سه همان کامپوننت‌های `packages/ui` را. تفاوت پلتفرم‌ها در چیدمان است، نه در قرارداد.',
    '',
  )
  out.push(
    '## بسته‌های دانلودپذیر',
    '',
    '| بسته | نشانی‌ها | جدول‌های همگام‌سازی | وابسته به |',
    '| --- | --- | --- | --- |',
  )
  for (const [id, pack] of Object.entries(FEATURE_PACKS)) {
    out.push(
      `| \`${id}\` | ${pack.routes.length} | ${list(pack.syncEntities)} | ${list(pack.dependsOn)} |`,
    )
  }
  out.push('')
  return { path: 'CROSS-PLATFORM-MATRIX.md', content: out.join('\n') }
}

function stateModel(): DocFile {
  const out = ['# مدل وضعیت‌ها', '', GENERATED, '']
  out.push('## جلسه‌ی خدمت (نوبت)', '', '| از | به |', '| --- | --- |')
  for (const from of SERVICE_DELIVERY_STATUSES) {
    const to = SERVICE_DELIVERY_STATUSES.filter(
      (next) => next !== from && isValidSessionStatusTransition(from, next),
    )
    out.push(`| \`${from}\` | ${to.length ? list(to) : 'پایانی'} |`)
  }
  out.push('', 'منبع: `isValidSessionStatusTransition` در `service-delivery.domain.ts`.', '')
  out.push('## پرونده‌ی تعمیر', '', '| از | به |', '| --- | --- |')
  for (const from of REPAIR_STATUSES)
    out.push(`| \`${from}\` | ${REPAIR_MOVES[from].length ? list(REPAIR_MOVES[from]) : 'پایانی'} |`)
  out.push('', 'منبع: `REPAIR_MOVES` در `repair-tickets.ts`.', '')
  out.push(
    '## حقوق',
    '',
    `- \`paid\` نهایی است: ${isPayrollFinal('paid') ? 'بله' : 'نه'} · \`draft\` نهایی است: ${isPayrollFinal('draft') ? 'بله' : 'نه'}.`,
    '- منبع: `isPayrollFinal`. «پرداخت نشد» دلیل می‌خواهد.',
    '',
  )
  out.push(
    '## فاکتور',
    '',
    '- `pending` یعنی «پرداخت‌نشده»، نه «در انتظار تأیید».',
    '- حذف و لغو از `reverseEffects` رد می‌شود: دفتر، پرداخت‌های خود فاکتور، انبار، بها.',
    '- فاکتوری که روی دستگاه ثبت شده تا جواب سرور شماره‌ی موقت `OFF-…` دارد.',
    '',
  )
  return { path: 'WORKFLOW-STATE-MODEL.md', content: out.join('\n') }
}

function acceptance(sources: Sources, all: readonly Facts[]): DocFile {
  const out = ['# معیارهای پذیرش', '', GENERATED, '']
  out.push(
    `یک فهرست، نه دو تا: همان ده معیاری که \`scripts/industry/sellable-criteria.mjs\` می‌سنجد. شواهد روی commit \`${sources.evidenceCommit.slice(0, 7)}\`.`,
    '',
  )
  out.push('| معیار | چه چیزی | صنف‌هایی که دارند |', '| --- | --- | ---: |')
  out.push(
    ...sources.criteria.map(
      (row) => `| \`${row.code}\` | ${row.title} | ${row.industriesMeeting} از ${all.length} |`,
    ),
    '',
  )
  const count = (label: StatusLabel) =>
    all.filter((facts) => experienceLabel(sources, facts) === label).length
  out.push('## تجربه‌ی اختصاصی صنف', '', '| برچسب | تعداد صنف |', '| --- | ---: |')
  for (const label of STATUS_LABELS) out.push(`| \`${label}\` | ${count(label)} |`)
  out.push(
    '',
    'سفر پایه برای همه سنجیده شده؛ «تجربه‌ی اختصاصی» چیز دیگری است و برای پروفایل عمومی `CONFIGURATION_REQUIRED` است.',
    '',
  )
  return { path: 'ACCEPTANCE-CRITERIA.md', content: out.join('\n') }
}

function index(all: readonly Facts[]): DocFile {
  const out = ['# صنف‌های حسابچه — نقشه', '', GENERATED, '']
  out.push(
    `${all.length} شناسه در ${FAMILY_IDS.length} خانواده. هر صنف یک README دارد؛ چهار صنف نماینده هشت فایل کامل دارند.`,
    '',
  )
  out.push('## سندهای مشترک', '')
  for (const file of [
    'INDUSTRY-REGISTRY.md',
    'SHARED-PAGE-CATALOG.md',
    'SHARED-CAPABILITY-MATRIX.md',
    'ROLE-PERMISSION-MATRIX.md',
    'OFFLINE-WORKFLOW-MATRIX.md',
    'CROSS-PLATFORM-MATRIX.md',
    'WORKFLOW-STATE-MODEL.md',
    'ACCEPTANCE-CRITERIA.md',
  ]) {
    out.push(`- [${file}](./${file})`)
  }
  out.push('', '## خانواده‌ها و صنف‌ها', '')
  for (const family of FAMILY_IDS) {
    const members = all.filter((facts) => facts.family === family)
    out.push(`### [${FAMILIES[family].title}](./families/${family}.md) — ${members.length}`, '')
    out.push(
      members
        .map(
          (facts) =>
            `[${facts.labels.fa}](./${facts.id}/README.md)${REPRESENTATIVES[facts.id] ? ' ★' : ''}`,
        )
        .join(' · '),
      '',
    )
  }
  out.push('★ = سند کامل هشت‌فایلی.', '')
  return { path: 'README.md', content: out.join('\n') }
}

// ─── Everything ─────────────────────────────────────────────────────────────

export function buildIndustryDocs(root: string): DocFile[] {
  const sources = loadSources(root)
  const all = INDUSTRY_KEYS.map((id) => factsOf(sources, id))
  const files: DocFile[] = [
    index(all),
    sharedPageCatalog(sources),
    capabilityMatrix(sources, all),
    roleMatrix(sources),
    offlineMatrix(),
    crossPlatform(sources),
    stateModel(),
    acceptance(sources, all),
  ]
  for (const family of FAMILY_IDS) files.push(familyDoc(sources, family, all))
  for (const facts of all) {
    files.push({ path: `${facts.id}/README.md`, content: readme(sources, facts) })
    const spec = REPRESENTATIVES[facts.id]
    files.push(...(spec ? representativeFiles(sources, facts, spec) : memberFiles(sources, facts)))
  }
  return files.map((file) => ({ path: file.path, content: `${file.content.trimEnd()}\n` }))
}

export { DASHBOARD_PART_IDS }
