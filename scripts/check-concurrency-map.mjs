import fs from 'node:fs'

const mapContent = fs.readFileSync('backend/src/utils/concurrency-safety-map.ts', 'utf8')
const auditFindings = JSON.parse(fs.readFileSync('scripts/audit-findings-raw.json', 'utf8'))

// Extract all registered routes in concurrency-safety-map
const registered = new Set()
const regex = /['"`](POST|PUT|PATCH|DELETE)\s+([^'"`]+)['"`]/g
let m
while ((m = regex.exec(mapContent)) !== null) {
  registered.add(`${m[1]} ${m[2]}`)
}

console.log('Total registered routes in concurrency-safety-map:', registered.size)

// Now find how many backend routes exist in total and which ones are not registered
const dir = 'backend/src/routes'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
const unregistered = []

for (const f of files) {
  const content = fs.readFileSync(`${dir}/${f}`, 'utf8')
  const rRegex = /fastify\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let rm
  while ((rm = rRegex.exec(content)) !== null) {
    const key = `${rm[1].toUpperCase()} ${rm[2]}`
    // Normalize parameter segments :id, :x etc
    const normalizedKey = key.replace(/:[a-zA-Z0-9_]+/g, ':id')
    let found = false
    for (const reg of registered) {
      const regNorm = reg.replace(/:[a-zA-Z0-9_]+/g, ':id')
      if (regNorm === normalizedKey || normalizedKey.endsWith(regNorm)) {
        found = true
        break
      }
    }
    if (!found) {
      unregistered.push({ file: f, method: rm[1].toUpperCase(), url: rm[2] })
    }
  }
}

console.log('Unregistered mutating routes in concurrency-safety-map:', unregistered.length)
console.log('Sample unregistered:', unregistered.slice(0, 20))
