import { readFileSync, writeFileSync } from 'node:fs'

const root = 'C:/Users/hamed/Desktop/hisabche'
const values = {
  en: 'Empty means 30 days from now.',
  fa: 'خالی یعنی ۳۰ روز دیگر.',
  af: 'خالی یعنی ۳۰ روز بعد.',
}

const pattern = /(\r?\n {4,10}"tokenExpires": "[^\r\n]*",)/

for (const [locale, value] of Object.entries(values)) {
  const path = `${root}/packages/i18n/messages/${locale}/common.json`
  const before = readFileSync(path, 'utf8')
  if (before.includes('"tokenExpiryHint"')) {
    console.log(`${locale}: already present`)
    continue
  }
  if (!pattern.test(before)) throw new Error(`${locale}: tokenExpires line not found`)
  const after = before.replace(pattern, `$1\n      "tokenExpiryHint": ${JSON.stringify(value)},`)
  const parsed = JSON.parse(after)
  if (parsed.admin.operations.monitor.tokenExpiryHint !== value) {
    throw new Error(`${locale}: insertion did not land`)
  }
  writeFileSync(path, after)
  console.log(`${locale}: added`)
}
