import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = 'C:/Users/hamed/Desktop/hisabche/backend/src'
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts)$/.test(entry.name)) files.push(full)
  }
}
walk(root)

const needles = [
  'model_prices',
  'ai_usage',
  'prompt_version',
  'promptVersion',
  'aiModelPrices',
  'aiBudgets',
  'budget',
]
const hits = new Map()
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const needle of needles) {
    if (source.includes(needle)) {
      const rel = relative('C:/Users/hamed/Desktop/hisabche', file).replace(/\\/g, '/')
      if (!hits.has(needle)) hits.set(needle, [])
      hits.get(needle).push(rel)
    }
  }
}
for (const [needle, list] of hits) {
  console.log(`\n## ${needle} (${list.length})`)
  for (const item of list.slice(0, 12)) console.log('  ' + item)
}
