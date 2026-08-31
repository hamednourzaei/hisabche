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
// ============================================

import { memo } from 'react'
import type { SoDMode, SoDOverride, SoDRule, SoDSettings } from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Loading,
  Panel,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'

export interface GovernanceViewProps {
  t: (key: string, fallback?: string) => string
  settings: SoDSettings | null
  rules: SoDRule[]
  overrides: SoDOverride[]
  isLoading: boolean
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

export const GovernanceView = memo(function GovernanceView({
  t,
  settings,
  rules,
  overrides,
  isLoading,
  error,
  actionError,
  isBusy,
  onModeChange,
  onToggleRule,
  onRefresh,
}: GovernanceViewProps) {
  const mode = settings?.mode ?? 'off'
  const disabled = new Set(settings?.disabledRules ?? [])
  const activeCount = rules.filter((rule) => !disabled.has(rule.id)).length

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

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {settings ? (
        <>
          <Panel
            title={t('governance.mode', 'حالت')}
            description={t(
              'governance.mode_hint',
              'برای دکان یک‌نفره «خاموش» درست است — کنترلی که مالک را از صندوق خودش رد کند، او را به اشتراک‌گذاری رمز عادت می‌دهد.',
            )}
            action={<Badge tone={MODE_TONE[mode]}>{t(`governance.mode_${mode}`, mode)}</Badge>}
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

            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              {t(`governance.mode_${mode}_explains`, '')}
            </p>

            <StatGrid>
              <Stat label={t('governance.active_rules', 'قواعد فعال')} value={activeCount} />
              <Stat label={t('governance.all_rules', 'کل قواعد')} value={rules.length} />
              <Stat
                label={t('governance.overrides', 'موارد نادیده‌گرفته‌شده')}
                value={overrides.length}
                hint={
                  mode === 'warn'
                    ? t('governance.warn_hint', 'در حالت هشدار، همین فهرست خودِ کنترل است.')
                    : undefined
                }
              />
            </StatGrid>
          </Panel>

          <Panel
            title={t('governance.rules', 'قواعد')}
            description={t('governance.rules_hint', 'هر قاعده جدا خاموش می‌شود، نه همه با هم.')}
          >
            <ul className="divide-y divide-[hsl(var(--border))]">
              {rules.map((rule) => {
                const enabled = !disabled.has(rule.id)

                return (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs" dir="ltr">
                          {rule.id}
                        </span>
                        {enabled ? (
                          <Badge tone="good">{t('common.active', 'فعال')}</Badge>
                        ) : (
                          <Badge tone="neutral">{t('common.inactive', 'غیرفعال')}</Badge>
                        )}
                      </div>

                      {/* The reason, always — a rule a person cannot justify is
                          a rule they switch off at the first inconvenience. */}
                      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                        {t(`governance.rule_${rule.id}`, rule.rationale)}
                      </p>

                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">
                        {rule.capability} ⟂ {rule.conflictsWith.join(', ')}
                      </p>
                    </div>

                    <ActionButton
                      variant="quiet"
                      disabled={isBusy || mode === 'off'}
                      onClick={() => onToggleRule(rule.id, !enabled)}
                    >
                      {enabled ? t('governance.disable', 'خاموش') : t('governance.enable', 'روشن')}
                    </ActionButton>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel
            title={t('governance.overrides', 'موارد نادیده‌گرفته‌شده')}
            description={t(
              'governance.overrides_hint',
              'کاری که با وجود تعارض انجام شد. کسی باید این را بخواند.',
            )}
          >
            {overrides.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {t('governance.no_overrides', 'موردی ثبت نشده.')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date', 'تاریخ')}</TableHead>
                    <TableHead>{t('governance.rule', 'قاعده')}</TableHead>
                    <TableHead>{t('governance.record', 'رکورد')}</TableHead>
                    <TableHead>{t('governance.reason', 'دلیل')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((override) => (
                    <TableRow key={override.id}>
                      <TableCell className="py-2 tabular-nums" dir="ltr">
                        {override.created_at?.slice(0, 16).replace('T', ' ')}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-xs" dir="ltr">
                        {override.rule_id}
                      </TableCell>
                      <TableCell
                        className="py-2 text-xs text-[hsl(var(--muted-foreground))]"
                        dir="ltr"
                      >
                        {override.entity_type} {override.entity_id?.slice(0, 8)}
                      </TableCell>
                      <TableCell>{override.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </>
      ) : null}
    </CapabilityPage>
  )
})

GovernanceView.displayName = 'GovernanceView'
