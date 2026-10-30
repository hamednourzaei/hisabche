import fs from 'node:fs'

for (const loc of ['en', 'fa', 'af']) {
  const p = 'packages/i18n/messages/' + loc + '/common.json'
  const s = fs.readFileSync(p, 'utf8')
  const i = s.indexOf('"crumbs"')
  console.log('=== ' + loc + ' @ ' + i + ' ===')
  console.log(JSON.stringify(s.slice(i - 20, i + 400)))
}
