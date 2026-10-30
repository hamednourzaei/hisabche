import fs from 'node:fs'

const keys = [
  'settings.fullNameRequired',
  'settings.profileSaved',
  'settings.saveFailed',
  'settings.fullName',
  'settings.businessNamePlaceholder',
  'common.saving',
  'common.save',
  'common.cancel',
  'settings.editProfile',
  'settings.stampNoWorkspace',
  'settings.stampInvalidType',
  'settings.stampTooLarge',
  'settings.imageSaved',
  'settings.stampUploadFailed',
  'settings.imageRemoved',
  'settings.businessStamp',
  'settings.backupFailed',
  'settings.cacheEntriesUnit',
]

for (const lang of ['en', 'fa', 'af']) {
  const data = JSON.parse(fs.readFileSync(`packages/i18n/messages/${lang}/common.json`, 'utf8'))
  const missing = []
  for (const k of keys) {
    const v = k.split('.').reduce((o, i) => (o ? o[i] : undefined), data)
    if (v === undefined || v === '') missing.push(k)
  }
  console.log(`[${lang}] missing ${missing.length} keys:`, missing)
}
