import fs from 'node:fs'
import path from 'node:path'

const dir = 'backend/src/routes'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))

const tenancyLeaks = []
const multiTableWrites = []

for (const f of files) {
  const content = fs.readFileSync(`${dir}/${f}`, 'utf8')

  // Find mutating route blocks
  const routeRegex =
    /fastify\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`][\s\S]*?async\s*\(\s*request[^)]*\)\s*=>\s*\{([\s\S]*?)(?=(fastify\.(get|post|put|patch|delete)|\}\s*\);?\s*$))/g
  let m
  while ((m = routeRegex.exec(content)) !== null) {
    const method = m[1].toUpperCase()
    const url = m[2]
    const body = m[3]
    const lineNumber = content.slice(0, m.index).split('\n').length

    // Check 1: Direct supabase writes in route body
    // If route body has multiple await supabase.from(...).insert/update/delete
    const writes =
      body.match(
        /await\s+(supabase|this\.db|db)\.from\(['"`]([a-z_]+)['"`]\)\.(insert|update|delete)/g,
      ) || []
    if (writes.length > 1) {
      multiTableWrites.push({
        file: f,
        line: lineNumber,
        method,
        url,
        count: writes.length,
        writes: writes.map((w) => w.replace(/\s+/g, ' ')),
      })
    }

    // Check 2: Direct updates/deletes in route body without .eq('workspace_id', ...)
    const updateDeleteChains =
      body.match(
        /\.from\(['"`]([a-z_]+)['"`]\)[\s\S]*?\.(update|delete)\([\s\S]*?\)\s*(\.eq\([^)]+\)|\.match\([^)]+\)|\.in\([^)]+\)|;)+/g,
      ) || []
    for (const chain of updateDeleteChains) {
      if (
        chain.includes(".eq('id'") &&
        !chain.includes('workspace_id') &&
        !chain.includes('workspaces') &&
        !chain.includes('users') &&
        !chain.includes('profiles')
      ) {
        tenancyLeaks.push({
          file: f,
          line: lineNumber,
          method,
          url,
          chain: chain.replace(/\s+/g, ' ').slice(0, 150),
        })
      }
    }
  }
}

console.log('Direct Multi-table writes in routes:', multiTableWrites.length)
for (const m of multiTableWrites.slice(0, 10)) {
  console.log(`- [${m.method}] ${m.url} in ${m.file} (Line ${m.line}): ${m.writes.join(', ')}`)
}

console.log('\nTenancy leaks in direct route updates/deletes:', tenancyLeaks.length)
for (const t of tenancyLeaks.slice(0, 10)) {
  console.log(`- [${t.method}] ${t.url} in ${t.file} (Line ${t.line}): ${t.chain}`)
}
