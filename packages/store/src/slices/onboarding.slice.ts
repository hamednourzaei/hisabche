import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type BusinessType = 'retail' | 'wholesale' | 'service' | 'restaurant' | 'other'
export type StoreSize = 'small' | 'medium' | 'large'

export interface OnboardingState {
  isCompleted: boolean
  step: number
  businessType: BusinessType | null
  storeSize: StoreSize | null
  defaultCurrency: 'AFN' | 'USD' | 'PKR' | 'IRR'
  language: 'fa-AF' | 'en'
  hasAddedProduct: boolean
  hasAddedCustomer: boolean
  hasCreatedInvoice: boolean

  setStep: (step: number) => void
  setBusinessType: (type: BusinessType) => void
  setStoreSize: (size: StoreSize) => void
  setDefaultCurrency: (currency: 'AFN' | 'USD' | 'PKR' | 'IRR') => void
  setLanguage: (lang: 'fa-AF' | 'en') => void
  completeOnboarding: () => void
  markProductAdded: () => void
  markCustomerAdded: () => void
  markInvoiceCreated: () => void
  reset: () => void
}

const initialState = {
  isCompleted: false,
  step: 0,
  businessType: null as BusinessType | null,
  storeSize: null as StoreSize | null,
  defaultCurrency: 'AFN' as const,
  language: 'fa-AF' as const,
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