// packages/ui/src/components/ui/quick-invoice/containers/quick-invoice-container.tsx
'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCreateInvoice } from '@hisabche/api'
import {
  useOnboardingStore,
  usePreferencesStore,
  useSyncStore,
  useBackupStore,
} from '@hisabche/store'
import { QuickInvoicePage, lineTotalOf } from '../quick-invoice-page'
import type {
  QuickInvoicePageProps,
  InvoiceLineItem,
  InvoiceLineDetail,
  TransactionType,
  InvoiceUnit,
} from '../quick-invoice-page'

/* ═══════════════════════════════════════════════════════════════════════════
   QuickInvoiceContainer v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · useMemo · safeT
   ═══════════════════════════════════════════════════════════════════════════ */

export const QuickInvoiceContainer = memo(function QuickInvoiceContainer() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const createInvoice = useCreateInvoice()
  const { markInvoiceCreated } = useOnboardingStore()
  const preferences = usePreferencesStore()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

  const [step, setStep] = useState<QuickInvoicePageProps['step']>('product')
  const [items, setItems] = useState<InvoiceLineItem[]>([])
  // `?type=purchase` is what /purchasing uses to open this same form in
  // purchase mode. No type, or an unknown one, keeps the existing sale
  // default so current links and bookmarks behave exactly as before.
  const typeParam = searchParams?.get('type')
  const [transactionType, setTransactionType] = useState<TransactionType>(
    typeParam === 'purchase' ? 'purchase' : 'sale',
  )

  // Command palette offers «ثبت فروش» and «ثبت خرید» as separate actions. Both
  // land on this form, so picking one while already here changes only the query
  // string — no remount, and the initial state above would never re-run.
  useEffect(() => {
    if (typeParam === 'purchase' || typeParam === 'sale') {
      setTransactionType(typeParam)
    }
  }, [typeParam])
  const [selectedCustomer, setSelectedCustomer] =
    useState<QuickInvoicePageProps['selectedCustomer']>(null)
  const [paymentType, setPaymentType] = useState<QuickInvoicePageProps['paymentType']>('cash')
  const [paidNow, setPaidNow] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed')
  const [isPaid, setIsPaid] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000,
    )
    return () => clearInterval(interval)
  }, [startTime])

  // ✅ useMemo برای محاسبات
  // Uses the shared line rule so the preview total can never disagree with
  // what is sent to the API — and priced details are never double-counted.
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + lineTotalOf(item), 0), [items])

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue) || 0
    if (v <= 0) return 0
    return discountType === 'percentage' ? (subtotal * v) / 100 : v
  }, [discountValue, discountType, subtotal])

  const total = useMemo(
    () => Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100),
    [subtotal, discountAmount],
  )

  const productName = useMemo(() => items.map((item) => item.product.name).join('، '), [items])

  const addItem = useCallback((product: QuickInvoicePageProps['items'][number]['product']) => {
    setItems((prev) => {
      if (prev.some((item) => item.product.id === product.id)) return prev
      return [
        ...prev,
        {
          key: product.id,
          product,
          quantity: '1',
          price: product.sellPrice.toString(),
        },
      ]
    })
  }, [])

  // ✅ آیتم با نام دلخواه (بدون محصول واقعی از انبار) — مثلاً حق‌الزحمه خدمات
  // product.id خالی می‌ماند تا در handleCreate با undefined جایگزین شود و
  // به‌جای شناسه‌ی جعلی محصول، productId اصلاً ارسال نشود (مغایرت FK نداشته باشیم).
  const addCustomItem = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setItems((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}`,
        product: { id: '', name: trimmed, sellPrice: 0, unit: '' },
        quantity: '1',
        price: '0',
      },
    ])
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }, [])

  const updateItemQuantity = useCallback((key: string, quantity: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, quantity } : item)))
  }, [])

  const updateItemPrice = useCallback((key: string, price: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, price } : item)))
  }, [])

  const updateItemUnit = useCallback((key: string, unit: InvoiceUnit) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        // Leaving 'custom' drops the stale label so it cannot resurface.
        const next: InvoiceLineItem = { ...item, unit }
        if (unit !== 'custom') delete next.unitLabel
        return next
      }),
    )
  }, [])

  const updateItemWeight = useCallback((key: string, weightGrams: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, weightGrams } : item)))
  }, [])

  const updateItemUnitLabel = useCallback((key: string, unitLabel: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, unitLabel } : item)))
  }, [])

  // ─── جزئیات آیتم ───────────────────────────────────────────────────────
  // بدون هیچ سقفی — کاربر هرچقدر بخواهد جزء اضافه می‌کند.
  const addDetail = useCallback((key: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        const detail: InvoiceLineDetail = {
          key: `d-${key}-${Date.now()}-${item.details?.length ?? 0}`,
          title: '',
          quantity: '1',
          amount: '0',
        }
        return { ...item, details: [...(item.details ?? []), detail] }
      }),
    )
  }, [])

  const updateDetail = useCallback(
    (key: string, detailKey: string, patch: Partial<Omit<InvoiceLineDetail, 'key'>>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                details: (item.details ?? []).map((d) =>
                  d.key === detailKey ? { ...d, ...patch } : d,
                ),
              }
            : item,
        ),
      )
    },
    [],
  )

  const removeDetail = useCallback((key: string, detailKey: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, details: (item.details ?? []).filter((d) => d.key !== detailKey) }
          : item,
      ),
    )
  }, [])

  // ✅ سویچ «تسویه شده» صریح — مستقل از نوع پرداخت (نقد/نسیه)، کاربر می‌تواند
  // برای هر دو حالت وضعیت پرداخت را دستی مشخص کند
  const paidAmount = useMemo(
    () => (isPaid ? total : parseFloat(paidNow) || 0),
    [isPaid, total, paidNow],
  )

  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const v = t(key as Parameters<typeof t>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const elapsedFormatted = useMemo(
    () => (elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`),
    [elapsed],
  )

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false)
    router.push(createdInvoiceId ? `/invoices/${createdInvoiceId}` : '/invoices')
  }, [createdInvoiceId, router])

  const handleCreate = useCallback(async () => {
    if (items.length === 0) return

    setSaveStatus('saving')

    try {
      const newInvoice = await createInvoice.mutateAsync({
        // Sent explicitly from form state — never inferred from the route
        // after submission.
        type: transactionType,
        date: new Date().toISOString(),
        subtotal,
        discountTotal: discountAmount,
        discountType,
        taxRate: preferences.lastTaxRate ?? 0,
        taxTotal: 0,
        total,
        paidAmount,
        paymentMethod: paymentType === 'cash' ? 'cash' : 'credit',
        currency: (preferences.lastCurrency as 'AFN' | 'USD' | 'PKR' | 'IRR') ?? 'AFN',
        customerId: selectedCustomer?.id || undefined,
        items: items.map((item) => {
          // parseFloat, not parseInt: a gram-priced line can be 12.5.
          const quantity = parseFloat(item.quantity) || 1
          const unitPrice = parseFloat(item.price) || 0
          const details = (item.details ?? [])
            .filter((d) => d.title.trim())
            .map((d, index) => ({
              title: d.title.trim(),
              quantity: parseFloat(d.quantity) || 1,
              amount: parseFloat(d.amount) || 0,
              sortOrder: index,
            }))

          return {
            // آیتم با نام دلخواه، product.id خالی است — productId ارسال نمی‌شود
            ...(item.product.id && { productId: item.product.id }),
            productName: item.product.name,
            quantity,
            unit: item.unit || 'piece',
            ...(item.unit === 'custom' && item.unitLabel?.trim()
              ? { unitLabel: item.unitLabel.trim() }
              : {}),
            unitPrice,
            discount: 0,
            // The single money rule — details replace the base when priced,
            // never add to it.
            totalPrice: lineTotalOf(item),
            details,
          }
        }),
      })

      for (const item of items) {
        preferences.addRecentProduct(item.product.name)
        preferences.addFrequentProduct(item.product.name)
      }
      if (selectedCustomer) {
        preferences.setLastCustomer(selectedCustomer.name, selectedCustomer.id)
      }
      markInvoiceCreated()

      addAuditEntry({
        action: 'create',
        entity: 'invoice',
        entityId: newInvoice.id || '',
        details: `فاکتور جدید: ${productName} — ${total.toLocaleString()} AFN ${paymentType === 'cash' ? 'نقد' : 'نسیه'}`,
      })

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      setCreatedInvoiceId(newInvoice.id ?? null)
      setShowCelebration(true)
      setStep('done')
    } catch (error) {
      setSaveStatus('idle')
      console.error('Failed to create invoice:', error)
    }
  }, [
    items,
    subtotal,
    discountAmount,
    discountType,
    total,
    paidAmount,
    paymentType,
    selectedCustomer,
    preferences,
    createInvoice,
    markInvoiceCreated,
    setSaveStatus,
    addAuditEntry,
    productName,
    transactionType,
  ])

  const handleViewInvoice = useCallback(
    () => router.push(`/invoices/${createdInvoiceId}`),
    [createdInvoiceId, router],
  )

  const handleViewAllInvoices = useCallback(() => router.push('/invoices'), [router])

  return (
    <QuickInvoicePage
      t={safeT}
      elapsedFormatted={elapsedFormatted}
      showSaved={false}
      showCelebration={showCelebration}
      step={step}
      items={items}
      selectedCustomer={selectedCustomer}
      paymentType={paymentType}
      paidNow={paidNow}
      subtotal={subtotal}
      discountValue={discountValue}
      discountType={discountType}
      total={total}
      productName={productName}
      paidAmount={paidAmount}
      isPaid={isPaid}
      createdInvoiceId={createdInvoiceId}
      isPending={createInvoice.isPending}
      onAddItem={addItem}
      onAddCustomItem={addCustomItem}
      onRemoveItem={removeItem}
      onUpdateItemQuantity={updateItemQuantity}
      onUpdateItemPrice={updateItemPrice}
      transactionType={transactionType}
      onTransactionTypeChange={setTransactionType}
      onUpdateItemUnit={updateItemUnit}
      onUpdateItemUnitLabel={updateItemUnitLabel}
      onUpdateItemWeight={updateItemWeight}
      onAddDetail={addDetail}
      onUpdateDetail={updateDetail}
      onRemoveDetail={removeDetail}
      onSelectCustomer={setSelectedCustomer}
      onPaymentTypeChange={setPaymentType}
      onPaidNowChange={setPaidNow}
      onDiscountValueChange={setDiscountValue}
      onDiscountTypeChange={setDiscountType}
      onIsPaidChange={setIsPaid}
      onSetStep={setStep}
      onConfirmCreate={handleCreate}
      onDismissCelebration={dismissCelebration}
      onViewInvoice={handleViewInvoice}
      onViewAllInvoices={handleViewAllInvoices}
    />
  )
})

QuickInvoiceContainer.displayName = 'QuickInvoiceContainer'
