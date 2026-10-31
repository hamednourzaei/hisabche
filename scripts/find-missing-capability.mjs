import fs from 'node:fs'

const dir = 'backend/src/routes'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
const missingCap = []

for (const f of files) {
  const content = fs.readFileSync(dir + '/' + f, 'utf8')
  const routeRegex = /fastify\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = routeRegex.exec(content)) !== null) {
    const startPos = m.index
    const block = content.slice(startPos, startPos + 600)
    const hasWorkspace = block.includes('requireWorkspaceContext')
    const hasCap =
      block.includes('requireCapability') ||
      block.includes('requireRole') ||
      block.includes('requireAdmin')
    if (hasWorkspace && !hasCap) {
      missingCap.push({ file: f, method: m[1].toUpperCase(), path: m[2] })
    }
  }
}

console.log('Mutating routes with workspace but NO capability/role:', missingCap.length)
console.log(JSON.stringify(missingCap, null, 2))
