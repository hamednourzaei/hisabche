import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'C:/Users/hamed/Desktop/hisabche'
const files = [
  'apps/admin/app/[lang]/(admin)/operations/operations-client.tsx',
  'apps/admin/app/[lang]/(admin)/operations/monitor/monitor-panel.tsx',
  'apps/admin/app/[lang]/(admin)/revenue/revenue-client.tsx',
  'apps/admin/app/[lang]/(admin)/revenue/gateways/gateways-panel.tsx',
  'apps/admin/app/[lang]/(admin)/security/security-client.tsx',
  'apps/admin/app/[lang]/wall/wall-client.tsx',
  'apps/admin/app/[lang]/wall/page.tsx',
  'apps/admin/hooks/use-admin-monitor.ts',
  'apps/admin/hooks/use-admin-gateways.ts',
  'apps/admin/hooks/use-admin-security.ts',
]

const locales = ['fa', 'af', 'en']
const messages = {}
for (const locale of locales) {
  messages[locale] = JSON.parse(
    readFileSync(join(ROOT, 'packages/i18n/messages', locale, 'common.json'), 'utf8'),
  )
}

function resolve(tree, dotted) {
  let node = tree
  for (const part of dotted.split('.')) {
    if (node && typeof node === 'object' && part in node) node = node[part]
    else return undefined
  }
  return node
}

const used = new Set()
for (const file of files) {
  const source = readFileSync(join(ROOT, file), 'utf8')
  for (const m of source.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1])
  for (const m of source.matchAll(/labelKey:\s*'([^']+)'/g)) used.add(m[1])
}

let missing = 0
for (const key of [...used].sort()) {
  for (const locale of locales) {
    if (typeof resolve(messages[locale], key) !== 'string') {
      console.log(`MISSING ${locale}: ${key}`)
      missing += 1
    }
  }
}
console.log(`keys checked: ${used.size}, missing: ${missing}`)
