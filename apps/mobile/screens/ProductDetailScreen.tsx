import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useProduct, useUpdateProduct, useDeleteProduct } from '@hisabche/api'
import { useThemeStore } from '@hisabche/store'
import { useTranslation } from 'react-i18next'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', border: '#e2e8f0', success: '#16a34a', warning: '#f59e0b', destructive: '#dc2626', muted: '#f1f5f9', input: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', border: '#1e2d45', success: '#4ade80', warning: '#fbbf24', destructive: '#f87171', muted: '#1e2d45', input: '#1e2d45' },
}

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: any) => num(v).toLocaleString('fa-AF')

export default function ProductDetailScreen({ route }: any) {
  const { id } = route?.params || {}
  const { t } = useTranslation()
  const { isDark } = useThemeStore()
  const tk = isDark ? tokens.dark : tokens.light
  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [quantity, setQuantity] = useState('')

  const startEditing = useCallback(() => {
    if (!product) return
    const p = product as any
    setName(p.name ?? '')
    setSellPrice((num(p.sell_price ?? p.sellPrice)).toString())
    setBuyPrice((num(p.buy_price ?? p.buyPrice)).toString())
    setQuantity((num(p.quantity)).toString())
    setEditing(true)
  }, [product])

  const handleSave = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: id!,
      name: name.trim(),
      sellPrice: num(sellPrice),
      buyPrice: num(buyPrice),
      quantity: Math.floor(num(quantity)),
    })
    setEditing(false)
  }, [id, name, sellPrice, buyPrice, quantity, updateProduct])

  const handleDelete = useCallback(async () => {
  Alert.alert('حذف', 'آیا مطمئن هستید؟', [
    { text: 'انصراف', style: 'cancel' },
    { 
      text: 'حذف', 
      style: 'destructive', 
      onPress: async () => { 
        await deleteProduct.mutateAsync(id!)
        ;(global as any).navigation?.goBack()
      } 
    },
  ])
}, [id, deleteProduct])

  if (isLoading) return <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: tk.background }]}><Text style={{ color: tk.mutedFg }}>در حال بارگذاری...</Text></SafeAreaView>
  if (!product) return <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: tk.background }]}><Text style={{ color: tk.foreground }}>محصول پیدا نشد</Text></SafeAreaView>

  const p = product as any
  const qty = num(p.quantity)

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tk.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: tk.foreground }]}>{p.name}</Text>

        {editing ? (
          <View style={{ gap: 12 }}>
            <TextInput style={[styles.input, { backgroundColor: tk.input, color: tk.foreground }]} value={name} onChangeText={setName} placeholder="نام" />
            <TextInput style={[styles.input, { backgroundColor: tk.input, color: tk.foreground }]} value={sellPrice} onChangeText={setSellPrice} placeholder="قیمت فروش" keyboardType="numeric" />
            <TextInput style={[styles.input, { backgroundColor: tk.input, color: tk.foreground }]} value={buyPrice} onChangeText={setBuyPrice} placeholder="قیمت خرید" keyboardType="numeric" />
            <TextInput style={[styles.input, { backgroundColor: tk.input, color: tk.foreground }]} value={quantity} onChangeText={setQuantity} placeholder="موجودی" keyboardType="numeric" />
            <View style={styles.rowBtns}>
              <TouchableOpacity style={[styles.btn, { borderColor: tk.border, borderWidth: 1 }]} onPress={() => setEditing(false)}><Text style={{ color: tk.foreground }}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: tk.primary }]} onPress={handleSave}><Text style={{ color: '#fff' }}>ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={[styles.row, { borderBottomColor: tk.border }]}><Text style={[styles.label, { color: tk.mutedFg }]}>قیمت فروش</Text><Text style={[styles.value, { color: tk.foreground }]}>{fmt(p.sell_price ?? p.sellPrice)} AFN</Text></View>
            <View style={[styles.row, { borderBottomColor: tk.border }]}><Text style={[styles.label, { color: tk.mutedFg }]}>قیمت خرید</Text><Text style={[styles.value, { color: tk.foreground }]}>{fmt(p.buy_price ?? p.buyPrice)} AFN</Text></View>
            <View style={[styles.row, { borderBottomColor: tk.border }]}><Text style={[styles.label, { color: tk.mutedFg }]}>موجودی</Text><Text style={[styles.value, { color: tk.foreground }]}>{qty} {p.unit || 'عدد'}</Text></View>
            <View style={[styles.row, { borderBottomColor: tk.border }]}><Text style={[styles.label, { color: tk.mutedFg }]}>ارزش کل</Text><Text style={[styles.value, { color: tk.primary }]}>{fmt(qty * num(p.sell_price ?? p.sellPrice))} AFN</Text></View>
            <View style={[styles.row, { borderBottomColor: tk.border }]}><Text style={[styles.label, { color: tk.mutedFg }]}>سود هر واحد</Text><Text style={[styles.value, { color: tk.success }]}>{fmt(num(p.sell_price ?? p.sellPrice) - num(p.buy_price ?? p.buyPrice))} AFN</Text></View>
            <View style={styles.rowBtns}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: tk.primary }]} onPress={startEditing}><Text style={{ color: '#fff' }}>ویرایش</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { borderColor: tk.destructive, borderWidth: 1 }]} onPress={handleDelete}><Text style={{ color: tk.destructive }}>حذف</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 20 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  label: { fontSize: 14 },
  value: { fontSize: 16, fontWeight: '600' },
  rowBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})