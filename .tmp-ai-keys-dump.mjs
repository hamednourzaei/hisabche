import { readFileSync } from 'node:fs'

const root = 'C:/Users/hamed/Desktop/hisabche'
const bundle = JSON.parse(readFileSync(`${root}/packages/i18n/messages/en/common.json`, 'utf8'))
console.log(JSON.stringify(bundle.admin.ai, null, 2))
