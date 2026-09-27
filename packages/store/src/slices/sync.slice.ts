import { create } from 'zustand'

interface SyncState {
  lastSyncedAt: number | null
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  autoSaveEnabled: boolean
  lastSavedAt: number | null
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'

  setLastSynced: (timestamp: number) => void
  setOnline: (online: boolean) => void
  setPendingCount: (count: number) => void
  setSyncing: (syncing: boolean) => void
  setAutoSave: (enabled: boolean) => void
  setLastSaved: (timestamp: number) => void
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
  addPending: () => void
  removePending: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  lastSyncedAt: null,
  // ⚠️ A constant, not `navigator.onLine`. The server renders with this
  // initial state and hydration compares against it (zustand hands React
  // `getInitialState()` as the server snapshot). Node 22 HAS a global
  // `navigator` — without `onLine` — so the old expression made the server
  // render «offline» while the browser rendered «online»: React #418 on every
  // screen that shows the connection badge (/warehouse?tab=products). The real
  // value is applied right below, on the client only, after the store exists.
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  autoSaveEnabled: true,
  lastSavedAt: null,
  saveStatus: 'idle',

  setLastSynced: (timestamp) => set({ lastSyncedAt: timestamp }),
  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setAutoSave: (enabled) => set({ autoSaveEnabled: enabled }),
  setLastSaved: (timestamp) => set({ lastSavedAt: timestamp, saveStatus: 'saved' }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  addPending: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  removePending: () => set((s) => ({ pendingCount: Math.max(0, s.pendingCount - 1) })),
}))

if (typeof window !== 'undefined') {
  useSyncStore.getState().setOnline(navigator.onLine)
  window.addEventListener('online', () => useSyncStore.getState().setOnline(true))
  window.addEventListener('offline', () => useSyncStore.getState().setOnline(false))
}
