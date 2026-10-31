import fs from 'node:fs'
import path from 'node:path'

function scanBackend() {
  const dir = 'backend/src/routes'
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
  const routes = []
  for (const f of files) {
    const filePath = path.join(dir, f)
    const content = fs.readFileSync(filePath, 'utf8')
    const regex = /fastify\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
    let m
    while ((m = regex.exec(content)) !== null) {
      // Find surrounding lines or prehandlers
      const startPos = m.index
      const block = content.slice(startPos, startPos + 500)
      const hasAuth = block.includes('authenticate')
      const hasWorkspace = block.includes('requireWorkspaceContext')
      const hasCapability = block.includes('requireCapability')
      routes.push({
        file: f,
        method: m[1].toUpperCase(),
        url: m[2],
        hasAuth,
        hasWorkspace,
        hasCapability,
      })
    }
  }
  return routes
}

function scanLocalEngine() {
  const dir = 'packages/local-engine/src/routes'
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
  const routes = []
  for (const f of files) {
    const filePath = path.join(dir, f)
    const content = fs.readFileSync(filePath, 'utf8')
    const regex = /router\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
    let m
    while ((m = regex.exec(content)) !== null) {
      routes.push({
        file: f,
        method: m[1].toUpperCase(),
        url: m[2],
      })
    }
  }
  return routes
}

const beRoutes = scanBackend()
const leRoutes = scanLocalEngine()
console.log(
  JSON.stringify(
    {
      backendTotal: beRoutes.length,
      localEngineTotal: leRoutes.length,
      backendSample: beRoutes.slice(0, 10),
      localEngineSample: leRoutes.slice(0, 10),
    },
    null,
    2,
  ),
)
