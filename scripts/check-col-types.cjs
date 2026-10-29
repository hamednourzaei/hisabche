const fs = require('fs')
const en = JSON.parse(fs.readFileSync('packages/i18n/messages/en/common.json', 'utf8'))
const fa = JSON.parse(fs.readFileSync('packages/i18n/messages/fa/common.json', 'utf8'))
const af = JSON.parse(fs.readFileSync('packages/i18n/messages/af/common.json', 'utf8'))

console.log('EN columnType:', en.invoiceBuilder?.columnType)
console.log('FA columnType:', fa.invoiceBuilder?.columnType)
console.log('AF columnType:', af.invoiceBuilder?.columnType)
