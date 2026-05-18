// ============================================
// backend/src/pdf/InvoicePDFDocument.tsx
// Server-side PDF Document — @react-pdf/renderer
// ============================================

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

// ─── Register Font ────────────────────────────────────
const fontPath = path.resolve(__dirname, '../fonts')
Font.register({
  family: 'Vazirmatn',
  fonts: [
    { src: path.join(fontPath, 'Vazirmatn-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontPath, 'Vazirmatn-Bold.ttf'), fontWeight: 700 },
  ],
})

// ─── Styles ───────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: 'Vazirmatn', direction: 'rtl', padding: 30, backgroundColor: '#ffffff', fontSize: 11 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  brand: { fontSize: 22, fontWeight: 700, color: '#00b97a' },
  brandSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  invoiceNum: { fontSize: 16, fontWeight: 700 },
  invoiceMeta: { fontSize: 10, color: '#64748b', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6, alignSelf: 'flex-end', fontSize: 9, fontWeight: 700 },
  table: { marginTop: 16 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 6 },
  thNum: { width: '5%', textAlign: 'right' },
  thName: { width: '45%', textAlign: 'right', fontWeight: 700 },
  thQty: { width: '12%', textAlign: 'center', fontWeight: 700 },
  thUnit: { width: '18%', textAlign: 'right', fontWeight: 700 },
  thTotal: { width: '20%', textAlign: 'right', fontWeight: 700 },
  tdNum: { width: '5%', textAlign: 'right', color: '#94a3b8' },
  tdName: { width: '45%', textAlign: 'right' },
  tdQty: { width: '12%', textAlign: 'center' },
  tdUnit: { width: '18%', textAlign: 'right' },
  tdTotal: { width: '20%', textAlign: 'right', fontWeight: 600 },
  totals: { marginTop: 20, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '55%', marginBottom: 4 },
  totalLabel: { width: '50%', textAlign: 'right', color: '#64748b' },
  totalValue: { width: '50%', textAlign: 'right' },
  grandRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '55%', borderTopWidth: 2, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 },
  grandLabel: { width: '50%', textAlign: 'right', fontWeight: 700, fontSize: 14 },
  grandValue: { width: '50%', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#00b97a' },
  footer: { marginTop: 40, textAlign: 'center', fontSize: 9, color: '#94a3b8' },
})

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#dcfce7', text: '#16a34a' },
  pending: { bg: '#fef3c7', text: '#f59e0b' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  partial: { bg: '#f1f5f9', text: '#64748b' },
}

const DEFAULT_STATUS = STATUS_STYLE.pending!

const fmt = (n: number) => (n ?? 0).toLocaleString('fa-AF')
const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('fa-AF') } catch { return d } }

// ─── PDF Document ─────────────────────────────────────
export function InvoicePDFDocument({ invoice }: { invoice: any }) {
  const inv = invoice as any
  const items = inv.invoice_items ?? inv.items ?? []
  const status: string = inv.status || 'pending'
  const st = STATUS_STYLE[status] ?? DEFAULT_STATUS

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
            <Text style={s.invoiceMeta}>{fmtDate(inv.date ?? '')}</Text>
            {inv.customer_name || inv.customerName ? <Text style={s.invoiceMeta}>{inv.customer_name ?? inv.customerName}</Text> : null}
            <Text style={{ ...s.badge, backgroundColor: st.bg, color: st.text }}>
              {status === 'completed' ? 'تکمیل شده' : status === 'pending' ? 'در انتظار' : status === 'cancelled' ? 'لغو شده' : 'جزئی'}
            </Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={s.thNum}>#</Text>
            <Text style={s.thName}>نام محصول</Text>
            <Text style={s.thQty}>تعداد</Text>
            <Text style={s.thUnit}>قیمت واحد</Text>
            <Text style={s.thTotal}>قیمت کل</Text>
          </View>
          {items.map((item: any, i: number) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.tdNum}>{i + 1}</Text>
              <Text style={s.tdName}>{item.product_name ?? item.productName ?? ''}</Text>
              <Text style={s.tdQty}>{item.quantity ?? 1}</Text>
              <Text style={s.tdUnit}>{fmt(item.unit_price ?? item.unitPrice ?? 0)} {inv.currency ?? 'AFN'}</Text>
              <Text style={s.tdTotal}>{fmt(item.total_price ?? item.totalPrice ?? 0)} {inv.currency ?? 'AFN'}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>جمع</Text>
            <Text style={s.totalValue}>{fmt(inv.subtotal ?? 0)} {inv.currency ?? 'AFN'}</Text>
          </View>
          {(inv.discount_total ?? inv.discountTotal ?? 0) > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>تخفیف</Text>
              <Text style={{ ...s.totalValue, color: '#dc2626' }}>-{fmt(inv.discount_total ?? inv.discountTotal ?? 0)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
          {(inv.tax_total ?? inv.taxTotal ?? 0) > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>مالیات</Text>
              <Text style={s.totalValue}>{fmt(inv.tax_total ?? inv.taxTotal ?? 0)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>مجموع</Text>
            <Text style={s.grandValue}>{fmt(inv.total ?? 0)} {inv.currency ?? 'AFN'}</Text>
          </View>
          {(inv.paid_amount ?? inv.paidAmount ?? 0) > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>پرداخت شده</Text>
              <Text style={{ ...s.totalValue, color: '#16a34a' }}>-{fmt(inv.paid_amount ?? inv.paidAmount ?? 0)} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
          {((inv.total ?? 0) - (inv.paid_amount ?? inv.paidAmount ?? 0)) > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>باقی‌مانده</Text>
              <Text style={{ ...s.totalValue, color: '#dc2626' }}>{fmt((inv.total ?? 0) - (inv.paid_amount ?? inv.paidAmount ?? 0))} {inv.currency ?? 'AFN'}</Text>
            </View>
          )}
        </View>

        <Text style={s.footer}>
          تولید شده توسط Hisabche — hisabche.com{'\n'}
          {fmtDate(inv.created_at ?? inv.createdAt ?? inv.date ?? '')}
        </Text>
      </Page>
    </Document>
  )
}

export default InvoicePDFDocument