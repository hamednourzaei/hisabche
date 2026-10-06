import { create } from 'zustand'

export interface CustomizerGroupData {
  title?: string
  look: any // To avoid strict coupling with ui package here
  items: { id: string; label: string }[]
  keepOne?: boolean
}

export interface CustomizerState {
  pageGroups: CustomizerGroupData[]
  setPageGroups: (groups: CustomizerGroupData[]) => void
}

export const useCustomizerStore = create<CustomizerState>((set) => ({
  pageGroups: [],
  setPageGroups: (pageGroups) => set({ pageGroups }),
}))
