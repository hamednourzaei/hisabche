import fs from 'node:fs'

const keys = [
  'auth.offlineEditionFailed',
  'auth.offlineFirstRun.timeZoneRequired',
  'auth.offlineFirstRun.failed',
  'auth.offlineEditionPreparing',
  'auth.offlineEdition',
  'auth.offlineFirstRun.description',
  'auth.offlineFirstRun.timeZoneHint',
  'auth.offlineFirstRun.creating',
]

for (const lang of ['en', 'fa', 'af']) {
  const data = JSON.parse(fs.readFileSync(`packages/i18n/messages/${lang}/common.json`, 'utf8'))
  for (const k of keys) {
    const v = k.split('.').reduce((o, i) => (o ? o[i] : undefined), data)
    console.log(`[${lang}] ${k} = ${v}`)
  }
}
