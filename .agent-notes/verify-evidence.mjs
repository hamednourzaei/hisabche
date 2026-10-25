import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.join(root, 'docs/sales/_evidence.md')
const text = fs.readFileSync(file, 'utf8')

const rows = text.split(/\r?\n/).filter((l) => /^\|\s*\*\*F-\d+\*\*/.test(l))
let missing = 0
let checked = 0
const report = []

for (const row of rows) {
  const id = row.match(/F-\d+/)[0]
  // every backticked path-ish token in the row
  const tokens = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1])
  for (const tok of tokens) {
    // skip ellipsis shorthand and non-path prose
    if (tok.includes('...')) continue
    if (!/[./]/.test(tok)) continue
    if (/^[A-Za-z_]+$/.test(tok)) continue
    const clean = tok.split(/\s*\(/)[0].trim()
    if (!/\/|\.(ts|tsx|js|mjs|sql|json|md|exe|apk)$/.test(clean)) continue
    const abs = path.join(root, clean)
    const exists = fs.existsSync(abs)
    if (!exists && clean.includes('/')) {
      checked++
      missing++
      report.push(`MISSING ${id}: ${clean}`)
    } else if (exists) {
      checked++
    }
  }
}

console.log(`rows=${rows.length} paths_checked=${checked} missing=${missing}`)
console.log(report.join('\n'))
