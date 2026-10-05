import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface PreferencesState {
  lastCurrency: string
  lastCustomer: string | null
  lastCustomerId: string | null
  lastTaxRate: number
  lastPaymentMethod: string
  recentProducts: string[]
  frequentProducts: string[]

  setLastCurrency: (currency: string) => void
  setLastCustomer: (name: string, id: string) => void
  setLastTaxRate: (rate: number) => void
  setLastPaymentMethod: (method: string) => void
  addRecentProduct: (product: string) => void
  addFrequentProduct: (product: string) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      lastCurrency: 'AFN',
      lastCustomer: null,
      lastCustomerId: null,
      lastTaxRate: 0,
      lastPaymentMethod: 'cash',
      recentProducts: [],
      frequentProducts: [],

      setLastCurrency: (currency) => set({ lastCurrency: currency }),
      setLastCustomer: (name, id) => set({ lastCustomer: name, lastCustomerId: id }),
      setLastTaxRate: (rate) => set({ lastTaxRate: rate }),
      setLastPaymentMethod: (method) => set({ lastPaymentMethod: method }),

      addRecentProduct: (product) => {
        const recent = [product, ...get().recentProducts.filter((p) => p !== product)].slice(0, 10)
        set({ recentProducts: recent })
      },

      addFrequentProduct: (product) => {
        const current = get().frequentProducts
        const existing = current.find((p) => p === product)
        if (!existing) {
          set({ frequentProducts: [...current, product].slice(0, 8) })
        }
      },
    }),
    {
      name: 'hisabche-preferences',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
          return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
    },
  ),
)
