import React, { memo, useCallback, useMemo, useState, useDeferredValue } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useCustomers, useTransactions } from '@hisabche/api'
import { useThemeStore } from '@hisabche/store'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', border: '#e2e8f0', success: '#16a34a', destructive: '#dc2626', muted: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', border: '#1e2d45', success: '#4ade80', destructive: '#f87171', muted: '#1e2d45' },
}

const POSITIVE_TYPES = new Set(['payment', 'receipt'])
const NEGATIVE_TYPES = new Set(['sale', 'purchase'])

const fmtAmount = (n: number) => n.toLocaleString('fa-AF')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fa-AF')

const TransactionCard = memo(function TransactionCard({ txn, accent, cardBg, borderColor, foreground, mutedFg, typeLabel, currencyLabel }: any) {
  const isPositive = POSITIVE_TYPES.has(txn.type)
  return (
    <View style={[s.txnCard, { backgroundColor: cardBg, borderColor }]} accessibilityRole="button" accessibilityLabel={typeLabel} accessibilityHint={`${typeLabel}: ${fmtAmount(txn.amount || 0)} ${currencyLabel}`} accessibilityState={{ disabled: false }}>
      <View style={[s.txnIcon, { backgroundColor: accent + '15' }]}><Text style={[s.txnIconText, { color: accent }]}>{isPositive ? '↓' : '↑'}</Text></View>
      <View style={s.txnBody}><Text style={[s.txnType, { color: foreground }]}>{typeLabel}</Text>{txn.date ? <Text style={[s.txnDate, { color: mutedFg }]}>{fmtDate(txn.date)}</Text> : null}</View>
      <View style={s.txnAmountWrap}><Text style={[s.txnAmount, { color: accent }]}>{fmtAmount(txn.amount || 0)}</Text><Text style={[s.txnCurrency, { color: mutedFg }]}>{currencyLabel}</Text></View>
    </View>
  )
})

export default function BaqidariScreen() {
  const { t, i18n } = useTranslation()
  const { isDark } = useThemeStore()
  const tk = isDark ? tokens.dark : tokens.light
  const isRTL = i18n.language?.includes('fa')

  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>()
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const { data: customersData } = useCustomers({ page: 1, limit: 50, sortDirection: 'desc' })
  const { data: txnsData, isLoading: transactionsLoading, refetch } = useTransactions({ page: 1, limit: 50, sortDirection: 'desc', customerId: selectedCustomer })

  const filteredCustomers = useMemo(() => {
    const customers = (customersData?.customers || []) as any[]
    if (!deferredSearch) return customers
    const s = deferredSearch.toLowerCase()
    return customers.filter((c: any) => c.fullName?.toLowerCase().includes(s))
  }, [customersData, deferredSearch])

  const { totalCredit, totalDebit, netBalance } = useMemo(() => {
    const txns = (txnsData?.transactions || []) as any[]
    const credit = txns.filter((t: any) => POSITIVE_TYPES.has(t.type)).reduce((s: number, t: any) => s + (t.amount || 0), 0)
    const debit = txns.filter((t: any) => NEGATIVE_TYPES.has(t.type)).reduce((s: number, t: any) => s + (t.amount || 0), 0)
    return { totalCredit: credit, totalDebit: debit, netBalance: credit - debit }
  }, [txnsData])

  const selectedCustomerName = useMemo(() => {
    if (!selectedCustomer) return null
    const found = (customersData?.customers || []).find((c: any) => c.id === selectedCustomer)
    return found?.fullName ?? t('baqidari.selected')
  }, [selectedCustomer, customersData, t])

  const currencyLabel = t('currency.afn')

  const renderTxn = useCallback(({ item }: any) => {
    const isPositive = POSITIVE_TYPES.has(item.type)
    const accent = isPositive ? tk.success : tk.destructive
    return <TransactionCard txn={item} accent={accent} cardBg={tk.card} borderColor={tk.border} foreground={tk.foreground} mutedFg={tk.mutedFg} typeLabel={t(`baqidari.${item.type}`)} currencyLabel={currencyLabel} />
  }, [tk, t, currencyLabel])

  const keyExtractor = useCallback((item: any, index: number) => item.id ?? item.transactionId ?? `txn-${index}`, [])

  const handleSelectCustomer = (id?: string) => { setSelectedCustomer(id); setShowCustomerPicker(false); setSearch('') }

  return (
    <View style={s.fill}>
      <View style={s.pickerWrap}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => setShowCustomerPicker((prev) => !prev)} style={[s.picker, { backgroundColor: tk.card, borderColor: tk.border }]} accessibilityRole="combobox" accessibilityLabel={t('faktoor.selectCustomer')}>
          <Text style={[s.pickerText, { color: selectedCustomer ? tk.foreground : tk.mutedFg }]}>{selectedCustomerName ?? t('faktoor.selectCustomer')}</Text>
          <Text style={{ color: tk.mutedFg }}>▼</Text>
        </TouchableOpacity>
        {showCustomerPicker && (
          <View style={[s.pickerDropdown, { backgroundColor: tk.card, borderColor: tk.border }]}>
            <View style={s.searchWrap}><TextInput value={search} onChangeText={setSearch} placeholder={t('action.search')} placeholderTextColor={tk.mutedFg} style={[s.searchInput, { borderColor: tk.border, color: tk.foreground }]} accessibilityLabel={t('action.search')} /></View>
            <FlatList data={[{ id: 'all', fullName: t('baqidari.allCustomers') }, ...filteredCustomers]} keyExtractor={(item: any) => item.id} style={{ maxHeight: 280 }} renderItem={({ item }: any) => (
              <TouchableOpacity style={[s.dropdownItem, { borderColor: tk.border }]} onPress={() => handleSelectCustomer(item.id === 'all' ? undefined : item.id)}><Text style={[s.dropdownItemText, { color: item.id === 'all' ? tk.mutedFg : tk.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{item.fullName}</Text></TouchableOpacity>
            )} />
          </View>
        )}
      </View>
      <View style={[s.balanceBox, { backgroundColor: tk.card, borderColor: tk.border }]}>
        <View style={s.balanceRow}><Text style={[s.balanceLabel, { color: tk.mutedFg }]}>{t('baqidari.debit')}</Text><Text style={[s.balanceValue, { color: tk.destructive }]}>{fmtAmount(totalDebit)} {currencyLabel}</Text></View>
        <View style={s.balanceRow}><Text style={[s.balanceLabel, { color: tk.mutedFg }]}>{t('baqidari.credit')}</Text><Text style={[s.balanceValue, { color: tk.success }]}>{fmtAmount(totalCredit)} {currencyLabel}</Text></View>
        <View style={[s.balanceDivider, { borderColor: tk.border }]}><Text style={[s.balanceLabelBold, { color: tk.foreground }]}>{t('baqidari.netBalance')}</Text><Text style={[s.balanceValueBold, { color: netBalance >= 0 ? tk.success : tk.destructive }]}>{fmtAmount(netBalance)} {currencyLabel}</Text></View>
      </View>
      {transactionsLoading ? (
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={tk.primary} /></View>
      ) : (
        <FlatList data={(txnsData?.transactions || []) as any[]} renderItem={renderTxn} keyExtractor={keyExtractor} showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent} refreshing={transactionsLoading} onRefresh={refetch} ListEmptyComponent={
          <View style={s.emptyWrap}><Text style={s.emptyEmoji}>📒</Text><Text style={[s.emptyTitle, { color: tk.foreground }]}>{t('baqidari.noTransactions')}</Text><Text style={[s.emptyDesc, { color: tk.mutedFg }]}>{t('baqidari.noTransactionsDesc')}</Text></View>
        } />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  pickerWrap: { paddingHorizontal: 16, paddingTop: 8 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  pickerText: { fontSize: 14, fontWeight: '500' },
  pickerDropdown: { marginTop: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  searchWrap: { padding: 12 },
  searchInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 0.5 },
  dropdownItemText: { fontSize: 14 },
  balanceBox: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: 13 },
  balanceValue: { fontSize: 15, fontWeight: '700' },
  balanceDivider: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 16 },
  balanceLabelBold: { fontSize: 14, fontWeight: '800' },
  balanceValueBold: { fontSize: 16, fontWeight: '800' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  txnCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12 },
  txnIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txnIconText: { fontSize: 18, fontWeight: '700' },
  txnBody: { flex: 1 },
  txnType: { fontSize: 14, fontWeight: '700' },
  txnDate: { fontSize: 11, marginTop: 4 },
  txnAmountWrap: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 15, fontWeight: '800' },
  txnCurrency: { fontSize: 10, marginTop: 4 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 96 },
  emptyEmoji: { fontSize: 54, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { fontSize: 13, textAlign: 'center' },
})