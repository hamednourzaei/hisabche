// ============================================
// Capabilities that are WRITTEN but not WIRED.
//
// ⚠️ WHAT THIS IS FOR.
//
// The most expensive defect class in this codebase is not a crash. It is an
// abstraction that is correct, fully tested, and called by nobody — because no
// test can see the absence of a caller, so it survives for years looking like
// a finished feature (lesson 84).
//
// So this file NAMES that state. Each entry is one of two honest values:
//
//   WIRED              — a request, a scheduled job or a worker can reach it
//   WRITTEN_NOT_WIRED  — the logic and its tests exist; nothing can reach it
//
// ---------------------------------------------------------------------------
// ⚠️ THE REGISTER ITSELF LIED, AND HOW (4 October 2026).
//
// Until today it held two rows, a cap of two, and this definition of a caller:
// «a mention outside the declaring file and outside tests». Under that
// definition `decideEscalation` was WIRED — `compensation.service.ts` mentions
// it — and nobody noticed that `compensation.service.ts` is itself imported by
// nothing. One unwired file vouching for another.
//
// Meanwhile the Business-OS report of 30 September listed twenty-one «new
// engines» (pricing, collections, installments, financing, connectors, cohorts,
// break-even, …) as built. Every one is a pure domain module with tests and NO
// production importer: no table, no service, no route, no hook, no screen. None
// of them was in this register, because the register was capped at two.
//
// A register that can hold a lie is worse than no register. Two changes:
//
//   1. WIRED now means REACHABLE: the declaring file must be in the import
//      closure of a real entry point (a route, the scheduler plugin, a worker,
//      or `index.ts`). A chain of files that only import each other is not a
//      caller.
//   2. Every `*.domain.ts` that is not reachable must be IN the register. A new
//      unwired engine cannot be added quietly, and an engine that gets wired
//      turns its own row red until the row is updated.
//
// ⚠️ WHY THE UNWIRED ENGINES ARE NOT SIMPLY DELETED. §14 says drop code you
// misunderstood. This code is not wrong — it is the tested arithmetic for
// capabilities the owner asked for. Deleting it would make the wiring phase
// rebuild it. It stays, labelled as what it is.
// ============================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/**
 * Line comments BEFORE block comments: a path or glob inside a line comment
 * opens a fake block comment that swallows the rest of the file (BUG-029).
 */
function stripComments(source: string): string {
  return source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : []
  })
}

const toRelative = (path: string) =>
  path
    .slice(SRC.length + 1)
    .split('\\')
    .join('/')

interface SourceFile {
  path: string
  relative: string
  code: string
  imports: string[]
}

/** A relative import, resolved to the file it names (or null when it is a package). */
function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = join(dirname(from), specifier)
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return toRelative(candidate)
  }
  return null
}

const FILES: SourceFile[] = walk(SRC).map((path) => {
  const code = stripComments(readFileSync(path, 'utf8'))
  const imports = [
    ...code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g),
    ...code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
  ]
    .map((match) => resolveImport(path, match[1] as string))
    .filter((target): target is string => target !== null)
  return { path, relative: toRelative(path), code, imports }
})

const BY_PATH = new Map(FILES.map((file) => [file.relative, file]))

/** Where execution can START: a request, the scheduler, a worker, the server. */
const isEntryPoint = (relative: string) =>
  relative === 'index.ts' ||
  relative.startsWith('routes/') ||
  relative.startsWith('plugins/') ||
  relative.startsWith('workers/') ||
  relative.startsWith('scheduler/')

/** Every file an entry point can reach by following imports. */
const REACHABLE: Set<string> = (() => {
  const seen = new Set<string>()
  const queue = FILES.filter((file) => isEntryPoint(file.relative)).map((file) => file.relative)
  while (queue.length > 0) {
    const next = queue.pop() as string
    if (seen.has(next)) continue
    seen.add(next)
    for (const target of BY_PATH.get(next)?.imports ?? []) queue.push(target)
  }
  return seen
})()

type Status = 'WIRED' | 'WRITTEN_NOT_WIRED'

interface Capability {
  /** The capability numbers from the 150-item map, for traceability. */
  id: string
  /** Where the logic lives. */
  file: string
  /** Exported symbols that prove the entry is about real code. */
  symbols: string[]
  /** What is missing, in one sentence the next reader can act on. */
  note: string
  status: Status
}

const NOTHING_REACHES_IT =
  'Pure, tested arithmetic. No table, no service, no route, no hook, no screen: ' +
  'wiring it is a migration + service + route + hook + UI on three platforms.'

/**
 * The register.
 *
 * ⚠️ Every entry must be TRUE when this file is read, and is proven by the
 * tests below.
 */
const REGISTER: Capability[] = [
  {
    id: '#69 Month-End · fiscal year end',
    file: 'services/accounting/month-end.domain.ts',
    symbols: ['monthEndsFiscalYear'],
    note:
      'Wired on 2026-09-30: the month-end service calls it. The rule still takes ' +
      'the year end as a PARAMETER because no workspace setting exists.',
    status: 'WIRED',
  },
  {
    id: '#68 Escalation · #81 Compensation',
    file: 'services/workflow/escalation.domain.ts',
    symbols: ['decideEscalation', 'compensationFor'],
    note:
      'Recorded as WIRED on 30 September — wrongly. Its only importers are ' +
      '`approval.domain.ts` and `compensation.service.ts`, and no route, job or ' +
      'worker imports either path to it. Nothing escalates anything.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#81 Compensation service',
    file: 'services/workflow/compensation.service.ts',
    symbols: [],
    note: 'A service with no route and no job. See the row above.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#62 Bank categorization',
    file: 'services/banking/categorization.domain.ts',
    symbols: ['categorize'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#55 Bank auto-match',
    file: 'services/banking/auto-match.domain.ts',
    symbols: ['decideAutoMatches'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#19 #114–#117 #120 Pricing & promotion',
    file: 'services/commerce/pricing.domain.ts',
    symbols: ['quotePrice', 'applyPrice'],
    note: NOTHING_REACHES_IT + ' The invoice still takes each line price from the request.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#123 #124 Installments & late fees',
    file: 'services/commerce/installment.domain.ts',
    symbols: ['planSchedule', 'decideBlock'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#51 #53 #66 Collections',
    file: 'services/collections/collections.domain.ts',
    symbols: ['collectionsFor', 'planPayments'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#38 #125 #126 Working capital & financing',
    file: 'services/financing/working-capital.domain.ts',
    symbols: ['workingCapital', 'instalment'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#10 #15 #19 Supplier intelligence',
    file: 'services/supplier/supplier-intelligence.domain.ts',
    symbols: ['scoreSupplier', 'supplierConcentration'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#57 #58 #63 #64 #112 Scheduled automation',
    file: 'services/automation/schedule.domain.ts',
    symbols: ['shouldRun', 'isDueOn'],
    note:
      NOTHING_REACHES_IT +
      ' No table of schedules exists, so nothing recurring can be defined by a user.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#130 #131 Cohorts, funnels, segments',
    file: 'services/analytics/cohort.domain.ts',
    symbols: ['buildCohorts', 'buildFunnel'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#133 #134 Break-even & scenarios',
    file: 'services/analytics/break-even.domain.ts',
    symbols: ['breakEven', 'runScenario'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#135 Benchmark',
    file: 'services/analytics/benchmark.domain.ts',
    symbols: ['benchmark'],
    note: NOTHING_REACHES_IT + ' And the product has no external data to benchmark against.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#16 #30 #48 #49 Document ingestion',
    file: 'services/ingest/ingest.domain.ts',
    symbols: ['checkIngestable', 'toDraft'],
    note: NOTHING_REACHES_IT + ' No OCR provider is configured either.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#20 Document translation',
    file: 'services/ingest/translate.domain.ts',
    symbols: ['pinFigures'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#3 #9 #13 #18 Customer risk',
    file: 'services/customers/customer-risk.domain.ts',
    symbols: ['customerRisk'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#106 #108 #109 NPS, health, loyalty',
    file: 'services/customers/nps.domain.ts',
    symbols: ['netPromoterScore', 'loyaltyTier'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#42–#46 Snapshots',
    file: 'services/portability/snapshot.domain.ts',
    symbols: ['buildSnapshot'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#21–#35 #137 #147 Connector framework',
    file: 'services/connectors/connector.domain.ts',
    symbols: ['acceptInbound', 'shouldPoll'],
    note: NOTHING_REACHES_IT + ' No connector exists; there are no credentials to store.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#141 #142 #143 Custom objects & formulas',
    file: 'services/extensions/extension.domain.ts',
    symbols: ['parseFormula', 'evaluateFormula'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#145 #146 Report & dashboard builder',
    file: 'services/reporting/dataset.domain.ts',
    symbols: ['validateReport', 'validateDashboard'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#144 Workflow builder',
    file: 'services/workflow/builder.domain.ts',
    symbols: ['validateDefinition'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: '#100 #101 #103 Attendance, shifts, notes',
    file: 'services/customers/attendance.domain.ts',
    symbols: ['attendanceFor', 'payableHours'],
    note: NOTHING_REACHES_IT,
    status: 'WRITTEN_NOT_WIRED',
  },

  // ── Found by the reachability walk itself (4 October 2026) ────────────────
  // Not Business-OS engines: older files nothing imports any more. Listed, not
  // deleted — whether each is dead (remove) or lost its caller (re-wire) is a
  // decision per file, and two of them other sessions are still editing.
  {
    id: 'Approval arithmetic',
    file: 'services/workflow/approval.domain.ts',
    symbols: [],
    note:
      'Imported only by pricing, builder and escalation — all unwired themselves. ' +
      'The approval ROUTES go through workflow.service and do not use this file.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Warehouse transfer (domain)',
    file: 'services/warehouse/transfer.domain.ts',
    symbols: [],
    note: 'Transfers run through the `warehouse_transfer_stock_keyed` function; this is unused.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Warehouse transfer (service)',
    file: 'services/warehouse/transfer.service.ts',
    symbols: [],
    note: 'No route imports it. See the row above.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Costing transfer (domain)',
    file: 'services/inventory-costing/transfer.domain.ts',
    symbols: [],
    note: 'Imported only by the unreachable warehouse transfer service.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Legacy accounting service (top level)',
    file: 'services/accounting.service.ts',
    symbols: [],
    note: 'Superseded by services/accounting/accounting.service.ts; nothing imports this one.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Checkout service',
    file: 'services/checkout.service.ts',
    symbols: [],
    note: 'No importer. Billing checkout runs through billing.service.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Entitlement service',
    file: 'services/entitlement.service.ts',
    symbols: [],
    note: 'No importer: plan limits are enforced elsewhere, so edits here change nothing.',
    status: 'WRITTEN_NOT_WIRED',
  },
  {
    id: 'Webhook service (legacy)',
    file: 'services/webhook.service.ts',
    symbols: [],
    note: 'No importer. Webhooks are delivered by services/developer.',
    status: 'WRITTEN_NOT_WIRED',
  },
]

describe('the register of written-but-unwired capabilities is honest', () => {
  it('inspects the backend, and finds entry points to start from', () => {
    expect(FILES.length).toBeGreaterThan(200)
    expect(FILES.filter((file) => isEntryPoint(file.relative)).length).toBeGreaterThan(50)
    // The walk actually follows imports: far more is reachable than the entry
    // points themselves.
    expect(REACHABLE.size).toBeGreaterThan(300)
  })

  it('every file the register names exists', () => {
    for (const cap of REGISTER) {
      expect(BY_PATH.has(cap.file), `${cap.id} names a missing file: ${cap.file}`).toBe(true)
    }
  })

  it('every symbol the register names is really exported', () => {
    for (const cap of REGISTER) {
      const file = BY_PATH.get(cap.file)
      for (const symbol of cap.symbols) {
        expect(file?.code, `${cap.id}: ${symbol} is not exported by ${cap.file}`).toMatch(
          new RegExp(`export (?:function|const|async function) ${symbol}\\b`),
        )
      }
    }
  })

  it('every WRITTEN_NOT_WIRED entry is really unreachable', () => {
    // ⚠️ When a phase wires one of these, this goes red — and the fix is to
    // change the row to WIRED, not to relax the check.
    const nowReachable = REGISTER.filter(
      (cap) => cap.status === 'WRITTEN_NOT_WIRED' && REACHABLE.has(cap.file),
    ).map((cap) => cap.id)
    expect(nowReachable).toEqual([])
  })

  it('every WIRED entry is really reachable from a route, a job or a worker', () => {
    // The mirror, and the check the old register did not have: a file that is
    // only imported by another unreachable file is not wired.
    const lost = REGISTER.filter((cap) => cap.status === 'WIRED' && !REACHABLE.has(cap.file)).map(
      (cap) => cap.id,
    )
    expect(lost).toEqual([])
  })

  it('no unreachable domain module is missing from the register', () => {
    // ⚠️ This replaces «the register may hold at most two rows». A cap on the
    // COUNT is what let twenty-one engines stay out of it. The rule is about
    // coverage: an engine nothing can reach must be written down here, so the
    // next unwired engine cannot arrive quietly.
    const registered = new Set(REGISTER.map((cap) => cap.file))
    const unlisted = FILES.filter(
      (file) =>
        file.relative.startsWith('services/') &&
        /\.(domain|service)\.ts$/.test(file.relative) &&
        !REACHABLE.has(file.relative) &&
        !registered.has(file.relative),
    ).map((file) => file.relative)
    expect(unlisted).toEqual([])
  })
})
