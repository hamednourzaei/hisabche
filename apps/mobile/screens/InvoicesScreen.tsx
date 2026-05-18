import React, { memo, useCallback, useMemo, useState, useDeferredValue } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useInvoices, useDeleteInvoice } from '@hisabche/api'
import { useThemeStore } from '@hisabche/store'
import type { InvoiceFilters } from '@hisabche/validation'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', border: '#e2e8f0', input: '#f1f5f9', success: '#16a34a', warning: '#f59e0b', destructive: '#dc2626', muted: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', border: '#1e2d45', input: '#1e2d45', success: '#4ade80', warning: '#fbbf24', destructive: '#f87171', muted: '#1e2d45' },
}

type ThemeTokens = typeof tokens.light
type InvoiceStatus = 'pending' | 'completed' | 'cancelled' | 'partial'

interface InvoiceDTO {
  id: string
  invoiceNumber?: string
  date?: string
  status: InvoiceStatus
  total: number
  currency: string
}

const statusMap: Record<InvoiceStatus, { bg: keyof ThemeTokens; border: keyof ThemeTokens; text: keyof ThemeTokens }> = {
  completed: { bg: 'success', border: 'success', text: 'success' },
  pending: { bg: 'warning', border: 'warning', text: 'warning' },
  cancelled: { bg: 'destructive', border: 'destructive', text: 'destructive' },
  partial: { bg: 'muted', border: 'border', text: 'mutedFg' },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('fa-AF')
const fmtAmount = (n: number) => n.toLocaleString('fa-AF')

// ─── Skeleton ─────────────────────────────────────────────
const SkeletonCard = memo(function SkeletonCard({ tk }: { tk: ThemeTokens }) {
  return (
    <View style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]}>
      <View style={s.cardHeader}>
        <View style={s.flex1}>
          <View style={[s.skeletonLine, { backgroundColor: tk.muted, width: 80 }]} />
          <View style={[s.skeletonLine, { backgroundColor: tk.muted, width: 50, marginTop: 6 }]} />
        </View>
        <View style={[s.skeletonBadge, { backgroundColor: tk.muted, width: 70 }]} />
      </View>
      <View style={s.cardFooter}>
        <View style={[s.skeletonLine, { backgroundColor: tk.muted, width: 100 }]} />
        <View style={[s.skeletonLine, { backgroundColor: tk.muted, width: 36, height: 36 }]} />
      </View>
    </View>
  )
})

// ─── Invoice Card ─────────────────────────────────────────
interface InvoiceCardProps {
  inv: InvoiceDTO
  tk: ThemeTokens
  statusLabel: string
  statusBg: string
  statusBorder: string
  statusTextColor: string
  currencyLabel: string
  deleteLabel: string
  deleteConfirmLabel: string
  onDelete: (id: string) => void
}

interface InvoiceCardProps {
  inv: InvoiceDTO
  tk: ThemeTokens
  statusLabel: string
  statusBg: string
  statusBorder: string
  statusTextColor: string
  currencyLabel: string
  deleteLabel: string
  deleteConfirmLabel: string
  onDelete: (id: string) => void
  onPress: (inv: InvoiceDTO) => void
}

const InvoiceCard = memo(function InvoiceCard({
  inv, tk, statusLabel, statusBg, statusBorder, statusTextColor,
  currencyLabel, deleteLabel, deleteConfirmLabel, onDelete, onPress,
}: InvoiceCardProps) {
  const handleDelete = useCallback((e: any) => {
    e.stopPropagation?.()
    Alert.alert(deleteLabel, `${deleteConfirmLabel} #${inv.invoiceNumber || '-'}؟`, [
      { text: 'انصراف', style: 'cancel' },
      { text: deleteLabel, style: 'destructive', onPress: () => onDelete(inv.id) },
    ])
  }, [inv.id, inv.invoiceNumber, deleteLabel, deleteConfirmLabel, onDelete])

  return (
    <TouchableOpacity
      onPress={() => onPress(inv)}
      activeOpacity={0.8}
      style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]}
      accessibilityRole="button"
      accessibilityLabel={`${inv.invoiceNumber || '-'}: ${statusLabel}, ${fmtAmount(inv.total || 0)} ${currencyLabel}`}
    >
      <View style={s.cardHeader}>
        <View style={s.flex1}>
          <Text style={[s.invoiceNum, { color: tk.foreground }]}>#{inv.invoiceNumber || '-'}</Text>
          {inv.date ? <Text style={[s.invoiceDate, { color: tk.mutedFg }]}>{fmtDate(inv.date)}</Text> : null}
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
          <Text style={[s.statusText, { color: statusTextColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={s.cardFooter}>
        <View>
          <Text style={[s.totalLabel, { color: tk.mutedFg }]}>{'جمع'}</Text>
          <Text style={[s.totalAmount, { color: tk.foreground }]}>{fmtAmount(inv.total || 0)} {inv.currency || currencyLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={handleDelete}
          style={[s.deleteBtn, { backgroundColor: tk.destructive + '15' }]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[s.deleteText, { color: tk.destructive }]}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

// ─── InvoicesScreen ───────────────────────────────────────
export default function InvoicesScreen() {
  const { t } = useTranslation()
  const { isDark } = useThemeStore()
  const tk = useMemo((): ThemeTokens => isDark ? tokens.dark : tokens.light, [isDark])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const filters = useMemo((): InvoiceFilters => ({ page: 1, limit: 20, sortDirection: 'desc', search: deferredSearch }), [deferredSearch])
  const { data, isLoading } = useInvoices(filters)
  const deleteInvoice = useDeleteInvoice()

  const currencyLabel = t('currency.afn')
  const deleteLabel = t('action.delete')
  const deleteConfirmLabel = t('action.deleteConfirm')

  const handleDelete = useCallback((id: string) => {
    deleteInvoice.mutate(id)
  }, [deleteInvoice])

  const handleClearSearch = useCallback(() => setSearch(''), [])

  const getStatusProps = useCallback((status: InvoiceStatus, tk: ThemeTokens) => {
    const s = statusMap[status] || statusMap.pending
    return {
      statusLabel: t(`faktoor.${status}`),
      statusBg: tk[s.bg] + '20',
      statusBorder: tk[s.border],
      statusTextColor: tk[s.text],
    }
  }, [t])
const handleInvoicePress = useCallback((inv: InvoiceDTO) => {
  // Navigate to invoice detail — use your navigation method
  // @ts-ignore
  if (global.navigation) {
    // @ts-ignore
    global.navigation.navigate('InvoiceDetail', { id: inv.id })
  }
}, [])
const renderInvoice = useCallback(({ item }: { item: InvoiceDTO }) => {
  const { statusLabel, statusBg, statusBorder, statusTextColor } = getStatusProps(item.status, tk)
  return (
    <InvoiceCard
      inv={item}
      tk={tk}
      statusLabel={statusLabel}
      statusBg={statusBg}
      statusBorder={statusBorder}
      statusTextColor={statusTextColor}
      currencyLabel={currencyLabel}
      deleteLabel={deleteLabel}
      deleteConfirmLabel={deleteConfirmLabel}
      onDelete={handleDelete}
      onPress={handleInvoicePress}
    />
  )
}, [tk, currencyLabel, deleteLabel, deleteConfirmLabel, handleDelete, handleInvoicePress, getStatusProps])

  const keyExtractor = useCallback((item: InvoiceDTO) => item.id || `inv-${item.invoiceNumber || ''}`, [])

  return (
    <View style={s.fill}>
      <View style={[s.searchBox, { backgroundColor: tk.input }]}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={[s.searchInput, { color: tk.foreground }]} value={search} onChangeText={setSearch} placeholder={t('action.search')} placeholderTextColor={tk.mutedFg} accessibilityLabel={t('action.search')} />
        {search ? (
          <TouchableOpacity onPress={handleClearSearch} accessibilityRole="button" accessibilityLabel={t('action.clear')}>
            <Text style={[s.clearBtn, { color: tk.mutedFg }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={s.list}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} tk={tk} />)}
        </View>
      ) : (
        <FlashList
          data={(data?.invoices || []) as InvoiceDTO[]}
          keyExtractor={keyExtractor}
          renderItem={renderInvoice}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyEmoji}>🧾</Text>
              <Text style={[s.emptyTitle, { color: tk.foreground }]}>{t('faktoor.noFaktoors')}</Text>
              <Text style={[s.emptyDesc, { color: tk.mutedFg }]}>{t('faktoor.createFirstFaktoor')}</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 14, height: 44, borderRadius: 12, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  clearBtn: { fontSize: 16, fontWeight: '600', padding: 4 },
  list: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNum: { fontSize: 15, fontWeight: '600' },
  invoiceDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 11 },
  totalAmount: { fontSize: 18, fontWeight: '700' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 16 },
  skeletonLine: { height: 14, borderRadius: 7 },
  skeletonBadge: { height: 22, borderRadius: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14 },
})