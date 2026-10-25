import fs from 'node:fs'

const all = fs.readFileSync('.agent-notes/agent-a/_test-names.txt', 'utf8').split('\n')
const groups = {
  reverse: /revers|cancel|void|برگشت|ابطال/i,
  profit: /profit|margin|unknown-is-not-zero|costStatus|سود/i,
  offline: /offline|queue|outbox|conflict|sync/i,
  permission: /permission|rbac|separation|capabilit|scope|denied|sod/i,
  planlimit: /plan.?limit|quota|ceiling|limit/i,
  currency: /currenc|fx|exchange|revaluat/i,
  inventory: /cycle.?count|transfer|costing|fifo|avco|stock/i,
  printing: /print|receipt|esc\/pos/i,
}

const out = []
for (const [name, re] of Object.entries(groups)) {
  const hits = all.filter((l) => re.test(l))
  const byFile = new Map()
  for (const h of hits) {
    const [f] = h.split(' :: ')
    byFile.set(f, (byFile.get(f) ?? 0) + 1)
  }
  out.push(`\n## ${name}: ${hits.length} tests in ${byFile.size} files`)
  const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  for (const [f, n] of top) out.push(`  ${n}  ${f}`)
  out.push('  -- sample names --')
  for (const h of hits.slice(0, 10)) out.push(`  * ${h.replace(/^.*[\\/]/, '')}`)
}

fs.writeFileSync('.agent-notes/agent-a/_test-groups.txt', out.join('\n'), 'utf8')
console.log(out.join('\n').slice(0, 200))
