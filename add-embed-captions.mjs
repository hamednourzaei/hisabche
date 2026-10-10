// add-embed-captions.mjs — add the four widget captions the client widgets need.
// Run once. Idempotent: refuses to overwrite an existing value.
import { readFileSync, writeFileSync } from 'node:fs'

const ADD = {
  fa: {
    invoice: 'کامپوننت واقعی فاکتور (InvoiceCard)',
    journal: 'سند حسابداری زنده (JournalVisual)',
    till: 'ثبت دخل و صندوق فروشگاهی (TillVisual)',
    offline: 'موتور همگام‌سازی آفلاین (OfflineVisual)',
    invoiceNote: 'وضعیت سند تغییر می‌کند؛ مبلغ از کاتالوگ پیام می‌آید، نه از یک مشتری واقعی.',
  },
  af: {
    invoice: 'کمپوننت واقعی بل (InvoiceCard)',
    journal: 'سند حسابداری زنده (JournalVisual)',
    till: 'ثبت دخل و صندوق دکان (TillVisual)',
    offline: 'موتور هم‌غام‌سازی آفلاین (OfflineVisual)',
    invoiceNote: 'وضعیت سند تغییر می‌کند؛ مبلغ از کتالوگ پیام می‌آید، نه از یک مشتری واقعی.',
  },
  en: {
    invoice: 'The real invoice component (InvoiceCard)',
    journal: 'Live accounting voucher (JournalVisual)',
    till: 'Till and POS register (TillVisual)',
    offline: 'Offline sync engine (OfflineVisual)',
    invoiceNote:
      'The document status changes; the figure comes from the message catalogue, not from a real customer.',
  },
}

for (const [locale, add] of Object.entries(ADD)) {
  const p = `packages/i18n/messages/${locale}/common.json`
  const raw = readFileSync(p, 'utf8')
  const m = JSON.parse(raw)
  const v = m.landing.visual

  for (const [k, val] of Object.entries(add)) {
    if (v[k] !== undefined) {
      console.log(`SKIP ${locale} landing.visual.${k} — already set`)
      continue
    }
    v[k] = val
  }

  // Re-serialise with the file's own indentation.
  const indent = /^\{\n(\s+)/.exec(raw)?.[1] ?? '  '
  writeFileSync(p, JSON.stringify(m, null, Number(indent.length)) + '\n', 'utf8')
  console.log(`WROTE ${p}`)
}
