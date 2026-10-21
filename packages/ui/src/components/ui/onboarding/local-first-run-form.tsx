// packages/ui/src/components/ui/onboarding/local-first-run-form.tsx
'use client'

// ============================================
// The local first run — the business, made on this device.
//
// ⚠️ TWO ANSWERS, BOTH ASKED.
//
// The name of the business and the unit its books are kept in. Neither has a
// default: a books currency that is preselected is a books currency nobody
// chose, and the local engine refuses to create a workspace without one
// (the offline engine has no `AFN` to fall back on — the device might not
// trade in Afghani at all).
//
// The currency control is the onboarding wizard's own picker
// (`CurrencyPicker`), so the two screens cannot offer different lists.
//
// This is a VIEW. It asks; it does not create anything. The shell owns the
// call to the local engine and the session that follows it.
// ============================================

import { isMetal } from '@hisabche/formatting'
import { MetalUnitPicker } from '../settings/metal-unit-section'
import { SelectField } from '../select-field'
import { memo } from 'react'

import { cn } from '../../../lib/utils'
import { CurrencyPicker } from './currency-picker'

/** Every zone this device knows, plus the current value even when it does not. */
function timeZoneOptions(current: string): { value: string; label: string }[] {
  const known =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return [...new Set([...(current ? [current] : []), ...known])].map((zone) => ({
    value: zone,
    label: zone,
  }))
}

export interface LocalFirstRunFormProps {
  /** The business name as typed. */
  name: string
  onNameChange: (name: string) => void
  /** The chosen books currency, or null when nothing has been chosen. */
  currency: string | null
  onCurrencyChange: (code: string) => void
  /**
   * The business time zone — PREFILLED with the device's, and editable.
   *
   * ⚠️ The device's zone is a SUGGESTION, not the answer. A shop in Herat
   * whose phone is set to Kabul would otherwise close its day at the wrong
   * midnight, and every «today» in the books would be wrong for four hours a
   * day. The person can change it; the field is there so they can.
   */
  timeZone: string
  onTimeZoneChange: (timeZone: string) => void
  onSubmit: () => void
  /** True while the workspace is being written. */
  isSubmitting: boolean
  /** Why the last attempt failed, or null. Shown at the button. */
  error: string | null
  /** Interface language — decides which two currencies are offered as cards. */
  lang: string
  t: (key: string, fallback?: string) => string
}

export const LocalFirstRunForm = memo(function LocalFirstRunForm({
  name,
  onNameChange,
  currency,
  onCurrencyChange,
  timeZone,
  onTimeZoneChange,
  onSubmit,
  isSubmitting,
  error,
  lang,
  t,
}: LocalFirstRunFormProps) {
  const canSubmit = name.trim().length > 0 && Boolean(currency) && !isSubmitting

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-2 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-3 sm:text-2xl">
        {t('auth.offlineFirstRun.title', 'کسب‌وکار خود را بسازید')}
      </h2>
      <p className="mb-6 text-center text-sm text-[hsl(var(--fg-secondary))] sm:mb-8">
        {t(
          'auth.offlineFirstRun.description',
          'این کسب‌وکار روی همین دستگاه ساخته می‌شود و به اینترنت نیاز ندارد.',
        )}
      </p>

      <div className="mb-6 sm:mb-8">
        <label
          htmlFor="offline-first-run-name"
          className="mb-1.5 block text-sm font-semibold text-[hsl(var(--fg-primary))]"
        >
          {t('auth.offlineFirstRun.name', 'نام کسب‌وکار')}
        </label>
        <input
          id="offline-first-run-name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t('auth.offlineFirstRun.namePlaceholder', 'مثلاً فروشگاه مرکزی')}
          className={cn(
            'w-full rounded-xl border p-3 text-sm outline-none',
            'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
            'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
            'focus:border-[hsl(var(--color-primary))]',
          )}
        />
      </div>

      <div className="mb-6 sm:mb-8">
        <label
          htmlFor="offline-first-run-time-zone"
          className="mb-1.5 block text-sm font-semibold text-[hsl(var(--fg-primary))]"
        >
          {t('auth.offlineFirstRun.timeZone', 'منطقه‌ی زمانی')}
        </label>
        {/* A searchable list, not a text box: few people can type «Asia/Kabul»,
            and a misspelt zone is a book whose «today» is wrong. Same list
            as the settings section (the zones this device knows). */}
        <SelectField
          id="offline-first-run-time-zone"
          name="timeZone"
          searchable
          value={timeZone}
          onChange={onTimeZoneChange}
          options={timeZoneOptions(timeZone)}
          aria-label={t('auth.offlineFirstRun.timeZone', 'منطقه‌ی زمانی')}
          className="w-full"
        />
        <p className="mt-1.5 text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'auth.offlineFirstRun.timeZoneHint',
            'منطقه‌ی زمانی دستگاه پیشنهاد شده است؛ «امروز» در دفاتر با همین منطقه حساب می‌شود.',
          )}
        </p>
      </div>

      <h3 className="mb-5 text-center text-xl font-bold text-[hsl(var(--fg-primary))] sm:mb-8 sm:text-2xl">
        {t('auth.offlineFirstRun.currency', 'ارز دفاتر')}
      </h3>
      <CurrencyPicker value={currency} onChange={onCurrencyChange} lang={lang} t={t} />

      {/* A metal is weighed: gram, kilogram or tonne — chosen here, changeable
          in settings. The books keep grams either way (owner, 21 Oct 2026). */}
      {isMetal(currency) ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          <span className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('settings.metalUnit.title', 'واحد نمایش فلز')}
          </span>
          <MetalUnitPicker />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8">
        {/* ⚠️ THE ERROR IS AT THE BUTTON, NOT SWALLOWED.
            A first run that failed and says nothing is a first run that
            looks like a button that does nothing. */}
        {error && (
          <p
            role="alert"
            className="text-center text-sm font-medium text-[hsl(var(--color-destructive))]"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-8 py-3',
            'text-base font-bold text-white',
            'bg-[image:var(--gradient-brand)]',
            'shadow-md shadow-[hsl(var(--color-primary)/0.15)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          {isSubmitting
            ? t('auth.offlineFirstRun.creating', 'در حال ساخت…')
            : t('auth.offlineFirstRun.submit', 'ساخت کسب‌وکار و شروع')}
        </button>
      </div>
    </div>
  )
})
LocalFirstRunForm.displayName = 'LocalFirstRunForm'
