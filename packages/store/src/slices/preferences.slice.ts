import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { setMetalDisplayUnit, type MetalUnit } from '@hisabche/formatting'

interface PreferencesState {
  lastCurrency: string
  lastCustomer: string | null
  lastCustomerId: string | null
  lastTaxRate: number
  lastPaymentMethod: string
  recentProducts: string[]
  frequentProducts: string[]
  /**
   * The unit metals are SHOWN and TYPED in (g / kg / t). The books stay in
   * grams; formatting converts both ways (formatting/metal-unit.ts).
   */
  metalUnit: MetalUnit

  setMetalUnit: (unit: MetalUnit) => void
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
      // Empty until the person picks one: the books currency is the server's.
      lastCurrency: '',
      lastCustomer: null,
      lastCustomerId: null,
      lastTaxRate: 0,
      lastPaymentMethod: 'cash',
      recentProducts: [],
      frequentProducts: [],
      metalUnit: 'g',

      setMetalUnit: (unit) => {
        setMetalDisplayUnit(unit)
        set({ metalUnit: unit })
      },
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
      // The formatter learns the stored unit as soon as it is read back.
      onRehydrateStorage: () => (state) => {
        if (state?.metalUnit) setMetalDisplayUnit(state.metalUnit)
      },
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
          return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
    },
  ),
)
