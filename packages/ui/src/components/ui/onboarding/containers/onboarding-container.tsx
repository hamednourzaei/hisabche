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
  type StoreSize,
  type Currency,
} from '@hisabche/store'
import { OnboardingPage } from '../onboarding-page'
import { useCallback, useEffect, useMemo, memo, useRef, useState } from 'react'
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'
import {
  inferOperationalDna,
  primaryIndustryKeyOf,
  canonicalIndustryTypes,
  suggestedOperatingAnswersFor,
  SALES_MODEL_KEYS,
  MAX_INDUSTRY_SELECTION,
  type OnboardingProgress,
  type OperatingAnswers,
} from '@hisabche/validation'
import {
  BUSINESS_MODELS,
  BUSINESS_TYPES,
  BUSINESS_TYPE_OTHER,
  CURRENCIES,
} from '@hisabche/ui-contract'
import { useLocalePush } from '../../../../hooks/use-locale-push'

/* ═══════════════════════════════════════════════════════════════════════════
   OnboardingContainer — forensic remediation R1/R2/R4 (22 Nov 2026)

   Completion is a coordinated chain, activation LAST, and navigation happens
   only on the server's positive readback:

     currency → workspace profile → DNA (one conflict retry) →
     PATCH /auth/profile (gate) → readback → ACTIVE draft → dashboard

   Autosave is debounced, sequence-guarded and its failures are VISIBLE.
   The draft carries every wizard field (note, explicit primary, savedAt) so a
   second device resumes the same wizard. See docs/audit/ONBOARDING-FORENSIC-AUDIT.md.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The same keys the size cards use — one name per size in every language. */
const STORE_SIZE_LABEL_KEY: Record<string, string> = {
  solo: 'onboarding.scaleSolo',
  small: 'onboarding.scaleSmall',
  medium: 'onboarding.scaleMedium',
  large: 'onboarding.scaleLarge',
}

const STORE_SIZES: readonly StoreSize[] = ['solo', 'small', 'medium', 'large']

/** The gate's prerequisites, named exactly as the server names them. */
const PREREQUISITE_KEY: Record<string, string> = {
  IDENTITY: 'onboarding.prerequisite.identity',
  WORKSPACE: 'onboarding.prerequisite.workspace',
  WORKSPACE_PROFILE: 'onboarding.prerequisite.workspaceProfile',
  DEFAULT_CURRENCY: 'onboarding.prerequisite.defaultCurrency',
}

/** Autosave coalescing window — one PUT per burst of answers, not per keystroke. */
const AUTOSAVE_DELAY_MS = 800

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

  const {
    step,
    businessType,
    primaryTradeKey,
    storeSize,
    defaultCurrency,
    businessNote,
    savedAt: localSavedAt,
    setStep,
    setBusinessType,
    setPrimaryTradeKey,
    setStoreSize,
    setDefaultCurrency,
    setBusinessNote,
    markProgressSaved,
    completeOnboarding,
  } = useOnboardingStore()

  // The ONE canonicaliser reads the selection — never a raw split (F-002/F-016).
  const selectedTrades = useMemo(
    () => [...canonicalIndustryTypes(businessType).known],
    [businessType],
  )

  // Sales models and trades are different questions; the review answers them
  // in separate rows (F-003/F-009). Unknown ids never render raw (F-008).
  const salesModelLabel = useMemo(() => {
    const models = selectedTrades.filter((id) => SALES_MODEL_KEYS.includes(id))
    return models
      .map((id) => {
        const option = BUSINESS_MODELS.find((entry) => entry.id === id)
        return option ? t(option.labelKey, option.labelFa) : t('onboarding.unknownActivity')
      })
      .join(t('common.listSeparator'))
  }, [selectedTrades, t])

  const tradesLabel = useMemo(() => {
    const catalogue = [...BUSINESS_TYPES, BUSINESS_TYPE_OTHER]
    return selectedTrades
      .filter((id) => !SALES_MODEL_KEYS.includes(id))
      .map((id) => {
        const option = catalogue.find((entry) => entry.id === id)
        return option ? t(option.labelKey, option.labelFa) : t('onboarding.unknownActivity')
      })
      .join(t('common.listSeparator'))
  }, [selectedTrades, t])

  const storeSizeLabel = useMemo(
    () => (storeSize ? t(STORE_SIZE_LABEL_KEY[storeSize] ?? '') : ''),
    [storeSize, t],
  )

  // The review names the currency in the reader's language, never the raw
  // ISO code (F-064). The catalogue is the same one the picker offers.
  const currencyLabel = useMemo(() => {
    if (!defaultCurrency) return ''
    const option = CURRENCIES.find((entry) => entry.code === defaultCurrency)
    return option ? t(option.labelKey, option.labelFa) : t('onboarding.unknownCurrency')
  }, [defaultCurrency, t])

  const updateProfile = useAuthStore((s) => s.updateProfile)
  const saveWorkspaceProfile = useSaveWorkspaceProfile()
  const setOperationalDna = useOnboardingStore((s) => s.setOperationalDna)
  const ownAnswers = useOnboardingStore((s) => s.operatingAnswers)
  const setOperatingAnswer = useOnboardingStore((s) => s.setOperatingAnswer)
  // The ONE canonical primary-industry decision (ADR-001): registry order,
  // explicit primary wins. The page displays the SAME value (F-005).
  const primaryTrade = primaryIndustryKeyOf(businessType, primaryTradeKey) ?? undefined
  // EVERY selected activity pre-fills its own answers (V64 §5).
  const operatingAnswers = useMemo<OperatingAnswers>(
    () => ({ ...suggestedOperatingAnswersFor(selectedTrades), ...ownAnswers }),
    [selectedTrades, ownAnswers],
  )
  const setPrimaryCurrency = useCurrencyStore((s) => s.setPrimaryCurrency)
  const saveBookCurrency = useSetBaseCurrency()
  const toast = useToast()

  // ─── Server draft: resume by recency, autosave with coalescing ───────────
  const operational = useOperationalProfile()
  const saveOperationalDna = useSaveOperationalDna()
  const saveOnboardingProgress = useSaveOnboardingProgress()
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const serverProgress = operational.data?.onboarding ?? null

  const [autosaveIssue, setAutosaveIssue] = useState<'failed' | 'unavailable' | null>(null)
  const [completionNotice, setCompletionNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const autosaveSeq = useRef(0)
  const lastResume = useRef<{ workspaceId: string | null; savedAt: number }>({
    workspaceId: null,
    savedAt: -1,
  })

  // Resume when the server draft is newer than this device's copy, or when the
  // local wizard is untouched (fresh device, reset, another workspace). The
  // ref prevents re-applying the same draft on every render; a reset re-arms
  // it because `localSavedAt` returns to null (F-028/F-034/F-035).
  useEffect(() => {
    if (!serverProgress || !workspaceId) return
    const serverAt = serverProgress.answers.savedAt ?? -1
    const last = lastResume.current
    const local = useOnboardingStore.getState()
    const localUntouched = local.step === 0 && !local.businessType && !local.businessNote
    const rearm = local.savedAt === null && last.workspaceId === workspaceId
    if (last.workspaceId === workspaceId && serverAt <= last.savedAt && !rearm) return
    if (!localUntouched && serverAt <= (local.savedAt ?? -1)) return

    if (serverProgress.state === 'ACTIVE') {
      // An ACTIVE draft without an activated account is a partial completion:
      // say so instead of silently restarting the wizard (F-036).
      if (useAuthStore.getState().user?.onboardingCompleted !== true) {
        setCompletionNotice(t('onboarding.recovery.activeDraft'))
      }
      lastResume.current = { workspaceId, savedAt: serverAt }
      return
    }

    const { answers } = serverProgress
    const restoredSelection = answers.businessType
      ? canonicalIndustryTypes(answers.businessType).known.join(',') || null
      : null
    const restoredPrimary =
      answers.primaryTradeKey && restoredSelection?.split(',').includes(answers.primaryTradeKey)
        ? answers.primaryTradeKey
        : null
    useOnboardingStore.setState({
      step: Math.min(Math.max(serverProgress.step, 0), 5),
      ...(restoredSelection ? { businessType: restoredSelection } : {}),
      ...(restoredPrimary ? { primaryTradeKey: restoredPrimary } : {}),
      ...(answers.storeSize && (STORE_SIZES as readonly string[]).includes(answers.storeSize)
        ? { storeSize: answers.storeSize as StoreSize }
        : {}),
      ...(answers.defaultCurrency && isSupportedCurrency(answers.defaultCurrency)
        ? { defaultCurrency: answers.defaultCurrency as Currency }
        : {}),
      ...(answers.operating ? { operatingAnswers: answers.operating } : {}),
      ...(typeof answers.businessNote === 'string' ? { businessNote: answers.businessNote } : {}),
    })
    markProgressSaved(serverAt >= 0 ? serverAt : Date.now())
    lastResume.current = { workspaceId, savedAt: serverAt }
  }, [serverProgress, workspaceId, localSavedAt, markProgressSaved, t])

  // Each answer is kept as it is given — debounced, latest-wins, and a failure
  // is SAID (F-037/F-038/F-039). The device copy remains the source the wizard
  // runs on; the notice never claims a save that did not happen.
  useEffect(() => {
    if (!workspaceId || step === 0 || operational.data?.configurable !== true) return
    const at = Date.now()
    const seq = ++autosaveSeq.current
    const timer = setTimeout(() => {
      const progress: OnboardingProgress = {
        state: 'IN_PROGRESS',
        step,
        answers: {
          businessType: businessType ?? null,
          storeSize: storeSize ?? null,
          defaultCurrency: defaultCurrency || null,
          operating: ownAnswers,
          primaryTradeKey: primaryTradeKey ?? null,
          businessNote: businessNote.trim() ? businessNote.trim() : null,
          savedAt: at,
        },
      }
      saveOnboardingProgress(progress)
        .then((saved) => {
          if (seq !== autosaveSeq.current) return
          if (saved) {
            setAutosaveIssue(null)
            markProgressSaved(at)
          } else {
            // `null` = the database cannot hold drafts yet (migration pending).
            setAutosaveIssue('unavailable')
          }
        })
        .catch(() => {
          if (seq === autosaveSeq.current) setAutosaveIssue('failed')
        })
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [
    workspaceId,
    step,
    businessType,
    storeSize,
    defaultCurrency,
    ownAnswers,
    primaryTradeKey,
    businessNote,
    operational.data?.configurable,
    saveOnboardingProgress,
    markProgressSaved,
  ])

  /**
   * Persist what the wizard collected, then finish — activation LAST.
   *
   * ⚠️ THE WORKSPACE USUALLY EXISTS ALREADY. `POST /auth/signup` provisions one
   * so a new account is never workspace-less. This function APPLIES the answers
   * to that workspace. The account is activated only after every required
   * persistence succeeded, and navigation requires the server's positive
   * readback — a local boolean is never proof (F-027/F-043/F-044/F-051).
   */
  const handleComplete = useCallback(async () => {
    if (inFlight.current) return
    const selected = selectedTrades

    if (selected.length === 0) {
      toast.error(tOriginal('onboarding.businessTypeRequired'))
      return
    }
    if (selected.length > MAX_INDUSTRY_SELECTION) {
      toast.error(tOriginal('onboarding.selectionLimit'))
      return
    }
    if (!defaultCurrency) {
      toast.error(tOriginal('onboarding.currencyRequired'))
      return
    }
    if (!storeSize) {
      toast.error(tOriginal('onboarding.sizeRequired'))
      return
    }
    // «سایر» without a description tells the product nothing (F-011/F-067).
    if (selected.includes('other') && !businessNote.trim()) {
      toast.error(tOriginal('onboarding.otherDescriptionRequired'))
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setCompletionNotice(null)

    // Infer DNA deterministically from the user's choices. EVERY selected
    // activity contributes; the primary only decides vocabulary (V64 §5).
    const inferredDna = inferOperationalDna({
      tradeKey: primaryTrade,
      tradeKeys: selected,
      primaryTradeKey: primaryTrade,
      ...operatingAnswers,
    })

    try {
      const user = useAuthStore.getState().user
      let wsId = useWorkspaceStore.getState().workspaceId

      // 1. No workspace at all: create it with the answers in one request.
      if (!wsId && user?.id) {
        const wsName = (user.businessName || user.fullName || t('onboarding.defaultWorkspaceName'))
          .trim()
          .slice(0, 100)
        const created = await apiClient.post<{ id?: string }>('/workspaces', {
          name: wsName,
          baseCurrency: defaultCurrency,
          businessTypes: selected,
        })
        await useWorkspaceStore.getState().fetchWorkspace(user.id)
        wsId = useWorkspaceStore.getState().workspaceId ?? created.data?.id ?? null
      } else if (wsId) {
        // 2. The signup workspace: the person's answer replaces the default —
        // while the books are empty, which is now. A refusal stops the chain.
        await saveBookCurrency.mutateAsync(defaultCurrency)
      }

      if (!wsId) throw new Error('WORKSPACE_NOT_AVAILABLE')

      // 3. The store every amount is formatted from — only after the books
      // currency write succeeded (F-060).
      setPrimaryCurrency(defaultCurrency)

      // 4. The workspace's own declaration. `null` means the database cannot
      // hold it yet: documented degraded mode, said out loud (F-045/F-055).
      let degraded = false
      const profileView = await saveWorkspaceProfile(selected)
      if (profileView === null) degraded = true

      // 5. The 8-axis profile, versioned. A conflict refetches and REAPPLIES
      // the person's intent once; a second conflict stops the chain (F-047).
      const operationalView = operational.data
      if (operationalView?.configurable === true) {
        let saved: { version: number; replayed: boolean } | null
        try {
          saved = await saveOperationalDna(inferredDna, operationalView.version)
        } catch (dnaError) {
          if (!apiErrorMessage(dnaError, '').includes('OPERATIONAL_PROFILE_CHANGED')) {
            throw dnaError
          }
          const fresh = await operational.refetch()
          const freshVersion = fresh.data?.version
          if (typeof freshVersion !== 'number') throw dnaError
          saved = await saveOperationalDna(inferredDna, freshVersion)
        }
        // Configurable server + null result is an inconsistency, not a
        // degraded mode: it must block activation (F-046).
        if (saved === null) throw new Error('OPERATIONAL_PROFILE_NOT_CONFIGURED')
        setOperationalDna(inferredDna)
      } else {
        degraded = true
        // Device-only copy, labelled by the recovery notice (F-049/F-050).
        setOperationalDna(inferredDna)
      }

      // 6. ACTIVATION LAST. The server gathers its OWN facts and refuses with
      // the exact missing prerequisites when anything required failed above.
      await updateProfile({
        onboardingCompleted: true,
        businessTypes: selected,
        storeSize,
        ...(businessNote.trim() ? { businessNote: businessNote.trim() } : {}),
      })
      // The readback is the proof — never the request body (F-027/F-105/F-107).
      if (useAuthStore.getState().user?.onboardingCompleted !== true) {
        throw new Error('ONBOARDING_PREREQUISITES_MISSING')
      }

      // 7. The ACTIVE draft — convenience for other devices. The server accepts
      // it only for an activated account (F-101). A failure here does not undo
      // activation; it is said, not hidden (F-048).
      try {
        await saveOnboardingProgress({
          state: 'ACTIVE',
          step: 0,
          answers: {
            businessType: businessType ?? null,
            storeSize: storeSize ?? null,
            defaultCurrency,
            operating: operatingAnswers,
            primaryTradeKey: primaryTradeKey ?? null,
            businessNote: businessNote.trim() ? businessNote.trim() : null,
            savedAt: Date.now(),
          },
        })
      } catch {
        setCompletionNotice(t('onboarding.recovery.draftNotSaved'))
      }

      if (degraded) setCompletionNotice(t('onboarding.recovery.degraded'))
    } catch (error) {
      // Name the failed step and the exact prerequisites — never a generic
      // message hiding partial persistence (F-054/F-055).
      const message = apiErrorMessage(error, '')
      const missing = (error as { missing?: unknown }).missing
      if (message.includes('ONBOARDING_PREREQUISITES_MISSING')) {
        const names = Array.isArray(missing)
          ? missing
              .filter((item): item is string => typeof item === 'string')
              .map((item) => t(PREREQUISITE_KEY[item] ?? 'onboarding.unknownActivity'))
              .join(t('common.listSeparator'))
          : ''
        toast.error(
          names
            ? `${t('onboarding.recovery.prerequisites')} ${names}`
            : t('onboarding.recovery.prerequisites'),
        )
        setCompletionNotice(t('onboarding.recovery.prerequisites'))
      } else if (message.includes('BASE_CURRENCY_LOCKED')) {
        toast.error(tOriginal('onboarding.bookCurrencyLocked'))
      } else if (message.includes('BASE_CURRENCY')) {
        toast.error(tOriginal('onboarding.bookCurrencyFailed'))
      } else if (message.includes('WORKSPACE_NOT_AVAILABLE')) {
        toast.error(tOriginal('onboarding.completionFailed.workspace'))
      } else if (message.includes('BUSINESS_TYPE') || message.includes('WORKSPACE_PROFILE')) {
        toast.error(tOriginal('onboarding.completionFailed.profile'))
      } else if (message.includes('OPERATIONAL')) {
        toast.error(tOriginal('onboarding.completionFailed.dna'))
      } else {
        toast.error(tOriginal('onboarding.saveFailed'))
      }
      return
    } finally {
      inFlight.current = false
      setSubmitting(false)
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
    primaryTradeKey,
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

  // The store setter validates and canonicalises — no `as` cast at the
  // boundary (F-010). An out-of-domain value is refused by the store itself.
  const handleSetBusinessType = useCallback(
    (type: string) => {
      setBusinessType(type)
    },
    [setBusinessType],
  )

  const handleSetStoreSize = useCallback(
    (size: string) => {
      if ((STORE_SIZES as readonly string[]).includes(size)) {
        setStoreSize(size as StoreSize)
      }
    },
    [setStoreSize],
  )

  const handleSetCurrency = useCallback(
    (currency: string) => {
      if (!isSupportedCurrency(currency)) {
        // Unreachable from the picker (catalogue parity is test-guarded); a
        // restored draft with an unsupported code is refused, not coerced.
        toast.error(tOriginal('onboarding.unknownCurrency'))
        return
      }
      const previousDefault = useOnboardingStore.getState().defaultCurrency
      const previousPrimary = useCurrencyStore.getState().primaryCurrency
      setDefaultCurrency(currency as Currency)
      setPrimaryCurrency(currency)
      // ⚠️ AND ON THE SERVER. A refusal rolls the device back to what the
      // books actually use — the local stores must never keep a currency the
      // server refused (F-060/F-061).
      saveBookCurrency.mutate(currency, {
        onError: (error) => {
          useOnboardingStore.getState().setDefaultCurrency(previousDefault)
          useCurrencyStore.getState().setPrimaryCurrency(previousPrimary)
          const message = apiErrorMessage(error, '')
          toast.error(
            message.includes('BASE_CURRENCY_LOCKED')
              ? tOriginal('onboarding.bookCurrencyLocked')
              : tOriginal('onboarding.bookCurrencyFailed'),
          )
        },
      })
    },
    [setDefaultCurrency, setPrimaryCurrency, saveBookCurrency, toast, tOriginal],
  )

  const autosaveNotice =
    autosaveIssue === 'failed'
      ? t('onboarding.autosaveFailed')
      : autosaveIssue === 'unavailable'
        ? t('onboarding.autosaveUnavailable')
        : null

  // A stored profile that no longer parses is SAID, not silently treated as
  // «never configured» (F-099/F-103). Same for unrecognised stored trades.
  const profileDiagnostic = useMemo(() => {
    const view = operational.data
    if (!view) return null
    if (view.dnaInvalid || view.onboardingInvalid) return t('onboarding.recovery.invalidProfile')
    return null
  }, [operational.data, t])

  return (
    <OnboardingPage
      step={step}
      businessType={businessType}
      primaryTradeKey={primaryTradeKey}
      storeSize={storeSize}
      defaultCurrency={defaultCurrency}
      lang={lang}
      t={t}
      salesModelLabel={salesModelLabel}
      tradesLabel={tradesLabel}
      storeSizeLabel={storeSizeLabel}
      currencyLabel={currencyLabel}
      onSetStep={setStep}
      onSetBusinessType={handleSetBusinessType}
      onSetPrimaryTradeKey={setPrimaryTradeKey}
      onSetStoreSize={handleSetStoreSize}
      businessNote={businessNote}
      onSetBusinessNote={setBusinessNote}
      onSetCurrency={handleSetCurrency}
      operatingAnswers={operatingAnswers}
      onSetOperatingAnswer={setOperatingAnswer}
      onComplete={handleComplete}
      submitting={submitting}
      autosaveNotice={autosaveNotice}
      completionNotice={completionNotice ?? profileDiagnostic}
      noteRequired={selectedTrades.includes('other')}
      selectionLimit={MAX_INDUSTRY_SELECTION}
    />
  )
})

OnboardingContainer.displayName = 'OnboardingContainer'
