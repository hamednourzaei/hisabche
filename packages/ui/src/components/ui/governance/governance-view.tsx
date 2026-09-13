'use client'

// ============================================
// packages/ui/src/components/ui/governance/governance-view.tsx
//
// Separation of duties.
//
// ---------------------------------------------------------------------------
// THE SCREEN SAYS WHAT THE MODE COSTS
//
// `off` is the default and the honest one for a one-person shop. The screen
// says so rather than nagging: a control that refuses the owner their own till
// teaches them to share a login, and a shared login destroys every other
// control at once.
//
// `warn` lets the work through and records it. That makes the override list
// the control — nothing was blocked, so the only thing between a conflict and
// nobody noticing is that somebody reads it. The list is therefore on this
// screen, not hidden behind a report.
//
// Each rule is switchable on its own, with its reason shown. A shop that has
// one person raise invoices and another take payments can keep that rule and
// drop the one that does not fit, instead of turning the whole thing off.
//
// ---------------------------------------------------------------------------
// LAYOUT — the invoices list structure: header, stat strip, the mode control,
// then the rules and the overrides, each on the shared DataTable.
// ============================================

import { memo, useMemo, useState } from 'react'
import { ListChecks, ShieldCheck, ShieldHalf, TriangleAlert } from 'lucide-react'
import type { SoDMode, SoDOverride, SoDRule, SoDSettings } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { SegmentedFilter } from '../segmented-filter'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  ListSection,
  Loading,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface GovernanceViewProps {
  t: (key: string, fallback?: string) => string
  settings: SoDSettings | null
  rules: SoDRule[]
  overrides: SoDOverride[]
  isLoading: boolean
  /** The override read is separate; its failure must not read as «none». */
  isOverridesLoading: boolean
  overridesError: string | null
  error: string | null
  actionError: string | null
  isBusy: boolean
  onModeChange: (mode: SoDMode) => void
  onToggleRule: (ruleId: string, enabled: boolean) => void
  onRefresh: () => void
}

const MODES: SoDMode[] = ['off', 'warn', 'strict']

const MODE_TONE: Record<SoDMode, string> = {
  off: 'neutral',
  warn: 'warn',
  strict: 'good',
}

type RuleFilter = 'all' | 'active' | 'inactive'

export const GovernanceView = memo(function GovernanceView({
  t,
  settings,
  rules,
  overrides,
  isLoading,
  isOverridesLoading,
  overridesError,
  error,
  actionError,
  isBusy,
  onModeChange,
  onToggleRule,
  onRefresh,
}: GovernanceViewProps) {
  const { dateTime } = useDateFormat()
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all')
  const [ruleSearch, setRuleSearch] = useState('')
  const [overrideSearch, setOverrideSearch] = useState('')

  const mode = settings?.mode ?? 'off'
  const disabled = useMemo(() => new Set(settings?.disabledRules ?? []), [settings])
  const activeCount = rules.filter((rule) => !disabled.has(rule.id)).length

  const ruleRows = useMemo(
    () =>
      rules
        .filter((rule) =>
          ruleFilter === 'all'
            ? true
            : ruleFilter === 'active'
              ? !disabled.has(rule.id)
              : disabled.has(rule.id),
        )
        .filter((rule) =>
          matchesSearch(ruleSearch, [
            rule.id,
            rule.capability,
            t(`governance.rule_${rule.id}`, rule.rationale),
            ...rule.conflictsWith,
          ]),
        ),
    [disabled, ruleFilter, ruleSearch, rules, t],
  )

  const overrideRows = useMemo(
    () =>
      overrides.filter((override) =>
        matchesSearch(overrideSearch, [
          override.rule_id,
          override.entity_type,
          override.reason,
          override.created_at ? dateTime(override.created_at) : null,
        ]),
      ),
    [dateTime, overrideSearch, overrides],
  )

  const ruleColumns = useMemo<TableColumn<SoDRule>[]>(
    () => [
      {
        id: 'id',
        labelKey: 'governance.rule',
        labelFallback: 'قاعده',
        locked: true,
        sortValue: (rule) => rule.id,
        render: (rule) => (
          <span className="font-mono text-xs" dir="ltr">
            {rule.id}
          </span>
        ),
      },
      {
        id: 'status',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        sortValue: (rule) => (disabled.has(rule.id) ? 0 : 1),
        render: (rule) =>
          disabled.has(rule.id) ? (
            <Badge tone="neutral">{t('common.inactive', 'غیرفعال')}</Badge>
          ) : (
            <Badge tone="good">{t('common.active', 'فعال')}</Badge>
          ),
      },
      {
        id: 'rationale',
        labelKey: 'governance.reason',
        labelFallback: 'دلیل',
        showFrom: 'md',
        // The reason, always — a rule a person cannot justify is a rule they
        // switch off at the first inconvenience.
        render: (rule) => (
          <span className="block min-w-[16rem] max-w-xl whitespace-normal text-[hsl(var(--fg-tertiary))]">
            {t(`governance.rule_${rule.id}`, rule.rationale)}
          </span>
        ),
      },
      {
        id: 'conflicts',
        labelKey: 'governance.conflicts',
        labelFallback: 'در تعارض با',
        showFrom: 'lg',
        render: (rule) => (
          <span className="text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
            {rule.capability} ⟂ {rule.conflictsWith.join(', ')}
          </span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'governance.toggle',
        labelFallback: 'روشن / خاموش',
        locked: true,
        align: 'end',
        render: (rule) => {
          const enabled = !disabled.has(rule.id)
          return (
            <ActionButton
              variant="quiet"
              disabled={isBusy || mode === 'off'}
              onClick={() => onToggleRule(rule.id, !enabled)}
            >
              {enabled ? t('governance.disable', 'خاموش') : t('governance.enable', 'روشن')}
            </ActionButton>
          )
        },
      },
    ],
    [disabled, isBusy, mode, onToggleRule, t],
  )

  const overrideColumns = useMemo<TableColumn<SoDOverride>[]>(
    () => [
      {
        id: 'createdAt',
        labelKey: 'common.date',
        labelFallback: 'تاریخ',
        sortValue: (override) => override.created_at,
        render: (override) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {override.created_at ? dateTime(override.created_at) : '—'}
          </span>
        ),
      },
      {
        id: 'rule',
        labelKey: 'governance.rule',
        labelFallback: 'قاعده',
        locked: true,
        sortValue: (override) => override.rule_id,
        render: (override) => (
          <span className="font-mono text-xs" dir="ltr">
            {override.rule_id}
          </span>
        ),
      },
      {
        id: 'record',
        labelKey: 'governance.record',
        labelFallback: 'رکورد',
        showFrom: 'md',
        render: (override) => (
          <span className="text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
            {override.entity_type} {override.entity_id?.slice(0, 8)}
          </span>
        ),
      },
      {
        id: 'reason',
        labelKey: 'governance.reason',
        labelFallback: 'دلیل',
        render: (override) => (
          <span className="block min-w-[12rem] whitespace-normal">{override.reason}</span>
        ),
      },
    ],
    [dateTime],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('governance.title', 'تفکیک وظایف')}
        description={t('governance.subtitle', 'چه کسی نباید هر دو نیمه‌ی یک کار را انجام دهد')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {actionError ? <ErrorNote message={actionError} /> : null}

      {isLoading ? (
        <Loading label={t('common.loading', 'در حال بارگذاری…')} />
      ) : error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}

      {settings ? (
        <>
          <StatGrid>
            <Stat
              icon={ShieldHalf}
              label={t('governance.mode', 'حالت')}
              value={<Badge tone={MODE_TONE[mode]}>{t(`governance.mode_${mode}`, mode)}</Badge>}
            />
            <Stat
              icon={ShieldCheck}
              label={t('governance.active_rules', 'قواعد فعال')}
              value={activeCount}
            />
            <Stat
              icon={ListChecks}
              label={t('governance.all_rules', 'کل قواعد')}
              value={rules.length}
            />
            {/* Counted only from a read that succeeded — «0 overrides» from a
                failed request is exactly the false comfort `warn` cannot afford. */}
            {!isOverridesLoading && !overridesError ? (
              <Stat
                icon={TriangleAlert}
                label={t('governance.overrides', 'موارد نادیده‌گرفته‌شده')}
                value={overrides.length}
                hint={
                  mode === 'warn'
                    ? t('governance.warn_hint', 'در حالت هشدار، همین فهرست خودِ کنترل است.')
                    : undefined
                }
              />
            ) : null}
          </StatGrid>

          <Panel
            title={t('governance.mode', 'حالت')}
            description={t(
              'governance.mode_hint',
              'برای دکان یک‌نفره «خاموش» درست است — کنترلی که مالک را از صندوق خودش رد کند، او را به اشتراک‌گذاری رمز عادت می‌دهد.',
            )}
          >
            <div className="flex flex-wrap gap-2">
              {MODES.map((option) => (
                <ActionButton
                  key={option}
                  variant={option === mode ? 'primary' : 'quiet'}
                  disabled={isBusy}
                  onClick={() => onModeChange(option)}
                >
                  {t(`governance.mode_${option}`, option)}
                </ActionButton>
              ))}
            </div>

            <p className="mt-3 text-sm text-[hsl(var(--fg-tertiary))]">
              {t(`governance.mode_${mode}_explains`, '')}
            </p>
          </Panel>

          <ListSection
            title={t('governance.rules', 'قواعد')}
            description={t('governance.rules_hint', 'هر قاعده جدا خاموش می‌شود، نه همه با هم.')}
            action={
              <SegmentedFilter
                label={t('common.status', 'وضعیت')}
                value={ruleFilter}
                onChange={setRuleFilter}
                options={[
                  { value: 'all', label: t('common.all', 'همه') },
                  { value: 'active', label: t('common.active', 'فعال') },
                  { value: 'inactive', label: t('common.inactive', 'غیرفعال') },
                ]}
              />
            }
          >
            <DataTable
              tableId="governance-rules"
              t={t}
              rows={ruleRows}
              columns={ruleColumns}
              rowKey={(rule) => rule.id}
              searchValue={ruleSearch}
              onSearchChange={setRuleSearch}
              minWidthClass="min-w-[420px] sm:min-w-[720px]"
              emptyState={
                <EmptyState icon="search" title={t('governance.no_rules', 'قاعده‌ای نیست')} />
              }
            />
          </ListSection>

          <ListSection
            title={t('governance.overrides', 'موارد نادیده‌گرفته‌شده')}
            description={t(
              'governance.overrides_hint',
              'کاری که با وجود تعارض انجام شد. کسی باید این را بخواند.',
            )}
          >
            {isOverridesLoading ? (
              <Loading label={t('common.loading', 'در حال بارگذاری…')} />
            ) : overridesError ? (
              <ErrorNote
                message={overridesError}
                onRetry={onRefresh}
                retryLabel={t('common.retry', 'تلاش دوباره')}
              />
            ) : (
              <DataTable
                tableId="governance-overrides"
                t={t}
                rows={overrideRows}
                columns={overrideColumns}
                rowKey={(override) => override.id}
                searchValue={overrideSearch}
                onSearchChange={setOverrideSearch}
                minWidthClass="min-w-[420px] sm:min-w-[640px]"
                emptyState={
                  <EmptyState
                    icon="search"
                    title={t('governance.no_overrides', 'موردی ثبت نشده.')}
                  />
                }
              />
            )}
          </ListSection>
        </>
      ) : null}
    </CapabilityPage>
  )
})

GovernanceView.displayName = 'GovernanceView'
