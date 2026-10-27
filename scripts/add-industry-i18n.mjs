import fs from 'node:fs'

const additions = {
  fa: {
    industryTitle: 'صنف و نوع کسب‌وکار',
    industryHint: 'صنف تعیین می‌کند واحد پیش‌فرض، ستون‌های فاکتور و ترتیب داشبورد چه باشد.',
    industryOwnerOnly: 'تنها مالک کسب‌وکار می‌تواند صنف را تغییر دهد.',
    industrySaved: 'صنف ذخیره شد.',
    industrySaveFailed: 'ذخیره‌ی صنف انجام نشد',
  },
  af: {
    industryTitle: 'صنف و نوع کسب‌وکار',
    industryHint: 'صنف تعیین می‌کند واحد پیش‌فرض، ستون‌های فاکتور و ترتیب داشبورد چه باشد.',
    industryOwnerOnly: 'تنها مالک کسب‌وکار می‌تواند صنف را تغییر دهد.',
    industrySaved: 'صنف ذخیره شد.',
    industrySaveFailed: 'ذخیره‌ی صنف انجام نشد',
  },
  en: {
    industryTitle: 'Industry',
    industryHint: 'The industry sets the default unit, invoice columns and dashboard order.',
    industryOwnerOnly: 'Only the workspace owner can change the industry.',
    industrySaved: 'Industry saved.',
    industrySaveFailed: 'The industry could not be saved',
  },
}

for (const [locale, entries] of Object.entries(additions)) {
  const file = `packages/i18n/messages/${locale}/common.json`
  const source = fs.readFileSync(file, 'utf8')
  const json = JSON.parse(source)
  if (!json.settings || typeof json.settings !== 'object') {
    throw new Error(`no settings object in ${file}`)
  }
  let added = 0
  for (const [key, value] of Object.entries(entries)) {
    if (json.settings[key] === undefined) {
      json.settings[key] = value
      added += 1
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
  console.log(`${locale}: added ${added}`)
}
