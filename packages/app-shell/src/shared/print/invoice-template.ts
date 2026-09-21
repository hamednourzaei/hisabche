// ============================================
// Print templates.
//
// A4 output is a self-contained HTML document — the print window loads it as a
// data URL, so it cannot reference app assets. Styles are inlined and use plain
// values rather than CSS variables, which do not resolve in that context.
// ============================================

export interface PrintableLine {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface PrintableInvoice {
  invoiceNumber: string
  date: string
  customerName: string
  lines: readonly PrintableLine[]
  subtotal: string
  total: string
  paid: string
  currencySign: string
}

export interface PrintLabels {
  title: string
  invoiceNumber: string
  customer: string
  date: string
  product: string
  quantity: string
  unitPrice: string
  amount: string
  subtotal: string
  total: string
  paid: string
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )

function rows(invoice: PrintableInvoice): string {
  return invoice.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.productName)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${line.unitPrice}</td>
        <td class="num">${line.totalPrice}</td>
      </tr>`,
    )
    .join('')
}

/** A4 invoice. `direction` follows the active locale. */
export function renderInvoiceHtml(
  invoice: PrintableInvoice,
  labels: PrintLabels,
  direction: 'rtl' | 'ltr',
): string {
  return `<!doctype html>
<html dir="${direction}">
<head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: 'Vazirmatn', system-ui, sans-serif; color: #101820; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #5a6b70; margin-bottom: 20px; }
  .meta div { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #dde5e6; text-align: ${direction === 'rtl' ? 'right' : 'left'}; }
  th { background: #f2f7f7; font-weight: 700; }
  .num { text-align: ${direction === 'rtl' ? 'left' : 'right'}; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 18px; width: 260px; ${direction === 'rtl' ? 'margin-left' : 'margin-right'}: 0; ${direction === 'rtl' ? 'margin-right' : 'margin-left'}: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .grand { border-top: 2px solid #101820; font-weight: 700; font-size: 14px; }
</style></head>
<body>
  <h1>${escapeHtml(labels.title)}</h1>
  <div class="meta">
    <div>${escapeHtml(labels.invoiceNumber)}: ${escapeHtml(invoice.invoiceNumber)}</div>
    <div>${escapeHtml(labels.customer)}: ${escapeHtml(invoice.customerName)}</div>
    <div>${escapeHtml(labels.date)}: ${escapeHtml(invoice.date)}</div>
  </div>

  <table>
    <thead><tr>
      <th>${escapeHtml(labels.product)}</th>
      <th class="num">${escapeHtml(labels.quantity)}</th>
      <th class="num">${escapeHtml(labels.unitPrice)}</th>
      <th class="num">${escapeHtml(labels.amount)}</th>
    </tr></thead>
    <tbody>${rows(invoice)}</tbody>
  </table>

  <div class="totals">
    <div><span>${escapeHtml(labels.subtotal)}</span><span class="num">${escapeHtml(invoice.subtotal)}</span></div>
    <div><span>${escapeHtml(labels.paid)}</span><span class="num">${escapeHtml(invoice.paid)}</span></div>
    <div class="grand"><span>${escapeHtml(labels.total)}</span><span class="num">${escapeHtml(invoice.total)} ${escapeHtml(invoice.currencySign)}</span></div>
  </div>
</body></html>`
}
