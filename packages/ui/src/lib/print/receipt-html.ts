// ============================================
// A thermal receipt (58/80 mm) as HTML.
//
// ⚠️ WHY HTML AND NOT ESC/POS TEXT. Most thermal printers have no Persian code
// page: Persian sent as ESC/POS text prints as garbage or unjoined, reversed
// letters. HTML is shaped and laid out by the browser engine (RTL, joining,
// the font) and reaches the printer through its Windows driver as an image —
// correct on every printer that has a driver. ESC/POS stays for what it does
// well: the cash drawer and the paper cut (escpos-control.ts).
//
// Every value is escaped; the caller formats money (one formatter for the
// invoice page and its receipt, so they cannot disagree).
// ============================================

export interface ReceiptLine {
  name: string
  quantity: string
  unitPrice: string
  total: string
}

export interface ReceiptData {
  businessName: string
  invoiceNumber: string
  date: string
  customerName?: string | undefined
  lines: ReceiptLine[]
  subtotal: string
  discount?: string | undefined
  tax?: string | undefined
  total: string
  paid: string
  remaining: string
  currency: string
  footer?: string | undefined
}

export interface ReceiptLabels {
  invoice: string
  date: string
  customer: string
  item: string
  quantity: string
  price: string
  amount: string
  subtotal: string
  discount: string
  tax: string
  total: string
  paid: string
  remaining: string
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export function renderReceiptHtml(
  data: ReceiptData,
  labels: ReceiptLabels,
  options: { widthMm: 58 | 80; direction: 'rtl' | 'ltr'; lang: string },
): string {
  const e = escapeHtml
  // Printable area: 80 mm paper ≈ 72 mm, 58 mm ≈ 48 mm.
  const inner = options.widthMm === 80 ? 72 : 48
  const small = options.widthMm === 58
  const row = (label: string, value: string, strong = false) =>
    `<tr class="${strong ? 'strong' : ''}"><td>${e(label)}</td><td class="num">${e(value)} ${e(data.currency)}</td></tr>`

  return `<!doctype html>
<html lang="${e(options.lang)}" dir="${options.direction}">
<head><meta charset="utf-8"><title>${e(labels.invoice)} ${e(data.invoiceNumber)}</title>
<style>
@page { size: ${options.widthMm}mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${inner}mm; margin: 0 auto; padding: 3mm 0 6mm;
  font: ${small ? 10 : 11.5}px/1.45 Tahoma, "Segoe UI", Vazirmatn, sans-serif; }
h1 { font-size: ${small ? 13 : 15}px; margin: 0 0 1mm; text-align: center; }
.meta { text-align: center; margin-bottom: 2mm; }
.meta div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table { width: 100%; border-collapse: collapse; }
.items th { font-weight: 700; border-bottom: 1px dashed #000; padding: 1mm 0; text-align: start; }
.items td { padding: 0.8mm 0; vertical-align: top; }
.items .name { width: 100%; }
.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; padding-inline-start: 2mm; }
.totals { margin-top: 2mm; border-top: 1px dashed #000; }
.totals td { padding: 0.6mm 0; }
.strong td { font-weight: 700; font-size: ${small ? 11.5 : 13}px; }
.footer { margin-top: 3mm; text-align: center; }
</style></head>
<body>
<h1>${e(data.businessName)}</h1>
<div class="meta">
<div>${e(labels.invoice)}: <span dir="ltr">${e(data.invoiceNumber)}</span></div>
<div>${e(labels.date)}: ${e(data.date)}</div>
${data.customerName ? `<div>${e(labels.customer)}: ${e(data.customerName)}</div>` : ''}
</div>
<table class="items">
<thead><tr><th class="name">${e(labels.item)}</th><th class="num">${e(labels.quantity)}</th><th class="num">${e(labels.amount)}</th></tr></thead>
<tbody>
${data.lines
  .map(
    (l) =>
      `<tr><td class="name">${e(l.name)}<br><small>${e(l.unitPrice)} ${e(data.currency)}</small></td><td class="num">${e(l.quantity)}</td><td class="num">${e(l.total)}</td></tr>`,
  )
  .join('\n')}
</tbody></table>
<table class="totals"><tbody>
${row(labels.subtotal, data.subtotal)}
${data.discount ? row(labels.discount, data.discount) : ''}
${data.tax ? row(labels.tax, data.tax) : ''}
${row(labels.total, data.total, true)}
${row(labels.paid, data.paid)}
${row(labels.remaining, data.remaining)}
</tbody></table>
${data.footer ? `<div class="footer">${e(data.footer)}</div>` : ''}
</body></html>`
}
