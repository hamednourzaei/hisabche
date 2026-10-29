const fs = require('fs')

const en = JSON.parse(fs.readFileSync('packages/i18n/messages/en/common.json', 'utf8'))
const fa = JSON.parse(fs.readFileSync('packages/i18n/messages/fa/common.json', 'utf8'))
const af = JSON.parse(fs.readFileSync('packages/i18n/messages/af/common.json', 'utf8'))

console.log('--- EN notifications ---')
console.log(en.notifications)
console.log('--- EN time ---')
console.log(en.time)

console.log('--- FA notifications ---')
console.log(fa.notifications)
console.log('--- FA time ---')
console.log(fa.time)

console.log('--- AF notifications ---')
console.log(af.notifications)
console.log('--- AF time ---')
console.log(af.time)
