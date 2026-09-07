// packages/ui/src/components/ui/onboarding/onboarding-page.tsx
'use client'

import { cn } from '../../../lib/utils'
import {
  Store,
  Building2,
  Utensils,
  Wrench,
  MoreHorizontal,
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
  BUSINESS_TYPE_OTHER,
  CURRENCIES,
  filterBusinessTypes,
  primaryCurrencies,
} from '@hisabche/ui-contract'
import { isSupportedCurrency } from '@hisabche/store'
import { useCurrencies, type CurrencyRecord } from '@hisabche/api'

import { SearchableOptionList } from './searchable-option-list'

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingPage v4 — Memoized · Performance Optimized
   ✅ memo · useCallback · Row جدا شده
   ═══════════════════════════════════════════════════════════════════════════ */

export interface OnboardingPageProps {
  step: number
  businessType: string | null
  storeSize: string | null
  /** Optional free text; never gates progress. */
  businessNote: string
  defaultCurrency: string
  /** Interface language, for the currency cards. */
  lang: string
  t: (key: string, fallback?: string) => string
  businessTypeLabel: string
  storeSizeLabel: string
  currencyLabel: string
  onSetStep: (step: number) => void
  onSetBusinessType: (type: string) => void
  onSetStoreSize: (size: string) => void
  onSetCurrency: (currency: string) => void
  onSetBusinessNote: (note: string) => void
  onComplete: () => void
}

const selectedClasses =
  'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-[0_0_0_2px_hsl(var(--color-primary)/0.3)]'
const unselectedClasses =
  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] hover:border-[hsl(var(--color-primary)/0.4)]'

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
    <div className="mx-auto max-w-xl text-center">
      <div className="mb-4 flex justify-center sm:mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--gradient-brand)] shadow-lg shadow-[hsl(var(--color-primary)/0.2)] sm:h-20 sm:w-20">
          <span className="text-2xl font-bold text-white sm:text-3xl">ح</span>
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-[hsl(var(--fg-primary))] sm:mb-4 sm:text-3xl">
        {t('onboarding.welcome', 'به حسابچه خوش آمدید')}
      </h2>
      <p className="mb-6 text-base text-[hsl(var(--fg-secondary))] sm:mb-8 sm:text-lg">
        {t(
          'onboarding.welcomeDesc',
          'در چند مرحله کوتاه حسابچه را برای کسب و کار شما آماده می‌کنیم.',
        )}
      </p>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-6 py-3 sm:px-8 sm:py-3.5',
          'text-base font-bold text-white',
          'bg-[var(--gradient-brand)]',
          'shadow-md shadow-[hsl(var(--color-primary)/0.15)]',
          'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
          'motion-reduce:transition-none',
        )}
      >
        <ArrowRight className="size-5" aria-hidden="true" />
        {t('onboarding.start', 'شروع')}
      </button>
    </div>
  )
})
WelcomeStep.displayName = 'WelcomeStep'

// ─── Step 1: Business Type ────────────────────────────────────────────────

const BusinessTypeStep = memo(function BusinessTypeStep({
  businessType,
  onSetBusinessType,
  onBack,
  onNext,
  t,
}: {
  businessType: string | null
  onSetBusinessType: (type: string) => void
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  // Selection is a set: someone may genuinely run more than one business.
  // `businessType` stays a single string on the workspace, so the parent keeps
  // the primary choice and this step reports the whole selection.
  const selectedIds = useMemo(
    () => new Set(businessType ? businessType.split(',').filter(Boolean) : []),
    [businessType],
  )

  const trades = useMemo(
    () =>
      filterBusinessTypes('', t).map((option) => ({
        id: option.id,
        label: t(option.labelKey, option.labelFa),
      })),
    [t],
  )

  const handleToggle = useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onSetBusinessType([...next].join(','))
    },
    [selectedIds, onSetBusinessType],
  )

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-5 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-8 sm:text-2xl">
        {t('onboarding.businessType', 'نوع کسب و کار')}
      </h2>
      {/* Sales model: two cards, side by side at every width. Almost every
          business is one of the two, so they stay cards rather than list rows. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {BUSINESS_MODELS.map((item) => {
          const Icon = item.id === 'wholesale' ? Building2 : Store
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={selectedIds.has(item.id)}
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

      {/* The actual trade, searchable. The old five-card set forced most shops
          to answer "other", which told us nothing about them. */}
      <div className="mt-4">
        <SearchableOptionList
          options={trades}
          selected={selectedIds}
          onToggle={handleToggle}
          placeholder={t('onboarding.searchBusiness', 'کسب‌وکارت را جست‌وجو کن')}
          emptyLabel={t('onboarding.noBusinessMatch', 'موردی پیدا نشد')}
          fallbackOption={{
            id: BUSINESS_TYPE_OTHER.id,
            label: t(BUSINESS_TYPE_OTHER.labelKey, BUSINESS_TYPE_OTHER.labelFa),
          }}
        />
      </div>
      <div className="mt-6 flex justify-between sm:mt-8">
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
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('action.back', 'برگشت')}
        </button>
        <button
          type="button"
          disabled={!businessType}
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next', 'ادامه')}
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
  onBack,
  onNext,
  t,
}: {
  storeSize: string | null
  onSetStoreSize: (size: string) => void
  businessNote: string
  onSetBusinessNote: (note: string) => void
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  const storeSizes = [
    {
      id: 'small',
      icon: StoreIcon,
      labelKey: 'onboarding.smallStore',
      descKey: 'onboarding.smallStoreDesc',
    },
    {
      id: 'medium',
      icon: BuildingIcon,
      labelKey: 'onboarding.mediumStore',
      descKey: 'onboarding.mediumStoreDesc',
    },
    {
      id: 'large',
      icon: ShoppingBag,
      labelKey: 'onboarding.largeStore',
      descKey: 'onboarding.largeStoreDesc',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-5 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-8 sm:text-2xl">
        {t('onboarding.storeSize', 'اندازه کسب و کار')}
      </h2>
      {/* Two per row rather than a vertical stack, so the three sizes and the
          free-text card below form one 2x2 block instead of a long column. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {storeSizes.map((item) => (
          <button
            key={item.id}
            type="button"
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
                {t(item.labelKey, item.id)}
              </h3>
              <p className="text-xs text-[hsl(var(--fg-secondary))] sm:text-sm">
                {t(item.descKey, '')}
              </p>
            </div>
            {storeSize === item.id && (
              <Check
                className="ms-auto size-5 shrink-0 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
            )}
          </button>
        ))}

        {/* Fourth cell: free text, completing the 2x2 block. Purely optional —
            it never gates the Next button, so leaving it blank costs nothing. */}
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
            {t('onboarding.aboutBusiness', 'درباره کسب‌وکارت')}
          </label>
          <textarea
            id="onboarding-business-note"
            value={businessNote}
            onChange={(event) => onSetBusinessNote(event.target.value)}
            rows={3}
            placeholder={t(
              'onboarding.aboutBusinessPlaceholder',
              'اگر دوست داشتی بیشتر درمورد کسب‌وکارت بنویس',
            )}
            className={cn(
              'w-full flex-1 resize-none rounded-xl border p-2.5 text-sm outline-none',
              'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
              'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
              'focus:border-[hsl(var(--color-primary))]',
            )}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-between sm:mt-8">
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
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('action.back', 'برگشت')}
        </button>
        <button
          type="button"
          disabled={!storeSize}
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next', 'ادامه')}
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
  /** Interface language — decides which two currencies are offered as cards. */
  lang: string
  onSetCurrency: (currency: string) => void
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  // Two cards, chosen by interface language: toman-first for Persian,
  // afghani-first for Dari, dollar second in both. Everything else — including
  // precious metals, which are priced by weight — is found by searching.
  //
  // Only the codes the product can actually honour are offered.
  //
  // ⚠️ THE COMMENT HERE USED TO SAY «accepts four». That was true before T1
  // and is not now — `currencyCodeSchema` accepts 25, including the metals.
  // The defect it described was real and is worth keeping in view: the
  // catalogue offered codes the schema rejected, the answer was cast through
  // `as`, and every formatter then quietly replaced it with AFN. A shopkeeper
  // who picked تومان was shown افغانی for the life of the account.
  //
  // ⚠️ THE LIST IS INTERSECTED WITH `isSupportedCurrency`, NOT TAKEN FROM THE
  // SERVER WHOLESALE (Patch 1).
  //
  // `currencies.is_active` and `CURRENCY_CODES` are meant to be the same 25,
  // and a verification query checks it. But if someone activates a row in the
  // database WITHOUT adding its precision to `FRACTION_DIGITS`, the server
  // would start offering a code this build cannot format — amounts with no
  // precision contract, which is a wrong number rather than a missing option
  // (rule 9). Intersecting means the database can never widen the picker past
  // what the code can honour; it can only ever narrow it.
  //
  // What the server DOES contribute is the reference data itself: the name,
  // the Persian name and the symbol, which is exactly what a reference table
  // is for.
  const { data: currencyData } = useCurrencies()

  const serverCurrencies = useMemo(() => {
    const rows = currencyData?.currencies ?? []
    return new Map<string, CurrencyRecord>(rows.map((row) => [row.code, row]))
  }, [currencyData])

  const primary = useMemo(
    () => primaryCurrencies(lang).filter((c) => isSupportedCurrency(c.code)),
    [lang],
  )
  const primaryCodes = useMemo(() => new Set(primary.map((c) => c.code)), [primary])

  const searchable = useMemo(
    () =>
      CURRENCIES.filter((c) => isSupportedCurrency(c.code) && !primaryCodes.has(c.code)).map(
        (c) => {
          // The server's name wins when it has one — it is the reference
          // table. The catalogue's label is the fallback, so a database that
          // has not run the migration still renders proper names.
          const fromTable = serverCurrencies.get(c.code)
          return {
            id: c.code,
            label: fromTable?.nameFa ?? t(c.labelKey, c.labelFa),
            prefix: c.flag,
          }
        },
      ),
    [primaryCodes, t, serverCurrencies],
  )

  const selectedCurrency = useMemo(
    () => new Set(defaultCurrency ? [defaultCurrency] : []),
    [defaultCurrency],
  )

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-5 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-8 sm:text-2xl">
        {t('onboarding.defaultCurrency', 'ارز پیشفرض')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {primary.map((cur) => (
          <button
            key={cur.code}
            type="button"
            onClick={() => onSetCurrency(cur.code)}
            className={cn(
              'rounded-2xl border-2 p-3.5 transition-all duration-200 sm:p-5',
              'motion-reduce:transition-none',
              defaultCurrency === cur.code ? selectedClasses : unselectedClasses,
            )}
          >
            <div className="mb-1.5 text-2xl sm:mb-2 sm:text-3xl">{cur.flag}</div>
            <div className="text-sm font-medium text-[hsl(var(--fg-primary))] sm:text-base">
              {t(cur.labelKey, cur.labelFa)}
            </div>
          </button>
        ))}
      </div>

      {/* Only reached if neither card is the user's unit. Same control as the
          business-type step, so the interaction is learned once. */}
      <div className="mt-4">
        <SearchableOptionList
          options={searchable}
          selected={selectedCurrency}
          onToggle={onSetCurrency}
          placeholder={t('onboarding.searchCurrency', 'واحد پولت را جست‌وجو کن')}
          emptyLabel={t('onboarding.noCurrencyMatch', 'موردی پیدا نشد')}
        />
      </div>
      <div className="mt-6 flex justify-between sm:mt-8">
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
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('action.back', 'برگشت')}
        </button>
        <button
          type="button"
          disabled={!defaultCurrency}
          onClick={onNext}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[var(--gradient-brand)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {t('action.next', 'ادامه')}
        </button>
      </div>
    </div>
  )
})
CurrencyStep.displayName = 'CurrencyStep'

// ─── Step 4: Complete ─────────────────────────────────────────────────────

const CompleteStep = memo(function CompleteStep({
  businessTypeLabel,
  storeSizeLabel,
  currencyLabel,
  onComplete,
  t,
}: {
  businessTypeLabel: string
  storeSizeLabel: string
  currencyLabel: string
  onComplete: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mb-4 flex justify-center sm:mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)] sm:h-20 sm:w-20">
          <Check
            className="size-8 text-[hsl(var(--color-success))] sm:size-10"
            aria-hidden="true"
          />
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-[hsl(var(--fg-primary))] sm:mb-4 sm:text-3xl">
        {t('onboarding.ready', 'همه چیز آماده است')}
      </h2>
      <p className="mb-5 text-sm text-[hsl(var(--fg-secondary))] sm:mb-8 sm:text-base">
        {t('onboarding.readyDesc', 'حسابچه با موفقیت پیکربندی شد.')}
      </p>
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] mb-5 sm:mb-8">
        <div className="p-4 space-y-3 text-start sm:p-6 sm:space-y-4">
          <Row label={t('onboarding.businessType', 'نوع کسب و کار')} value={businessTypeLabel} />
          <Row label={t('onboarding.size', 'اندازه')} value={storeSizeLabel} />
          <Row label={t('onboarding.currency', 'ارز')} value={currencyLabel} />
        </div>
      </div>
      <button
        type="button"
        onClick={onComplete}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 sm:px-8 sm:py-3.5',
          'text-base font-bold text-white',
          'bg-[var(--gradient-brand)]',
          'shadow-md shadow-[hsl(var(--color-primary)/0.15)]',
          'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
          'motion-reduce:transition-none',
        )}
      >
        <ArrowRight className="size-5" aria-hidden="true" />
        {t('onboarding.enter', 'ورود به حسابچه')}
      </button>
    </div>
  )
})
CompleteStep.displayName = 'CompleteStep'

// ─── Main Component ─────────────────────────────────────────────────────────

export const OnboardingPage = memo(function OnboardingPage({
  step,
  businessType,
  storeSize,
  businessNote,
  defaultCurrency,
  lang,
  t,
  businessTypeLabel,
  storeSizeLabel,
  currencyLabel,
  onSetStep,
  onSetBusinessType,
  onSetStoreSize,
  onSetCurrency,
  onSetBusinessNote,
  onComplete,
}: OnboardingPageProps) {
  const handleStart = useCallback(() => onSetStep(1), [onSetStep])
  const handleBack1 = useCallback(() => onSetStep(0), [onSetStep])
  const handleNext1 = useCallback(() => onSetStep(2), [onSetStep])
  const handleBack2 = useCallback(() => onSetStep(1), [onSetStep])
  const handleNext2 = useCallback(() => onSetStep(3), [onSetStep])
  const handleBack3 = useCallback(() => onSetStep(2), [onSetStep])
  const handleNext3 = useCallback(() => onSetStep(4), [onSetStep])

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--surface-base))]">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-5 sm:py-8">
        <div className="mb-6 flex items-center justify-center gap-1.5 sm:mb-10 sm:gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 w-12 rounded-full transition-all duration-300 sm:h-2 sm:w-20',
                s <= step ? 'bg-[hsl(var(--color-primary))]' : 'bg-[hsl(var(--surface-muted))]',
              )}
            />
          ))}
        </div>

        {step === 0 && <WelcomeStep onStart={handleStart} t={t} />}
        {step === 1 && (
          <BusinessTypeStep
            businessType={businessType}
            onSetBusinessType={onSetBusinessType}
            onBack={handleBack1}
            onNext={handleNext1}
            t={t}
          />
        )}
        {step === 2 && (
          <StoreSizeStep
            storeSize={storeSize}
            onSetStoreSize={onSetStoreSize}
            businessNote={businessNote}
            onSetBusinessNote={onSetBusinessNote}
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
          <CompleteStep
            businessTypeLabel={businessTypeLabel}
            storeSizeLabel={storeSizeLabel}
            currencyLabel={currencyLabel}
            onComplete={onComplete}
            t={t}
          />
        )}
      </div>
    </div>
  )
})

OnboardingPage.displayName = 'OnboardingPage'
