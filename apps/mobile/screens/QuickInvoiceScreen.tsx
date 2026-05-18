import React, { memo, useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useCreateInvoice, useProducts, useCustomers } from '@hisabche/api'
import { useOnboardingStore, usePreferencesStore, useThemeStore } from '@hisabche/store'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', muted: '#f1f5f9', primary: '#00b97a', primaryFg: '#ffffff', border: '#e2e8f0', success: '#16a34a', successBg: '#dcfce7', input: '#f1f5f9' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', muted: '#1e2d45', primary: '#2dd4a0', primaryFg: '#060d1f', border: '#1e2d45', success: '#4ade80', successBg: '#14532d', input: '#1e2d45' },
}

type Step = 'product' | 'customer' | 'price' | 'done'

const safeParseInt = (v: string): number => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(0, n) : 0 }
const safeParseFloat = (v: string): number => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(0, n) : 0 }
const fmt = (n: number) => n.toLocaleString('fa-AF')

interface Props { onComplete?: () => void }

export default function QuickInvoiceScreen({ onComplete }: Props) {
  const { t } = useTranslation()
  const createInvoice = useCreateInvoice()
  const { markInvoiceCreated } = useOnboardingStore()
  const preferences = usePreferencesStore()
  const { isDark } = useThemeStore()
  const tk = isDark ? tokens.dark : tokens.light

  const inputRef = useRef<TextInput>(null)
  const [step, setStep] = useState<Step>('product')

  // Product picker
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const { data: productData } = useProducts({ page: 1, limit: 20, sortDirection: 'desc', search: productSearch || undefined })

  // Customer picker
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const { data: customerData } = useCustomers({ page: 1, limit: 20, sortDirection: 'desc', search: customerSearch || undefined })

  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [startTime] = useState(Date.now())

  useEffect(() => { inputRef.current?.focus() }, [step])

  useEffect(() => {
    if (selectedProduct) {
      setPrice((selectedProduct.sell_price ?? selectedProduct.sellPrice ?? 0).toString())
    }
  }, [selectedProduct])

  const total = safeParseFloat(price) * safeParseInt(quantity)

  const handleCreateInvoice = useCallback(async () => {
    if (!selectedProduct || !price || createInvoice.isPending) return
    const qty = safeParseInt(quantity) || 1
    const unitPrice = safeParseFloat(price)
    const total = unitPrice * qty

    const newInvoice = await createInvoice.mutateAsync({
      type: 'sale', date: new Date().toISOString(), subtotal: total, discountTotal: 0,
      discountType: 'fixed', taxRate: 0, taxTotal: 0, total, paidAmount: total,
      paymentMethod: 'cash', currency: 'AFN',
      customerId: selectedCustomer?.id || undefined,
      customerName: selectedCustomer ? (selectedCustomer.fullName || selectedCustomer.full_name || selectedCustomer.name) : undefined,
      items: [{
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty, unitPrice, discount: 0, totalPrice: total,
      }],
    })

    if (selectedProduct.name) {
      preferences.addRecentProduct(selectedProduct.name)
      preferences.addFrequentProduct(selectedProduct.name)
    }
    if (selectedCustomer) {
      preferences.setLastCustomer(selectedCustomer.fullName || selectedCustomer.full_name || selectedCustomer.name || '', selectedCustomer.id)
    }

    markInvoiceCreated()

    setTimeout(() => {
      onComplete?.()
      // @ts-ignore
      if (global.navigation && newInvoice.id) {
        // @ts-ignore
        global.navigation.navigate('InvoiceDetail', { id: newInvoice.id })
      }
    }, 2000)
  }, [selectedProduct, selectedCustomer, price, quantity, createInvoice, preferences, markInvoiceCreated, onComplete])

  const isPending = createInvoice.isPending
  const products = (productData?.products || []) as any[]
  const customers = (customerData?.customers || []) as any[]

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tk.background }]}>
      <View style={[styles.header, { borderBottomColor: tk.border }]}>
        <Text style={[styles.headerTitle, { color: tk.foreground }]}>{t('faktoor.newFaktoor')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* STEP: Product */}
        {step === 'product' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📦</Text>
            <Text style={[styles.stepTitle, { color: tk.foreground }]}>{t('godam.productName')}</Text>

            {selectedProduct ? (
              <View style={[styles.selectedBox, { backgroundColor: tk.primary + '15', borderColor: tk.primary }]}>
                <Text style={[styles.selectedName, { color: tk.foreground }]}>{selectedProduct.name}</Text>
                <Text style={[styles.selectedMeta, { color: tk.mutedFg }]}>
                  {fmt(selectedProduct.sell_price ?? selectedProduct.sellPrice ?? 0)} AFN / {selectedProduct.unit || 'عدد'}
                </Text>
                <TouchableOpacity onPress={() => { setSelectedProduct(null); setPrice('') }}>
                  <Text style={[styles.changeBtn, { color: tk.primary }]}>تغییر</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.pickerBtn, { borderColor: tk.border }]} onPress={() => setShowProductPicker(true)}>
                <Text style={[styles.pickerBtnText, { color: tk.mutedFg }]}>انتخاب محصول از گدام...</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: tk.primary, opacity: selectedProduct ? 1 : 0.5 }]}
              disabled={!selectedProduct}
              onPress={() => setStep('customer')}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryBtnText, { color: tk.primaryFg }]}>{t('action.next')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP: Customer */}
        {step === 'customer' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>👤</Text>
            <Text style={[styles.stepTitle, { color: tk.foreground }]}>{t('faktoor.customer')}</Text>

            {selectedCustomer ? (
              <View style={[styles.selectedBox, { backgroundColor: tk.primary + '15', borderColor: tk.primary }]}>
                <Text style={[styles.selectedName, { color: tk.foreground }]}>
                  {selectedCustomer.fullName || selectedCustomer.full_name || selectedCustomer.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Text style={[styles.changeBtn, { color: tk.primary }]}>تغییر</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.pickerBtn, { borderColor: tk.border }]} onPress={() => setShowCustomerPicker(true)}>
                <Text style={[styles.pickerBtnText, { color: tk.mutedFg }]}>انتخاب مشتری (اختیاری)...</Text>
              </TouchableOpacity>
            )}

            <View style={styles.rowBtns}>
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: tk.border }]} onPress={() => setStep('product')} activeOpacity={0.8}>
                <Text style={[styles.secondaryBtnText, { color: tk.foreground }]}>{t('action.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtnSmall, { backgroundColor: tk.primary }]} onPress={() => setStep('price')} activeOpacity={0.85}>
                <Text style={[styles.primaryBtnTextSmall, { color: tk.primaryFg }]}>{t('action.next')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP: Price */}
        {step === 'price' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>💰</Text>
            <Text style={[styles.stepTitle, { color: tk.foreground }]}>{t('faktoor.total')}</Text>

            <View style={[styles.summaryMini, { backgroundColor: tk.card, borderColor: tk.border }]}>
              <Text style={[styles.summaryKey, { color: tk.mutedFg }]}>
                {selectedProduct?.name} {selectedCustomer ? `→ ${selectedCustomer.fullName || selectedCustomer.full_name || selectedCustomer.name}` : ''}
              </Text>
            </View>

            <Text style={[styles.label, { color: tk.foreground }]}>{t('godam.quantity')}</Text>
            <View style={styles.quantityRow}>
              {['1', '2', '3', '5', '10'].map((q) => (
                <TouchableOpacity key={q} style={[styles.qtyBtn, { borderColor: quantity === q ? tk.primary : tk.border, backgroundColor: quantity === q ? tk.primary + '15' : 'transparent' }]} onPress={() => setQuantity(q)}>
                  <Text style={[styles.qtyText, { color: quantity === q ? tk.primary : tk.mutedFg }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput ref={inputRef} style={[styles.input, { backgroundColor: tk.input, color: tk.foreground }]} value={price} onChangeText={setPrice} placeholder="قیمت (AFN)" placeholderTextColor={tk.mutedFg} keyboardType="numeric" />

            {price ? (
              <View style={[styles.totalBox, { backgroundColor: tk.primary + '10' }]}>
                <Text style={[styles.totalLabel, { color: tk.mutedFg }]}>{t('faktoor.total')}</Text>
                <Text style={[styles.totalAmount, { color: tk.primary }]}>{total.toLocaleString('fa-AF')} AFN</Text>
              </View>
            ) : null}

            <View style={styles.rowBtns}>
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: tk.border }]} onPress={() => setStep('customer')}>
                <Text style={[styles.secondaryBtnText, { color: tk.foreground }]}>{t('action.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtnSmall, { backgroundColor: tk.primary, opacity: price && !isPending ? 1 : 0.5 }]} disabled={!price || safeParseFloat(price) <= 0 || isPending} onPress={handleCreateInvoice}>
                <Text style={[styles.primaryBtnTextSmall, { color: tk.primaryFg }]}>{isPending ? '...' : t('faktoor.printFaktoor')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} animationType="slide" transparent>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: tk.card }]}>
            <TextInput style={[styles.input, { backgroundColor: tk.input, color: tk.foreground, marginBottom: 12 }]} value={productSearch} onChangeText={setProductSearch} placeholder="جستجوی محصول..." placeholderTextColor={tk.mutedFg} autoFocus />
            <FlatList
              data={products}
              keyExtractor={(item: any) => item.id}
              renderItem={({ item }: any) => (
                <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: tk.border }]} onPress={() => { setSelectedProduct(item); setShowProductPicker(false); setProductSearch('') }}>
                  <Text style={[styles.pickerItemName, { color: tk.foreground }]}>{item.name}</Text>
                  <Text style={[styles.pickerItemPrice, { color: tk.mutedFg }]}>{fmt(item.sell_price ?? item.sellPrice ?? 0)} AFN</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: tk.border, marginTop: 12 }]} onPress={() => setShowProductPicker(false)}>
              <Text style={[styles.secondaryBtnText, { color: tk.foreground }]}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal visible={showCustomerPicker} animationType="slide" transparent>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: tk.card }]}>
            <TextInput style={[styles.input, { backgroundColor: tk.input, color: tk.foreground, marginBottom: 12 }]} value={customerSearch} onChangeText={setCustomerSearch} placeholder="جستجوی مشتری..." placeholderTextColor={tk.mutedFg} autoFocus />
            <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: tk.border }]} onPress={() => { setSelectedCustomer(null); setShowCustomerPicker(false); setCustomerSearch('') }}>
              <Text style={[styles.pickerItemName, { color: tk.mutedFg }]}>بدون مشتری</Text>
            </TouchableOpacity>
            <FlatList
              data={customers}
              keyExtractor={(item: any) => item.id}
              renderItem={({ item }: any) => (
                <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: tk.border }]} onPress={() => { setSelectedCustomer(item); setShowCustomerPicker(false); setCustomerSearch('') }}>
                  <Text style={[styles.pickerItemName, { color: tk.foreground }]}>{item.fullName || item.full_name || item.name}</Text>
                  <Text style={[styles.pickerItemPrice, { color: tk.mutedFg }]}>{item.phone || ''}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: tk.border, marginTop: 12 }]} onPress={() => setShowCustomerPicker(false)}>
              <Text style={[styles.secondaryBtnText, { color: tk.foreground }]}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  stepContent: { paddingTop: 24, alignItems: 'center', gap: 16 },
  stepEmoji: { fontSize: 48, marginBottom: 4 },
  stepTitle: { fontSize: 22, fontWeight: '700' },
  input: { width: '100%', height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  pickerBtn: { width: '100%', height: 50, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  pickerBtnText: { fontSize: 15 },
  selectedBox: { width: '100%', borderRadius: 12, borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 4 },
  selectedName: { fontSize: 16, fontWeight: '600' },
  selectedMeta: { fontSize: 13 },
  changeBtn: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  rowBtns: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 8 },
  primaryBtn: { width: '100%', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  primaryBtnSmall: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnTextSmall: { fontSize: 15, fontWeight: '600' },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '500', alignSelf: 'flex-start' },
  quantityRow: { flexDirection: 'row', gap: 8 },
  qtyBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 15, fontWeight: '600' },
  summaryMini: { width: '100%', borderRadius: 10, borderWidth: 1, padding: 12 },
  summaryKey: { fontSize: 13 },
  totalBox: { width: '100%', borderRadius: 14, padding: 20, alignItems: 'center' },
  totalLabel: { fontSize: 12, marginBottom: 4 },
  totalAmount: { fontSize: 28, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, paddingHorizontal: 4 },
  pickerItemName: { fontSize: 15, fontWeight: '500', flex: 1 },
  pickerItemPrice: { fontSize: 13 },
})