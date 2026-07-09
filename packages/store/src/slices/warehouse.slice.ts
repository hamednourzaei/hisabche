import { create } from 'zustand'

interface WarehouseState {
  selectedGodamId: string | null
  warehouseList: { id: string; name: string }[]
  setSelectedWarehouse: (id: string) => void
  addWarehouse: (name: string) => void
}

export const useWarehouseStore = create<WarehouseState>((set) => ({
  selectedGodamId: null,
  warehouseList: [{ id: 'default', name: 'گدام اصلی' }],
  setSelectedWarehouse: (id) => set({ selectedGodamId: id }),
  addWarehouse: (name) => set((s) => ({ warehouseList: [...s.warehouseList, { id: `warehouse-${Date.now()}`, name }] })),
}))