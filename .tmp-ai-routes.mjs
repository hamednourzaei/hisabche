import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'C:/Users/hamed/Desktop/hisabche/backend/src/routes'
for (const file of readdirSync(dir).filter((f) => f.endsWith('.routes.ts'))) {
  const source = readFileSync(join(dir, file), 'utf8')
  const paths = [...source.matchAll(/'(\/api\/[^']*ai[^']*)'/g)].map((m) => m[1])
  if (paths.length) console.log(file, [...new Set(paths)].join(' | '))
}
