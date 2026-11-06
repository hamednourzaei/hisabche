// packages/store/src/slices/onboarding.slice.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CURRENCY_CODES, type OperationalDna, ARCHETYPE_PRESETS } from '@hisabche/validation'

export type BusinessType = 'retail' | 'wholesale' | 'service' | 'restaurant' | 'other'
export type StoreSize = 'small' | 'medium' | 'large'
/**
 * ⚠️ Derived, not restated. Same reasoning as `CurrencyCode` in
 * currency.slice.ts — a second copy of a list is a list that will disagree.
 */
export type Currency = (typeof CURRENCY_CODES)[number]
export type Language = 'fa-AF' | 'en'

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
  businessType: BusinessType | null
  storeSize: StoreSize | null
  operationalDna: OperationalDna | null
  defaultCurrency: Currency
  language: Language
  hasAddedProduct: boolean
  hasAddedCustomer: boolean
  hasCreatedInvoice: boolean

  setStep: (step: number) => void
  setBusinessType: (type: BusinessType) => void
  setStoreSize: (size: StoreSize) => void
  setOperationalDna: (dna: OperationalDna) => void
  setArchetypePreset: (presetKey: keyof typeof ARCHETYPE_PRESETS) => void
  setDefaultCurrency: (currency: Currency) => void
  setLanguage: (lang: Language) => void
  completeOnboarding: () => void
  markProductAdded: () => void
  markCustomerAdded: () => void
  markInvoiceCreated: () => void
  /** Bind the persisted answers to one account; another account's are discarded. */
  claimForUser: (userId: string) => void
  reset: () => void
}

const initialState: Omit<
  OnboardingState,
  keyof {
    setStep: any
    setBusinessType: any
    setStoreSize: any
    setOperationalDna: any
    setArchetypePreset: any
    setDefaultCurrency: any
    setLanguage: any
    completeOnboarding: any
    markProductAdded: any
    markCustomerAdded: any
    markInvoiceCreated: any
    claimForUser: any
    reset: any
  }
> = {
  isCompleted: false,
  ownerId: null,
  step: 0,
  businessType: null,
  storeSize: null,
  operationalDna: null,
  // Nothing is chosen for the person: the wizard's button stays disabled
  // until they pick, and what they pick becomes the books currency.
  defaultCurrency: '' as Currency,
  language: 'fa-AF',
  hasAddedProduct: false,
  hasAddedCustomer: false,
  hasCreatedInvoice: false,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ step }),
      setBusinessType: (businessType) => set({ businessType, step: 2 }),
      setStoreSize: (storeSize) => set({ storeSize, step: 3 }),
      setOperationalDna: (operationalDna) => set({ operationalDna }),
      setArchetypePreset: (presetKey) => {
        const preset = ARCHETYPE_PRESETS[presetKey]
        if (preset) {
          set({ operationalDna: preset })
        }
      },
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
      setLanguage: (language) => set({ language }),
      completeOnboarding: () => set({ isCompleted: true, step: 0 }),
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
