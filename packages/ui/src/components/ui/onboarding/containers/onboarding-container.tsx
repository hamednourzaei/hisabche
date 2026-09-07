// packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx
'use client'

import { useRouter } from 'next/navigation'
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

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingContainer v3 — Memoized · Type-Safe · Persist Fix
   ✅ memo · useCallback · useMemo · safeT · type-safe
   ═══════════════════════════════════════════════════════════════════════════ */

const businessTypes: { id: BusinessType; labelFa: string }[] = [
  { id: 'retail', labelFa: 'خرده فروشی' },
  { id: 'wholesale', labelFa: 'عمده فروشی' },
  { id: 'restaurant', labelFa: 'رستوران' },
  { id: 'service', labelFa: 'خدماتی' },
  { id: 'other', labelFa: 'سایر' },
]

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
  const router = useRouter()
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

  // ✅ useMemo برای labels
  const businessTypeLabel = useMemo(
    () => businessTypes.find((b) => b.id === businessType)?.labelFa || '',
    [businessType],
  )

  const storeSizeLabel = useMemo(
    () => storeSizes.find((s) => s.id === storeSize)?.labelFa || '',
    [storeSize],
  )

  const currencyLabel = useMemo(() => defaultCurrency, [defaultCurrency])

  // Optional free text from the store-size step. Local to the wizard until
  // completion, when it is persisted with everything else.
  const [businessNote, setBusinessNote] = useState('')

  const updateProfile = useAuthStore((s) => s.updateProfile)

  const handleComplete = useCallback(() => {
    completeOnboarding()
    router.push('/dashboard')
  }, [completeOnboarding, router])

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
    },
    [setDefaultCurrency, setPrimaryCurrency],
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
