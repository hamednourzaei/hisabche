// recon-copy.mjs — does every key copy.ts asks for actually exist?
import { readFileSync } from 'node:fs'

const msg = JSON.parse(readFileSync('packages/i18n/messages/fa/common.json', 'utf8')).landing
const src = readFileSync('packages/ui/src/components/ui/landing/copy.ts', 'utf8')

function get(o, path) {
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
}
function isObj(v) {
  return v !== null && typeof v === 'object'
}

const wanted = [...src.matchAll(/t\('([^']+)'/g)].map((m) => m[1].replace(/^landing\./, ''))
const missing = wanted.filter((k) => get(msg, k) === undefined)

console.log('ASKED', wanted.length, 'MISSING', missing.length)
console.log(missing.join('\n'))

// The object-valued reads: landing.<x> used as a record.
const objs = [...src.matchAll(/t\('(landing\.[A-Za-z]+)'\)/g)].map((m) =>
  m[1].replace(/^landing\./, ''),
)
console.log('\nOBJECT READS')
for (const o of objs) {
  const v = get(msg, o)
  console.log(`  ${o}: ${isObj(v) ? 'object {' + Object.keys(v).join(',') + '}' : typeof v}`)
}
