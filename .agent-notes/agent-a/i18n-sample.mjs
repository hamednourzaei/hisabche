import fs from 'node:fs'

const read = (lang) =>
  JSON.parse(fs.readFileSync(`packages/i18n/messages/${lang}/common.json`, 'utf8'))

const fa = read('fa')
const af = read('af')

function leaves(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out)
    else out.push([p, v])
  }
  return out
}

const lines = []
lines.push('# i18n sampling — fa')
const counts = Object.entries(fa).map(([k, v]) => [k, leaves(v, k).length])
counts.sort((a, b) => b[1] - a[1])
lines.push(`top-level namespaces: ${counts.length}`)
for (const [k, n] of counts) lines.push(`${k}: ${n}`)

const wanted = [
  'nav',
  'dashboard',
  'invoices',
  'customers',
  'warehouse',
  'accounting',
  'reports',
  'offline',
  'sync',
  'auth',
  'billing',
  'team',
  'settings',
  'manufacturing',
  'ai',
  'till',
  'approvals',
  'audit',
  'governance',
  'onboarding',
  'landing',
]

const diffs = []
for (const ns of wanted) {
  const faLeaves = leaves(fa[ns] ?? {}, ns)
  lines.push('')
  lines.push(`## ${ns} (${faLeaves.length})`)
  const step = Math.max(1, Math.floor(faLeaves.length / 14))
  for (let i = 0; i < faLeaves.length && i / step < 14; i += step) {
    lines.push(`- ${faLeaves[i][0]} = ${faLeaves[i][1]}`)
  }
  const afLeaves = new Map(leaves(af[ns] ?? {}, ns))
  let n = 0
  for (const [k, v] of faLeaves) {
    const other = afLeaves.get(k)
    if (other !== undefined && other !== v && n < 8) {
      diffs.push(`- ${k}\n    fa: ${v}\n    af: ${other}`)
      n++
    }
  }
}

lines.push('')
lines.push('# fa/af differences (sample, only where wording really differs)')
lines.push(...diffs.slice(0, 90))

fs.writeFileSync('.agent-notes/agent-a/_i18n-sample.txt', lines.join('\n'), 'utf8')
console.log('lines', lines.length, 'diffs', diffs.length)
