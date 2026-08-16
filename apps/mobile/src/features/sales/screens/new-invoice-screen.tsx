// ============================================
// Create invoice — canonical five-stage wizard.
//
// Web anatomy (packages/ui/components/ui/quick-invoice):
//   product → customer → price → preview → done
//
// Each canonical stage is preserved on mobile:
//   product  — transaction type, product/custom item, line items, unit/weight/details
//   customer — customer/supplier picker (bottom sheet)
//   price    — subtotal, discount, cash/credit, paid/unpaid, prepayment, remaining
//   preview  — native rendering of the invoice document before the final mutation
//   done     — completion state with view-invoice / create-another / back actions
//
// The create mutation fires only at the canonical confirmation point (preview),
// never earlier. Draft state stays centralized in use-invoice-draft.
// ============================================

import React, { useCallback, useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  Button,
  MobileCard,
  Money,
  SectionHeader,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { currencySign, formatAmount } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { CustomerPickerSheet } from '../components/customer-picker-sheet'
import { LineItemDetailEditor } from '../components/line-item-detail-editor'
import { LineItemRow } from '../components/line-item-row'
import { TransactionTypeSwitch } from '../components/transaction-type-switch'
import { ProductPickerSheet } from '../components/product-picker-sheet'
import { useSubmitInvoice } from '../hooks/use-create-invoice'
import { useInvoiceDraft } from '../hooks/use-invoice-draft'
import {
  QuickInvoiceFooter,
  QuickInvoicePreview,
  QuickInvoiceStepIndicator,
  QuickInvoiceDone,
  QuickInvoiceCelebration,
  type QuickInvoiceStep,
} from '../components/quick-invoice-steps'
import { router } from 'expo-router'

export function NewInvoiceScreen() {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const currency = useCurrency()

  // `?type=purchase` — the same parameter the web and desktop command palette
  // uses, so a deep link means the same thing on every platform.
  const { type } = useLocalSearchParams<{ type?: string }>()
  const draft = useInvoiceDraft(type === 'purchase' ? 'purchase' : 'sale')
  const { submit, isSubmitting } = useSubmitInvoice()

  const [step, setStep] = useState<QuickInvoiceStep>('product')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)

  // Timer effect to track how long the user has been creating the invoice.
  // Stops once the wizard reaches the done stage so the elapsed value freezes.
  useEffect(() => {
    if (step === 'done') return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime, step])

  const isPurchase = draft.transactionType === 'purchase'
  const title = isPurchase ? t('sales.newPurchase', 'خرید جدید') : t('sales.newInvoice')

  const confirmCreate = useCallback(async () => {
    try {
      const result = await submit(draft.build(currency))
      setCreatedInvoiceId(result.invoiceId ?? null)
      setShowCelebration(true)
      setStep('done')
    } catch (error) {
      // Stay on the completion state so the user is never stranded mid-flow.
      console.error('submit invoice failed', error)
      setStep('done')
    }
  }, [currency, draft, submit])

  const onBack = useCallback(() => {
    setStep((s) =>
      s === 'customer' ? 'product' : s === 'price' ? 'customer' : s === 'preview' ? 'price' : s,
    )
  }, [])

  const onNext = useCallback(() => {
    setStep((s) =>
      s === 'product' ? 'customer' : s === 'customer' ? 'price' : s === 'price' ? 'preview' : s,
    )
  }, [])

  const canNextProduct = draft.items.length > 0
  const canNextPrice = draft.items.length > 0

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false)
  }, [])

  const confirmCelebration = useCallback(() => {
    setShowCelebration(false)
    if (createdInvoiceId) {
      router.push(`/invoices/${createdInvoiceId}`)
    }
  }, [createdInvoiceId])

  return (
    <AppScreen>
      <ScreenHeader title={title} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step indicator — canonical progress with elapsed timer, shown across the wizard */}
          {step !== 'done' ? <QuickInvoiceStepIndicator current={step} elapsed={elapsed} /> : null}

          {step === 'product' ? (
            <ProductStage
              draft={draft}
              currency={currency}
              isPurchase={isPurchase}
              onOpenProduct={() => setProductOpen(true)}
              onNext={onNext}
              canNext={canNextProduct}
              colors={colors}
              spacing={spacing}
            />
          ) : null}

          {step === 'customer' ? (
            <CustomerStage
              isPurchase={isPurchase}
              customerName={draft.customerName}
              onOpen={() => setCustomerOpen(true)}
              onBack={onBack}
              onNext={onNext}
              colors={colors}
              spacing={spacing}
            />
          ) : null}

          {step === 'price' ? (
            <PriceStage
              draft={draft}
              currency={currency}
              onBack={onBack}
              onNext={onNext}
              canNext={canNextPrice}
              isSubmitting={false}
              colors={colors}
              spacing={spacing}
            />
          ) : null}

          {step === 'preview' ? (
            <PreviewStage
              draft={draft}
              currency={currency}
              isPurchase={isPurchase}
              isSubmitting={isSubmitting}
              onBack={onBack}
              onConfirm={confirmCreate}
              colors={colors}
              spacing={spacing}
            />
          ) : null}

          {step === 'done' ? (
            <QuickInvoiceDone
              total={draft.total}
              paidAmount={draft.paidAmount}
              remaining={draft.remaining}
              isPurchase={isPurchase}
              currency={currency}
              createdInvoiceId={createdInvoiceId}
              elapsed={elapsed}
              itemCount={draft.items.length}
              paymentMethod={draft.paymentMethod}
              onViewInvoice={() => {
                if (createdInvoiceId) {
                  router.push(`/invoices/${createdInvoiceId}`)
                }
              }}
              onCreateAnother={() => {
                draft.reset()
                setStep('product')
              }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <QuickInvoiceCelebration
        visible={showCelebration}
        onDismiss={dismissCelebration}
        onConfirm={confirmCelebration}
      />

      <CustomerPickerSheet
        visible={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onSelect={(customer) => {
          draft.setCustomer(customer.id, customer.fullName)
          setCustomerOpen(false)
        }}
      />

      <ProductPickerSheet
        visible={productOpen}
        onClose={() => setProductOpen(false)}
        onSelect={(product) => {
          draft.addItem({ ...product, discount: 0 })
          setProductOpen(false)
        }}
      />
    </AppScreen>
  )
}

/* ─── Stage 1: Product ─────────────────────────────────────────────────── */

interface StageProps {
  spacing: ReturnType<typeof useTheme>['spacing']
  colors: ReturnType<typeof useTheme>['colors']
}

function ProductStage({
  draft,
  currency,
  isPurchase,
  onOpenProduct,
  onNext,
  canNext,
  spacing,
  colors,
}: StageProps & {
  draft: ReturnType<typeof useInvoiceDraft>
  currency: ReturnType<typeof useCurrency>
  isPurchase: boolean
  onOpenProduct: () => void
  onNext: () => void
  canNext: boolean
}) {
  const { t } = useTranslation('mobile')

  return (
    <View style={{ gap: spacing.lg }}>
      <TransactionTypeSwitch value={draft.transactionType} onChange={draft.setTransactionType} />

      <View>
        <SectionHeader
          title={t('sales.items')}
          actionLabel={t('sales.addItem')}
          actionTestID="add-item"
          onAction={onOpenProduct}
        />

        {draft.items.length === 0 ? (
          <MobileCard variant="muted" elevated="none" padding="lg">
            <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
              {t('sales.noItems')}
            </Text>
          </MobileCard>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {draft.items.map((item, index) => (
              <View key={item.key}>
                <LineItemRow
                  testID={`line-item-${index}`}
                  item={item}
                  currency={currency}
                  onRemove={() => draft.removeItem(item.key)}
                />
                <LineItemDetailEditor item={item} onChange={draft.updateItem} />
              </View>
            ))}
          </View>
        )}
      </View>

      <QuickInvoiceFooter
        current="product"
        canNext={canNext}
        nextLabel={t('quickInvoice.next')}
        onNext={onNext}
      />
    </View>
  )
}

/* ─── Stage 2: Customer ────────────────────────────────────────────────── */

function CustomerStage({
  isPurchase,
  customerName,
  onOpen,
  onBack,
  onNext,
  spacing,
  colors,
}: StageProps & {
  isPurchase: boolean
  customerName?: string | undefined
  onOpen: () => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useTranslation('mobile')

  return (
    <View style={{ gap: spacing.lg }}>
      <MobileCard onPress={onOpen} padding="lg">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={customerName ?? '?'} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="legal" tone="tertiary">
              {isPurchase ? t('sales.supplier', 'فروشنده') : t('sales.customer')}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {customerName ?? (isPurchase ? t('sales.selectSupplier') : t('sales.selectCustomer'))}
            </Text>
          </View>
          <Ionicons name="chevron-back" size={18} color={colors.fgTertiary} />
        </View>
      </MobileCard>

      <QuickInvoiceFooter
        current="customer"
        canNext
        nextLabel={t('quickInvoice.next')}
        onBack={onBack}
        onNext={onNext}
      />
    </View>
  )
}

/* ─── Stage 3: Price ───────────────────────────────────────────────────── */

function PriceStage({
  draft,
  currency,
  onBack,
  onNext,
  canNext,
  spacing,
  colors,
}: StageProps & {
  draft: ReturnType<typeof useInvoiceDraft>
  currency: ReturnType<typeof useCurrency>
  onBack: () => void
  onNext: () => void
  canNext: boolean
  isSubmitting: boolean
}) {
  const { t } = useTranslation('mobile')
  const sign = currencySign(currency)

  return (
    <View style={{ gap: spacing.lg }}>
      <MobileCard padding="lg" elevated="md">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="label" tone="secondary" style={{ flex: 1 }}>
            {t('sales.grandTotal')}
          </Text>
          <Money amount={formatAmount(draft.total)} sign={sign} size="large" />
        </View>
      </MobileCard>

      {/* Discount — mirrors web's PriceStep: value input + fixed/% toggle. */}
      <MobileCard padding="lg">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
              {t('sales.discount')}
            </Text>
            <TextInput
              testID="discount-input"
              style={{
                borderWidth: 1,
                borderColor: colors.borderDefault,
                borderRadius: 12,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                color: colors.fgPrimary,
                fontSize: 15,
              }}
              value={draft.discountValue}
              onChangeText={draft.setDiscountValue}
              placeholder={draft.discountType === 'fixed' ? currency : '٪'}
              keyboardType="numeric"
              placeholderTextColor={colors.fgTertiary}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: colors.borderDefault,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {(['fixed', 'percentage'] as const).map((dt) => (
              <Pressable
                key={dt}
                onPress={() => draft.setDiscountType(dt)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 10,
                  backgroundColor: draft.discountType === dt ? colors.primary : 'transparent',
                }}
              >
                <Text
                  variant="label"
                  style={{
                    color: draft.discountType === dt ? colors.primaryFg : colors.fgSecondary,
                  }}
                >
                  {dt === 'fixed' ? (currency?.slice(0, 3).toUpperCase() ?? 'AFN') : '%'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {draft.discountTotal > 0 ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
            {t('sales.subtotal')}: {formatAmount(draft.subtotal)} {sign}
          </Text>
        ) : null}
      </MobileCard>

      {/* Payment — web's PriceStep cash/credit, تسویه switch, prepayment. */}
      <MobileCard padding="lg">
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['cash', 'credit'] as const).map((method) => {
            const active = draft.paymentMethod === method
            return (
              <Pressable
                key={method}
                onPress={() => draft.setPaymentMethod(method)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primary : 'transparent',
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.borderDefault,
                }}
              >
                <Text
                  variant="label"
                  style={{ color: active ? colors.primaryFg : colors.fgSecondary }}
                >
                  {method === 'cash' ? `💵 ${t('sales.paid')}` : `📝 ${t('sales.credit', 'نسیه')}`}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Pressable
          onPress={() => draft.setIsPaid(!draft.isPaid)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            borderRadius: 12,
            padding: spacing.md,
          }}
        >
          <Text variant="label">{t('sales.paid')}</Text>
          <View
            style={{
              width: 42,
              height: 24,
              borderRadius: 12,
              backgroundColor: draft.isPaid ? colors.primary : colors.surfaceMuted,
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <View
              style={{
                alignSelf: draft.isPaid ? 'flex-end' : 'flex-start',
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.surfaceElevated,
              }}
            />
          </View>
        </Pressable>

        {draft.paymentMethod === 'credit' && !draft.isPaid ? (
          <View style={{ marginTop: spacing.md }}>
            <Text variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
              {t('payment.record', 'پیش‌پرداخت')}
            </Text>
            <TextInput
              testID="paid-now-input"
              style={{
                borderWidth: 1,
                borderColor: colors.borderDefault,
                borderRadius: 12,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                color: colors.fgPrimary,
                fontSize: 15,
              }}
              value={draft.paidNow}
              onChangeText={draft.setPaidNow}
              placeholder={`${t('common.total')}: ${formatAmount(draft.total)} ${sign}`}
              keyboardType="numeric"
              placeholderTextColor={colors.fgTertiary}
            />
            {draft.remaining > 0 ? (
              <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
                {t('sales.statusPartial')}: {formatAmount(draft.remaining)} {sign}
              </Text>
            ) : null}
          </View>
        ) : null}
      </MobileCard>

      <QuickInvoiceFooter
        current="price"
        canNext={canNext}
        nextLabel={t('quickInvoice.stepPreview')}
        onBack={onBack}
        onNext={onNext}
      />
    </View>
  )
}

/* ─── Stage 4: Preview — the canonical confirmation point ───────────────── */

function PreviewStage({
  draft,
  currency,
  isPurchase,
  isSubmitting,
  onBack,
  onConfirm,
  spacing,
  colors,
}: StageProps & {
  draft: ReturnType<typeof useInvoiceDraft>
  currency: ReturnType<typeof useCurrency>
  isPurchase: boolean
  isSubmitting: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation('mobile')

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="heading">{t('quickInvoice.previewTitle')}</Text>
        <Text variant="caption" tone="secondary">
          {t('quickInvoice.previewDesc')}
        </Text>
      </View>

      <QuickInvoicePreview
        items={draft.items}
        customerName={draft.customerName}
        isPurchase={isPurchase}
        subtotal={draft.subtotal}
        discountTotal={draft.discountTotal}
        total={draft.total}
        paidAmount={draft.isPaid ? draft.total : draft.paidAmount}
        remaining={draft.remaining}
        currency={currency}
      />

      <QuickInvoiceFooter
        current="preview"
        canNext
        nextLabel={t('quickInvoice.confirmCreate')}
        loading={isSubmitting}
        onBack={onBack}
        onNext={onConfirm}
      />
    </View>
  )
}
