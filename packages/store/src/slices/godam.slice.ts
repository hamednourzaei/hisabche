import { create } from 'zustand'

interface GodamState {
  selectedGodamId: string | null
  godamList: { id: string; name: string }[]
  setSelectedGodam: (id: string) => void
  addGodam: (name: string) => void
}

export const useGodamStore = create<GodamState>((set) => ({
  selectedGodamId: null,
  godamList: [{ id: 'default', name: 'گدام اصلی' }],
  setSelectedGodam: (id) => set({ selectedGodamId: id }),
  addGodam: (name) => set((s) => ({ godamList: [...s.godamList, { id: `godam-${Date.now()}`, name }] })),
}))