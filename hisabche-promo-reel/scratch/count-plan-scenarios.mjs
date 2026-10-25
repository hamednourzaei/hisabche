// Counts every scenario row in docs/100-VIDEO-PLAN.md and checks the layer totals.
// Reads the plan file, so the count in the final report is measured, not asserted.
import { readFileSync } from 'node:fs'

const text = readFileSync('docs/100-VIDEO-PLAN.md', 'utf8')

// Scenario rows look like:  | L1.01 | عنوان | ... |
// §8 also names ids in its coverage table (the same video covering several
// industries), so the coverage block is cut out before counting.
const scenarios = text.replace(/### پوشش ۴۹ صنف[\s\S]*$/, '')
const ids = [...scenarios.matchAll(/^\|\s*(L[0-4]\.\d{2})\s*\|/gm)].map((m) => m[1])

const byLayer = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 }
for (const id of ids) byLayer[id.slice(0, 2)] += 1

const dups = ids.filter((id, i) => ids.indexOf(id) !== i)

console.log(`scenario rows found: ${ids.length}`)
console.log(`unique ids: ${new Set(ids).size}`)
console.log(`duplicates: ${dups.length ? dups.join(', ') : 'none'}`)
console.log('')
for (const [layer, n] of Object.entries(byLayer)) console.log(`  ${layer}: ${n}`)
console.log('')

// The layer table in §2 states a target per layer — read it back and compare.
const targets = {}
for (const m of text.matchAll(/\|\s*([۰۱۲۳۴])\s*\|[^|]*\|[^|]*\|\s*([۰-۹\d]+)\s*\|/g)) {
  const map = { '۰': 'L0', '۱': 'L1', '۲': 'L2', '۳': 'L3', '۴': 'L4' }
  const layer = map[m[1]]
  if (layer) targets[layer] = Number(m[2].replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
}

console.log('declared targets in §2 vs rows actually written:')
let ok = true
for (const layer of ['L0', 'L1', 'L2', 'L3', 'L4']) {
  const t = targets[layer]
  const a = byLayer[layer]
  const match = t === a ? 'OK' : 'MISMATCH'
  if (t !== a) ok = false
  console.log(`  ${layer}: declared ${t ?? '?'} · written ${a} · ${match}`)
}
const total = ids.length
console.log(`\nTOTAL: ${total} (target 100) — ${total === 100 && ok ? 'OK' : 'MISMATCH'}`)

// Blacklisted claims must not appear anywhere in the plan's scenario rows.
const BLACKLIST = [
  'مودیان',
  'کد رهگیری مالیاتی',
  'یادآور پیامکی',
  'امضای پیامکی',
  'ضدجعل',
  'تضمین',
  '۱۰۰٪',
  'مصونیت کامل',
  'جریمه‌ی صفر ریال',
  'معافیت قانونی',
]
// The blacklist section itself names them on purpose — exclude that block.
const body = text.replace(/### ⛔ فهرست سیاه ادعا[\s\S]*?### ⛔ قید آفلاین/, '')
const hits = BLACKLIST.filter((w) => body.includes(w))
console.log(
  `\nblacklisted claims outside the blacklist section: ${hits.length ? hits.join(', ') : 'none'}`,
)
