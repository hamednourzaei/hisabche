// fix-variant-index.mjs — the ten variant roots still pass `locale` down to a
// ProductScene that now takes the resolved copy. Swap the call, keep the rest.
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const files = globSync('src/components/ui/landing/variants/*/index.tsx')
let n = 0

for (const file of files) {
  const before = readFileSync(file, 'utf8')
  const src = before.replace(
    /<(\w*ProductScene)\s+locale=\{locale\}\s*\/>/,
    '<$1 t={t} captions={captions} invoiceNote={invoiceNote} />',
  )
  if (src === before) {
    console.log('UNCHANGED', file)
    continue
  }
  writeFileSync(file, src, 'utf8')
  console.log('REWROTE', file, '—', src.match(/<\w*ProductScene[^>]*>/)[0])
  n++
}
console.log('\nchanged', n, 'of', files.length)
