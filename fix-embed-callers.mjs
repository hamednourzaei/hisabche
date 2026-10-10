// fix-embed-callers.mjs — thread the server-resolved `t` through the ten
// product-scene files that embed the real widgets.
//
// Before: `<LiveInvoiceWidget locale={locale} />` — the widget built its own
// inline Persian dictionary and never consulted the catalogue.
// After:  `<LiveInvoiceWidget t={t} caption={captions.invoice} note={invoiceNote} />`
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const files = globSync('packages/ui/src/components/ui/landing/variants/*/*-product-scene.tsx')
let changed = 0

for (const file of files) {
  const before = readFileSync(file, 'utf8')
  let src = before

  // 1. Swap the prop shape on every widget call.
  src = src.replace(/<Live(\w+?)Widget\s+locale=\{locale\}\s*\/>/g, (_m, which) => {
    const kind = which.toLowerCase() // invoice | journalvoucher | tillregister | offlinepipeline
    const key = {
      invoice: 'invoice',
      journalvoucher: 'journal',
      tillregister: 'till',
      offlinepipeline: 'offline',
    }[kind]
    if (!key) throw new Error(`${file}: unmapped widget Live${which}Widget`)
    const note = key === 'invoice' ? ' note={invoiceNote}' : ''
    return `<Live${which}Widget t={t} caption={captions.${key}}${note} />`
  })

  // 2. Widen the props type: locale -> t + captions + invoiceNote.
  src = src.replace(
    /export function (\w+)\(\{ locale \}: \{ locale: string \}\)/,
    'export function $1({ t, captions, invoiceNote }: { t: T; captions: Captions; invoiceNote: string })',
  )
  // Tolerate the already-rewritten shape from a previous run.
  src = src.replace(
    /export function (\w+)\(\{ locale \}: \{ locale: string \}\)/g,
    'export function $1({ t, captions, invoiceNote }: { t: T; captions: Captions; invoiceNote: string })',
  )

  if (src === before) {
    console.log('UNCHANGED', file)
    continue
  }

  // 3. Import the prop types, and drop 'use client' — nothing here is
  //    interactive any more; the widget below is the client boundary.
  src = src.replace(/^'use client'\n\n/, '')
  src = src.replace(
    /^(import .*\n)/m,
    "$1import type { T, ProductCaptions as Captions } from '../../copy'\n",
  )

  writeFileSync(file, src, 'utf8')
  console.log('REWROTE', file)
  changed++
}
console.log('\nfiles changed:', changed, 'of', files.length)
