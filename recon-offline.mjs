import { readFileSync } from 'node:fs'
const L = JSON.parse(readFileSync('packages/i18n/messages/fa/common.json', 'utf8')).landing
console.log('transformStep:')
for (const [id, v] of Object.entries(L.transformStep))
  console.log(' ', id, JSON.stringify(v, null, 0))
console.log('\noffline:', JSON.stringify(L.offline, null, 1))
console.log('\ndesc1 present?', 'desc1' in L.offline, '| offline.desc1 =', L.offline.desc1)
