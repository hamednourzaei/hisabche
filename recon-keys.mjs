// recon-keys.mjs — which landing.* keys does anything actually read?
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const msg = JSON.parse(readFileSync('packages/i18n/messages/fa/common.json', 'utf8')).landing

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === 'dist') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(p)) out.push(p)
  }
  return out
}

// Everything that could read a landing key.
const sources = [
  ...walk('packages/ui/src'),
  ...walk('apps/web'),
  ...walk('apps/desktop'),
  ...walk('apps/mobile'),
].filter((f) => !f.includes('__tests__'))

const blob = sources.map((f) => readFileSync(f, 'utf8')).join('\n')

function flatten(o, p) {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, p + k + '.') : [p + k],
  )
}

const all = flatten(msg, 'landing.')
const dead = all.filter((k) => {
  // last segment, as t() callers often reference the tail
  const leaf = k.split('.').pop()
  return !blob.includes(`'${k}'`) && !blob.includes(`"${k}"`) && !blob.includes('.' + leaf + "'")
})

console.log('TOTAL KEYS', all.length)
console.log('NEVER READ', dead.length)
console.log(dead.join('\n'))
