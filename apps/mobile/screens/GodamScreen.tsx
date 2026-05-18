import React, { memo, useCallback, useMemo, useState, useDeferredValue } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useProducts, useCreateProduct, useDeleteProduct } from '@hisabche/api'
import { useThemeStore } from '@hisabche/store'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', border: '#e2e8f0', input: '#f1f5f9', success: '#16a34a', warning: '#f59e0b', destructive: '#dc2626', muted: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', border: '#1e2d45', input: '#1e2d45', success: '#4ade80', warning: '#fbbf24', destructive: '#f87171', muted: '#1e2d45' },
}

type ThemeTokens = typeof tokens.light

const fmt = (n: number) => n.toLocaleString('fa-AF')
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

const ProductCard = memo(function ProductCard({ p, tk, onPress, onDelete }: { p: any; tk: ThemeTokens; onPress: () => void; onDelete: () => void }) {
  const qty = num(p.quantity)
  const min = num(p.min_stock_level ?? p.minStockLevel ?? 5)
  const statusColor = qty === 0 ? tk.destructive : qty <= min ? tk.warning : tk.success
  const sellPrice = num(p.sell_price ?? p.sellPrice)

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]}>
      <View style={s.cardRow}>
        <View style={[s.productIcon, { backgroundColor: tk.muted }]}>
          <Text style={s.productEmoji}>📦</Text>
        </View>
        <View style={s.flex1}>
          <Text style={[s.productName, { color: tk.foreground }]}>{p.name}</Text>
          <Text style={[s.productMeta, { color: tk.mutedFg }]}>{p.category || 'عمومی'} · {p.unit || 'عدد'} · خرید: {fmt(num(p.buy_price ?? p.buyPrice))} AFN</Text>
        </View>
        <View style={s.productRight}>
          <Text style={[s.productPrice, { color: tk.foreground }]}>{fmt(sellPrice)} AFN</Text>
          <View style={[s.stockBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <View style={[s.stockDot, { backgroundColor: statusColor }]} />
            <Text style={[s.stockText, { color: statusColor }]}>موجودی: {qty}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.deleteIcon, { color: tk.destructive }]}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

export default function GodamScreen() {
  const { t } = useTranslation()
  const { isDark } = useThemeStore()
  const tk = useMemo((): ThemeTokens => isDark ? tokens.dark : tokens.light, [isDark])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const { data, isLoading } = useProducts({ page: 1, limit: 50, sortDirection: 'desc', search: deferredSearch })
  const createProduct = useCreateProduct()
  const deleteProduct = useDeleteProduct()

  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('0')
  const [newBuyPrice, setNewBuyPrice] = useState('')
  const [newSellPrice, setNewSellPrice] = useState('')

  const totalValue = (data?.products || []).reduce((sum: number, p: any) => sum + num(p.quantity) * num(p.sell_price ?? p.sellPrice), 0)

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return
    await createProduct.mutateAsync({
      name: newName.trim(),
      quantity: parseInt(newQty) || 0,
      buyPrice: parseFloat(newBuyPrice) || 0,
      sellPrice: parseFloat(newSellPrice) || 0,
      unit: 'piece',
      minStockLevel: 5,
      category: 'general',
      isActive: true,
    })
    setNewName(''); setNewQty('0'); setNewBuyPrice(''); setNewSellPrice('')
    setShowAddModal(false)
  }, [newName, newQty, newBuyPrice, newSellPrice, createProduct])

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(t('action.delete'), `«${name}» حذف شود؟`, [
      { text: t('action.cancel'), style: 'cancel' },
      { text: t('action.delete'), style: 'destructive', onPress: () => deleteProduct.mutate(id) },
    ])
  }, [t, deleteProduct])

  const handleClearSearch = useCallback(() => setSearch(''), [])

  return (
    <View style={s.fill}>
      <View style={[s.searchBox, { backgroundColor: tk.input }]}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={[s.searchInput, { color: tk.foreground }]} value={search} onChangeText={setSearch} placeholder={t('action.search')} placeholderTextColor={tk.mutedFg} />
        {search ? <TouchableOpacity onPress={handleClearSearch}><Text style={[s.clearBtn, { color: tk.mutedFg }]}>✕</Text></TouchableOpacity> : null}
      </View>

      <View style={[s.statsRow, { borderBottomColor: tk.border }]}>
        <View style={s.statItem}><Text style={[s.statValue, { color: tk.foreground }]}>{data?.total || 0}</Text><Text style={[s.statLabel, { color: tk.mutedFg }]}>کل</Text></View>
        <View style={s.statItem}><Text style={[s.statValue, { color: tk.warning }]}>{(data?.products || []).filter((p: any) => num(p.quantity) > 0 && num(p.quantity) <= num(p.min_stock_level ?? p.minStockLevel ?? 5)).length}</Text><Text style={[s.statLabel, { color: tk.mutedFg }]}>کمبود</Text></View>
        <View style={s.statItem}><Text style={[s.statValue, { color: tk.destructive }]}>{(data?.products || []).filter((p: any) => num(p.quantity) === 0).length}</Text><Text style={[s.statLabel, { color: tk.mutedFg }]}>ناموجود</Text></View>
        <View style={s.statItem}><Text style={[s.statValue, { color: tk.success }]}>{fmt(totalValue)}</Text><Text style={[s.statLabel, { color: tk.mutedFg }]}>ارزش</Text></View>
      </View>

      <TouchableOpacity style={[s.addBtn, { backgroundColor: tk.primary }]} onPress={() => setShowAddModal(true)}>
        <Text style={[s.addBtnText, { color: tk.primaryFg }]}>+ محصول جدید</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={s.list}>{Array.from({ length: 5 }).map((_, i) => <View key={i} style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder, height: 70 }]} />)}</View>
      ) : (
        <FlashList
          data={(data?.products || []) as any[]}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <ProductCard
              p={item}
              tk={tk}
              onPress={() => {
                // @ts-ignore
                if (global.navigation) global.navigation.navigate('ProductDetail', { id: item.id })
              }}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={<View style={s.emptyContainer}><Text style={s.emptyEmoji}>📦</Text><Text style={[s.emptyTitle, { color: tk.foreground }]}>هیچ محصولی موجود نیست</Text></View>}
        />
      )}

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: tk.card }]}>
            <Text style={[s.modalTitle, { color: tk.foreground }]}>محصول جدید</Text>
            <TextInput style={[s.modalInput, { backgroundColor: tk.input, color: tk.foreground }]} value={newName} onChangeText={setNewName} placeholder="نام محصول *" placeholderTextColor={tk.mutedFg} />
            <TextInput style={[s.modalInput, { backgroundColor: tk.input, color: tk.foreground }]} value={newQty} onChangeText={setNewQty} placeholder="موجودی اولیه" placeholderTextColor={tk.mutedFg} keyboardType="numeric" />
            <TextInput style={[s.modalInput, { backgroundColor: tk.input, color: tk.foreground }]} value={newBuyPrice} onChangeText={setNewBuyPrice} placeholder="قیمت خرید (AFN)" placeholderTextColor={tk.mutedFg} keyboardType="numeric" />
            <TextInput style={[s.modalInput, { backgroundColor: tk.input, color: tk.foreground }]} value={newSellPrice} onChangeText={setNewSellPrice} placeholder="قیمت فروش (AFN)" placeholderTextColor={tk.mutedFg} keyboardType="numeric" />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: tk.border, borderWidth: 1 }]} onPress={() => setShowAddModal(false)}><Text style={{ color: tk.foreground }}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: tk.primary }]} onPress={handleAdd}><Text style={{ color: tk.primaryFg }}>ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 10, marginTop: 2 },
  addBtn: { marginHorizontal: 16, marginVertical: 8, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  productEmoji: { fontSize: 22 },
  productName: { fontSize: 14, fontWeight: '600' },
  productMeta: { fontSize: 11, marginTop: 2 },
  productRight: { alignItems: 'flex-end', gap: 4 },
  productPrice: { fontSize: 14, fontWeight: '700' },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontSize: 10, fontWeight: '600' },
  deleteIcon: { fontSize: 16, padding: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  modalInput: { height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})