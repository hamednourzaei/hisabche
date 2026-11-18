// ============================================
// scripts/industry/campaign-status.mjs
//
// Read-only reporter for the industry-completion campaign.
//
// It answers the question the campaign is built on, with file evidence:
//   «for every engine and capability the product already owns, which of the five
//    layers (service, server route, local engine, client hook, UI) exist, and
//    which named limitation keeps it `partial`?»
//
// Sources, read only:
//   docs/architecture/universal-core/ENGINE-WIRING.csv   engine/capability → wiring → limitation
//   docs/industries/SHARED-CAPABILITY-MATRIX.md           53 product capabilities
//   docs/industries/INDUSTRY-REGISTRY.md                 67 industries and their capabilities
//   docs/architecture/industry/sellable-industries.json   measured 10-criteria state
//   scripts/industry/coverage-data.mjs                   capability → code anchor + tests
//
// Outputs (generated; never edit by hand):
//   docs/campaigns/ENGINE-WIRING-STATUS.md
//   docs/campaigns/CAPABILITY-RECONCILIATION.md
//   docs/campaigns/INDUSTRY-MATRIX.md
//
// Run:   node scripts/industry/campaign-status.mjs
// Check: node scripts/industry/campaign-status.mjs --check   (no writes; exit 1 on drift)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { CAPABILITIES, EVIDENCE, TESTS } from './coverage-data.mjs'

const ROOT = process.cwd()
const CHECK_ONLY = process.argv.includes('--check')
const OUT_DIR = path.join(ROOT, 'docs', 'campaigns')

/**
 * The commit this report describes. Every acceptance number must be tied to a
 * commit: `git` on PATH is a Windows shim that silently no-ops, so it is spawned
 * by absolute executable lookup (AGENTS.md §7).
 */
const CURRENT_HEAD = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
})()

// ---------------------------------------------------------------
// 1. Phases. A phase is a gate, not a date.
// ---------------------------------------------------------------
const PHASES = [
  ['C0', 'شاهد و تطبیق (evidence and reconciliation)'],
  ['C1', 'سخت‌سازی موتورهای موجود (existing engines → complete)'],
  ['C2', 'تکمیل گردش‌کار عمودی (vertical workflows)'],
  ['C3', 'دامنه‌های مشترک جدید (new shared domains)'],
  ['C4', 'سیم‌کشی صنف (industry wiring)'],
  ['C5', 'پذیرش و شاهد (acceptance and evidence)'],
  ['C6', 'پایلوت واقعی (real-customer pilot)'],
  ['C7', 'گسترش و کنترل انحراف (expansion and drift control)'],
]
const PHASE_INDEX = new Map(PHASES.map(([id], index) => [id, index]))

// ---------------------------------------------------------------
// 2. Work packages: one per engine change, never one per industry.
//    `capabilities` are keys of SHARED-CAPABILITY-MATRIX and of the
//    capability rows in ENGINE-WIRING.csv.
// ---------------------------------------------------------------
const WORK_PACKAGES = [
  {
    id: 'WP-01',
    phase: 'C1',
    title: 'واریانت تا SKU و لایه هزینه',
    capabilities: ['variants'],
    coverage: ['variants', 'variantGrid'],
  },
  {
    id: 'WP-02',
    phase: 'C1',
    title: 'سریال، گارانتی و رهگیری دستگاه',
    capabilities: ['serialized_items', 'warranty_claims'],
    coverage: ['serials', 'warranty'],
  },
  {
    id: 'WP-03',
    phase: 'C1',
    title: 'واحد، تبدیل و قیمت‌گذاری اندازه',
    capabilities: [
      'measurement',
      'weight_pricing',
      'length_pricing',
      'area_pricing',
      'volume_pricing',
      'multi_unit',
      'fuel_tank_reconciliation',
    ],
    coverage: ['unitConversion', 'weightPricing', 'lengthPricing', 'areaPricing', 'dualUom'],
  },
  {
    id: 'WP-04',
    phase: 'C1',
    title: 'رول: برش، باقی‌مانده، ضایعات و مسیر سرور',
    capabilities: ['roll_cutting'],
    coverage: ['rollTracking'],
  },
  {
    id: 'WP-05',
    phase: 'C1',
    title: 'بچ: FEFO، بازگردانی برگشت و قرنطینه',
    capabilities: ['batch_expiry'],
    coverage: ['batchExpiry'],
  },
  {
    id: 'WP-06',
    phase: 'C1',
    title: 'طلا: عیار و اجرت روی ردیف فاکتور',
    capabilities: ['gold_purity', 'making_charges', 'gold_trade'],
    coverage: ['goldPurity', 'makingCharges', 'oldGold'],
  },
  {
    id: 'WP-07',
    phase: 'C1',
    title: 'صرافی: موتور رسمی، موقعیت ارزی و کنترل صندوق',
    capabilities: ['currency_exchange'],
    coverage: [],
  },
  {
    id: 'WP-08',
    phase: 'C1',
    title: 'قیمت‌گذاری پله‌ای و لیست قیمت',
    capabilities: ['tiered_pricing'],
    coverage: ['priceLists'],
  },
  {
    id: 'WP-09',
    phase: 'C2',
    title: 'تولید: BOM نسخه‌دار و بهای تمام‌شده واقعی',
    capabilities: ['recipe_bom', 'cost_allocation', 'production_batch', 'print_job'],
    coverage: ['manufacturing'],
  },
  {
    id: 'WP-10',
    phase: 'C2',
    title: 'میز، سالن و KDS روی سفارش مشترک',
    capabilities: ['table_service'],
    coverage: [],
  },
  {
    id: 'WP-11',
    phase: 'C2',
    title: 'ظرفیت منابع و قفل هم‌زمانی رزرو',
    capabilities: ['resource_capacity'],
    coverage: ['appointments'],
  },
  {
    id: 'WP-12',
    phase: 'C2',
    title: 'صف کار، SLA و کنترل کیفیت',
    capabilities: ['work_queue_sla', 'quality_inspection'],
    coverage: [],
  },
  {
    id: 'WP-13',
    phase: 'C2',
    title: 'سفارش فروش، بیعانه و اقساط به‌عنوان تعهد',
    capabilities: ['sales_orders', 'deposits_liability', 'installments'],
    coverage: ['depositOrders', 'installments', 'madeToOrder'],
  },
  {
    id: 'WP-14',
    phase: 'C3',
    title: 'تدارکات: برنامه‌ریزی و تطبیق سه‌طرفه',
    capabilities: ['procurement_planning', 'three_way_match'],
    coverage: [],
  },
  {
    id: 'WP-15',
    phase: 'C2',
    title: 'پروژه، زمان‌سنجی و صورتحساب مرحله‌ای',
    capabilities: ['project_costing', 'timesheet_billing'],
    coverage: ['timesheetBilling'],
  },
  {
    id: 'WP-16',
    phase: 'C3',
    title: 'سازگاری قطعات، واحد خودرو و مغزی',
    capabilities: ['auto_fitments'],
    coverage: ['crossReference', 'vehicleUnit', 'coreCharge', 'reconditioning'],
  },
  {
    id: 'WP-17',
    phase: 'C3',
    title: 'قرارداد تکرارشونده و صورتحساب دوره‌ای',
    capabilities: ['contracts_recurring'],
    coverage: [],
  },
  {
    id: 'WP-18',
    phase: 'C2',
    title: 'اعتبار جلسه و بسته خدمات، با مسیر آفلاین',
    capabilities: ['package_credits'],
    coverage: [],
  },
  {
    id: 'WP-19',
    phase: 'C2',
    title: 'ناوگان، ارسال، مدرک تحویل و COD',
    capabilities: ['delivery_pod', 'fleet_dispatch'],
    coverage: ['dispatchPod', 'fleetAssets', 'trips', 'codReconciliation', 'seatTicketing'],
  },
  {
    id: 'WP-20',
    phase: 'C3',
    title: 'اجاره دارایی و شب‌های اقامت',
    capabilities: ['asset_rental', 'room_nights'],
    coverage: [],
  },
  {
    id: 'WP-21',
    phase: 'C3',
    title: 'گردش تأیید و Audit تصمیم',
    capabilities: ['approval_workflow'],
    coverage: [],
  },
  {
    id: 'WP-22',
    phase: 'C3',
    title: 'پیش‌بینی مالک و هشدار نقدینگی',
    capabilities: ['owner_forecast'],
    coverage: [],
  },
  {
    id: 'WP-23',
    phase: 'C3',
    title: 'کشاورزی، زمین، دام و چرخه کشت',
    capabilities: ['livestock_register', 'crop_cycle'],
    coverage: ['agriLand', 'livestock'],
  },
  {
    id: 'WP-24',
    phase: 'C3',
    title: 'نسخه چشم و سفارش عدسی (اصلاح رجیستری + دامنه مشترک)',
    capabilities: ['optical_prescription', 'lens_order'],
    coverage: [],
  },
  {
    id: 'WP-25',
    phase: 'C3',
    title: 'نسخه دارو و پوشش بیمه (اصلاح رجیستری + دامنه مشترک)',
    capabilities: ['pharmacy_prescription', 'pharmacy_dispensing', 'insurance_claims'],
    coverage: [],
  },
  {
    id: 'WP-26',
    phase: 'C0',
    title: 'اصلاح رجیستری و تخصیص قابلیت به ۶۷ صنف',
    capabilities: [],
    coverage: [],
  },
  {
    id: 'WP-27',
    phase: 'C2',
    title: 'خدمات آیتم‌محور: رهگیری تک‌به‌تک لباس (خشکشویی)',
    capabilities: ['laundry_item_tracking'],
    coverage: [],
  },
  {
    id: 'WP-28',
    phase: 'C3',
    title: 'پرونده بالینی و دسترسی به داده سلامت (کلینیک)',
    capabilities: ['clinical_record', 'health_data_access'],
    coverage: [],
  },
  {
    id: 'WP-29',
    phase: 'C3',
    title: 'رزرو سفر و تسویه تأمین‌کننده (آژانس مسافرتی)',
    capabilities: ['travel_booking', 'supplier_settlement'],
    coverage: [],
  },
]

const CAPABILITY_TO_WP = new Map()
for (const workPackage of WORK_PACKAGES) {
  for (const capability of workPackage.capabilities) {
    if (CAPABILITY_TO_WP.has(capability)) {
      throw new Error(`${capability} is claimed by two work packages`)
    }
    CAPABILITY_TO_WP.set(capability, workPackage)
  }
}
const CAPABILITY_COVERAGE = new Map(
  WORK_PACKAGES.flatMap((workPackage) =>
    workPackage.capabilities.map((capability) => [capability, workPackage.coverage]),
  ),
)

// ---------------------------------------------------------------
// 3. Read the measured inputs.
// ---------------------------------------------------------------
const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8')

/** Minimal CSV reader: this file only uses double-quote quoting and commas. */
const parseCsv = (text) => {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const WIRING = parseCsv(read('docs/architecture/universal-core/ENGINE-WIRING.csv'))
const WIRING_HEAD = WIRING[0]
const WIRING_ROWS = WIRING.slice(1)
  .filter((row) => row.length === WIRING_HEAD.length)
  .map((row) => {
    const record = {}
    WIRING_HEAD.forEach((column, index) => (record[column] = row[index]))
    return record
  })
const ENGINE_ROWS = WIRING_ROWS.filter((row) => row.row_type === 'engine')
const CAPABILITY_WIRING = new Map(
  WIRING_ROWS.filter((row) => row.row_type === 'capability').map((row) => [row.key, row]),
)
if (ENGINE_ROWS.length === 0 || CAPABILITY_WIRING.size === 0) {
  throw new Error('ENGINE-WIRING.csv has no engine/capability rows')
}

const MATRIX_STATUS = new Map()
for (const line of read('docs/industries/SHARED-CAPABILITY-MATRIX.md').split('\n')) {
  if (!line.startsWith('| `')) continue
  const cells = line.split('|').map((cell) => cell.trim())
  MATRIX_STATUS.set(cells[1].replace(/`/g, ''), cells[2])
}
if (MATRIX_STATUS.size === 0) throw new Error('shared capability matrix parsed as empty')

/** `available: a, b · partial: c · planned: d` → three lists (capabilities and requirements). */
const parseBuckets = (cellText) => {
  const buckets = { available: [], partial: [], planned: [] }
  for (const part of (cellText ?? '').split('·')) {
    const separator = part.indexOf(':')
    if (separator < 0) continue
    const bucket = part.slice(0, separator).trim().toLowerCase()
    if (!buckets[bucket]) continue
    for (const value of part.slice(separator + 1).split(',')) {
      const clean = value.trim().replace(/`/g, '')
      if (clean) buckets[bucket].push(clean)
    }
  }
  return buckets
}

const REGISTRY = []
for (const line of read('docs/industries/INDUSTRY-REGISTRY.md').split('\n')) {
  if (!/^\|\s*\d+\s*\|/.test(line)) continue
  const cells = line.split('|').map((cell) => cell.trim())
  const id = cells[2]?.replace(/`/g, '')
  if (!id) continue
  REGISTRY.push({
    id,
    archetype: (cells[5] ?? '').replace(/`/g, ''),
    capabilities: parseBuckets(cells[7]),
    // The requirement column is implementation-independent: it is what the
    // trade needs, including capabilities the registry can only mark `planned`.
    requirements: parseBuckets(cells[8]),
  })
}
if (REGISTRY.length !== 67) throw new Error(`registry parsed ${REGISTRY.length} rows, expected 67`)

/** Does this industry ask for the capability — as an ON feature or as a requirement? */
const needs = (industry, capability) =>
  ['capabilities', 'requirements'].some((column) =>
    ['available', 'partial', 'planned'].some((bucket) =>
      industry[column][bucket].includes(capability),
    ),
  )

const SELLABLE = JSON.parse(read('docs/architecture/industry/sellable-industries.json'))
const SELLABLE_BY_KEY = new Map(SELLABLE.industries.map((row) => [row.key, row]))

// ---------------------------------------------------------------
// 4. Coverage anchors: a capability counts as evidenced only if file + needle exist.
// ---------------------------------------------------------------
const textCache = new Map()
const fileText = (relative) => {
  if (!textCache.has(relative)) {
    const absolute = path.join(ROOT, relative)
    textCache.set(relative, existsSync(absolute) ? readFileSync(absolute, 'utf8') : null)
  }
  return textCache.get(relative)
}

const COVERAGE = new Map()
for (const [capability, entry] of Object.entries(CAPABILITIES)) {
  const anchors = (entry.evidence ?? []).map((id) => {
    const anchor = EVIDENCE[id]
    if (!anchor) return { id, state: 'UNDECLARED' }
    const text = fileText(anchor.file)
    if (text === null) return { id, state: 'FILE_MISSING', file: anchor.file }
    return text.includes(anchor.needle)
      ? { id, state: 'OK', file: anchor.file }
      : { id, state: 'NEEDLE_MISSING', file: anchor.file }
  })
  const tests = (entry.tests ?? []).map((id) => {
    const file = TESTS[id]
    if (!file) return { id, state: 'UNDECLARED' }
    return { id, state: existsSync(path.join(ROOT, file)) ? 'OK' : 'FILE_MISSING', file }
  })
  COVERAGE.set(capability, {
    status: entry.status,
    anchors,
    tests,
    unhealthy: [...anchors, ...tests].filter((item) => item.state !== 'OK'),
  })
}

// ---------------------------------------------------------------
// 5. Per-engine wiring (the 20 engine rows).
// ---------------------------------------------------------------
const present = (record, field) => record[field] === 'true'
// The generator writes the COUNT in `backend_route_files` and the semicolon-joined
// FILE LIST in `backend_routes_registered` (scripts/capability/wiring-matrix.mjs:299).
const routeCount = (record) => Number(record.backend_route_files || 0)

const engineRows = ENGINE_ROWS.map((record) => {
  const gaps = []
  if (!present(record, 'service_present')) gaps.push('service')
  if (routeCount(record) === 0) gaps.push('route')
  if (!present(record, 'local_engine_present')) gaps.push('local')
  if (!present(record, 'client_hook_present')) gaps.push('hook')
  if (!present(record, 'ui_host_present')) gaps.push('ui')
  return {
    key: record.key,
    pack: record.pack || '—',
    structure: record.engine_structure || '—',
    status: record.status,
    routes: routeCount(record),
    local: present(record, 'local_engine_present'),
    hook: present(record, 'client_hook_present'),
    ui: present(record, 'ui_host_present'),
    gaps,
  }
})

const engineStatusCounts = {}
const engineGapCounts = { service: 0, route: 0, local: 0, hook: 0, ui: 0 }
for (const row of engineRows) {
  engineStatusCounts[row.status] = (engineStatusCounts[row.status] ?? 0) + 1
  for (const gap of row.gaps) engineGapCounts[gap] += 1
}

// ---------------------------------------------------------------
// 6. Per-capability reconciliation (the 38 capability rows).
// ---------------------------------------------------------------
const capabilityRows = [...MATRIX_STATUS.entries()].map(([capability, matrixStatus]) => {
  const workPackage = CAPABILITY_TO_WP.get(capability)
  if (!workPackage) throw new Error(`shared capability ${capability} has no work package`)
  const wiring = CAPABILITY_WIRING.get(capability)
  if (!wiring) throw new Error(`capability ${capability} is missing from ENGINE-WIRING.csv`)

  const limitations = (wiring.limitations || '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
  // A capability inherits its engine's wiring. `route` therefore comes from the
  // engine row: the per-capability route count only lists routes that reference
  // this capability's evidence anchors, which is a narrower question.
  const owningEngine = ENGINE_ROWS.find((row) => row.key === wiring.engine)
  const layers = {
    service: present(wiring, 'service_present'),
    route: owningEngine ? routeCount(owningEngine) > 0 : false,
    local: present(wiring, 'local_engine_present'),
    hook: present(wiring, 'client_hook_present'),
    ui: present(wiring, 'ui_host_present'),
  }
  const missingLayers = Object.entries(layers)
    .filter(([, ok]) => !ok)
    .map(([layer]) => layer)

  // OWN evidence: the files the registry names for THIS capability. Only presence
  // is measured — a file on disk is not a working flow (that is C5's job).
  const evidenceFiles = Number(wiring.evidence_files || 0)
  const evidencePresent = Number(wiring.evidence_present || 0)
  const evidence =
    evidenceFiles > 0 && evidencePresent === evidenceFiles ? 'FILE_PRESENT' : 'FILE_MISSING'

  // Shared package anchors answer a wider question and are reported separately;
  // they never decide the capability's verdict.
  const coverageCodes = CAPABILITY_COVERAGE.get(capability) ?? []

  // The requirement, not the current ON list, decides who is affected: a trade
  // that asks for a capability the registry never derived still needs it.
  const affected = REGISTRY.filter((industry) => needs(industry, capability)).length
  const blocked = matrixStatus === 'available' ? 0 : affected
  const unmappedEngine = wiring.engine ? 0 : affected

  let verdict
  if (wiring.status === 'planned' || !wiring.engine) verdict = 'NO_ENGINE'
  else if (evidence === 'FILE_MISSING') verdict = 'EVIDENCE_MISSING'
  else if (missingLayers.length > 0) verdict = 'UNWIRED'
  else if (wiring.status === 'available' && matrixStatus === 'available') verdict = 'WIRED'
  else if (wiring.status === 'available' && matrixStatus !== 'available') verdict = 'MATRIX_STALE'
  else if (wiring.status !== 'available' && matrixStatus === 'available') verdict = 'MATRIX_AHEAD'
  else if (limitations.length > 0) verdict = 'LIMITATION_NAMED'
  else verdict = 'PARTIAL_UNNAMED'

  return {
    capability,
    matrixStatus,
    engine: wiring.engine || '—',
    engineStructure: wiring.engine_structure || '—',
    engineStatus: wiring.status,
    missingLayers,
    limitations,
    evidence,
    evidencePresent,
    evidenceFiles,
    sharedEvidence: coverageCodes.map(
      (codeKey) => `${codeKey}:${COVERAGE.get(codeKey)?.status ?? 'UNDECLARED'}`,
    ),
    affected,
    blocked,
    unmappedEngine,
    workPackage: workPackage.id,
    phase: workPackage.phase,
    verdict,
  }
})

const verdictCounts = {}
for (const row of capabilityRows) verdictCounts[row.verdict] = (verdictCounts[row.verdict] ?? 0) + 1

const workPackageLoad = new Map()
for (const row of capabilityRows) {
  workPackageLoad.set(row.workPackage, (workPackageLoad.get(row.workPackage) ?? 0) + row.blocked)
}

// ---------------------------------------------------------------
// 7. Per-industry view.
// ---------------------------------------------------------------
// An acceptance number is only evidence for the commit it was recorded on.
const staleReasons = []
if (SELLABLE.evidenceFresh !== true) staleReasons.push('evidenceFresh=false')
if (SELLABLE.acceptanceWorktreeDirty === true) staleReasons.push('worktree dirty')
if (CURRENT_HEAD && SELLABLE.acceptanceCommit !== CURRENT_HEAD) {
  staleReasons.push(
    `acceptance ${String(SELLABLE.acceptanceCommit).slice(0, 7)} ≠ HEAD ${CURRENT_HEAD.slice(0, 7)}`,
  )
}
const EVIDENCE_STALE = staleReasons.length > 0

const industryRows = REGISTRY.map((industry) => {
  const sellable = SELLABLE_BY_KEY.get(industry.id)
  const required = [
    ...new Set(
      ['capabilities', 'requirements'].flatMap((column) =>
        ['available', 'partial', 'planned'].flatMap((bucket) => industry[column][bucket]),
      ),
    ),
  ]
  // «No blocker in the registry» is not «ready»: a requirement the registry never
  // derived is still unmet and still blocks the trade.
  const unmet = required.filter((capability) => MATRIX_STATUS.get(capability) !== 'available')
  const blockers = unmet.filter((capability) => CAPABILITY_TO_WP.has(capability))
  const unmapped = unmet.filter((capability) => !CAPABILITY_TO_WP.has(capability))
  const packages = [...new Set(blockers.map((capability) => CAPABILITY_TO_WP.get(capability)))]
  const earliest = packages
    .map((workPackage) => workPackage.phase)
    .sort((a, b) => (PHASE_INDEX.get(a) ?? 99) - (PHASE_INDEX.get(b) ?? 99))[0]
  const measuredStatus = sellable?.status ?? 'UNMEASURED'
  return {
    id: industry.id,
    archetype: industry.archetype,
    measuredStatus,
    status: sellable && EVIDENCE_STALE ? 'STALE_EVIDENCE' : measuredStatus,
    met: sellable ? Object.values(sellable.criteria).filter(Boolean).length : 0,
    total: sellable ? Object.keys(sellable.criteria).length : 10,
    required: required.length,
    unmet: unmet.length,
    blockers,
    unmapped,
    packages: packages.map((workPackage) => workPackage.id),
    phase: earliest ?? 'C5',
  }
})

const phaseCounts = {}
for (const row of industryRows) phaseCounts[row.phase] = (phaseCounts[row.phase] ?? 0) + 1

const requirementIndustries = industryRows.filter((row) => row.required > 0).length
const blockedIndustries = industryRows.filter((row) => row.unmet > 0).length
const unmappedRequirements = industryRows.reduce((sum, row) => sum + row.unmapped.length, 0)
const unmappedEngineDemand = capabilityRows.reduce((sum, row) => sum + row.unmappedEngine, 0)

// ---------------------------------------------------------------
// 8. Render.
// ---------------------------------------------------------------
const tick = (value) => (value ? '✓' : '—')
const code = (value) => `\`${value}\``
const generated = `<!-- GENERATED by scripts/industry/campaign-status.mjs — دستی ویرایش نکن. HEAD ${CURRENT_HEAD ?? 'unknown'} · acceptance ${SELLABLE.acceptanceCommit ?? 'unknown'} · evidenceFresh ${SELLABLE.evidenceFresh === true ? 'true' : 'false'} -->`

const evidenceBanner =
  staleReasons.length === 0
    ? ''
    : [
        '> ⚠️ **شاهد پذیرش تازه نیست:** ' + staleReasons.join(' · '),
        '> عدد «اندازه‌گیری‌شده» از درخت دیگری می‌آید؛ تا اجرای دوباره‌ی پذیرش روی همین commit، وضعیت `STALE_EVIDENCE` است.',
      ].join('\n')

const wiringDoc = [
  '# وضعیت سیم‌کشی موتورها',
  '',
  generated,
  '',
  'منبع: `docs/architecture/universal-core/ENGINE-WIRING.csv` (ردیف‌های `engine`). هر ردیف یک موتور است، نه یک صنف. ' +
    'این جدول فقط «وجود لایه» را نشان می‌دهد، نه کیفیت گردش کاربر.',
  '',
  '| سنجه | مقدار |',
  '| --- | --- |',
  `| موتور | ${engineRows.length} |`,
  `| وضعیت | ${Object.entries(engineStatusCounts)
    .map(([status, count]) => `${status}=${count}`)
    .join(' · ')} |`,
  `| بدون مسیر سرور | ${engineGapCounts.route} |`,
  `| بدون Local Engine | ${engineGapCounts.local} |`,
  `| بدون Hook | ${engineGapCounts.hook} |`,
  `| بدون UI | ${engineGapCounts.ui} |`,
  `| بدون service | ${engineGapCounts.service} |`,
  '',
  '| موتور | بسته | ساختار | وضعیت | مسیر | آفلاین | Hook | UI | کمبود |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
  ...engineRows.map(
    (row) =>
      `| ${code(row.key)} | ${row.pack} | ${row.structure} | ${row.status} | ${row.routes} | ${tick(
        row.local,
      )} | ${tick(row.hook)} | ${tick(row.ui)} | ${row.gaps.join(', ') || '—'} |`,
  ),
  '',
  '## موتورهای بدون Local Engine',
  '',
  engineRows
    .filter((row) => !row.local)
    .map((row) => `- ${code(row.key)} — ${row.status}`)
    .join('\n'),
  '',
  '> هر عملیاتی که روی این موتورها سوار است، تا ساخته‌شدن مسیر محلی، فقط آنلاین است و باید در ' +
    '`docs/industries/OFFLINE-WORKFLOW-MATRIX.md` همین‌طور بماند.',
  '',
].join('\n')

const reconciliationDoc = [
  '# تطبیق قابلیت‌ها: ماتریس محصول ↔ سیم‌کشی ↔ لنگر کد',
  '',
  generated,
  '',
  'برای هر قابلیت `partial`/`planned` در `SHARED-CAPABILITY-MATRIX.md`، این سند سه چیز را کنار هم می‌گذارد: ' +
    'سیم‌کشی پنج‌لایه از `ENGINE-WIRING.csv`، محدودیت نام‌دار ثبت‌شده، و لنگر کد/تست در `coverage-data.mjs`.',
  '',
  '| سنجه | مقدار |',
  '| --- | --- |',
  `| قابلیت ماتریس | ${MATRIX_STATUS.size} |`,
  `| قابلیت با لنگر بسته (coverage-data) | ${COVERAGE.size} |`,
  `| بسته کاری | ${WORK_PACKAGES.length} |`,
  `| صنوف با نیازمندی ثبت‌شده | ${requirementIndustries} |`,
  `| صنوف با نیازمندی برآورده‌نشده | ${blockedIndustries} |`,
  `| نیازمندی بی‌موتور | ${unmappedEngineDemand} |`,
  `| نیازمندی بی‌بسته | ${unmappedRequirements} |`,
  `| حکم | ${Object.entries(verdictCounts)
    .map(([verdict, count]) => `${verdict}=${count}`)
    .join(' · ')} |`,
  '',
  '| قابلیت | ماتریس | موتور | ساختار | وضعیت موتور | لایه غایب | محدودیت | شاهد خود قابلیت | شاهد بسته | صنوف نیازمند | مسدود | بی‌موتور | بسته | فاز | حکم |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
  ...capabilityRows.map(
    (row) =>
      `| ${code(row.capability)} | ${row.matrixStatus} | ${code(row.engine)} | ${row.engineStructure} | ${
        row.engineStatus
      } | ${row.missingLayers.join(', ') || '—'} | ${row.limitations.map(code).join(' ') || '—'} | ${
        row.evidence
      } (${row.evidencePresent}/${row.evidenceFiles}) | ${
        row.sharedEvidence.map(code).join(', ') || '—'
      } | ${row.affected} | ${row.blocked} | ${row.unmappedEngine} | ${row.workPackage} | ${
        row.phase
      } | ${row.verdict} |`,
  ),
  '',
  '> «شاهد خود قابلیت» فقط وجود فایل‌هایی را می‌سنجد که رجیستری برای همان قابلیت نام برده است. ' +
    '«شاهد بسته» لنگرهای `coverage-data.mjs` است و حکم را عوض نمی‌کند.',
  '',
  '> «صنوف نیازمند» از ستون نیازمندی‌های `INDUSTRY-REGISTRY.md` می‌آید؛ «مسدود» یعنی همان نیاز ' +
    'هنوز `available` نیست و «بی‌موتور» یعنی هیچ موتوری پشت آن نیست.',
  '',
  '## معنی حکم‌ها',
  '',
  '| حکم | معنی |',
  '| --- | --- |',
  '| `WIRED` | موتور `available`، پنج لایه کامل و ماتریس هم `available` |',
  '| `MATRIX_STALE` | موتور `available` است ولی ماتریس هنوز `partial` — ماتریس باید با شاهد به‌روز شود |',
  '| `MATRIX_AHEAD` | ماتریس `available` است ولی موتور کامل نیست — ادعا باید پس گرفته شود |',
  '| `LIMITATION_NAMED` | لایه‌ها کامل‌اند، یک محدودیت نام‌دار باقی است |',
  '| `UNWIRED` | یکی از لایه‌ها (service/آفلاین/Hook/UI) وجود ندارد |',
  '| `PARTIAL_UNNAMED` | `partial` بدون محدودیت و بدون لایه غایب — نیازمند بررسی دستی |',
  '| `NO_ENGINE` | موتور `planned` یا خالی — نیازمندی ثبت شده ولی چیزی پشتش نیست |',
  '| `EVIDENCE_MISSING` | رجیستری فایلی برای این قابلیت نام نبرده یا فایل نام‌برده روی دیسک نیست |',
  '| `FILE_PRESENT`/`FILE_MISSING` | فقط وجود فایل سنجیده می‌شود؛ گردش کاربر در C5 تأیید می‌شود |',
  '',
  '## لنگرهای ناسالم',
  '',
  ...[...COVERAGE.entries()]
    .filter(([, entry]) => entry.unhealthy.length > 0)
    .map(
      ([capability, entry]) =>
        `- ${code(capability)} — ${entry.unhealthy
          .map((item) => `${item.id}:${item.state}`)
          .join(', ')}`,
    ),
  '',
  '## بار هر بسته روی صنوف',
  '',
  '| بسته | فاز | عنوان | قابلیت‌ها | صنوف مسدود |',
  '| --- | --- | --- | --- | ---: |',
  ...WORK_PACKAGES.map(
    (workPackage) =>
      `| ${workPackage.id} | ${workPackage.phase} | ${workPackage.title} | ${
        workPackage.capabilities.map(code).join(', ') || '—'
      } | ${workPackageLoad.get(workPackage.id) ?? 0} |`,
  ),
  '',
  '## آنچه این سند اثبات نمی‌کند',
  '',
  '- وجود لایه یعنی فایل و ردیف سیم‌کشی هست؛ یعنی گردش کامل کاربر تأیید نشده است.',
  '- هیچ نتیجه‌ی PostgreSQL یا مرورگری در این سند نیست؛ آن شاهد در فاز C5 ساخته می‌شود.',
  '- تعداد صنوف مسدود از رجیستری می‌آید؛ خطای رجیستری در این سند هم تکرار می‌شود.',
  '- «شاهد خود قابلیت» یعنی فایل هست، نه اینکه گردش کار می‌کند یا روی PostgreSQL اجرا شده است.',
  '- نیازمندی‌ای که هیچ صنفی در رجیستری ثبت نکرده باشد، در شمارش «صنوف نیازمند» دیده نمی‌شود.',
  '',
].join('\n')

const matrixDoc = [
  '# ماتریس صنوف کمپین',
  '',
  generated,
  '',
  'وضعیت هر صنف از `sellable-industries.json` خوانده می‌شود؛ موانع آن از ستون نیازمندی‌ها و ' +
    'قابلیت‌های `INDUSTRY-REGISTRY.md` می‌آید. «فاز» اولین فازی است که می‌تواند این صنف را باز کند.',
  '',
  ...(evidenceBanner ? [evidenceBanner, ''] : []),
  '| سنجه | مقدار |',
  '| --- | --- |',
  `| صنوف | ${industryRows.length} |`,
  `| معیارهای فعلی | ${Math.max(...industryRows.map((row) => row.met))}/${industryRows[0]?.total ?? 10} |`,
  `| SELLABLE | ${industryRows.filter((row) => SELLABLE_BY_KEY.get(row.id)?.sellable).length} |`,
  `| شاهد تازه | ${EVIDENCE_STALE ? 0 : industryRows.length} |`,
  `| نیازمندی بی‌بسته | ${unmappedRequirements} |`,
  `| توزیع فاز | ${Object.entries(phaseCounts)
    .sort((a, b) => (PHASE_INDEX.get(a[0]) ?? 99) - (PHASE_INDEX.get(b[0]) ?? 99))
    .map(([phase, count]) => `${phase}=${count}`)
    .join(' · ')} |`,
  '',
  '| # | صنف | Archetype | وضعیت | اندازه‌گیری‌شده | معیار | نیاز | برآورده‌نشده | موانع | بسته‌ها | فاز |',
  '| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
  ...industryRows.map(
    (row, index) =>
      `| ${index + 1} | ${code(row.id)} | ${row.archetype} | ${row.status} | ${
        row.measuredStatus
      } | ${row.met}/${row.total} | ${row.required} | ${row.unmet} | ${
        row.blockers.map(code).join(', ') || '—'
      } | ${row.packages.join(', ') || '—'} | ${row.phase} |`,
  ),
  '',
  '## معنی وضعیت‌ها',
  '',
  '| وضعیت | معنی |',
  '| --- | --- |',
  '| `STALE_EVIDENCE` | عدد اندازه‌گیری‌شده از commit دیگری (یا درخت ناپاک) است و قابل استناد نیست |',
  '| `WORKFLOW_VERIFIED` | گردش صنف با تست‌های همین مخزن تأیید شده؛ شاهد PostgreSQL و مرورگر ندارد |',
  '| `UNMEASURED` | صنف در `sellable-industries.json` نیست |',
  '',
  '## فازها',
  '',
  '| فاز | عنوان |',
  '| --- | --- |',
  ...PHASES.map(([id, title]) => `| ${id} | ${title} |`),
  '',
  '> فاز `C5` یعنی هیچ نیازمندی برآورده‌نشده‌ای نمانده و فقط شاهد تازه PostgreSQL و مرورگر باقی است. ' +
    'تا وقتی شاهد تازه نباشد، وضعیت صنف `STALE_EVIDENCE` می‌ماند.',
  '',
].join('\n')

const OUTPUTS = [
  ['ENGINE-WIRING-STATUS.md', wiringDoc],
  ['CAPABILITY-RECONCILIATION.md', reconciliationDoc],
  ['INDUSTRY-MATRIX.md', matrixDoc],
]

if (CHECK_ONLY) {
  const drift = OUTPUTS.filter(([name, content]) => {
    const target = path.join(OUT_DIR, name)
    return !existsSync(target) || readFileSync(target, 'utf8') !== content
  }).map(([name]) => name)
  if (drift.length > 0) {
    console.error(`drift: ${drift.join(', ')} — run node scripts/industry/campaign-status.mjs`)
    process.exit(1)
  }
  console.log('campaign docs are current')
} else {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, content] of OUTPUTS) writeFileSync(path.join(OUT_DIR, name), content)
  console.log(
    [
      `engines: ${engineRows.length} · ${JSON.stringify(engineStatusCounts)} · gaps ${JSON.stringify(engineGapCounts)}`,
      `capabilities: ${MATRIX_STATUS.size} · ${JSON.stringify(verdictCounts)}`,
      `industries: ${industryRows.length} · phases ${JSON.stringify(phaseCounts)}`,
      `wrote ${OUTPUTS.map(([name]) => `docs/campaigns/${name}`).join(', ')}`,
    ].join('\n'),
  )
}
