import fs from 'node:fs'

const j = JSON.parse(fs.readFileSync('packages/i18n/messages/fa/common.json', 'utf8'))
const flat = []
const walk = (o, p) => {
  for (const k in o) {
    const v = o[k]
    const q = p ? `${p}.${k}` : k
    if (v && typeof v === 'object') walk(v, q)
    else flat.push([q, String(v)])
  }
}
walk(j, '')

const out = []
for (const term of ['دانلود', 'ویندوز', 'اندروید', 'اپلیکیشن', 'دسکتاپ', 'نسخه‌ی محلی']) {
  const hits = flat.filter(([, v]) => v.includes(term))
  out.push(`### ${term} (${hits.length})`)
  for (const [k, v] of hits.slice(0, 10)) out.push(`${k} = ${v.slice(0, 110)}`)
}
fs.writeFileSync('.agent-notes/agent-a/_download.txt', out.join('\n'), 'utf8')
console.log('done', out.length)
