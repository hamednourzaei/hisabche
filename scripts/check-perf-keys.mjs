import fs from 'node:fs'

const keys = [
  'settings.perfAuto',
  'settings.perfNormal',
  'settings.perfLite',
  'settings.brandImages.logo',
  'settings.brandImages.stamp',
  'settings.brandImages.signature',
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
