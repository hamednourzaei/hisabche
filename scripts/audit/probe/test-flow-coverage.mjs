// scripts/audit/probe/test-flow-coverage.mjs
// Inspects existing tests across the codebase for the 5 critical flows

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
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
    else if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
const allTests = walk(ROOT)

const flows = {
  invoiceReturn: ['invoice-return', 'invoice_return_create', 'useCreateInvoiceReturn'],
  bankReconcile: ['bank', 'reconcile', 'useReconcileLine'],
  tillClose: ['pos/sessions', 'closeSession', 'useCloseSession', 'till'],
  syncConflict: ['conflict', 'conflicts', 'sync/push', 'oversell'],
  taxReturn: ['tax/return', 'useTaxReturn', 'getTaxReturn'],
}

for (const [flowName, keywords] of Object.entries(flows)) {
  console.log(`=== Flow: ${flowName} ===`)
  const matches = []
  for (const t of allTests) {
    const content = fs.readFileSync(t, 'utf8')
    const rPath = rel(t)
    for (const kw of keywords) {
      if (content.includes(kw) || rPath.includes(kw)) {
        matches.push(rPath)
        break
      }
    }
  }
  console.log(`Found ${matches.length} matching test files:`)
  matches.slice(0, 10).forEach((m) => console.log(' -', m))
}
