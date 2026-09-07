// packages/store/src/slices/onboarding.slice.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CURRENCY_CODES } from '@hisabche/validation'

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
  step: number
  businessType: BusinessType | null
  storeSize: StoreSize | null
  defaultCurrency: Currency
  language: Language
  hasAddedProduct: boolean
  hasAddedCustomer: boolean
  hasCreatedInvoice: boolean

  setStep: (step: number) => void
  setBusinessType: (type: BusinessType) => void
  setStoreSize: (size: StoreSize) => void
  setDefaultCurrency: (currency: Currency) => void
  setLanguage: (lang: Language) => void
  completeOnboarding: () => void
  markProductAdded: () => void
  markCustomerAdded: () => void
  markInvoiceCreated: () => void
  reset: () => void
}

const initialState: Omit<
  OnboardingState,
  keyof {
    setStep: any
    setBusinessType: any
    setStoreSize: any
    setDefaultCurrency: any
    setLanguage: any
    completeOnboarding: any
    markProductAdded: any
    markCustomerAdded: any
    markInvoiceCreated: any
    reset: any
  }
> = {
  isCompleted: false,
  step: 0,
  businessType: null,
  storeSize: null,
  defaultCurrency: 'AFN',
  language: 'fa-AF',
  hasAddedProduct: false,
  hasAddedCustomer: false,
  hasCreatedInvoice: false,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ step }),
      setBusinessType: (businessType) => set({ businessType, step: 2 }),
      setStoreSize: (storeSize) => set({ storeSize, step: 3 }),
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
      setLanguage: (language) => set({ language }),
      completeOnboarding: () => set({ isCompleted: true, step: 0 }),
      markProductAdded: () => set({ hasAddedProduct: true }),
      markCustomerAdded: () => set({ hasAddedCustomer: true }),
      markInvoiceCreated: () => set({ hasCreatedInvoice: true }),
      reset: () => set(initialState),
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
