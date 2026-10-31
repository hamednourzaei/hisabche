import fs from 'fs'
import path from 'path'

const tenantTables = new Set([
  'invoices',
  'invoice_items',
  'invoice_item_details',
  'customers',
  'products',
  'product_stock',
  'journal_entries',
  'journal_lines',
  'payments',
  'payment_allocations',
  'stock_movements',
  'cost_layers',
  'cost_consumptions',
  'warehouses',
  'branches',
  'transfers',
  'pos_sessions',
  'orders',
  'employees',
  'salaries',
  'payrolls',
])

function inspectTenantTables() {
  const dir = 'backend/src/services'
  const files = []
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.ts')) files.push(p)
    }
  }
  walk(dir)

  const violations = []

  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    for (const table of tenantTables) {
      // Look for .from('<table>') followed by .update or .delete
      const pattern = new RegExp(
        `\\.from\\(['"]${table}['"]\\)\\s*\\.(update|delete)\\(([\\s\\S]*?)(?=(?:await\\s+|\\bconst\\s+|\\blet\\s+|\\bif\\s*\\(|;\\s*|\\n\\s*\\n|\\breturn\\b))`,
        'g',
      )
      let match
      while ((match = pattern.exec(text)) !== null) {
        const op = match[1]
        const queryText = match[0]
        if (!queryText.includes('workspace_id') && !queryText.includes('workspaceId')) {
          const line = text.slice(0, match.index).split('\n').length
          violations.push({
            file: f,
            line,
            table,
            op,
            query: queryText.slice(0, 160).replace(/\s+/g, ' '),
          })
        }
      }
    }
  }

  console.log(`Core tenant table violations (missing workspace_id): ${violations.length}`)
  violations.forEach((v) => {
    console.log(`${v.file}:${v.line} [${v.table} ${v.op}] -> ${v.query}`)
  })
}

inspectTenantTables()
