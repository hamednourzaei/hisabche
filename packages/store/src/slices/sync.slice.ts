import { create } from 'zustand'

interface SyncState {
  lastSyncedAt: number | null
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  autoSaveEnabled: boolean
  lastSavedAt: number | null

  setLastSynced: (timestamp: number) => void
  setOnline: (online: boolean) => void
  setPendingCount: (count: number) => void
  setSyncing: (syncing: boolean) => void
  setAutoSave: (enabled: boolean) => void
  setLastSaved: (timestamp: number) => void
  addPending: () => void
  removePending: () => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastSyncedAt: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  isSyncing: false,
  autoSaveEnabled: true,
  lastSavedAt: null,

  setLastSynced: (timestamp) => set({ lastSyncedAt: timestamp }),
  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setAutoSave: (enabled) => set({ autoSaveEnabled: enabled }),
  setLastSaved: (timestamp) => set({ lastSavedAt: timestamp }),
  addPending: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  removePending: () => set((s) => ({ pendingCount: Math.max(0, s.pendingCount - 1) })),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useSyncStore.getState().setOnline(true))
  window.addEventListener('offline', () => useSyncStore.getState().setOnline(false))
}