// packages/ui/src/components/ui/onboarding/onboarding-page.tsx
'use client'

import { cn } from '../../../lib/utils'
import {
  Store,
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Store as StoreIcon,
  Building2 as BuildingIcon,
  ShoppingBag,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import {
  BUSINESS_MODELS,
  BUSINESS_TYPES,
  BUSINESS_TYPE_OTHER,
  filterBusinessTypes,
} from '@hisabche/ui-contract'
import { primaryIndustryKeyOf } from '@hisabche/validation'
import { industrySupportNoteKey } from '../../../lib/industry-support-note'
import { CurrencyPicker } from './currency-picker'
import { SearchableOptionList } from './searchable-option-list'
import { OperatingQuestions } from './operating-questions'
import { CompositionPlanSummary } from './composition-plan-summary'
import type { OperatingAnswers, OperatingQuestion } from '@hisabche/validation'

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingPage — forensic remediation R2/R5 (22 Nov 2026)
   • the displayed primary is the ONE canonical decision (ADR-001)
   • selection cap shared with both server writes
   • «other» requires a description before Next
   • review answers sales-model and trades separately; no raw ids/codes
   • RTL-correct arrows, progressbar semantics, single-flight finish button
   ═══════════════════════════════════════════════════════════════════════════ */

export interface OnboardingPageProps {
  step: number
  businessType: string | null
  primaryTradeKey?: string | null | undefined
  storeSize: string | null
  /** Free text; mandatory when «other» is selected, optional otherwise. */
  businessNote: string
  defaultCurrency: string
  /** Interface language, for the currency cards. */
  lang: string
  t: (key: string, fallback?: string) => string
  salesModelLabel: string
  tradesLabel: string
  storeSizeLabel: string
  currencyLabel: string
  onSetStep: (step: number) => void
  onSetBusinessType: (type: string) => void
  onSetPrimaryTradeKey?: ((key: string | null) => void) | undefined
  onSetStoreSize: (size: string) => void
  onSetCurrency: (currency: string) => void
  onSetBusinessNote: (note: string) => void
  /** V54 5.3: «how do you work» — the person's answers over the trade's suggestions. */
  operatingAnswers: OperatingAnswers
  onSetOperatingAnswer: (question: OperatingQuestion, answer: string) => void
  onComplete: () => void
  /** True while the completion chain runs — the finish button is single-flight. */
  submitting: boolean
  /** Visible autosave failure/degraded notice (never silent). */
  autosaveNotice: string | null
  /** Recovery information after a partial completion or an ACTIVE draft. */
  completionNotice: string | null
  /** «other» is selected — the note gates Next. */
  noteRequired: boolean
  /** The ONE selection limit, shared with both server writes. */
  selectionLimit: number
}

const selectedClasses =
  'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_0_2px_hsl(var(--color-primary)/0.3)]'
const unselectedClasses =
  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] hover:border-[hsl(var(--color-primary)/0.4)]'

/** Directional icons follow the reading direction (fa/af are RTL). */
const directionalIconClass = 'rtl:-scale-x-100'

// ─── Row ────────────────────────────────────────────────────────────────────

const Row = memo(function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
      <span className="font-medium text-[hsl(var(--fg-primary))]">{value}</span>
    </div>
  )
})
Row.displayName = 'Row'

// ─── Step 0: Welcome ──────────────────────────────────────────────────────

const WelcomeStep = memo(function WelcomeStep({
  onStart,
  t,
}: {
  onStart: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="mx-auto my-auto max-w-xl text-center">
      <div className="mb-4 flex justify-center sm:mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[image:var(--gradient-brand)] shadow-lg shadow-[hsl(var(--color-primary)/0.2)] sm:h-20 sm:w-20">
          <span className="text-2xl font-bold text-white sm:text-3xl">
            {t('onboarding.brandInitial')}
          </span>
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-[hsl(var(--fg-primary))] sm:mb-4 sm:text-3xl">
        {t('onboarding.welcome')}
      </h2>
      <p className="mb-6 text-base text-[hsl(var(--fg-secondary))] sm:mb-8 sm:text-lg">
        {t('onboarding.welcomeDesc')}
      </p>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-6 py-3 sm:px-8 sm:py-3.5',
          'text-base font-bold text-white',
          'bg-[image:var(--gradient-brand)]',
          'shadow-md shadow-[hsl(var(--color-primary)/0.15)]',
          'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
          'motion-reduce:transition-none',
        )}
      >
        <ArrowRight className={cn('size-5', directionalIconClass)} aria-hidden="true" />
        {t('onboarding.start')}
      </button>
    </div>
  )
})
WelcomeStep.displayName = 'WelcomeStep'

// ─── Step 1: Business Type ────────────────────────────────────────────────

const BusinessTypeStep = memo(function BusinessTypeStep({
  businessType,
  primaryTradeKey,
  onSetBusinessType,
  onSetPrimaryTradeKey,
  onBack,
  onNext,
  selectionLimit,
  t,
}: {
  businessType: string | null
  primaryTradeKey?: string | null | undefined
  onSetBusinessType: (type: string) => void
  onSetPrimaryTradeKey?: ((key: string | null) => void) | undefined
  onBack: () => void
  onNext: () => void
  selectionLimit: number
  t: (key: string, fallback?: string) => string
}) {
  // Selection is a set: someone may genuinely run more than one business.
  const selectedIds = useMemo(
    () => new Set(businessType ? businessType.split(',').filter(Boolean) : []),
    [businessType],
  )
  const [limitHit, setLimitHit] = useState(false)

  const trades = useMemo(
    () =>
      filterBusinessTypes('', t).map((option) => ({
        id: option.id,
        label: t(option.labelKey, option.labelFa),
      })),
    [t],
  )

  // ONE catalogue for chip labels — models included, so a selected
  // «retail»/«wholesale» never renders as a raw id (F-113).
  const labelOf = useCallback(
    (id: string): string => {
      const option = [...BUSINESS_MODELS, ...BUSINESS_TYPES, BUSINESS_TYPE_OTHER].find(
        (entry) => entry.id === id,
      )
      return option ? t(option.labelKey, option.labelFa) : t('onboarding.unknownActivity')
    },
    [t],
  )

  const handleToggle = useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        // The SAME cap both server writes enforce (F-017).
        if (next.size >= selectionLimit) {
          setLimitHit(true)
          return
        }
        next.add(id)
      }
      setLimitHit(false)
      onSetBusinessType([...next].join(','))
    },
    [selectedIds, onSetBusinessType, selectionLimit],
  )

  // The displayed primary is the canonical decision — registry order, explicit
  // primary wins — never the insertion order of the selection set (F-005).
  const displayPrimary = primaryIndustryKeyOf(businessType, primaryTradeKey)

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <h2 className="mb-4 shrink-0 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-6 sm:text-2xl">
        {t('onboarding.businessType')}
      </h2>
      <div
        data-onboarding-body=""
        className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1"
      >
        {/* Sales model: two cards, side by side at every width. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {BUSINESS_MODELS.map((item) => {
            const Icon = item.id === 'wholesale' ? Building2 : Store
            return (
              <button
                key={item.id}
                type="button"
                role="checkbox"
                aria-checked={selectedIds.has(item.id)}
                data-option-key={item.id}
                onClick={() => handleToggle(item.id)}
                className={cn(
                  'rounded-2xl border-2 p-4 transition-all duration-200 sm:p-6',
                  'motion-reduce:transition-none',
                  selectedIds.has(item.id) ? selectedClasses : unselectedClasses,
                )}
              >
                <Icon
                  className="mb-2 size-7 text-[hsl(var(--color-primary))] sm:mb-4 sm:size-10"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] sm:text-base">
                  {t(item.labelKey, item.labelFa)}
                </h3>
              </button>
            )
          })}
        </div>

        {/* The actual trade, searchable. */}
        <div className="mt-4">
          <SearchableOptionList
            options={trades}
            selected={selectedIds}
            onToggle={handleToggle}
            placeholder={t('onboarding.searchBusiness')}
            emptyLabel={t('onboarding.noBusinessMatch')}
            fallbackOption={{
              id: BUSINESS_TYPE_OTHER.id,
              label: t(BUSINESS_TYPE_OTHER.labelKey, BUSINESS_TYPE_OTHER.labelFa),
            }}
          />
        </div>

        {limitHit && (
          <p role="alert" className="mt-3 text-sm text-[hsl(var(--color-destructive))]">
            {t('onboarding.selectionLimit')}
          </p>
        )}

        {selectedIds.size > 1 && (
          <div className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] p-4 bg-[hsl(var(--surface-elevated))]">
            <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('onboarding.primaryIndustry')}
            </h4>
            <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
              {t('onboarding.primaryIndustryDesc')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...selectedIds].map((id) => {
                const isPrimary = displayPrimary === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isPrimary}
                    onClick={() => onSetPrimaryTradeKey?.(id)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      isPrimary
                        ? 'bg-[hsl(var(--color-primary))] text-white'
                        : 'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] hover:border-[hsl(var(--color-primary)/0.4)]',
                    )}
                  >
                    {labelOf(id)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex shrink-0 justify-between border-t border-[hsl(var(--border-default))] pt-4 sm:mt-6">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
            'text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
          )}
        >
          <ArrowLeft className={cn('size-4', directionalIconClass)} aria-hidden="true" />
          {t('action.back')}
        </button>
        <button
          type="button"
          disabled={!businessType}
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[image:var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next')}
        </button>
      </div>
    </div>
  )
})
BusinessTypeStep.displayName = 'BusinessTypeStep'

// ─── Step 2: Store Size ───────────────────────────────────────────────────

const StoreSizeStep = memo(function StoreSizeStep({
  storeSize,
  onSetStoreSize,
  businessNote,
  onSetBusinessNote,
  noteRequired,
  onBack,
  onNext,
  t,
}: {
  storeSize: string | null
  onSetStoreSize: (size: string) => void
  businessNote: string
  onSetBusinessNote: (note: string) => void
  noteRequired: boolean
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  // The label already carries the headcount — the old second line repeated
  // the same key and printed every label twice (F-066).
  const storeSizes = [
    { id: 'solo', icon: StoreIcon, labelKey: 'onboarding.scaleSolo' },
    { id: 'small', icon: StoreIcon, labelKey: 'onboarding.scaleSmall' },
    { id: 'medium', icon: BuildingIcon, labelKey: 'onboarding.scaleMedium' },
    { id: 'large', icon: ShoppingBag, labelKey: 'onboarding.scaleLarge' },
  ]

  const noteMissing = noteRequired && !businessNote.trim()

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <h2 className="mb-4 shrink-0 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-6 sm:text-2xl">
        {t('onboarding.storeSize')}
      </h2>
      <div
        data-onboarding-body=""
        className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {storeSizes.map((item) => (
            <button
              key={item.id}
              type="button"
              data-option-key={item.id}
              onClick={() => onSetStoreSize(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 transition-all duration-200 text-start sm:gap-4 sm:p-5',
                'motion-reduce:transition-none',
                storeSize === item.id ? selectedClasses : unselectedClasses,
              )}
            >
              <item.icon
                className="size-8 shrink-0 text-[hsl(var(--color-primary))] sm:size-10"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))] sm:text-base">
                  {t(item.labelKey)}
                </h3>
              </div>
              {storeSize === item.id && (
                <Check
                  className="ms-auto size-5 shrink-0 text-[hsl(var(--color-primary))]"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}

          {/* Fourth cell: free text. Optional — UNLESS «other» was selected,
            when a description is the only thing that tells us the business
            (F-011). The note is persisted, so a refresh keeps it (F-031). */}
          <div
            className={cn(
              'flex flex-col rounded-2xl border-2 p-3.5 sm:p-5',
              'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
            )}
          >
            <label
              htmlFor="onboarding-business-note"
              className="mb-1.5 text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('onboarding.aboutBusiness')}
              {noteRequired ? ' *' : ''}
            </label>
            <textarea
              id="onboarding-business-note"
              value={businessNote}
              onChange={(event) => onSetBusinessNote(event.target.value)}
              rows={3}
              maxLength={2000}
              required={noteRequired}
              aria-required={noteRequired}
              placeholder={t('onboarding.aboutBusinessPlaceholder')}
              className={cn(
                'w-full flex-1 resize-none rounded-xl border p-2.5 text-sm outline-none',
                'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
                'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
                'focus:border-[hsl(var(--color-primary))]',
              )}
            />
            {noteMissing && (
              <p className="mt-1.5 text-xs text-[hsl(var(--color-destructive))]">
                {t('onboarding.otherDescriptionRequired')}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex shrink-0 justify-between border-t border-[hsl(var(--border-default))] pt-4 sm:mt-6">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
            'text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
          )}
        >
          <ArrowLeft className={cn('size-4', directionalIconClass)} aria-hidden="true" />
          {t('action.back')}
        </button>
        <button
          type="button"
          disabled={!storeSize || noteMissing}
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[image:var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next')}
        </button>
      </div>
    </div>
  )
})
StoreSizeStep.displayName = 'StoreSizeStep'

// ─── Step 3: Currency ─────────────────────────────────────────────────────

const CurrencyStep = memo(function CurrencyStep({
  defaultCurrency,
  lang,
  onSetCurrency,
  onBack,
  onNext,
  t,
}: {
  defaultCurrency: string
  lang: string
  onSetCurrency: (currency: string) => void
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <h2 className="mb-4 shrink-0 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-6 sm:text-2xl">
        {t('onboarding.defaultCurrency')}
      </h2>
      <div
        data-onboarding-body=""
        className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1"
      >
        {/* The picker is shared with the offline first run — one control,
          one list of codes, one place where a code can be refused. */}
        <CurrencyPicker
          value={defaultCurrency || null}
          onChange={onSetCurrency}
          lang={lang}
          t={t}
        />
      </div>
      <div className="mt-4 flex shrink-0 justify-between border-t border-[hsl(var(--border-default))] pt-4 sm:mt-6">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
            'text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
          )}
        >
          <ArrowLeft className={cn('size-4', directionalIconClass)} aria-hidden="true" />
          {t('action.back')}
        </button>
        <button
          type="button"
          disabled={!defaultCurrency}
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[image:var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next')}
        </button>
      </div>
    </div>
  )
})
CurrencyStep.displayName = 'CurrencyStep'

// ─── Step 4: How the business works (adaptive) ────────────────────────────

const OperatingStep = memo(function OperatingStep({
  businessType,
  answers,
  onAnswer,
  onBack,
  onNext,
  t,
}: {
  businessType: string | null
  answers: OperatingAnswers
  onAnswer: (question: OperatingQuestion, answer: string) => void
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <h2 className="mb-2 shrink-0 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
        {t('onboarding.operating.title')}
      </h2>
      <p className="mb-4 shrink-0 text-center text-sm text-[hsl(var(--fg-secondary))] sm:mb-6">
        {t('onboarding.operating.description')}
      </p>
      <div
        data-onboarding-body=""
        className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1"
      >
        <OperatingQuestions answers={answers} onAnswer={onAnswer} t={t} />
        <CompositionPlanSummary answers={answers} businessType={businessType} t={t} />
      </div>
      <div className="mt-4 flex shrink-0 justify-between border-t border-[hsl(var(--border-default))] pt-4 sm:mt-6">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
            'text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
          )}
        >
          <ArrowLeft className={cn('size-4', directionalIconClass)} aria-hidden="true" />
          {t('action.back')}
        </button>
        <button
          type="button"
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[image:var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next')}
        </button>
      </div>
    </div>
  )
})
OperatingStep.displayName = 'OperatingStep'

// ─── Step 5: Complete ─────────────────────────────────────────────────────

const CompleteStep = memo(function CompleteStep({
  businessType,
  salesModelLabel,
  tradesLabel,
  storeSizeLabel,
  currencyLabel,
  onComplete,
  submitting,
  t,
}: {
  businessType: string
  salesModelLabel: string
  tradesLabel: string
  storeSizeLabel: string
  currencyLabel: string
  onComplete: () => void
  submitting: boolean
  t: (key: string, fallback?: string) => string
}) {
  const noteKey = industrySupportNoteKey(businessType)
  return (
    <div className="mx-auto my-auto max-w-xl text-center">
      <div className="mb-4 flex justify-center sm:mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)] sm:h-20 sm:w-20">
          <Check
            className="size-8 text-[hsl(var(--color-success))] sm:size-10"
            aria-hidden="true"
          />
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-[hsl(var(--fg-primary))] sm:mb-4 sm:text-3xl">
        {t('onboarding.ready')}
      </h2>
      <p className="mb-5 text-sm text-[hsl(var(--fg-secondary))] sm:mb-8 sm:text-base">
        {t('onboarding.readyDesc')}
      </p>
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] mb-5 sm:mb-8">
        <div className="p-4 space-y-3 text-start sm:p-6 sm:space-y-4">
          {/* Sales model and trades answer different questions — separate rows
            (F-003/F-009). Currency is named, not coded (F-064). */}
          {salesModelLabel ? (
            <Row label={t('onboarding.salesModel')} value={salesModelLabel} />
          ) : null}
          <Row label={t('onboarding.trades')} value={tradesLabel} />
          <Row label={t('onboarding.size')} value={storeSizeLabel} />
          <Row label={t('onboarding.currency')} value={currencyLabel} />
        </div>
      </div>
      {noteKey ? (
        <p
          role="note"
          className="mb-5 rounded-xl bg-[hsl(var(--surface-muted))] px-4 py-3 text-start text-xs text-[hsl(var(--fg-secondary))] sm:mb-8 sm:text-sm"
        >
          {t(noteKey)}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onComplete}
        disabled={submitting}
        aria-busy={submitting}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 sm:px-8 sm:py-3.5',
          'text-base font-bold text-white',
          'bg-[image:var(--gradient-brand)]',
          'shadow-md shadow-[hsl(var(--color-primary)/0.15)]',
          'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
          'disabled:opacity-60 disabled:cursor-wait',
          'motion-reduce:transition-none',
        )}
      >
        <ArrowRight className={cn('size-5', directionalIconClass)} aria-hidden="true" />
        {submitting ? t('onboarding.saving') : t('onboarding.enter')}
      </button>
    </div>
  )
})
CompleteStep.displayName = 'CompleteStep'

// ─── Main Component ─────────────────────────────────────────────────────────

export const OnboardingPage = memo(function OnboardingPage({
  step,
  businessType,
  primaryTradeKey,
  storeSize,
  businessNote,
  defaultCurrency,
  lang,
  t,
  salesModelLabel,
  tradesLabel,
  storeSizeLabel,
  currencyLabel,
  onSetStep,
  onSetBusinessType,
  onSetPrimaryTradeKey,
  onSetStoreSize,
  onSetCurrency,
  onSetBusinessNote,
  operatingAnswers,
  onSetOperatingAnswer,
  onComplete,
  submitting,
  autosaveNotice,
  completionNotice,
  noteRequired,
  selectionLimit,
}: OnboardingPageProps) {
  const handleStart = useCallback(() => onSetStep(1), [onSetStep])
  const handleBack1 = useCallback(() => onSetStep(0), [onSetStep])
  const handleNext1 = useCallback(() => onSetStep(2), [onSetStep])
  const handleBack2 = useCallback(() => onSetStep(1), [onSetStep])
  const handleNext2 = useCallback(() => onSetStep(3), [onSetStep])
  const handleBack3 = useCallback(() => onSetStep(2), [onSetStep])
  const handleNext3 = useCallback(() => onSetStep(4), [onSetStep])
  const handleBack4 = useCallback(() => onSetStep(3), [onSetStep])
  const handleNext4 = useCallback(() => onSetStep(5), [onSetStep])

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-[hsl(var(--surface-base))]"
      data-onboarding-screen=""
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-4 sm:py-6">
        <div
          className="mb-4 flex shrink-0 items-center justify-center gap-1.5 sm:mb-6 sm:gap-2"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={Math.min(Math.max(step, 1), 5)}
          aria-label={t('onboarding.progressLabel')}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 w-12 rounded-full transition-all duration-300 sm:h-2 sm:w-20',
                s <= step ? 'bg-[hsl(var(--color-primary))]' : 'bg-[hsl(var(--surface-muted))]',
              )}
            />
          ))}
        </div>

        {/* Failures are said, never swallowed (F-037/F-055). */}
        {autosaveNotice && (
          <p
            role="status"
            className="mb-3 shrink-0 rounded-xl bg-[hsl(var(--color-warning)/0.1)] px-4 py-2.5 text-start text-xs text-[hsl(var(--fg-secondary))] sm:text-sm"
          >
            {autosaveNotice}
          </p>
        )}
        {completionNotice && (
          <p
            role="alert"
            className="mb-3 shrink-0 rounded-xl bg-[hsl(var(--color-destructive)/0.1)] px-4 py-2.5 text-start text-xs text-[hsl(var(--fg-primary))] sm:text-sm"
          >
            {completionNotice}
          </p>
        )}

        {step === 0 && <WelcomeStep onStart={handleStart} t={t} />}
        {step === 1 && (
          <BusinessTypeStep
            businessType={businessType}
            primaryTradeKey={primaryTradeKey}
            onSetBusinessType={onSetBusinessType}
            onSetPrimaryTradeKey={onSetPrimaryTradeKey}
            onBack={handleBack1}
            onNext={handleNext1}
            selectionLimit={selectionLimit}
            t={t}
          />
        )}
        {step === 2 && (
          <StoreSizeStep
            storeSize={storeSize}
            onSetStoreSize={onSetStoreSize}
            businessNote={businessNote}
            onSetBusinessNote={onSetBusinessNote}
            noteRequired={noteRequired}
            onBack={handleBack2}
            onNext={handleNext2}
            t={t}
          />
        )}
        {step === 3 && (
          <CurrencyStep
            defaultCurrency={defaultCurrency}
            lang={lang}
            onSetCurrency={onSetCurrency}
            onBack={handleBack3}
            onNext={handleNext3}
            t={t}
          />
        )}
        {step === 4 && (
          <OperatingStep
            businessType={businessType}
            answers={operatingAnswers}
            onAnswer={onSetOperatingAnswer}
            onBack={handleBack4}
            onNext={handleNext4}
            t={t}
          />
        )}
        {step === 5 && (
          <CompleteStep
            businessType={businessType ?? ''}
            salesModelLabel={salesModelLabel}
            tradesLabel={tradesLabel}
            storeSizeLabel={storeSizeLabel}
            currencyLabel={currencyLabel}
            onComplete={onComplete}
            submitting={submitting}
            t={t}
          />
        )}
      </div>
    </div>
  )
})

OnboardingPage.displayName = 'OnboardingPage'
