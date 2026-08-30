// ============================================
// Separation of duties on a phone.
//
// Web anatomy (packages/ui/components/ui/governance/governance-view.tsx):
//   mode → rules, each switchable with its reason → the override log.
//
// The override log is on the screen, not behind a report, for the same reason
// it is on web: in `warn` mode nothing is blocked, so the list IS the control.
// ============================================

import React from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useSaveSoD,
  useSoD,
  useSoDOverrides,
  type SoDMode,
  type SoDOverride,
  type SoDRule,
} from '@hisabche/api'
import { Button, ErrorState, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { Section, StatRow, StateBadge } from '../../capability/capability-kit'

const MODES: SoDMode[] = ['off', 'warn', 'strict']

export function GovernanceScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const sod = useSoD()
  const overrides = useSoDOverrides()
  const save = useSaveSoD()

  const settings = sod.data?.settings ?? null
  const rules: SoDRule[] = sod.data?.rules ?? []
  const overrideList: SoDOverride[] = overrides.data ?? []

  const mode = settings?.mode ?? 'off'
  const disabled = new Set(settings?.disabledRules ?? [])

  return (
    <AppScreen>
      <NavScreenHeader id="governance" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {sod.isLoading ? <Skeleton height={140} /> : null}

        {sod.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(sod.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => sod.refetch()}
          />
        ) : null}

        {settings ? (
          <>
            <Section
              title={t('governance.mode', 'حالت')}
              subtitle={t(
                'governance.mode_hint',
                'برای دکان یک‌نفره «خاموش» درست است — کنترلی که مالک را از صندوق خودش رد کند، او را به اشتراک‌گذاری رمز عادت می‌دهد.',
              )}
            >
              {MODES.map((option) => (
                <View key={option} style={{ marginBottom: spacing.xs }}>
                  <Button
                    label={t(`governance.mode_${option}`, option)}
                    variant={option === mode ? 'primary' : 'secondary'}
                    loading={save.isPending && option === mode}
                    onPress={() => save.mutate({ mode: option })}
                    fullWidth
                  />
                </View>
              ))}
            </Section>

            <Section
              title={t('governance.rules', 'قواعد')}
              subtitle={t('governance.rules_hint', 'هر قاعده جدا خاموش می‌شود، نه همه با هم.')}
            >
              {rules.map((rule) => {
                const enabled = !disabled.has(rule.id)
                const current: string[] = settings.disabledRules ?? []

                return (
                  <View key={rule.id} style={{ paddingVertical: spacing.sm }}>
                    <StatRow
                      label={rule.id}
                      value={
                        <StateBadge
                          tone={enabled ? 'success' : 'neutral'}
                          label={
                            enabled ? t('common.active', 'فعال') : t('common.inactive', 'غیرفعال')
                          }
                        />
                      }
                    />

                    {/* The reason, always. A rule nobody can justify is a rule
                        somebody switches off at the first inconvenience. */}
                    <Text variant="caption" tone="secondary">
                      {t(`governance.rule_${rule.id}`, rule.rationale)}
                    </Text>

                    <View style={{ marginTop: spacing.xs }}>
                      <Button
                        label={
                          enabled
                            ? t('governance.disable', 'خاموش')
                            : t('governance.enable', 'روشن')
                        }
                        variant="secondary"
                        disabled={save.isPending || mode === 'off'}
                        onPress={() =>
                          save.mutate({
                            // The whole list, not a delta: the server stores the
                            // set, and a delta races with another device.
                            disabledRules: enabled
                              ? [...current, rule.id]
                              : current.filter((id) => id !== rule.id),
                          })
                        }
                        fullWidth
                      />
                    </View>
                  </View>
                )
              })}
            </Section>

            <Section
              title={t('governance.overrides', 'موارد نادیده‌گرفته‌شده')}
              subtitle={t(
                'governance.overrides_hint',
                'کاری که با وجود تعارض انجام شد. کسی باید این را بخواند.',
              )}
            >
              {overrideList.length === 0 ? (
                <Text variant="body" tone="secondary">
                  {t('governance.no_overrides', 'موردی ثبت نشده.')}
                </Text>
              ) : (
                overrideList.map((override) => (
                  <StatRow
                    key={override.id}
                    label={override.rule_id}
                    hint={override.reason}
                    value={override.created_at?.slice(0, 10) ?? '—'}
                  />
                ))
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
