// packages/store/src/slices/onboarding.slice.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  CURRENCY_CODES,
  MAX_INDUSTRY_SELECTION,
  canonicalIndustryTypes,
  primaryIndustryKeyOf,
  type OperatingAnswers,
  type OperatingQuestion,
  type OperationalDna,
  ARCHETYPE_PRESETS,
  operatingAnswersSchema,
  operationalDnaSchema,
} from '@hisabche/validation'

/**
 * The wizard's selection is a CANONICAL comma-separated serialisation of
 * registry keys — never an opaque blob (forensic audit F-001/F-002/F-016).
 * Every write goes through `canonicalIndustryTypes`: duplicates removed,
 * casing folded, registry order, unknown/legacy refused. The legacy five-value
 * union («retail|wholesale|service|restaurant|other») is gone; the registry in
 * `@hisabche/validation` is the one source of truth.
 */
export type StoreSize = 'solo' | 'small' | 'medium' | 'large'
/**
 * ⚠️ Derived, not restated. Same reasoning as `CurrencyCode` in
 * currency.slice.ts — a second copy of a list is a list that will disagree.
 */
export type Currency = (typeof CURRENCY_CODES)[number]
export type Language = 'fa-AF' | 'en'

/** The wizard has steps 0..5; a restored draft outside that range is clamped. */
const MAX_WIZARD_STEP = 5
const STORE_SIZES: readonly StoreSize[] = ['solo', 'small', 'medium', 'large']

export interface OnboardingState {
  isCompleted: boolean
  /**
   * The account this wizard's answers belong to.
   *
   * ⚠️ THE STATE IS PERSISTED, THE ACCOUNT IS NOT PART OF IT UNLESS IT IS
   * RECORDED. On a shared browser a second signup inherited the first one's
   * «completed» flag and never saw the wizard at all — the cookie-clearing on
   * logout never touched this store. `claimForUser` makes the answer belong to
   * one person: anything left over from someone else is discarded.
   */
  ownerId: string | null
  step: number
  /** Canonical selection serialisation; null until something is selected. */
  businessType: string | null
  primaryTradeKey: string | null
  storeSize: StoreSize | null
  operationalDna: OperationalDna | null
  /** V54 5.3: the adaptive «how do you work» answers; unanswered = the trade's default. */
  operatingAnswers: OperatingAnswers
  defaultCurrency: Currency
  language: Language
  /**
   * The free-text «about your business» note. Persisted here (not in component
   * state) so a refresh keeps it, and autosaved to the workspace draft so a
   * second device keeps it too (forensic audit F-031/F-032).
   */
  businessNote: string
  /** Epoch ms of the last local answer change — recency reconciliation (F-035). */
  savedAt: number | null
  /** Real completion timestamp, not a boolean proxy (F-100/F-109). */
  completedAt: string | null
  hasAddedProduct: boolean
  hasAddedCustomer: boolean
  hasCreatedInvoice: boolean

  setStep: (step: number) => void
  setBusinessType: (selection: string) => void
  setPrimaryTradeKey: (key: string | null) => void
  setStoreSize: (size: StoreSize) => void
  setOperationalDna: (dna: OperationalDna) => void
  setOperatingAnswer: (question: OperatingQuestion, answer: string) => void
  setOperatingAnswers: (answers: OperatingAnswers) => void
  setArchetypePreset: (presetKey: keyof typeof ARCHETYPE_PRESETS) => void
  setDefaultCurrency: (currency: Currency) => void
  setLanguage: (lang: Language) => void
  setBusinessNote: (note: string) => void
  /** Record when the current answers were last saved (device or server draft). */
  markProgressSaved: (at: number) => void
  completeOnboarding: () => void
  markProductAdded: () => void
  markCustomerAdded: () => void
  markInvoiceCreated: () => void
  /** Bind the persisted answers to one account; another account's are discarded. */
  claimForUser: (userId: string) => void
  reset: () => void
}

/** The persisted answers — every field of the state that is not a function. */
type OnboardingData = {
  [
    K in keyof OnboardingState as OnboardingState[K] extends (...args: never[]) => unknown
      ? never
      : K
  ]: OnboardingState[K]
}

const initialState: OnboardingData = {
  isCompleted: false,
  ownerId: null,
  step: 0,
  businessType: null,
  primaryTradeKey: null,
  storeSize: null,
  operationalDna: null,
  operatingAnswers: {},
  // Nothing is chosen for the person: the wizard's button stays disabled
  // until they pick, and what they pick becomes the books currency.
  defaultCurrency: '' as Currency,
  language: 'fa-AF',
  businessNote: '',
  savedAt: null,
  completedAt: null,
  hasAddedProduct: false,
  hasAddedCustomer: false,
  hasCreatedInvoice: false,
}

const clampStep = (step: unknown): number =>
  typeof step === 'number' && Number.isSafeInteger(step)
    ? Math.min(Math.max(step, 0), MAX_WIZARD_STEP)
    : 0

/** Canonical selection serialisation, or null when nothing recognisable remains. */
const canonicalSelection = (input: string): string | null => {
  const { known } = canonicalIndustryTypes(input)
  return known.length > 0 ? known.join(',') : null
}

const isStoreSize = (value: unknown): value is StoreSize =>
  typeof value === 'string' && (STORE_SIZES as readonly string[]).includes(value)

const isCurrency = (value: unknown): value is Currency =>
  typeof value === 'string' && (CURRENCY_CODES as readonly string[]).includes(value)

/**
 * Upgrade a persisted payload from any older version (forensic audit F-014).
 * v1 stored the raw wizard string and had no note/recency/completion fields.
 * Anything out of domain is dropped rather than trusted; the owner binding and
 * the first-value flags survive. A corrupt payload becomes the initial state.
 */
function migrateOnboarding(persisted: unknown): OnboardingData {
  if (typeof persisted !== 'object' || persisted === null) return { ...initialState }
  const raw = persisted as Record<string, unknown>
  // Every re-hydration validates: localStorage is a trust boundary. v1 payloads
  // lack note/recency/completion fields and may carry the legacy raw selection
  // string; `sanitizePersisted` canonicalises or drops each field.
  return sanitizePersisted(raw, { ...initialState })
}

function sanitizePersisted(raw: Record<string, unknown>, base: OnboardingData): OnboardingData {
  const next: OnboardingData = { ...base }
  if (typeof raw.ownerId === 'string') next.ownerId = raw.ownerId
  if (typeof raw.isCompleted === 'boolean') next.isCompleted = raw.isCompleted
  next.step = clampStep(raw.step)
  if (typeof raw.businessType === 'string') {
    next.businessType = canonicalSelection(raw.businessType)
  }
  if (typeof raw.primaryTradeKey === 'string' && next.businessType) {
    const explicit = canonicalIndustryTypes([raw.primaryTradeKey]).known[0]
    next.primaryTradeKey =
      explicit && next.businessType.split(',').includes(explicit) ? explicit : null
  }
  if (isStoreSize(raw.storeSize)) next.storeSize = raw.storeSize
  if (isCurrency(raw.defaultCurrency)) next.defaultCurrency = raw.defaultCurrency
  if (raw.language === 'fa-AF' || raw.language === 'en') next.language = raw.language
  const answers = operatingAnswersSchema.safeParse(raw.operatingAnswers)
  if (answers.success) next.operatingAnswers = answers.data
  const dna = operationalDnaSchema.safeParse(raw.operationalDna)
  if (dna.success) next.operationalDna = dna.data
  if (typeof raw.businessNote === 'string') next.businessNote = raw.businessNote.slice(0, 2000)
  if (typeof raw.savedAt === 'number' && Number.isSafeInteger(raw.savedAt) && raw.savedAt >= 0) {
    next.savedAt = raw.savedAt
  }
  if (typeof raw.completedAt === 'string' && raw.completedAt.length > 0) {
    next.completedAt = raw.completedAt
  }
  if (typeof raw.hasAddedProduct === 'boolean') next.hasAddedProduct = raw.hasAddedProduct
  if (typeof raw.hasAddedCustomer === 'boolean') next.hasAddedCustomer = raw.hasAddedCustomer
  if (typeof raw.hasCreatedInvoice === 'boolean') next.hasCreatedInvoice = raw.hasCreatedInvoice
  // A v1 «completed» flag without a timestamp gets one now, so the offline
  // decision carries a real instant instead of a boolean proxy.
  if (next.isCompleted && !next.completedAt) next.completedAt = new Date().toISOString()
  return next
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ step: clampStep(step) }),
      setBusinessType: (selection) => {
        const canonical = canonicalIndustryTypes(selection)
        // Unknown/legacy values are refused, not stored and trusted later —
        // the same rule both server writes apply (F-007/F-018).
        if (canonical.unknown.length > 0 || canonical.legacy.length > 0) return
        if (canonical.known.length > MAX_INDUSTRY_SELECTION) return
        const businessType = canonical.known.length > 0 ? canonical.known.join(',') : null
        // Removing the selected primary replaces it deterministically by the
        // ONE canonical rule — never a stale key naming a deselected trade (F-006).
        const currentPrimary = get().primaryTradeKey
        const primaryTradeKey =
          currentPrimary && businessType?.split(',').includes(currentPrimary)
            ? currentPrimary
            : primaryIndustryKeyOf(businessType)
        set({ businessType, primaryTradeKey, savedAt: Date.now() })
      },
      setPrimaryTradeKey: (key) => {
        if (key === null) {
          set({ primaryTradeKey: null })
          return
        }
        const selection = get().businessType
        const canonical = canonicalIndustryTypes([key]).known[0]
        if (!canonical || !selection?.split(',').includes(canonical)) return
        set({ primaryTradeKey: canonical })
      },
      setStoreSize: (storeSize) => set({ storeSize, step: 3, savedAt: Date.now() }),
      setOperationalDna: (operationalDna) => set({ operationalDna }),
      setOperatingAnswer: (question, answer) => {
        // The shared schema decides what an answer may be; anything else is
        // refused here rather than stored and trusted later.
        const next = operatingAnswersSchema.safeParse({
          ...get().operatingAnswers,
          [question]: answer,
        })
        if (next.success) set({ operatingAnswers: next.data, savedAt: Date.now() })
      },
      setOperatingAnswers: (operatingAnswers) => {
        // The bulk path validates exactly like the single-answer path (F-023).
        const next = operatingAnswersSchema.safeParse(operatingAnswers)
        if (next.success) set({ operatingAnswers: next.data, savedAt: Date.now() })
      },
      setArchetypePreset: (presetKey) => {
        const preset = ARCHETYPE_PRESETS[presetKey]
        // A preset is applied only if it satisfies the shared schema (F-025).
        const parsed = operationalDnaSchema.safeParse(preset)
        if (parsed.success) set({ operationalDna: parsed.data })
      },
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency, savedAt: Date.now() }),
      setLanguage: (language) => set({ language }),
      setBusinessNote: (note) => set({ businessNote: note.slice(0, 2000), savedAt: Date.now() }),
      markProgressSaved: (at) => set({ savedAt: at }),
      completeOnboarding: () =>
        set({ isCompleted: true, completedAt: new Date().toISOString(), step: 0 }),
      markProductAdded: () => set({ hasAddedProduct: true }),
      markCustomerAdded: () => set({ hasAddedCustomer: true }),
      markInvoiceCreated: () => set({ hasCreatedInvoice: true }),
      claimForUser: (userId) => {
        // Same person: keep what they chose. Someone else: the wizard is not
        // theirs to inherit — reset, but bind the fresh state to them.
        if (get().ownerId === userId) return
        set({ ...initialState, ownerId: userId })
      },
      // The owner survives a reset: `reset` clears the ANSWERS, not the fact
      // that this store now belongs to the signed-in account.
      reset: () => set((state) => ({ ...initialState, ownerId: state.ownerId })),
    }),
    {
      name: 'hisabche-onboarding',
      version: 2,
      migrate: (persisted) => migrateOnboarding(persisted),
      partialize: (state): OnboardingData => ({
        isCompleted: state.isCompleted,
        ownerId: state.ownerId,
        step: state.step,
        businessType: state.businessType,
        primaryTradeKey: state.primaryTradeKey,
        storeSize: state.storeSize,
        operationalDna: state.operationalDna,
        operatingAnswers: state.operatingAnswers,
        defaultCurrency: state.defaultCurrency,
        language: state.language,
        businessNote: state.businessNote,
        savedAt: state.savedAt,
        completedAt: state.completedAt,
        hasAddedProduct: state.hasAddedProduct,
        hasAddedCustomer: state.hasAddedCustomer,
        hasCreatedInvoice: state.hasCreatedInvoice,
      }),
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          return localStorage
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
    },
  ),
)
