import fs from 'node:fs'
import path from 'node:path'

function getFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const full = path.join(dir, file)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (!file.includes('__tests__') && !file.includes('node_modules')) {
        results = results.concat(getFiles(full))
      }
    } else if (file.endsWith('.service.ts') || file.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

const serviceFiles = getFiles('backend/src/services')
console.log('Total service files:', serviceFiles.length)

const tenancyLeaksInServices = []
const multiWritesInServices = []

for (const f of serviceFiles) {
  const content = fs.readFileSync(f, 'utf8')
  const lines = content.split('\n')

  // Scan methods
  const methodRegex = /(?:async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{/g
  let m
  while ((m = methodRegex.exec(content)) !== null) {
    const methodName = m[1]
    if (['constructor', 'if', 'for', 'while', 'switch', 'catch'].includes(methodName)) continue
    const startIndex = m.index
    const snippet = content.slice(startIndex, startIndex + 3500)
    const lineNumber = content.slice(0, startIndex).split('\n').length

    // Check updates/deletes without workspace_id
    const updateDeleteRegex =
      /\.from\(['"`]([a-z_]+)['"`]\)[\s\S]*?\.(update|delete)\([\s\S]*?\)\s*(\.eq\([^)]+\)|\.match\([^)]+\)|\.in\([^)]+\)|\.is\([^)]+\)|;)+/g
    let ud
    while ((ud = updateDeleteRegex.exec(snippet)) !== null) {
      const chain = ud[0].replace(/\s+/g, ' ')
      const table = ud[1]
      // Exclude platform tables that don't have workspace_id
      const platformTables = [
        'users',
        'workspaces',
        'audit_logs',
        'rate_limits',
        'system_metrics',
        'migrations',
        'developer_apps',
        'marketplace_apps',
      ]
      if (platformTables.includes(table)) continue

      if (chain.includes(".eq('id'") && !chain.includes('workspace_id')) {
        tenancyLeaksInServices.push({
          file: f,
          line: lineNumber,
          method: methodName,
          table,
          chain: chain.slice(0, 150),
        })
      }
    }

    // Check multiple table writes without .rpc
    const writeOps =
      snippet.match(
        /await\s+(supabase|this\.db|db)\.from\(['"`]([a-z_]+)['"`]\)\.(insert|update|delete)/g,
      ) || []
    if (writeOps.length > 2 && !snippet.includes('.rpc(')) {
      multiWritesInServices.push({
        file: f,
        line: lineNumber,
        method: methodName,
        writeCount: writeOps.length,
        writes: writeOps.map((w) => w.replace(/\s+/g, ' ')),
      })
    }
  }
}

console.log(
  'Tenancy leaks in services (update/delete on tenant table without workspace_id):',
  tenancyLeaksInServices.length,
)
for (const t of tenancyLeaksInServices.slice(0, 15)) {
  console.log(`- [${t.method}] in ${t.file}:${t.line} on table ${t.table}: ${t.chain}`)
}

console.log(
  '\nSequential multi-table writes in services without .rpc():',
  multiWritesInServices.length,
)
for (const mw of multiWritesInServices.slice(0, 15)) {
  console.log(
    `- [${mw.method}] in ${mw.file}:${mw.line} (${mw.writeCount} writes): ${mw.writes.slice(0, 3).join(', ')}...`,
  )
}
