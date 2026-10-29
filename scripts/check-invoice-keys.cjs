const fs = require('fs')
const en = JSON.parse(fs.readFileSync('packages/i18n/messages/en/common.json', 'utf8'))
const fa = JSON.parse(fs.readFileSync('packages/i18n/messages/fa/common.json', 'utf8'))
const af = JSON.parse(fs.readFileSync('packages/i18n/messages/af/common.json', 'utf8'))

const keys = [
  'reasonDefective',
  'reasonWrongItem',
  'reasonChangeOfMind',
  'reasonDamaged',
  'reasonExpired',
  'reasonOther',
  'invoiceQuantity',
]

console.log(
  'EN:',
  keys.map((k) => `${k}: ${en.invoices?.[k]}`),
)
console.log(
  'FA:',
  keys.map((k) => `${k}: ${fa.invoices?.[k]}`),
)
console.log(
  'AF:',
  keys.map((k) => `${k}: ${af.invoices?.[k]}`),
)
