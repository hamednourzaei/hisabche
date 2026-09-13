import { create } from 'zustand'
import { setOnSubscriptionExpired } from '@hisabche/api'

// ============================================
// The subscription lock notice.
//
// Raised when the server refuses a write with 402 SUBSCRIPTION_EXPIRED (wired
// below, the same way auth.slice wires setOnUnauthorized). It only controls
// whether the lock DIALOG is showing. Whether a page is gated is decided from
// the server's `access.expired` on GET /billing/subscription — a flag in the
// browser is never the authority on what a business may do.
// ============================================

export interface SubscriptionLockState {
  noticeOpen: boolean
  openNotice: () => void
  closeNotice: () => void
}

export const useSubscriptionLockStore = create<SubscriptionLockState>((set) => ({
  noticeOpen: false,
  openNotice: () => set({ noticeOpen: true }),
  closeNotice: () => set({ noticeOpen: false }),
}))

if (typeof window !== 'undefined') {
  setOnSubscriptionExpired(() => useSubscriptionLockStore.getState().openNotice())
}
