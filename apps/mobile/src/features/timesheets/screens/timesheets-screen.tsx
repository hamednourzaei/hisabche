// ============================================
// Timesheets on a phone.
//
// Web anatomy (packages/ui/components/ui/timesheets/timesheets-view.tsx):
//   pick a project → totals → log time → billing preview → profitability.
//
// The same two rules travel with the screen. Durations cross the wire as whole
// MINUTES — 1.5 hours is 90, and a float here is a bill that drifts. And the
// preview BILLS NOTHING: its `problems` list names the reasons hours cannot be
// billed, which is the difference between "there is nothing to bill" and
// "there are forty hours nobody set a rate for".
// ============================================

import React, { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useBillingPreview,
  useLogTime,
  useProjectProfitability,
  useProjects,
  useTimesheetSummary,
  type BillableLine,
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
import { MinorMoney, Section, StatRow, formatMinutes } from '../../capability/capability-kit'

export function TimesheetsScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [projectId, setProjectId] = useState<string>('')
  const [employeeId, setEmployeeId] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [description, setDescription] = useState('')

  const projects = useProjects()
  const summary = useTimesheetSummary(projectId)
  const preview = useBillingPreview(projectId)
  const profitability = useProjectProfitability(projectId)
  const logTime = useLogTime()

  // `/projects` answers with either a bare array or a `{ projects }` envelope
  // depending on the caller. Both are handled: guessing wrong renders an empty
  // picker with no error to explain it.
  const options = useMemo<FilterOption<string>[]>(() => {
    const raw = projects.data as unknown
    const list = Array.isArray(raw)
      ? raw
      : ((raw as { projects?: unknown[] } | undefined)?.projects ?? [])

    return (list as Array<Record<string, unknown>>)
      .filter((row) => typeof row?.id === 'string')
      .map((row) => ({
        value: row.id as string,
        label: (row.name as string) ?? (row.title as string) ?? (row.id as string),
      }))
  }, [projects.data])

  const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0)

  return (
    <AppScreen>
      <NavScreenHeader id="timesheets" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {projects.isLoading ? <Skeleton height={80} /> : null}

        {projects.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(projects.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => projects.refetch()}
          />
        ) : null}

        {!projects.isLoading && options.length === 0 ? (
          <EmptyState
            title={t('timesheets.no_projects', 'پروژه‌ای وجود ندارد')}
            description={t(
              'timesheets.no_projects_hint',
              'زمان روی یک پروژه ثبت می‌شود. ابتدا پروژه بسازید.',
            )}
          />
        ) : null}

        {options.length > 0 ? (
          <FilterBar options={options} value={projectId} onChange={setProjectId} />
        ) : null}

        {projectId && summary.data ? (
          <Section title={t('timesheets.totals', 'جمع کارکرد')}>
            <StatRow
              label={t('timesheets.recorded', 'ثبت‌شده')}
              value={formatMinutes(summary.data.totals.recordedMinutes)}
            />
            <StatRow
              label={t('timesheets.billable', 'قابل صورتحساب')}
              value={formatMinutes(summary.data.totals.billableMinutes)}
            />
            <StatRow
              label={t('timesheets.billed', 'صورتحساب‌شده')}
              value={formatMinutes(summary.data.totals.billedMinutes)}
            />
            <StatRow
              label={t('timesheets.unbilled', 'در انتظار صورتحساب')}
              hint={formatMinutes(summary.data.totals.unbilledMinutes)}
              value={<MinorMoney minor={summary.data.totals.unbilledAmountMinor} />}
            />
          </Section>
        ) : null}

        {projectId ? (
          <Section
            title={t('timesheets.log_title', 'ثبت زمان')}
            subtitle={t('timesheets.log_hint', 'ساعت و دقیقه — به دقیقه‌ی صحیح ذخیره می‌شود.')}
          >
            <Input
              label={t('timesheets.employee', 'کارمند')}
              value={employeeId}
              onChangeText={setEmployeeId}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('timesheets.hours', 'ساعت')}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('timesheets.minutes', 'دقیقه')}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Input
                label={t('common.description', 'شرح')}
                value={description}
                onChangeText={setDescription}
              />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('timesheets.log_action', 'ثبت')}
                loading={logTime.isPending}
                disabled={totalMinutes <= 0 || employeeId.trim() === ''}
                onPress={() =>
                  logTime.mutate({
                    projectId,
                    employeeId: employeeId.trim(),
                    onDate: new Date().toISOString().slice(0, 10),
                    minutes: totalMinutes,
                    billable: true,
                    description: description.trim(),
                  })
                }
                fullWidth
              />
            </View>
          </Section>
        ) : null}

        {projectId && preview.data ? (
          <Section
            title={t('timesheets.preview', 'پیش‌نمایش صورتحساب')}
            subtitle={t(
              'timesheets.preview_hint',
              'چیزی صورتحساب نمی‌شود — فقط نشان می‌دهد چه می‌شد.',
            )}
          >
            {(preview.data.problems as string[]).map((problem) => (
              <Text key={problem} variant="caption" tone="warning">
                {t(`timesheets.problem_${problem}`, problem)}
              </Text>
            ))}

            {(preview.data.lines as BillableLine[]).map((line) => (
              <StatRow
                key={line.entryIds.join('-')}
                label={line.description}
                hint={formatMinutes(line.minutes)}
                value={<MinorMoney minor={line.amountMinor} />}
              />
            ))}
          </Section>
        ) : null}

        {projectId && profitability.data ? (
          <Section
            title={t('timesheets.profitability', 'سودآوری پروژه')}
            subtitle={t(
              'timesheets.profitability_hint',
              'کارکرد به بهای تمام‌شده ارزیابی می‌شود، نه به نرخ فروش.',
            )}
          >
            <StatRow
              label={t('timesheets.revenue', 'درآمد')}
              value={<MinorMoney minor={profitability.data.revenueMinor} />}
            />
            <StatRow
              label={t('timesheets.labour_cost', 'هزینه‌ی کارکرد')}
              value={<MinorMoney minor={profitability.data.labourCostMinor} tone="muted" />}
            />
            <StatRow
              label={t('timesheets.expenses', 'هزینه‌ها')}
              value={<MinorMoney minor={profitability.data.expenseMinor} tone="muted" />}
            />
            <StatRow
              label={t('timesheets.margin', 'حاشیه')}
              hint={
                profitability.data.marginPercent != null
                  ? `${Math.round(profitability.data.marginPercent)}%`
                  : undefined
              }
              value={<MinorMoney minor={profitability.data.marginMinor} signed />}
            />
            {profitability.data.unbillableMinutes > 0 ? (
              <StatRow
                label={t('timesheets.unbillable', 'کارکرد غیرقابل صورتحساب')}
                value={formatMinutes(profitability.data.unbillableMinutes)}
              />
            ) : null}
          </Section>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
