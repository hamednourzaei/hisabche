import fs from 'node:fs'

for (const lang of ['en', 'fa', 'af']) {
  const data = JSON.parse(fs.readFileSync(`packages/i18n/messages/${lang}/common.json`, 'utf8'))
  console.log(`[${lang}] settings.imageNotSupported:`, data.settings?.imageNotSupported)
}
