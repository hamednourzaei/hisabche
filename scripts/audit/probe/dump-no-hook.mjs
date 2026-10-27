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
const lines = noHook.map(
  (r) =>
    `${r.Method} ${r.Route_Path} | ${r.Domain} | ${r.Route_File} | auth=${r.Auth_Guarded} ws=${r.Workspace_Guarded} role=${r.Required_Role}`,
)
fs.writeFileSync('scripts/audit/probe/no-hook-routes.txt', lines.join('\n'))
console.log(lines.length)
