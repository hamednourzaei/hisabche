// ============================================
// Quick invoice — canonical five-stage wizard pieces.
//
// Web anatomy (packages/ui/components/ui/quick-invoice):
//   product → customer → price → preview → done
//   each step rendered inside a bordered elevated card, with a progress
//   indicator at the top (web's filled bars) and Next/Back actions.
//
// These native pieces reproduce that structure: a touch-friendly step
// indicator, a card footer with the stage navigation, the invoice preview
// document, and the completion state. All copy resolves through i18n; all
// colors come from the theme.
// ============================================

import React, { memo, useEffect, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, MobileCard, Money, Text, useTheme } from '@hisabche/mobile-ui'

import { currencySign, formatAmount, formatCurrency } from '../../../shared/lib/format'
import type { CurrencyCode } from '@hisabche/store'
import type { DraftItem } from '../hooks/use-invoice-draft'

// ─── Step model — the canonical five stages ───────────────────────────────

export type QuickInvoiceStep = 'product' | 'customer' | 'price' | 'preview' | 'done'

export const QUICK_INVOICE_STEPS: readonly { id: QuickInvoiceStep; labelKey: string }[] = [
  { id: 'product', labelKey: 'quickInvoice.stepProduct' },
  { id: 'customer', labelKey: 'quickInvoice.stepCustomer' },
  { id: 'price', labelKey: 'quickInvoice.stepPrice' },
  { id: 'preview', labelKey: 'quickInvoice.stepPreview' },
  { id: 'done', labelKey: 'quickInvoice.stepDone' },
]

const STEP_INDEX: Record<QuickInvoiceStep, number> = {
  product: 0,
  customer: 1,
  price: 2,
  preview: 3,
  done: 4,
}

// ─── Step indicator — web's filled progress bars with elapsed timer ───────

export const QuickInvoiceStepIndicator = memo(function QuickInvoiceStepIndicator({
  current,
  onJump,
  elapsed,
}: {
  current: QuickInvoiceStep
  onJump?: ((step: QuickInvoiceStep) => void) | undefined
  elapsed?: number
}) {
  const { t } = useTranslation('mobile')
  const { colors, spacing, radius } = useTheme()
  const currentIndex = STEP_INDEX[current]

  // Format elapsed time as MM:SS
  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
          {QUICK_INVOICE_STEPS.map((step) => {
            const index = STEP_INDEX[step.id]
            const done = index < currentIndex
            const active = index === currentIndex
            return (
              <Pressable
                key={step.id}
                disabled={!onJump || step.id === 'done'}
                onPress={() => onJump?.(step.id)}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: radius.full,
                  backgroundColor: done || active ? colors.primary : colors.surfaceMuted,
                }}
                accessibilityLabel={t(step.labelKey)}
              />
            )
          })}
        </View>
        {elapsed !== undefined && elapsed > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }}
            />
            <Text
              variant="legal"
              style={{ color: colors.fgSecondary, fontVariant: ['tabular-nums'] }}
            >
              {formatElapsed(elapsed)}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {QUICK_INVOICE_STEPS.map((step) => {
          const index = STEP_INDEX[step.id]
          const active = index === currentIndex
          const done = index < currentIndex
          return (
            <Text
              key={step.id}
              variant="legal"
              numberOfLines={1}
              style={{
                flex: 1,
                textAlign: 'center',
                color: active ? colors.primary : done ? colors.fgSecondary : colors.fgTertiary,
                fontWeight: active ? '700' : '400',
              }}
            >
              {t(step.labelKey)}
            </Text>
          )
        })}
      </View>
    </View>
  )
})

// ─── Step: Items (multi-product) ───────────────────────────────────────────

// ─── Footer — canonical Back / Next stage navigation ───────────────────────

export function QuickInvoiceFooter({
  current,
  canNext,
  nextLabel,
  loading,
  onBack,
  onNext,
}: {
  current: QuickInvoiceStep
  canNext: boolean
  nextLabel: string
  loading?: boolean
  onBack?: (() => void) | undefined
  onNext: () => void
}) {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()

  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {onBack ? (
        <View style={{ flex: 1 }}>
          <Button
            label={t('quickInvoice.back')}
            variant="subtle"
            size="md"
            fullWidth
            onPress={() => onBack()}
          />
        </View>
      ) : null}
      <View style={onBack ? { flex: 1 } : { flex: 1 }}>
        <Button
          label={nextLabel}
          size="md"
          fullWidth
          disabled={!canNext}
          loading={loading}
          onPress={onNext}
        />
      </View>
    </View>
  )
}

// ─── Preview — native rendering of the canonical InvoiceDocument anatomy ────

export function QuickInvoicePreview({
  items,
  customerName,
  isPurchase,
  subtotal,
  discountTotal,
  total,
  paidAmount,
  remaining,
  currency,
}: {
  items: DraftItem[]
  customerName?: string | undefined
  isPurchase: boolean
  subtotal: number
  discountTotal: number
  total: number
  paidAmount: number
  remaining: number
  currency: CurrencyCode
}) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const sign = currencySign(currency)

  return (
    <MobileCard padding="lg" elevated="none">
      {/* Business header — web's «فاکتور فروش/خرید» + number placeholder */}
      <View style={{ alignItems: 'center', gap: 2, paddingBottom: spacing.md }}>
        <Text variant="heading" style={{ color: colors.primary }}>
          {isPurchase ? t('sales.purchase') : t('sales.sale')}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t('quickInvoice.previewTitle')}
        </Text>
      </View>

      {customerName ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.borderDefault,
            paddingVertical: spacing.md,
          }}
        >
          <Avatar name={customerName} size={32} />
          <View style={{ flex: 1 }}>
            <Text variant="legal" tone="tertiary">
              {isPurchase ? t('sales.supplier') : t('sales.customer')}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {customerName}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Items — web's table rows as native rows with unit details */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
          paddingVertical: spacing.sm,
        }}
      >
        {items.map((item) => (
          <View
            key={item.key}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: spacing.xs,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" numberOfLines={1}>
                {item.productName}
              </Text>
              <Text variant="legal" tone="tertiary">
                {`${item.quantity} × ${formatCurrency(item.unitPrice, currency)}`}
              </Text>
              {/* Show unit/weight if present — mirrors web's InvoiceDocument item details */}
              {item.unit || item.weightGrams ? (
                <Text variant="legal" tone="tertiary" style={{ fontSize: 10 }}>
                  {[
                    item.unit ? `${t('sales.unit')}: ${item.unit}` : '',
                    item.weightGrams ? `${t('sales.weightGrams')}: ${item.weightGrams}` : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              ) : null}
            </View>
            <Text variant="caption" style={{ color: colors.fgPrimary }}>
              {formatCurrency(item.quantity * item.unitPrice, currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Totals — web's tfoot with subtotal/discount/total/paid/remaining */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
          paddingTop: spacing.sm,
          gap: spacing.xs,
        }}
      >
        {discountTotal > 0 ? (
          <PreviewRow
            label={t('sales.subtotal')}
            value={`${formatAmount(subtotal)} ${sign}`}
            tone="tertiary"
          />
        ) : null}
        {discountTotal > 0 ? (
          <PreviewRow
            label={t('sales.discount')}
            value={`-${formatAmount(discountTotal)} ${sign}`}
            tone="danger"
          />
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="bodyStrong">{t('sales.grandTotal')}</Text>
          <Text variant="heading" style={{ color: colors.primary }}>
            {formatCurrency(total, currency)}
          </Text>
        </View>
        {paidAmount > 0 ? (
          <PreviewRow
            label={t('sales.paid')}
            value={`-${formatAmount(paidAmount)} ${sign}`}
            tone="success"
          />
        ) : null}
        {remaining > 0 ? (
          <PreviewRow
            label={t('sales.statusPartial')}
            value={`${formatAmount(remaining)} ${sign}`}
            tone="danger"
          />
        ) : null}
      </View>
    </MobileCard>
  )
}

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'tertiary' | 'danger' | 'success'
}) {
  const { colors } = useTheme()
  const color =
    tone === 'danger' ? colors.destructive : tone === 'success' ? colors.success : colors.fgTertiary
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="caption" style={{ color }}>
        {value}
      </Text>
    </View>
  )
}

// ─── Celebration — canonical animated overlay ──────────────────────────────

export const QuickInvoiceCelebration = memo(function QuickInvoiceCelebration({
  visible,
  onDismiss,
  onConfirm,
}: {
  visible: boolean
  onDismiss: () => void
  onConfirm?: () => void
}) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const scaleAnim = useState(new Animated.Value(0))[0]

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.3)
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }).start()
    } else {
      scaleAnim.setValue(0)
    }
  }, [visible, scaleAnim])

  if (!visible) return null

  // Web semantics: tapping the celebration navigates to the created invoice.
  // Tap on the backdrop just dismisses without navigating.
  const handleCardPress = () => {
    if (onConfirm) onConfirm()
    else onDismiss()
  }

  return (
    <Pressable
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
        zIndex: 1000,
      }}
      onPress={onDismiss}
    >
      <Pressable onPress={handleCardPress}>
        <Animated.View
          style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: spacing.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            padding: spacing.xl,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.successSoft,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="checkmark" size={44} color={colors.success} />
          </View>
          <Text variant="heading" style={{ color: colors.fgPrimary, marginBottom: spacing.sm }}>
            {t('quickInvoice.created')} 🎉
          </Text>
          <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
            {t('quickInvoice.clickToView')}
          </Text>
        </Animated.View>
      </Pressable>
    </Pressable>
  )
})
QuickInvoiceCelebration.displayName = 'QuickInvoiceCelebration'

// ─── Done — canonical completion state with next actions ───────────────────

export function QuickInvoiceDone({
  total,
  paidAmount,
  remaining,
  isPurchase,
  currency,
  createdInvoiceId,
  onViewInvoice,
  onCreateAnother,
  elapsed,
  itemCount,
  paymentMethod,
}: {
  total: number
  paidAmount: number
  remaining: number
  isPurchase: boolean
  currency: CurrencyCode
  createdInvoiceId: string | null
  onViewInvoice: () => void
  onCreateAnother: () => void
  elapsed?: number
  itemCount?: number
  paymentMethod?: 'cash' | 'credit'
}) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const router = useRouter()
  const sign = currencySign(currency)

  // Format elapsed time as MM:SS
  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.successSoft,
          }}
        >
          <Ionicons name="checkmark" size={44} color={colors.success} />
        </View>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text variant="heading">{t('quickInvoice.created')} 🎉</Text>
          <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
            {t('quickInvoice.createdDesc')}
          </Text>
          {elapsed !== undefined && elapsed > 0 && (
            <Text
              variant="legal"
              style={{ color: colors.fgSecondary, fontVariant: ['tabular-nums'] }}
            >
              {t('quickInvoice.elapsedTime', {
                m: Math.floor(elapsed / 60)
                  .toString()
                  .padStart(2, '0'),
                s: (elapsed % 60).toString().padStart(2, '0'),
              })}
            </Text>
          )}
        </View>
      </View>

      <MobileCard padding="lg" elevated="none">
        <PreviewRow
          label={t('sales.grandTotal')}
          value={`${formatAmount(total)} ${sign}`}
          tone="tertiary"
        />
        {paidAmount > 0 ? (
          <PreviewRow
            label={t('sales.paid')}
            value={`${formatAmount(paidAmount)} ${sign}`}
            tone="success"
          />
        ) : null}
        {remaining > 0 ? (
          <PreviewRow
            label={t('sales.statusPartial')}
            value={`${formatAmount(remaining)} ${sign}`}
            tone="danger"
          />
        ) : null}
        {itemCount !== undefined && itemCount > 0 && (
          <PreviewRow
            label={t('quickInvoice.items', { count: itemCount })}
            value={isPurchase ? t('sales.purchase') : t('sales.sale')}
            tone="tertiary"
          />
        )}
        {paymentMethod && (
          <PreviewRow
            label={t('quickInvoice.paymentMethod')}
            value={paymentMethod === 'cash' ? t('quickInvoice.cash') : t('quickInvoice.credit')}
            tone="tertiary"
          />
        )}
      </MobileCard>

      <View style={{ gap: spacing.sm }}>
        {createdInvoiceId ? (
          <Button label={t('quickInvoice.viewInvoice')} fullWidth onPress={onViewInvoice} />
        ) : null}
        <Button
          label={t('quickInvoice.createAnother')}
          variant="subtle"
          fullWidth
          onPress={onCreateAnother}
        />
        <Button
          label={t('quickInvoice.backToInvoices')}
          variant="ghost"
          fullWidth
          onPress={() => router.replace('/(tabs)/invoices')}
        />
      </View>
    </View>
  )
}
