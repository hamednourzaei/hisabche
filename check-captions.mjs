import { readFileSync } from 'node:fs'
const v = {}
for (const l of ['fa', 'af', 'en'])
  v[l] = JSON.parse(readFileSync(`packages/i18n/messages/${l}/common.json`, 'utf8')).landing.visual

const keys = [
  'example',
  'invoiceCaption',
  'journalCaption',
  'tillCaption',
  'offlineCaption',
  'invoiceNote',
]
for (const k of keys) {
  const row = ['fa', 'af', 'en'].map((l) => {
    const x = v[l][k]
    return (x === undefined ? 'MISSING' : String(x).slice(0, 30)).padEnd(32)
  })
  console.log(k.padEnd(15), row.join('| '))
}
console.log(
  '\nall present in all three:',
  keys.every((k) => ['fa', 'af', 'en'].every((l) => v[l][k] !== undefined)),
)
