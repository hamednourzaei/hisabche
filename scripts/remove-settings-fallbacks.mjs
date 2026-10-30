import fs from 'node:fs'

const filePath = 'packages/ui/src/components/ui/settings/settings-page.tsx'
let content = fs.readFileSync(filePath, 'utf8')

const replacements = [
  ["t('settings.fullNameRequired', 'نام نمی‌تواند خالی باشد')", "t('settings.fullNameRequired')"],
  ["t('settings.profileSaved', 'اطلاعات ذخیره شد')", "t('settings.profileSaved')"],
  ["t('settings.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.')", "t('settings.saveFailed')"],
  ["t('settings.fullName', 'نام')", "t('settings.fullName')"],
  [
    "t('settings.businessNamePlaceholder', 'مثلاً: فروشگاه حسابچه')",
    "t('settings.businessNamePlaceholder')",
  ],
  ["t('common.saving', 'در حال ذخیره...')", "t('common.saving')"],
  ["t('common.save', 'ذخیره')", "t('common.save')"],
  ["t('common.cancel', 'انصراف')", "t('common.cancel')"],
  ["t('settings.editProfile', 'ویرایش اطلاعات')", "t('settings.editProfile')"],
  [
    "t(\n      'settings.imageNotSupported',\n      'ذخیره‌ی این تصویر روی این سرور هنوز فعال نیست. با پشتیبانی تماس بگیرید.',\n    )",
    "t('settings.imageNotSupported')",
  ],
  [
    "t(\n                    'settings.imageNotSupported',\n                    'ذخیره‌ی این تصویر روی این سرور هنوز فعال نیست. با پشتیبانی تماس بگیرید.',\n                  )",
    "t('settings.imageNotSupported')",
  ],
  [
    "t('settings.stampNoWorkspace', 'کسب‌وکار هنوز بارگذاری نشده — کمی بعد دوباره تلاش کنید.')",
    "t('settings.stampNoWorkspace')",
  ],
  [
    "t('settings.stampInvalidType', 'فقط تصویر PNG یا SVG پذیرفته می‌شود.')",
    "t('settings.stampInvalidType')",
  ],
  [
    "t('settings.stampTooLarge', 'حجم تصویر باید کمتر از ۱ مگابایت باشد.')",
    "t('settings.stampTooLarge')",
  ],
  ["t('settings.imageSaved', 'تصویر ذخیره شد')", "t('settings.imageSaved')"],
  [
    "t('settings.stampUploadFailed', 'بارگذاری تصویر ناموفق بود.')",
    "t('settings.stampUploadFailed')",
  ],
  ["t('settings.imageRemoved', 'تصویر حذف شد')", "t('settings.imageRemoved')"],
  ["t('settings.businessStamp', 'مهر کسب‌وکار')", "t('settings.businessStamp')"],
  ["t('settings.backupFailed', 'دانلود پشتیبان ناموفق بود')", "t('settings.backupFailed')"],
  ["t('settings.cacheEntriesUnit', 'مورد')", "t('settings.cacheEntriesUnit')"],
  [
    "{ value: 'auto', labelKey: 'settings.perfAuto', fallback: 'خودکار' }",
    "{ value: 'auto', labelKey: 'settings.perfAuto' }",
  ],
  [
    "{ value: 'normal', labelKey: 'settings.perfNormal', fallback: 'معمولی' }",
    "{ value: 'normal', labelKey: 'settings.perfNormal' }",
  ],
  [
    "{ value: 'lite', labelKey: 'settings.perfLite', fallback: 'اقتصادی' }",
    "{ value: 'lite', labelKey: 'settings.perfLite' }",
  ],
  [
    "{ field: 'logoUrl', column: 'logo_url', labelKey: 'settings.brandImages.logo', fallback: 'لوگو' }",
    "{ field: 'logoUrl', column: 'logo_url', labelKey: 'settings.brandImages.logo' }",
  ],
  [
    "    field: 'stampUrl',\n    column: 'stamp_url',\n    labelKey: 'settings.brandImages.stamp',\n    fallback: 'مهر',",
    "    field: 'stampUrl',\n    column: 'stamp_url',\n    labelKey: 'settings.brandImages.stamp',",
  ],
  [
    "    field: 'signatureUrl',\n    column: 'signature_url',\n    labelKey: 'settings.brandImages.signature',\n    fallback: 'امضا',",
    "    field: 'signatureUrl',\n    column: 'signature_url',\n    labelKey: 'settings.brandImages.signature',",
  ],
  ['{t(labelKey, fallback)}', '{t(labelKey)}'],
  ['label={t(image.labelKey, image.fallback)}', 'label={t(image.labelKey)}'],
]

for (const [target, replacement] of replacements) {
  if (!content.includes(target)) {
    console.error('Target not found:', target)
    process.exit(1)
  }
  content = content.replace(target, replacement)
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated settings-page.tsx without hardcoded fallbacks!')
