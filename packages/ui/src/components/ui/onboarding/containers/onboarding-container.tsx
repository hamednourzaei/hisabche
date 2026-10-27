// packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx
'use client'

import { useToast } from '../../toast-provider'
import { apiErrorMessage, useSetBaseCurrency } from '@hisabche/api'
import { useLocale, useTranslations } from 'next-intl'
import {
  useOnboardingStore,
  useCurrencyStore,
  isSupportedCurrency,
  type BusinessType,
  type StoreSize,
  type Currency,
} from '@hisabche/store'
import { OnboardingPage } from '../onboarding-page'
import { useCallback, useMemo, memo, useState } from 'react'
import { useAuthStore } from '@hisabche/store'
import { BUSINESS_MODELS, BUSINESS_TYPES, BUSINESS_TYPE_OTHER } from '@hisabche/ui-contract'
import { useLocalePush } from '../../../../hooks/use-locale-push'

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingContainer v3 — Memoized · Type-Safe · Persist Fix
   ✅ memo · useCallback · useMemo · safeT · type-safe
   ═══════════════════════════════════════════════════════════════════════════ */

const storeSizes: { id: StoreSize; labelFa: string }[] = [
  { id: 'small', labelFa: 'دکان کوچک' },
  { id: 'medium', labelFa: 'فروشگاه متوسط' },
  { id: 'large', labelFa: 'تجارت بزرگ' },
]

export const OnboardingContainer = memo(function OnboardingContainer() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const push = useLocalePush()
  const lang = useLocale()

  const safeT = t

  const {
    step,
    businessType,
    storeSize,
    defaultCurrency,
    setStep,
    setBusinessType,
    setStoreSize,
    setDefaultCurrency,
    completeOnboarding,
  } = useOnboardingStore()

  // ✅ useMemo برای labels — the catalogue is the one onboarding renders, so the
  // review step can no longer show «سایر» for a trade that is in the list.
  const businessTypeLabel = useMemo(() => {
    const ids = businessType
      ? businessType
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []
    const catalogue = [...BUSINESS_MODELS, ...BUSINESS_TYPES, BUSINESS_TYPE_OTHER]
    return ids.map((id) => catalogue.find((option) => option.id === id)?.labelFa ?? id).join('، ')
  }, [businessType])

  const storeSizeLabel = useMemo(
    () => storeSizes.find((s) => s.id === storeSize)?.labelFa || '',
    [storeSize],
  )

  const currencyLabel = useMemo(() => defaultCurrency, [defaultCurrency])

  // Optional free text from the store-size step. Local to the wizard until
  // completion, when it is persisted with everything else.
  const [businessNote, setBusinessNote] = useState('')

  const updateProfile = useAuthStore((s) => s.updateProfile)
  const toast = useToast()

  /**
   * Persist what the wizard collected, then finish.
   *
   * The selection used to live only in this device's store: `updateProfile`
   * was read and never called, so the server's `profiles.business_types` stayed
   * empty and every screen resolved the generic profile. A failure is shown
   * and the wizard stays put — finishing locally would look like success while
   * the account kept an empty industry.
   */
  const handleComplete = useCallback(async () => {
    const selected = businessType
      ? businessType
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []
    try {
      await updateProfile({
        onboardingCompleted: true,
        businessTypes: selected,
        ...(storeSize ? { storeSize } : {}),
        ...(businessNote.trim() ? { businessNote: businessNote.trim() } : {}),
      })
    } catch {
      toast.error(tOriginal('onboarding.saveFailed'))
      return
    }
    completeOnboarding()
    push('/dashboard')
  }, [
    businessNote,
    businessType,
    completeOnboarding,
    push,
    storeSize,
    tOriginal,
    toast,
    updateProfile,
  ])

  // ✅ type-safe wrapper برای setterها
  const handleSetBusinessType = useCallback(
    (type: string) => {
      setBusinessType(type as BusinessType)
    },
    [setBusinessType],
  )

  const handleSetStoreSize = useCallback(
    (size: string) => {
      setStoreSize(size as StoreSize)
    },
    [setStoreSize],
  )

  const setPrimaryCurrency = useCurrencyStore((s) => s.setPrimaryCurrency)
  const saveBookCurrency = useSetBaseCurrency()

  // The wizard's answer used to stop here: `defaultCurrency` was written to the
  // onboarding store and NOTHING read it back. Every amount in the product is
  // formatted from `useCurrencyStore.primaryCurrency`, which stayed on its
  // 'AFN' default — so the currency step was decorative and a USD shop was
  // shown افغانی on every screen. Propagating the answer to the store the UI
  // actually reads is what makes the choice real.
  const handleSetCurrency = useCallback(
    (currency: string) => {
      if (!isSupportedCurrency(currency)) {
        // ⚠️ UNREACHABLE FROM THE PICKER, AND A TEST KEEPS IT THAT WAY.
        //
        // This used to fire constantly: the catalogue offered 25 codes while
        // `currencyCodeSchema` accepted four, so choosing طلا or تومان hit
        // this branch and the wizard silently did NOTHING. Task T1 opened the
        // schema to all 25, and `currency-catalogue-parity.test.ts` asserts
        // the two lists stay equal — so nothing the user can click lands here.
        //
        // The branch stays for a code arriving from anywhere else (a restored
        // draft, a stale persisted store). It refuses rather than coercing:
        // silently substituting a different currency is the failure this whole
        // change exists to remove.
        return
      }
      setDefaultCurrency(currency as Currency)
      setPrimaryCurrency(currency)
      // ⚠️ AND ON THE SERVER. The two lines above live in this device's
      // storage; the books currency is `workspaces.base_currency`. Without
      // this the choice was real on one phone and nowhere else — invoices
      // with no currency were still recorded in the server's default. A
      // refusal is said, not swallowed: the business may already have
      // documents, and then the books currency can no longer change.
      saveBookCurrency.mutate(currency, {
        onError: (error) => {
          const message = apiErrorMessage(error, '')
          toast.error(
            message.includes('BASE_CURRENCY_LOCKED')
              ? tOriginal('onboarding.bookCurrencyLocked')
              : tOriginal('onboarding.bookCurrencyFailed'),
          )
        },
      })
    },
    // eslint-plugin: `t` is rebuilt each render and reads only the translator.
    [setDefaultCurrency, setPrimaryCurrency, saveBookCurrency, toast, tOriginal],
  )

  return (
    <OnboardingPage
      step={step}
      businessType={businessType}
      storeSize={storeSize}
      defaultCurrency={defaultCurrency}
      lang={lang}
      t={safeT}
      businessTypeLabel={businessTypeLabel}
      storeSizeLabel={storeSizeLabel}
      currencyLabel={currencyLabel}
      onSetStep={setStep}
      onSetBusinessType={handleSetBusinessType}
      onSetStoreSize={handleSetStoreSize}
      businessNote={businessNote}
      onSetBusinessNote={setBusinessNote}
      onSetCurrency={handleSetCurrency}
      onComplete={handleComplete}
    />
  )
})

OnboardingContainer.displayName = 'OnboardingContainer'
