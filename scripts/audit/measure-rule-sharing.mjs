// For each business flow: which shared-core (@hisabche/validation) functions does the SERVER side use,
// which does the LOCAL (offline) side use, and which does only ONE side use?
//
//   node scripts/audit/measure-rule-sharing.mjs
//
// A function used by one side only is either (a) a rule the other side re-implements, (b) a rule the other
// side skips, or (c) a rule that genuinely belongs to one side. The report cannot tell which — a person
// reads it — but a flow with SHARED = 0 is a flow with two independent implementations.

import fs from 'node:fs'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..', '..')

const pairs = [
  [
    'invoice',
    ['backend/src/services/invoice.service.ts'],
    ['packages/local-engine/src/routes/invoices.ts'],
  ],
  [
    'payments',
    [
      'backend/src/services/payments/payments.service.ts',
      'backend/src/services/payments/payments.domain.ts',
    ],
    ['packages/local-engine/src/routes/payments.ts'],
  ],
  [
    'returns',
    ['backend/src/services/sales/invoice-return.service.ts'],
    ['packages/local-engine/src/routes/invoice-returns.ts'],
  ],
  [
    'purchasing',
    ['backend/src/services/purchasing.service.ts'],
    ['packages/local-engine/src/routes/purchasing.ts'],
  ],
  [
    'transfers',
    ['backend/src/services/warehouse.service.ts'],
    ['packages/local-engine/src/routes/transfers.ts'],
  ],
  [
    'till/pos',
    ['backend/src/services/pos/pos.service.ts'],
    ['packages/local-engine/src/routes/till.ts'],
  ],
  [
    'costing',
    ['backend/src/services/inventory-costing/costing.service.ts'],
    [
      'packages/local-engine/src/routes/costing.ts',
      'packages/local-engine/src/routes/cost-layers.ts',
    ],
  ],
  [
    'payroll',
    ['backend/src/services/human-resources.service.ts'],
    ['packages/local-engine/src/routes/payroll.ts'],
  ],
  [
    'attendance',
    ['backend/src/services/payroll/attendance.service.ts'],
    ['packages/local-engine/src/routes/attendance.ts'],
  ],
  [
    'accounting',
    [
      'backend/src/services/accounting/accounting.service.ts',
      'backend/src/services/accounting/ledger.port.ts',
    ],
    [
      'packages/local-engine/src/routes/accounting.ts',
      'packages/local-engine/src/routes/local-ledger.ts',
    ],
  ],
]

function valueImports(file) {
  const full = path.join(repo, file)
  if (!fs.existsSync(full)) return null
  const source = fs.readFileSync(full, 'utf8')
  const names = new Set()
  for (const match of source.matchAll(
    /(?:import|export)\s*(type\s*)?\{([^}]*)\}\s*from\s*'(@hisabche\/validation|\.\/[^']*domain|\.\.\/[^']*domain)'/g,
  )) {
    if (match[1]) continue
    for (const part of match[2].split(',')) {
      const raw = part.trim()
      if (!raw || raw.startsWith('type ')) continue
      names.add(raw.split(/\s+as\s+/)[0].trim())
    }
  }
  return names
}

let rowsWithNoSharing = 0
for (const [flow, serverFiles, localFiles] of pairs) {
  const server = new Set()
  const local = new Set()
  const missing = []
  for (const f of serverFiles) {
    const names = valueImports(f)
    if (names === null) missing.push(f)
    else names.forEach((n) => server.add(n))
  }
  for (const f of localFiles) {
    const names = valueImports(f)
    if (names === null) missing.push(f)
    else names.forEach((n) => local.add(n))
  }
  const shared = [...server].filter((n) => local.has(n))
  if (shared.length === 0) rowsWithNoSharing++
  console.log(
    `\n## ${flow}   server=${server.size}  local=${local.size}  SHARED=${shared.length}${missing.length ? `  MISSING FILES: ${missing.join(', ')}` : ''}`,
  )
  console.log(`   shared    : ${shared.join(', ') || '—'}`)
  console.log(
    `   serverOnly: ${
      [...server]
        .filter((n) => !local.has(n))
        .slice(0, 16)
        .join(', ') || '—'
    }`,
  )
  console.log(
    `   localOnly : ${
      [...local]
        .filter((n) => !server.has(n))
        .slice(0, 16)
        .join(', ') || '—'
    }`,
  )
}
console.log(`\nflows with NO shared rule function: ${rowsWithNoSharing} of ${pairs.length}`)
