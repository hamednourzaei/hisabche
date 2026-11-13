// packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx
'use client'

import { useToast } from '../../toast-provider'
import {
  apiErrorMessage,
  useSetBaseCurrency,
  useSaveWorkspaceProfile,
  useOperationalProfile,
  useSaveOperationalDna,
  useSaveOnboardingProgress,
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
import { useCallback, useEffect, useMemo, memo, useRef, useState } from 'react'
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'
import {
  inferOperationalDna,
  primaryIndustryKeyOf,
  suggestedOperatingAnswersFor,
  type OnboardingProgress,
  type OperatingAnswers,
} from '@hisabche/validation'
import { BUSINESS_MODELS, BUSINESS_TYPES, BUSINESS_TYPE_OTHER } from '@hisabche/ui-contract'
import { useLocalePush } from '../../../../hooks/use-locale-push'

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingContainer v3 — Memoized · Type-Safe · Persist Fix
   ✅ memo · useCallback · useMemo · safeT · type-safe
   ═══════════════════════════════════════════════════════════════════════════ */

/** The same keys the size cards use — one name per size in every language. */
const STORE_SIZE_LABEL_KEY: Record<StoreSize, string> = {
  small: 'onboarding.smallStore',
  medium: 'onboarding.mediumStore',
  large: 'onboarding.largeStore',
}

export const OnboardingContainer = memo(function OnboardingContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )
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
    return ids
      .map((id) => {
        const option = catalogue.find((entry) => entry.id === id)
        return option ? t(option.labelKey) : id
      })
      .join(t('common.listSeparator'))
  }, [businessType, t])

  const storeSizeLabel = useMemo(
    () => (storeSize ? t(STORE_SIZE_LABEL_KEY[storeSize as StoreSize] ?? '') : ''),
    [storeSize, t],
  )

  const currencyLabel = useMemo(() => defaultCurrency, [defaultCurrency])

  // Optional free text from the store-size step. Local to the wizard until
  // completion, when it is persisted with everything else.
  const [businessNote, setBusinessNote] = useState('')

  const updateProfile = useAuthStore((s) => s.updateProfile)
  const saveWorkspaceProfile = useSaveWorkspaceProfile()
  const setOperationalDna = useOnboardingStore((s) => s.setOperationalDna)
  const ownAnswers = useOnboardingStore((s) => s.operatingAnswers)
  const setOperatingAnswer = useOnboardingStore((s) => s.setOperatingAnswer)
  // V55: the ONE canonical primary-industry decision (registry order, explicit
  // primary wins) — the same rule `resolveBusinessProfile` applies on the
  // server. Insertion order is never an accidental primary-industry rule.
  const selectedTrades = useMemo(
    () =>
      businessType
        ? businessType
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
    [businessType],
  )
  const primaryTrade = primaryIndustryKeyOf(businessType) ?? undefined
  // EVERY selected activity pre-fills its own answers (V64 §5): the wizard and
  // the inferred DNA must never see only the primary trade.
  const operatingAnswers = useMemo<OperatingAnswers>(
    () => ({ ...suggestedOperatingAnswersFor(selectedTrades), ...ownAnswers }),
    [selectedTrades, ownAnswers],
  )
  const setPrimaryCurrency = useCurrencyStore((s) => s.setPrimaryCurrency)
  const saveBookCurrency = useSetBaseCurrency()
  const toast = useToast()

  // ─── V54 5.3: the wizard's place is kept on the WORKSPACE ───────────────
  // Another device, a reinstall or a cleared browser resumes where the person
  // stopped instead of starting over. Before docs/operational-profile-01 runs
  // the server answers `configurable: false` and nothing here changes.
  const operational = useOperationalProfile()
  const saveOperationalDna = useSaveOperationalDna()
  const saveOnboardingProgress = useSaveOnboardingProgress()
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)

  // Resume ONCE, and only into an untouched wizard: answers already given on
  // this device are never overwritten by an older copy from elsewhere.
  const resumed = useRef(false)
  const serverProgress = operational.data?.onboarding ?? null
  useEffect(() => {
    if (resumed.current || !serverProgress) return
    resumed.current = true
    const local = useOnboardingStore.getState()
    if (local.step !== 0 || local.businessType || serverProgress.state === 'ACTIVE') return
    const { answers } = serverProgress
    useOnboardingStore.setState({
      step: serverProgress.step,
      ...(answers.businessType ? { businessType: answers.businessType as BusinessType } : {}),
      ...(answers.storeSize ? { storeSize: answers.storeSize as StoreSize } : {}),
      ...(answers.defaultCurrency && isSupportedCurrency(answers.defaultCurrency)
        ? { defaultCurrency: answers.defaultCurrency as Currency }
        : {}),
      ...(answers.operating ? { operatingAnswers: answers.operating } : {}),
    })
  }, [serverProgress])

  // Each answer is kept as it is given. Best effort by design: the device copy
  // is the one the wizard runs on, so a failed save loses nothing here — it
  // only means another device would start this step again. No success is
  // claimed for it anywhere.
  useEffect(() => {
    if (!workspaceId || step === 0 || operational.data?.configurable !== true) return
    const progress: OnboardingProgress = {
      state: 'IN_PROGRESS',
      step,
      answers: {
        businessType: businessType ?? null,
        storeSize: storeSize ?? null,
        defaultCurrency: defaultCurrency || null,
        operating: ownAnswers,
      },
    }
    saveOnboardingProgress(progress).catch(() => undefined)
  }, [
    workspaceId,
    step,
    businessType,
    storeSize,
    defaultCurrency,
    ownAnswers,
    operational.data?.configurable,
    saveOnboardingProgress,
  ])

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
    const selected = selectedTrades

    if (!defaultCurrency) {
      toast.error(tOriginal('onboarding.currencyRequired'))
      return
    }

    // Infer DNA deterministically from the user's choices. EVERY selected
    // activity contributes; the primary only decides vocabulary (V64 §5).
    const inferredDna = inferOperationalDna({
      tradeKey: primaryTrade,
      tradeKeys: selectedTrades,
      primaryTradeKey: primaryTrade,
      ...operatingAnswers,
    })
    setOperationalDna(inferredDna)

    try {
      const user = useAuthStore.getState().user
      let workspaceId = useWorkspaceStore.getState().workspaceId

      // 1. No workspace at all: create it with the answers in one request.
      if (!workspaceId && user?.id) {
        const wsName = (user.businessName || user.fullName || t('onboarding.defaultWorkspaceName'))
          .trim()
          .slice(0, 100)
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

      // V54 5.2: the 8-axis profile on the workspace, versioned. The version
      // named is the one this screen read; if another device saved in between
      // the server refuses (`OPERATIONAL_PROFILE_CHANGED`) and THAT profile
      // stands — this wizard does not overwrite it.
      const operationalView = operational.data
      if (operationalView?.configurable === true) {
        try {
          await saveOperationalDna(inferredDna, operationalView.version)
        } catch (dnaError) {
          if (!apiErrorMessage(dnaError, '').includes('OPERATIONAL_PROFILE_CHANGED')) {
            throw dnaError
          }
          await operational.refetch()
        }
        await saveOnboardingProgress({
          state: 'ACTIVE',
          step: 0,
          answers: {
            businessType: businessType ?? null,
            storeSize: storeSize ?? null,
            defaultCurrency,
            operating: operatingAnswers,
          },
        })
      }
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
    operational,
    operatingAnswers,
    primaryTrade,
    selectedTrades,
    saveOperationalDna,
    saveOnboardingProgress,
    defaultCurrency,
    push,
    saveBookCurrency,
    saveWorkspaceProfile,
    setOperationalDna,
    setPrimaryCurrency,
    storeSize,
    t,
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
      operatingAnswers={operatingAnswers}
      onSetOperatingAnswer={setOperatingAnswer}
      onComplete={handleComplete}
    />
  )
})

OnboardingContainer.displayName = 'OnboardingContainer'
