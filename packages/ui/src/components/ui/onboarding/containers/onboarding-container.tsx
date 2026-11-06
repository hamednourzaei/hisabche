// packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx
'use client'

import { useToast } from '../../toast-provider'
import {
  apiErrorMessage,
  useSetBaseCurrency,
  useSaveWorkspaceProfile,
  apiClient,
} from '@hisabche/api'
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
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'
import { inferOperationalDna } from '@hisabche/validation'
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
  const saveWorkspaceProfile = useSaveWorkspaceProfile()
  const setOperationalDna = useOnboardingStore((s) => s.setOperationalDna)
  const setPrimaryCurrency = useCurrencyStore((s) => s.setPrimaryCurrency)
  const saveBookCurrency = useSetBaseCurrency()
  const toast = useToast()

  /**
   * Persist what the wizard collected, then finish.
   *
   * ⚠️ THE WORKSPACE USUALLY EXISTS ALREADY. `POST /auth/signup` provisions one
   * so a new account is never workspace-less — with NO name from the trade, no
   * base currency and no industry (the wizard has not run yet). This function
   * therefore has to APPLY the answers to that workspace, not only create one
   * when it is missing. The old `if (!currentWorkspaceId)` branch skipped
   * everything on every real signup, which is why a gold business kept AFN
   * books and a generic environment.
   */
  const handleComplete = useCallback(async () => {
    const selected = businessType
      ? businessType
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []

    if (!defaultCurrency) {
      toast.error(tOriginal('onboarding.currencyRequired'))
      return
    }

    // Infer DNA deterministically from the user's choices
    const inferredDna = inferOperationalDna({
      tradeKey: selected[0],
      holdsStock: storeSize ? 'yes' : 'unknown',
    })
    setOperationalDna(inferredDna)

    try {
      const user = useAuthStore.getState().user
      let workspaceId = useWorkspaceStore.getState().workspaceId

      // 1. No workspace at all: create it with the answers in one request.
      if (!workspaceId && user?.id) {
        const wsName = (user.businessName || user.fullName || 'کسب‌وکار من').trim().slice(0, 100)
        const created = await apiClient.post<{ id?: string }>('/workspaces', {
          name: wsName,
          baseCurrency: defaultCurrency,
          businessTypes: selected,
        })
        await useWorkspaceStore.getState().fetchWorkspace(user.id)
        workspaceId = useWorkspaceStore.getState().workspaceId ?? created.data?.id ?? null
      } else if (workspaceId) {
        // 2. The signup workspace: its currency is the default. The person's
        // answer replaces it — while the books are empty, which is now.
        await saveBookCurrency.mutateAsync(defaultCurrency)
      }

      if (!workspaceId) throw new Error('WORKSPACE_NOT_AVAILABLE')

      // 3. The store every amount on every screen is formatted from.
      setPrimaryCurrency(defaultCurrency)

      await updateProfile({
        onboardingCompleted: true,
        businessTypes: selected,
        ...(storeSize ? { storeSize } : {}),
        ...(businessNote.trim() ? { businessNote: businessNote.trim() } : {}),
      })
      // Also persist to workspace profile if user holds workspace.manage. The
      // account-level industry above is what screens read; this is the
      // workspace's own declaration, and a database that cannot store it yet
      // answers `null` rather than failing.
      await saveWorkspaceProfile(selected)
    } catch (error) {
      // The chosen currency is the whole point of the wizard, so a refusal is
      // said and the wizard stays — finishing locally would look like success
      // while the books kept another currency.
      const message = apiErrorMessage(error, '')
      toast.error(
        message.includes('BASE_CURRENCY_LOCKED')
          ? tOriginal('onboarding.bookCurrencyLocked')
          : message.includes('BASE_CURRENCY')
            ? tOriginal('onboarding.bookCurrencyFailed')
            : tOriginal('onboarding.saveFailed'),
      )
      return
    }
    completeOnboarding()
    push('/dashboard')
  }, [
    businessNote,
    businessType,
    completeOnboarding,
    defaultCurrency,
    push,
    saveBookCurrency,
    saveWorkspaceProfile,
    setOperationalDna,
    setPrimaryCurrency,
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

  // The wizard's answer used to stop here: `defaultCurrency` was written to the
  // onboarding store and NOTHING read it back. Every amount in the product is
  // formatted from `useCurrencyStore.primaryCurrency` — so the currency step was
  // decorative and a USD shop was shown افغانی on every screen.
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
