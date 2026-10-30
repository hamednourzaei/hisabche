import fs from 'node:fs'

for (const loc of ['en', 'fa', 'af']) {
  const j = JSON.parse(fs.readFileSync('packages/i18n/messages/' + loc + '/common.json', 'utf8'))
  console.log('=== ' + loc + ' currency ===')
  console.log(JSON.stringify(j.currency, null, 1).slice(0, 2500))
}
