// ============================================
// Till — the cash drawer on a phone.
//
// Web anatomy (packages/ui/components/ui/till/till-view.tsx):
//   Header, then: open-the-drawer form when closed; totals + cash in/out +
//   count-and-close when open; abandoned sessions for a supervisor.
//
// Mobile renders the same states from the same hooks. Two rules travel with
// the screen rather than with the platform:
//
//   · the variance is shown BEFORE the close is confirmed, and a non-zero one
//     must be explained — a cashier who learns the drawer is short after the
//     session is sealed can no longer count again;
//   · expected cash is the server's figure and has no input. A field a person
//     can type into is a field that can be made to agree with the drawer.
// ============================================

import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useAbandonedSessions,
  useCloseSession,
  useCurrentSession,
  useOpenSession,
  useRecordCashMovement,
  type AbandonedSession,
} from '@hisabche/api'
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { MinorMoney, Section, StatRow, StateBadge } from '../../capability/capability-kit'

/** Major units typed by a person into the integer minor units the API takes. */
function toMinor(text: string): number {
  const value = Number(text.replace(/[^\d.-]/g, ''))
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

export function TillScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [float, setFloat] = useState('')
  const [movement, setMovement] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [counted, setCounted] = useState('')
  const [varianceReason, setVarianceReason] = useState('')

  const current = useCurrentSession()
  const abandoned = useAbandonedSessions()
  const openSession = useOpenSession()
  const cashMovement = useRecordCashMovement()
  const closeSession = useCloseSession()

  const abandonedList: AbandonedSession[] = abandoned.data ?? []
  const session = current.data?.session ?? null
  const totals = current.data?.totals ?? null
  const busy = openSession.isPending || cashMovement.isPending || closeSession.isPending

  const countedMinor = toMinor(counted)
  const variance = totals ? countedMinor - totals.expectedCashMinor : null

  return (
    <AppScreen>
      <NavScreenHeader id="till" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {current.isLoading ? <Skeleton height={120} /> : null}

        {current.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(current.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => current.refetch()}
          />
        ) : null}

        {!current.isLoading && !session ? (
          <Section
            title={t('till.open_title', 'صندوق بسته است')}
            subtitle={t('till.open_hint', 'مبلغ نقد اولیه‌ی داخل صندوق را وارد کنید.')}
          >
            <Input
              label={t('till.opening_float', 'نقد اولیه')}
              value={float}
              onChangeText={setFloat}
              keyboardType="numeric"
            />
            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('till.open_action', 'باز کردن صندوق')}
                onPress={() => openSession.mutate({ openingFloatMinor: toMinor(float) })}
                loading={openSession.isPending}
                fullWidth
              />
            </View>
          </Section>
        ) : null}

        {session && totals ? (
          <>
            <Section
              title={t('till.session_title', 'صندوق باز')}
              trailing={
                <StateBadge
                  tone="success"
                  label={t(`till.status_${session.status}`, session.status)}
                />
              }
            >
              <StatRow label={t('till.orders', 'فروش‌ها')} value={String(totals.orderCount)} />
              <StatRow
                label={t('till.gross_sales', 'فروش ناخالص')}
                value={<MinorMoney minor={totals.grossSalesMinor} />}
              />
              <StatRow
                label={t('till.expected_cash', 'نقد مورد انتظار')}
                hint={t('till.expected_hint', 'محاسبه‌ی سرور — قابل ویرایش نیست')}
                value={<MinorMoney minor={totals.expectedCashMinor} />}
              />
              <StatRow
                label={t('till.opening_float', 'نقد اولیه')}
                value={<MinorMoney minor={session.openingFloatMinor} tone="muted" />}
              />
            </Section>

            <Section
              title={t('till.movement_title', 'ورود و خروج نقدی')}
              subtitle={t('till.movement_hint', 'برداشت از صندوق بدون دلیل، یعنی کسری بدون توضیح.')}
            >
              <Input
                label={t('till.amount', 'مبلغ')}
                value={movement}
                onChangeText={setMovement}
                keyboardType="numeric"
              />
              <View style={{ marginTop: spacing.sm }}>
                <Input
                  label={t('till.reason', 'دلیل')}
                  value={movementReason}
                  onChangeText={setMovementReason}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('till.cash_in', 'ورود نقدی')}
                    variant="secondary"
                    // The server requires a reason too; disabling here only
                    // saves a round trip to be told so.
                    disabled={busy || toMinor(movement) <= 0 || movementReason.trim() === ''}
                    onPress={() =>
                      cashMovement.mutate({
                        sessionId: session.id,
                        kind: 'cash_in',
                        amountMinor: toMinor(movement),
                        reason: movementReason.trim(),
                      })
                    }
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('till.cash_out', 'خروج نقدی')}
                    variant="secondary"
                    disabled={busy || toMinor(movement) <= 0 || movementReason.trim() === ''}
                    onPress={() =>
                      cashMovement.mutate({
                        sessionId: session.id,
                        kind: 'cash_out',
                        amountMinor: toMinor(movement),
                        reason: movementReason.trim(),
                      })
                    }
                    fullWidth
                  />
                </View>
              </View>
            </Section>

            <Section
              title={t('till.close_title', 'شمارش و بستن')}
              subtitle={t('till.close_hint', 'اختلاف پیش از تأیید نشان داده می‌شود.')}
            >
              <Input
                label={t('till.counted_cash', 'نقد شمرده‌شده')}
                value={counted}
                onChangeText={setCounted}
                keyboardType="numeric"
              />

              <StatRow
                label={t('till.variance', 'اختلاف')}
                value={
                  variance == null ? (
                    <Text variant="bodyStrong">—</Text>
                  ) : (
                    <MinorMoney minor={variance} signed />
                  )
                }
              />

              {variance != null && variance !== 0 ? (
                <Input
                  label={t('till.variance_reason', 'توضیح اختلاف')}
                  value={varianceReason}
                  onChangeText={setVarianceReason}
                />
              ) : null}

              <View style={{ marginTop: spacing.md }}>
                <Button
                  label={t('till.close_action', 'بستن صندوق')}
                  loading={closeSession.isPending}
                  disabled={
                    busy || (variance != null && variance !== 0 && varianceReason.trim() === '')
                  }
                  onPress={() =>
                    closeSession.mutate({
                      sessionId: session.id,
                      countedCashMinor: countedMinor,
                      ...(varianceReason.trim() ? { varianceReason: varianceReason.trim() } : {}),
                    })
                  }
                  fullWidth
                />
              </View>
            </Section>
          </>
        ) : null}

        {abandonedList.length > 0 ? (
          <Section
            title={t('till.abandoned_title', 'صندوق‌های رها شده')}
            subtitle={t('till.abandoned_hint', 'پولی که در صندوقی است که کسی به آن دسترسی ندارد.')}
          >
            {abandonedList.map((item) => (
              <StatRow
                key={item.sessionId}
                label={item.openedAt.slice(0, 10)}
                hint={`${Math.round(item.hoursOpen)}${t('till.hours_short', 'س')} · ${item.orderCount}`}
                value={<MinorMoney minor={item.expectedCashMinor} />}
              />
            ))}
          </Section>
        ) : null}

        {!current.isLoading && !session && abandonedList.length === 0 ? (
          <EmptyState
            title={t('till.open_title', 'صندوق بسته است')}
            description={t('till.open_hint', 'مبلغ نقد اولیه‌ی داخل صندوق را وارد کنید.')}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
