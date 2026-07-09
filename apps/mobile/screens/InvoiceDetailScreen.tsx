import React, { useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Linking, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useInvoice } from '@hisabche/api'
import { useThemeStore } from '@hisabche/store'
import { useTranslation } from 'react-i18next'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const API_URL = 'http://localhost:3001'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', border: '#e2e8f0', success: '#16a34a', warning: '#f59e0b', destructive: '#dc2626', muted: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', border: '#1e2d45', success: '#4ade80', warning: '#fbbf24', destructive: '#f87171', muted: '#1e2d45' },
}

const statusMap: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#16a34a20', text: '#16a34a' },
  pending: { bg: '#f59e0b20', text: '#f59e0b' },
  cancelled: { bg: '#dc262620', text: '#dc2626' },
  partial: { bg: '#64748b20', text: '#64748b' },
}

const fmtAmount = (n: number) => n.toLocaleString('fa-AF')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fa-AF')

export default function InvoiceDetailScreen({ route }: any) {
  const { id } = route?.params || {}
  const { t } = useTranslation()
  const { isDark } = useThemeStore()
  const tk = isDark ? tokens.dark : tokens.light
  const { data: invoice, isLoading } = useInvoice(id)

// ─── PDF Download ──────────────────────────────────
const handlePDF = useCallback(() => {
  if (!id) return
  const url = `${API_URL}/api/invoices/${id}/pdf`
  
  // Web: hidden iframe download
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  setTimeout(() => document.body.removeChild(iframe), 2000)
}, [id])

// ─── Print ─────────────────────────────────────────
const handlePrint = useCallback(() => {
  if (!id) return
  const url = `${API_URL}/api/invoices/${id}/pdf`
  window.open(url, '_blank')
}, [id])
  // ─── Share ─────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!invoice) return
    const inv = invoice as any
    const text = [
      `🧾 ${t('invoices.title')}: #${inv.invoiceNumber ?? inv.invoice_number ?? ''}`,
      `📅 ${fmtDate(inv.date ?? '')}`,
      inv.customerName || inv.customer_name ? `👤 ${inv.customerName ?? inv.customer_name}` : '',
      `💰 ${fmtAmount(inv.total ?? 0)} ${inv.currency ?? 'AFN'}`,
      `📌 ${t(`invoices.${inv.status ?? 'pending'}`)}`,
    ].filter(Boolean).join('\n')
    try {
      await Share.share({ message: text })
    } catch {}
  }, [invoice, t])

  // ─── WhatsApp ──────────────────────────────────────
  const handleWhatsApp = useCallback(() => {
    if (!invoice) return
    const inv = invoice as any
    const text = `🧾 *${t('invoices.title')}*: #${inv.invoiceNumber ?? inv.invoice_number}\n📅 ${fmtDate(inv.date ?? '')}\n💰 *${fmtAmount(inv.total ?? 0)} ${inv.currency ?? 'AFN'}*\n📌 ${t(`invoices.${inv.status ?? 'pending'}`)}`
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url)
      else Share.share({ message: text })
    })
  }, [invoice, t])

  // ─── Telegram ──────────────────────────────────────
  const handleTelegram = useCallback(() => {
    if (!invoice) return
    const inv = invoice as any
    const text = `🧾 *${t('invoices.title')}*: #${inv.invoiceNumber ?? inv.invoice_number}\n📅 ${fmtDate(inv.date ?? '')}\n💰 *${fmtAmount(inv.total ?? 0)} ${inv.currency ?? 'AFN'}*\n📌 ${t(`invoices.${inv.status ?? 'pending'}`)}`
    const url = `tg://msg?text=${encodeURIComponent(text)}`
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url)
      else Share.share({ message: text })
    })
  }, [invoice, t])

  // ─── Email ─────────────────────────────────────────
  const handleEmail = useCallback(() => {
    if (!invoice) return
    const inv = invoice as any
    const subject = `${t('invoices.title')} #${inv.invoiceNumber ?? inv.invoice_number}`
    const body = `${t('invoices.title')}: #${inv.invoiceNumber ?? inv.invoice_number}\n${t('invoices.date')}: ${fmtDate(inv.date ?? '')}\n${t('invoices.total')}: ${fmtAmount(inv.total ?? 0)} ${inv.currency ?? 'AFN'}`
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open email'))
  }, [invoice, t])

  if (isLoading) {
    return (
      <SafeAreaView style={[s.fill, s.center, { backgroundColor: tk.background }]}>
        <Text style={[s.loadingText, { color: tk.mutedFg }]}>در حال بارگذاری...</Text>
      </SafeAreaView>
    )
  }

  if (!invoice) {
    return (
      <SafeAreaView style={[s.fill, s.center, { backgroundColor: tk.background }]}>
        <Text style={[s.emptyEmoji]}>🧾</Text>
        <Text style={[s.emptyTitle, { color: tk.foreground }]}>{t('invoices.notFound')}</Text>
      </SafeAreaView>
    )
  }

  const inv = invoice as any
  const items = inv.items || inv.invoice_items || inv.invoiceItems || []
  const status = inv.status || 'pending'
  const statusStyle = statusMap[status] ?? { bg: tk.muted, text: tk.mutedFg }

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={[s.invoiceHeader, { borderBottomColor: tk.border }]}>
          <Text style={[s.logo, { color: tk.primary }]}>Hisabche</Text>
          <View style={s.invoiceInfo}>
            <Text style={[s.invoiceNum, { color: tk.foreground }]}>
              #{inv.invoiceNumber || inv.invoice_number || '???'}
            </Text>
            <Text style={[s.invoiceDate, { color: tk.mutedFg }]}>
              {fmtDate(inv.date || '')}
            </Text>
            {(inv.customerName || inv.customer_name) ? (
              <Text style={[s.customerName, { color: tk.foreground }]}>
                👤 {inv.customerName || inv.customer_name}
              </Text>
            ) : null}
            <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[s.statusText, { color: statusStyle.text }]}>{t(`invoices.${status}`)}</Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={s.tableContainer}>
          <View style={[s.tableHeader, { borderBottomColor: tk.border }]}>
            <Text style={[s.thNum, { color: tk.mutedFg }]}>#</Text>
            <Text style={[s.thName, { color: tk.mutedFg }]}>{t('warehouse.productName')}</Text>
            <Text style={[s.thQty, { color: tk.mutedFg }]}>{t('invoices.quantity')}</Text>
            <Text style={[s.thPrice, { color: tk.mutedFg }]}>{t('invoices.unitPrice')}</Text>
            <Text style={[s.thTotal, { color: tk.mutedFg }]}>{t('invoices.totalPrice')}</Text>
          </View>
          {items.map((item: any, i: number) => (
            <View key={i} style={[s.tableRow, { borderBottomColor: tk.border }]}>
              <Text style={[s.tdNum, { color: tk.mutedFg }]}>{i + 1}</Text>
              <Text style={[s.tdName, { color: tk.foreground }]}>
                {item.productName || item.product_name || 'محصول'}
              </Text>
              <Text style={[s.tdQty, { color: tk.foreground }]}>{item.quantity || 1}</Text>
              <Text style={[s.tdPrice, { color: tk.foreground }]}>
                {fmtAmount(item.unitPrice || item.unit_price || 0)}
              </Text>
              <Text style={[s.tdTotal, { color: tk.foreground }]}>
                {fmtAmount(item.totalPrice || item.total_price || 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={[s.totals, { borderTopColor: tk.border }]}>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: tk.mutedFg }]}>{t('invoices.subtotal')}</Text>
            <Text style={[s.totalValue, { color: tk.foreground }]}>
              {fmtAmount(inv.subtotal || 0)} {inv.currency || 'AFN'}
            </Text>
          </View>
          {(inv.discountTotal || inv.discount_total || 0) > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: tk.mutedFg }]}>{t('invoices.discount')}</Text>
              <Text style={[s.totalValue, { color: tk.destructive }]}>
                -{fmtAmount(inv.discountTotal || inv.discount_total || 0)} {inv.currency || 'AFN'}
              </Text>
            </View>
          )}
          {(inv.taxTotal || inv.tax_total || 0) > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: tk.mutedFg }]}>{t('invoices.tax')}</Text>
              <Text style={[s.totalValue, { color: tk.foreground }]}>
                {fmtAmount(inv.taxTotal || inv.tax_total || 0)} {inv.currency || 'AFN'}
              </Text>
            </View>
          )}
          <View style={[s.totalRow, { borderTopColor: tk.border, paddingTop: 12 }]}>
            <Text style={[s.grandLabel, { color: tk.foreground }]}>{t('invoices.total')}</Text>
            <Text style={[s.grandValue, { color: tk.primary }]}>
              {fmtAmount(inv.total || 0)} {inv.currency || 'AFN'}
            </Text>
          </View>
          {(inv.paidAmount || inv.paid_amount || 0) > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: tk.success }]}>{t('invoices.paid')}</Text>
              <Text style={[s.totalValue, { color: tk.success }]}>
                -{fmtAmount(inv.paidAmount || inv.paid_amount || 0)} {inv.currency || 'AFN'}
              </Text>
            </View>
          )}
          {((inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0)) > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: tk.destructive }]}>{t('invoices.remaining')}</Text>
              <Text style={[s.totalValue, { color: tk.destructive }]}>
                {fmtAmount((inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0))} {inv.currency || 'AFN'}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#25D366' }]} onPress={handleWhatsApp} activeOpacity={0.8}>
            <Text style={[s.actionBtnText, { color: '#fff' }]}>💬 WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#0088cc' }]} onPress={handleTelegram} activeOpacity={0.8}>
            <Text style={[s.actionBtnText, { color: '#fff' }]}>📨 Telegram</Text>
          </TouchableOpacity>
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtnOutline, { borderColor: tk.border }]} onPress={handleEmail} activeOpacity={0.8}>
            <Text style={[s.actionBtnTextOutline, { color: tk.foreground }]}>📧 {t('action.email')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: tk.primary }]} onPress={handleShare} activeOpacity={0.8}>
            <Text style={[s.actionBtnText, { color: '#fff' }]}>📤 {t('action.share')}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: tk.primary }]} onPress={handlePDF} activeOpacity={0.8}>
            <Text style={[s.actionBtnText, { color: '#fff' }]}>📄 PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtnOutline, { borderColor: tk.border }]} onPress={handlePrint} activeOpacity={0.8}>
            <Text style={[s.actionBtnTextOutline, { color: tk.foreground }]}>🖨️ {t('action.print')}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: tk.border }]}>
          <Text style={[s.footerText, { color: tk.mutedFg }]}>
            {t('invoices.generatedBy')} Hisabche — hisabche.com
          </Text>
          <Text style={[s.footerDate, { color: tk.mutedFg }]}>
            {fmtDate(inv.createdAt || inv.created_at || inv.date || '')}{' '}
            {new Date(inv.createdAt || inv.created_at || inv.date || '').toLocaleTimeString('fa-AF')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 24, paddingBottom: 60 },
  loadingText: { fontSize: 16 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, borderBottomWidth: 1 },
  logo: { fontSize: 20, fontWeight: '700' },
  invoiceInfo: { alignItems: 'flex-end', gap: 6 },
  invoiceNum: { fontSize: 18, fontWeight: '700' },
  invoiceDate: { fontSize: 12 },
  customerName: { fontSize: 14, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  tableContainer: { gap: 0 },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 2, alignItems: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, alignItems: 'center' },
  thNum: { width: 24, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  thName: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right', paddingHorizontal: 6 },
  thQty: { width: 40, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  thPrice: { width: 60, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  thTotal: { width: 70, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  tdNum: { width: 24, fontSize: 12, textAlign: 'right' },
  tdName: { flex: 1, fontSize: 13, fontWeight: '500', textAlign: 'right', paddingHorizontal: 6 },
  tdQty: { width: 40, fontSize: 13, textAlign: 'center' },
  tdPrice: { width: 60, fontSize: 12, textAlign: 'right' },
  tdTotal: { width: 70, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  totals: { borderTopWidth: 2, paddingTop: 16, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 14, fontWeight: '500' },
  grandLabel: { fontSize: 16, fontWeight: '700' },
  grandValue: { fontSize: 20, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  actionBtnOutline: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionBtnTextOutline: { fontSize: 14, fontWeight: '500' },
  footer: { borderTopWidth: 1, paddingTop: 16, alignItems: 'center', gap: 4, marginTop: 8 },
  footerText: { fontSize: 12 },
  footerDate: { fontSize: 11 },
})