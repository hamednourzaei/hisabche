import fs from 'node:fs'
import path from 'node:path'

const dir = 'packages/local-engine/src/routes'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))
const mutating = []

for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8')
  const regex = /router\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = regex.exec(content)) !== null) {
    const start = m.index
    const snippet = content.slice(start, start + 2500)
    const writesDb =
      snippet.includes('db.insert') ||
      snippet.includes('db.update') ||
      snippet.includes('db.upsert') ||
      snippet.includes('db.remove') ||
      snippet.includes('db.exec')
    const queuesSync =
      snippet.includes('sync_queue') || snippet.includes('queue') || snippet.includes('enqueue')
    mutating.push({
      file: f,
      method: m[1].toUpperCase(),
      url: m[2],
      writesDb,
      queuesSync,
      snippet: snippet.slice(0, 300),
    })
  }
}

console.log('Total local mutating:', mutating.length)
const unqueued = mutating.filter((m) => m.writesDb && !m.queuesSync)
console.log('Writes DB without queue:', unqueued.length)
for (const u of unqueued) {
  console.log(`- [${u.method}] ${u.url} in ${u.file}`)
}
