// Adds the two breadcrumb labels that were missing, so the trail stops printing
// the raw URL slug (`/en/sync-center` → «sync-center», `/en/onboarding` →
// «onboarding»). One run, all three bundles, every replacement asserted.
import fs from 'node:fs'

const ENTRIES = {
  en: [
    ['sync-center', 'Sync Center'],
    ['onboarding', 'Onboarding'],
  ],
  fa: [
    ['sync-center', 'مرکز همگام‌سازی'],
    ['onboarding', 'راه‌اندازی'],
  ],
  af: [
    ['sync-center', 'مرکز همگام‌سازی'],
    ['onboarding', 'راه‌اندازی'],
  ],
}

for (const [locale, entries] of Object.entries(ENTRIES)) {
  const file = 'packages/i18n/messages/' + locale + '/common.json'
  let source = fs.readFileSync(file, 'utf8')

  const crumbsAt = source.indexOf('"crumbs"')
  if (crumbsAt < 0) throw new Error(locale + ': no crumbs block')

  const blockEnd = source.indexOf('\n  },', crumbsAt)
  if (blockEnd < 0) throw new Error(locale + ': no end of crumbs block')

  const block = source.slice(crumbsAt, blockEnd)
  const anchor = block.lastIndexOf('\n')
  const lastLine = block.slice(anchor + 1)
  if (!/^\s{4}"[^"]+":\s".*"$/.test(lastLine)) {
    throw new Error(locale + ': unexpected last crumb line: ' + JSON.stringify(lastLine))
  }

  const insertion = entries
    .map(([key, value]) => `,\n    ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join('')

  for (const [key] of entries) {
    if (new RegExp('"' + key + '"').test(block)) {
      throw new Error(locale + ': ' + key + ' already present in crumbs')
    }
  }

  source = source.slice(0, blockEnd) + insertion + source.slice(blockEnd)
  fs.writeFileSync(file, source, 'utf8')

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const [key, value] of entries) {
    if (parsed.crumbs[key] !== value) throw new Error(locale + ': ' + key + ' did not land')
  }
  console.log(locale + ': added ' + entries.length + ' crumbs, JSON parses, keys verified')
}
