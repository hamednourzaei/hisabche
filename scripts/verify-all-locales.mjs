import fs from 'node:fs'

const locales = ['en', 'fa', 'af']
const keysToCheck = [
  'auth.localUser',
  'auth.offlineFirstRun.title',
  'auth.offlineFirstRun.ownerName',
  'auth.offlineFirstRun.ownerNamePlaceholder',
  'auth.offlineFirstRun.name',
  'auth.offlineFirstRun.namePlaceholder',
  'auth.offlineFirstRun.ownerEmail',
  'auth.offlineFirstRun.ownerEmailPlaceholder',
  'auth.offlineFirstRun.timeZone',
  'auth.offlineFirstRun.currency',
  'auth.offlineFirstRun.submit',
  'sync.localActive',
  'status.pending',
  'status.paid',
  'status.completed',
  'status.cancelled',
  'status.partial',
  'status.overdue',
  'status.draft',
  'notifications.saleInvoiceCreated',
  'notifications.purchaseInvoiceCreated',
  'notifications.invoiceRegisteredBody',
  'notifications.paymentReceived',
  'notifications.paymentSent',
  'notifications.paymentRecorded',
  'notifications.newCustomerAdded',
  'notifications.customerCreated',
  'notifications.activityCount',
  'settings.editProfile',
  'settings.fullName',
  'settings.businessNamePlaceholder',
]

function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj)
}

let allOk = true
for (const locale of locales) {
  const content = JSON.parse(
    fs.readFileSync(`packages/i18n/messages/${locale}/common.json`, 'utf8'),
  )
  console.log(`\n=== Checking locale [${locale}] ===`)
  for (const k of keysToCheck) {
    const val = getNested(content, k)
    if (val === undefined || val === '') {
      console.error(`  MISSING: ${k}`)
      allOk = false
    } else {
      console.log(`  ${k} => "${val}"`)
    }
  }
}

if (!allOk) {
  process.exit(1)
} else {
  console.log('\nAll checked keys exist in en, fa, af!')
}
