import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const locales = ['fa', 'af', 'en']

for (const locale of locales) {
  const p = join(root, 'packages', 'i18n', 'messages', locale, 'common.json')
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const terminology = j.terminology ?? {}
  const generic = terminology.generic ?? {}
  const trades = terminology.trades ?? {}
  const common = j.common ?? {}

  console.log(`\n=== ${locale} ===`)
  console.log(
    'terminology.generic keys:',
    Object.keys(generic).length,
    Object.keys(generic).join(', '),
  )
  console.log(
    'terminology.trades keys:',
    Object.keys(trades).length,
    Object.keys(trades).join(', '),
  )

  // Check for common.* keys that terminology references
  const dnaCommonKeys = [
    'common.customer',
    'common.client',
    'common.student',
    'common.product',
    'common.sale',
    'common.stock',
    'common.session',
    'common.spare_parts',
  ]
  for (const k of dnaCommonKeys) {
    const [ns, ...rest] = k.split('.')
    const val = j[ns]?.[rest.join('.')]
    console.log(`  ${k}: ${val ? '"' + val + '"' : 'MISSING'}`)
  }
}
