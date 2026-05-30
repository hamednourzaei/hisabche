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
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
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
  window.addEventListener('online', () => useSyncStore.getState().setOnline(true))
  window.addEventListener('offline', () => useSyncStore.getState().setOnline(false))
}