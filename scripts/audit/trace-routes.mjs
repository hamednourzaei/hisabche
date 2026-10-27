// Read-only audit helper: for every backend route file touched by the universal-core work,
// list each endpoint and check whether a hook, a UI consumer, an engine route, an offline-matrix
// row and a test mention it. Prints a table; writes nothing.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const read = (p) => fs.readFileSync(p, 'utf8')
const files = {
  hooks: walk('packages/api/src/hooks').map((p) => [p, read(p)]),
  ui: walk('packages/ui/src/components').map((p) => [p, read(p)]),
  engine: walk('packages/local-engine/src/routes').map((p) => [p, read(p)]),
  matrix: [['matrix', read('packages/validation/src/schemas/offline-endpoint-matrix.ts')]],
  tests: [
    ...walk('backend/src/__tests__'),
    ...walk('packages/local-engine/src/__tests__'),
    ...walk('packages/validation/src/__tests__'),
    ...walk('packages/ui/src/__tests__'),
    ...walk('packages/api/src/__tests__'),
  ].map((p) => [p, read(p)]),
}

const changed = execSync('git status --short', { encoding: 'utf8' })
  .split('\n')
  .map((l) => l.slice(3).trim())
  .filter((p) => /^backend\/src\/routes\/.*\.routes\.ts$/.test(p))
const untrackedDirs = []
const routeFiles = new Set(changed)
for (const f of fs.readdirSync('backend/src/routes')) {
  if (
    /(variant|fitment|warranty|invoice-return|order-deposit|metal-rates|transport|agriculture|appointment|odata)\.routes\.ts$/.test(
      f,
    )
  )
    routeFiles.add('backend/src/routes/' + f)
}
void untrackedDirs

const rows = []
for (const rf of [...routeFiles].sort()) {
  if (!fs.existsSync(rf)) continue
  const src = read(rf)
  const re = /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length
    const route = m[2]
    const tail = route
      .replace(/^\/api/, '')
      .replace(/:[A-Za-z]+/g, '')
      .replace(/\/+$/, '')
    const hit = (group) =>
      files[group]
        .filter(([, s]) => s.includes(tail) || s.includes(route))
        .map(([p]) => path.basename(p))
    rows.push({
      file: path.basename(rf),
      line,
      method: m[1].toUpperCase(),
      route,
      hook: hit('hooks').length,
      ui: files.ui.filter(([, s]) => hit('hooks').some(() => false) || s.includes(tail)).length,
      engine: hit('engine').length,
      matrix: hit('matrix').length,
      tests: hit('tests').length,
    })
  }
}
console.log('file|line|method|route|hook|uiMentions|engine|matrix|tests')
for (const r of rows)
  console.log(
    [r.file, r.line, r.method, r.route, r.hook, r.ui, r.engine, r.matrix, r.tests].join('|'),
  )
console.log('TOTAL endpoints:', rows.length)
