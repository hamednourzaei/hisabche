// scratch: prefix distribution of routes with no hook (from the CSV)
import fs from 'node:fs'

const csv = fs
  .readFileSync('docs/product-intelligence/ROUTE-DOMAIN-HOOK-UI-MASTER-MATRIX.csv', 'utf8')
  .trim()
  .split('\n')

function parse(line) {
  const out = []
  let inQ = false
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

const headers = parse(csv[0])
const rows = csv.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [headers[i], v])))
const noHook = rows.filter((r) => r.Connection_Status === 'ROUTE_EXISTS_UI_MISSING')
const pre = {}
for (const r of noHook) {
  const seg = r.Route_Path.split('/')[2] || '?'
  pre[seg] = (pre[seg] || 0) + 1
}
console.log('noHook', noHook.length)
console.log(
  Object.entries(pre)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join('\n'),
)
