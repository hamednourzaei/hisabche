// fix-variant-props.mjs — the ten variant roots each declared their OWN
// `VariantProps { locale: string }` and destructured `{ locale }`. Ten copies of
// one interface is the parallel-architecture shape (G2), and widening all ten
// by hand is how they drift apart again.
//
// Delete all ten, import the shared one, and destructure from it.
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const files = globSync('src/components/ui/landing/variants/*/index.tsx')
let n = 0

for (const file of files) {
  const before = readFileSync(file, 'utf8')
  let src = before

  // 1. Remove the local interface.
  src = src.replace(/export interface VariantProps \{\n {2}locale: string\n\}\n\n/, '')

  // 2. Replace the destructuring with the shared type's fields.
  src = src.replace(
    /export function (\w+)\(\{ locale \}: VariantProps\)/,
    'export function $1({ locale, t, captions, invoiceNote }: VariantProps)',
  )

  // 3. Import the shared type.
  src = src.replace(
    /^(import React from 'react'\n)/m,
    "$1import type { VariantProps } from '../copy'\n",
  )

  if (src === before) {
    console.log('UNCHANGED', file)
    continue
  }
  writeFileSync(file, src, 'utf8')
  console.log('REWROTE', file)
  n++
}
console.log('\nchanged', n, 'of', files.length)
