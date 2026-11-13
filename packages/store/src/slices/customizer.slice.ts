import { create } from 'zustand'

/**
 * The part of a page's look (`PageLook` in @hisabche/ui) the customizer uses — named here so
 * the store does not depend on the ui package.
 */
export interface CustomizerLook {
  ready: boolean
  shows: (id: string) => boolean
  toggle: (id: string) => void
  reset: () => void
}

export interface CustomizerGroupData {
  title?: string
  look: CustomizerLook
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
