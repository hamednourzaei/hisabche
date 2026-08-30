// ============================================
// Offline conflicts on a phone.
//
// Web anatomy (packages/ui/components/ui/conflicts/conflicts-view.tsx):
//   status tabs → queue → both versions side by side → decide.
//
// This is the screen an offline-first product exists for, and the phone is
// where the offline writes came from. The same three rules travel with it:
//
//   · both versions are always shown, never just the difference;
//   · a financial divergence is marked and cannot be resolved silently;
//   · a reason is required on every decision, including "keep the server
//     version" — a financial correction with no reason is unauditable.
//
// A phone cannot show two columns, so the two versions stack: server first,
// device beneath it, with the field name above both. Nothing is summarised —
// `items` on an invoice IS the disagreement, and "3 items" on both sides
// would read as agreement when the lines differ.
// ============================================

import React, { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useConflict,
  useConflicts,
  useResolveConflict,
  type Conflict,
  type FieldDivergence,
  type ResolutionChoice,
} from '@hisabche/api'
import {
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  Skeleton,
  Text,
  useTheme,
  type FilterOption,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { Section, StatRow, StateBadge } from '../../capability/capability-kit'

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ConflictsScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open')
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [choice, setChoice] = useState<ResolutionChoice>('keep_server')
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'server' | 'client'>>({})
  const [reason, setReason] = useState('')

  const conflicts = useConflicts(status)
  const list: Conflict[] = conflicts.data ?? []

  const detail = useConflict(chosenId ?? '')
  const selected: Conflict | null = detail.data ?? list.find((row) => row.id === chosenId) ?? null

  const resolve = useResolveConflict()

  const divergences: FieldDivergence[] = selected?.divergences ?? []
  const undecided =
    choice === 'merge' ? divergences.filter((d) => !fieldChoices[d.field]).length : 0

  const STATUS_OPTIONS: FilterOption<'open' | 'resolved' | 'all'>[] = [
    { value: 'open', label: t('conflicts.status_open', 'باز') },
    { value: 'resolved', label: t('conflicts.status_resolved', 'حل‌شده') },
    { value: 'all', label: t('conflicts.status_all', 'همه') },
  ]

  return (
    <AppScreen>
      <NavScreenHeader id="conflicts" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <FilterBar
          options={STATUS_OPTIONS}
          value={status}
          onChange={(next) => {
            setStatus(next)
            // The selection belongs to the previous filter.
            setChosenId(null)
          }}
        />

        {conflicts.isLoading ? <Skeleton height={140} /> : null}

        {conflicts.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(conflicts.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => conflicts.refetch()}
          />
        ) : null}

        {!conflicts.isLoading && list.length === 0 ? (
          <EmptyState
            title={t('conflicts.empty_title', 'تعارضی در انتظار نیست')}
            description={t(
              'conflicts.empty_hint',
              'هر نوشته‌ی آفلاینی که سرور نپذیرد اینجا می‌آید و تا تصمیم شما اعمال نمی‌شود.',
            )}
          />
        ) : null}

        {list.length > 0 ? (
          <Section
            title={t('conflicts.queue', 'صف تعارض')}
            subtitle={t('conflicts.queue_hint', 'هیچ‌کدام هنوز اعمال نشده‌اند.')}
          >
            {list.map((conflict) => (
              <Pressable
                key={conflict.id}
                onPress={() => setChosenId(conflict.id === chosenId ? null : conflict.id)}
              >
                <StatRow
                  label={t(`conflicts.entity_${conflict.entityType}`, conflict.entityType)}
                  hint={`${conflict.divergences.length} ${t('conflicts.fields', 'فیلد')} · ${conflict.createdAt?.slice(0, 10)}`}
                  value={
                    <StateBadge
                      tone={
                        conflict.status === 'resolved'
                          ? 'success'
                          : conflict.hasFinancialDivergence
                            ? 'destructive'
                            : 'warning'
                      }
                      label={
                        conflict.status === 'resolved'
                          ? t('conflicts.resolved', 'حل‌شده')
                          : conflict.hasFinancialDivergence
                            ? t('conflicts.financial', 'اختلاف مالی')
                            : t('conflicts.open', 'باز')
                      }
                    />
                  }
                />
              </Pressable>
            ))}
          </Section>
        ) : null}

        {selected ? (
          <Section
            title={t('conflicts.divergences', 'اختلاف‌ها')}
            subtitle={t(
              'conflicts.detail_hint',
              'هر دو نسخه نگه داشته شده‌اند. هیچ‌کدام هنوز اعمال نشده.',
            )}
          >
            {divergences.map((divergence) => (
              <View
                key={divergence.field}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(128,128,128,0.2)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="bodyStrong">{divergence.field}</Text>
                  {divergence.financial ? (
                    <StateBadge
                      tone="destructive"
                      label={t('conflicts.financial', 'اختلاف مالی')}
                    />
                  ) : null}
                </View>

                <StatRow
                  label={t('conflicts.server_value', 'نسخه‌ی سرور')}
                  value={renderValue(divergence.serverValue)}
                />
                <StatRow
                  label={t('conflicts.client_value', 'نسخه‌ی دستگاه')}
                  value={renderValue(divergence.clientValue)}
                />

                {choice === 'merge' ? (
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    {(['server', 'client'] as const).map((side) => (
                      <View key={side} style={{ flex: 1 }}>
                        <Button
                          label={t(`conflicts.side_${side}`, side)}
                          variant={
                            fieldChoices[divergence.field] === side ? 'primary' : 'secondary'
                          }
                          onPress={() =>
                            setFieldChoices((current) => ({ ...current, [divergence.field]: side }))
                          }
                          fullWidth
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {selected && selected.status === 'open' ? (
          <Section
            title={t('conflicts.resolve', 'تصمیم')}
            subtitle={t(
              'conflicts.resolve_hint',
              'دلیل اجباری است — حتی برای نگه‌داشتن نسخه‌ی سرور.',
            )}
          >
            {(['keep_server', 'keep_client', 'merge'] as const).map((option) => (
              <View key={option} style={{ marginBottom: spacing.xs }}>
                <Button
                  label={t(`conflicts.choice_${option}`, option)}
                  variant={choice === option ? 'primary' : 'secondary'}
                  onPress={() => setChoice(option)}
                  fullWidth
                />
              </View>
            ))}

            {undecided > 0 ? (
              <Text variant="caption" tone="warning">
                {undecided} {t('conflicts.undecided', 'فیلد هنوز انتخاب نشده')}
              </Text>
            ) : null}

            <View style={{ marginTop: spacing.sm }}>
              <Input
                label={t('conflicts.reason', 'دلیل')}
                value={reason}
                onChangeText={setReason}
              />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('conflicts.apply', 'اعمال تصمیم')}
                loading={resolve.isPending}
                disabled={reason.trim() === '' || undecided > 0}
                onPress={() =>
                  resolve.mutate(
                    {
                      conflictId: selected.id,
                      choice,
                      reason: reason.trim(),
                      ...(choice === 'merge' ? { fieldChoices } : {}),
                    },
                    {
                      onSuccess: () => {
                        setReason('')
                        setFieldChoices({})
                        setChosenId(null)
                      },
                    },
                  )
                }
                fullWidth
              />
            </View>

            {resolve.error ? (
              <Text variant="caption" tone="danger">
                {((resolve.error as { response?: { data?: { error?: string } } })?.response?.data
                  ?.error ??
                  (resolve.error as Error).message) ||
                  ''}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {selected && selected.status !== 'open' ? (
          <Section title={t('conflicts.resolution', 'تصمیم ثبت‌شده')}>
            <StatRow
              label={t('conflicts.choice', 'انتخاب')}
              value={t(`conflicts.choice_${selected.resolution}`, selected.resolution ?? '—')}
            />
            <StatRow
              label={t('conflicts.reason', 'دلیل')}
              value={selected.resolutionReason ?? '—'}
            />
            <StatRow
              label={t('conflicts.resolved_at', 'زمان')}
              value={selected.resolvedAt?.slice(0, 16).replace('T', ' ') ?? '—'}
            />
          </Section>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
