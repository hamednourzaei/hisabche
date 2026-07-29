// ============================================
// backend/src/pdf/InvoicePDFDocument.tsx
// Server-side PDF Document — @react-pdf/renderer
// Kept in structural parity with the on-page document
// (packages/ui/.../invoice-detail/invoice-document.tsx): same
// sections/fields/order — customer info, item table columns
// (incl. unit + discount), totals breakdown, notes, signature area,
// and the shareable QR code.
// ============================================

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'
import path from 'path'

// ─── Register Font ──────────────────────────────────────────
const fontPath = path.resolve(__dirname, '../fonts')
Font.register({
  family: 'Vazirmatn',
  fonts: [
    { src: path.join(fontPath, 'Vazirmatn-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontPath, 'Vazirmatn-Bold.ttf'), fontWeight: 700 },
  ],
})

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: 'Vazirmatn', direction: 'rtl', padding: 30, backgroundColor: '#ffffff', fontSize: 11 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  brand: { fontSize: 22, fontWeight: 700, color: '#00b97a' },
  brandSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  invoiceNum: { fontSize: 16, fontWeight: 700 },
  invoiceMeta: { fontSize: 10, color: '#64748b', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6, alignSelf: 'flex-end', fontSize: 9, fontWeight: 700 },
  qr: { width: 56, height: 56, marginTop: 8, alignSelf: 'flex-end' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  infoBox: { flexGrow: 1, flexBasis: 0, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10 },
  infoTitle: { fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 },
  infoLine: { fontSize: 10, color: '#1e293b', marginTop: 2 },

  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 6 },
  thNum: { width: '5%', textAlign: 'right' },
  thName: { width: '30%', textAlign: 'right', fontWeight: 700 },
  thQty: { width: '10%', textAlign: 'center', fontWeight: 700 },
  thUnit: { width: '10%', textAlign: 'center', fontWeight: 700 },
  thUnitPrice: { width: '18%', textAlign: 'right', fontWeight: 700 },
  thDiscount: { width: '10%', textAlign: 'right', fontWeight: 700 },
  thTotal: { width: '17%', textAlign: 'right', fontWeight: 700 },
  tdNum: { width: '5%', textAlign: 'right', color: '#94a3b8' },
  tdName: { width: '30%', textAlign: 'right' },
  tdQty: { width: '10%', textAlign: 'center' },
  tdUnit: { width: '10%', textAlign: 'center', color: '#94a3b8' },
  tdUnitPrice: { width: '18%', textAlign: 'right' },
  tdDiscount: { width: '10%', textAlign: 'right', color: '#94a3b8' },
  tdTotal: { width: '17%', textAlign: 'right', fontWeight: 600 },

  totals: { marginTop: 20, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '55%', marginBottom: 4 },
  totalLabel: { width: '50%', textAlign: 'right', color: '#64748b' },
  totalValue: { width: '50%', textAlign: 'right' },
  grandRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '55%', borderTopWidth: 2, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 },
  grandLabel: { width: '50%', textAlign: 'right', fontWeight: 700, fontSize: 14 },
  grandValue: { width: '50%', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#00b97a' },

  notesBox: { marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  notesTitle: { fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 },
  notesText: { fontSize: 10, color: '#1e293b' },

  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40, gap: 24 },
  signatureBox: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  signatureLine: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#94a3b8', borderStyle: 'dashed', height: 40 },
  signatureLabel: { fontSize: 9, color: '#94a3b8', marginTop: 6 },

  footer: { marginTop: 30, textAlign: 'center', fontSize: 9, color: '#94a3b8' },
})

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#dcfce7', text: '#16a34a' },
  paid: { bg: '#dcfce7', text: '#16a34a' },
  pending: { bg: '#fef3c7', text: '#f59e0b' },
  overdue: { bg: '#fee2e2', text: '#dc2626' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  partial: { bg: '#f1f5f9', text: '#64748b' },
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  pending: 'در انتظار',
  overdue: 'سررسید گذشته',
  cancelled: 'لغو شده',
  partial: 'جزئی',
}

const DEFAULT_STATUS = STATUS_STYLE.pending!

const fmt = (n: number) => (n ?? 0).toLocaleString('fa-AF')
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('fa-AF') } catch { return d } }

// ─── PDF Document ──────────────────────────────────────────
// `qrDataUrl` — optional PNG data URI (from qrcode.toDataURL) encoding
// the same public-view share link used by the on-page QR code.
export function InvoicePDFDocument({ invoice, qrDataUrl }: { invoice: any; qrDataUrl?: string | null }) {
  const inv = invoice as any
  const items = inv.invoice_items ?? inv.items ?? []
  const status: string = inv.status || 'pending'
  const st = STATUS_STYLE[status] ?? DEFAULT_STATUS
  const customer = inv.customer ?? null
  const customerName = customer?.full_name ?? inv.customer_name ?? inv.customerName
  const customerPhone = customer?.phone
  const customerEmail = customer?.email
  const customerAddress = customer?.address
  const hasCustomerInfo = !!(customerName || customerPhone || customerEmail || customerAddress)

  const subtotal = inv.subtotal ?? 0
  const discountTotal = inv.discount_total ?? inv.discountTotal ?? 0
  const taxTotal = inv.tax_total ?? inv.taxTotal ?? 0
  const total = inv.total ?? 0
  const paidAmount = inv.paid_amount ?? inv.paidAmount ?? 0
  const remaining = total - paidAmount

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Hisabche</Text>
            <Text style={s.brandSub}>hisabche.com</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.invoiceNum}>#{inv.invoice_number ?? inv.invoiceNumber ?? ''}</Text>
            <Text style={{ ...s.badge, backgroundColor: st.bg, color: st.text }}>
              {STATUS_LABEL[status] ?? status}
            </Text>
            {qrDataUrl ? <Image src={qrDataUrl} style={s.qr} /> : null}
          </View>
        </View>

        {/* Invoice info + customer info — matches invoice-document.tsx's two-box layout */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>اطلاعات فاکتور</Text>
            <Text style={s.infoLine}>تاریخ: {fmtDate(inv.date ?? '')}</Text>
            {inv.due_date || inv.dueDate ? (
              <Text style={s.infoLine}>سررسید: {fmtDate(inv.due_date ?? inv.dueDate)}</Text>
            ) : null}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>اطلاعات مشتری</Text>
            {hasCustomerInfo ? (
              <>
                {customerName ? <Text style={s.infoLine}>{customerName}</Text> : null}
                {customerPhone ? <Text style={s.infoLine}>{customerPhone}</Text> : null}
                {customerEmail ? <Text style={s.infoLine}>{customerEmail}</Text> : null}
                {customerAddress ? <Text style={s.infoLine}>{customerAddress}</Text> : null}
              </>
            ) : (
              <Text style={s.infoLine}>مشتری عمومی</Text>
            )}
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={s.thNum}>#</Text>
            <Text style={s.thName}>نام محصول</Text>
            <Text style={s.thQty}>تعداد</Text>
            <Text style={s.thUnit}>واحد</Text>
            <Text style={s.thUnitPrice}>قیمت واحد</Text>
            <Text style={s.thDiscount}>تخفیف</Text>
            <Text style={s.thTotal}>قیمت کل</Text>
          </View>
          {items.map((item: any, i: number) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.tdNum}>{i + 1}</Text>
              <Text style={s.tdName}>{item.product_name ?? item.productName ?? ''}</Text>
              <Text style={s.tdQty}>{item.quantity ?? 1}</Text>
              <Text style={s.tdUnit}>{item.unit ?? '—'}</Text>
              <Text style={s.tdUnitPrice}>{fmt(item.unit_price ?? item.unitPrice ?? 0)} {inv.currency ?? 'AFN'}</Text>
              <Text style={s.tdDiscount}>{item.discount ? `${item.discount}%` : '—'}</Text>
              <Text style={s.tdTotal}>{fmt(item.total_price ?? item.totalPrice ?? 0)} {inv.currency ?? 'AFN'}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>جمع</Text>
            <Text style={s.totalValue}>{fmt(subtotal)} {inv.currency ?? 'AFN'}</Text>
          </View>
          {discountTotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>تخفیف</Text>
              <Text style={{ ...s.totalValue, color: '#dc2626' }}>-{fmt(discountTotal)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
          {taxTotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>مالیات</Text>
              <Text style={s.totalValue}>{fmt(taxTotal)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>مجموع</Text>
            <Text style={s.grandValue}>{fmt(total)} {inv.currency ?? 'AFN'}</Text>
          </View>
          {paidAmount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>پرداخت شده</Text>
              <Text style={{ ...s.totalValue, color: '#16a34a' }}>-{fmt(paidAmount)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
          {remaining > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>باقی‌مانده</Text>
              <Text style={{ ...s.totalValue, color: '#dc2626' }}>{fmt(remaining)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
        </View>

        {/* Notes — matches invoice-document.tsx */}
        {inv.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesTitle}>یادداشت‌ها</Text>
            <Text style={s.notesText}>{inv.notes}</Text>
          </View>
        ) : null}

        {/* Signature area — matches invoice-document.tsx */}
        <View style={s.signatureRow}>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>امضای مشتری</Text>
          </View>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>مهر و امضای فروشنده</Text>
          </View>
        </View>

        <Text style={s.footer}>
          از خرید شما سپاسگزاریم{'\n'}
          ایجاد شده توسط Hisabche — hisabche.com{'\n'}
          {fmtDate(inv.created_at ?? inv.createdAt ?? inv.date ?? '')}
        </Text>
      </Page>
    </Document>
  )
}

export default InvoicePDFDocument
