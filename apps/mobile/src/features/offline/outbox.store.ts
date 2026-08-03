// ============================================
// Offline outbox
//
// Every write the user makes while offline is appended here and replayed
// against the real API once connectivity returns. The queue is durable
// (AsyncStorage), ordered, and idempotent per entry via `clientId`.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CreateInvoice } from '@hisabche/validation'

export type OutboxStatus = 'pending' | 'syncing' | 'failed'

export interface OutboxEntry {
  /** Stable client-generated id — also sent to the server for deduplication. */
  clientId: string
  kind: 'invoice.create'
  payload: CreateInvoice
  status: OutboxStatus
  attempts: number
  lastError?: string
  createdAt: string
}

export interface OutboxState {
  entries: OutboxEntry[]
  lastSyncedAt: string | null

  enqueue: (entry: Omit<OutboxEntry, 'status' | 'attempts' | 'createdAt'>) => void
  markSyncing: (clientId: string) => void
  markFailed: (clientId: string, error: string) => void
  remove: (clientId: string) => void
  setLastSyncedAt: (value: string) => void
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set) => ({
      entries: [],
      lastSyncedAt: null,

      enqueue: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, status: 'pending', attempts: 0, createdAt: new Date().toISOString() },
          ],
        })),

      markSyncing: (clientId) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.clientId === clientId ? { ...e, status: 'syncing' } : e
          ),
        })),

      markFailed: (clientId, error) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.clientId === clientId
              ? { ...e, status: 'failed', attempts: e.attempts + 1, lastError: error }
              : e
          ),
        })),

      remove: (clientId) =>
        set((state) => ({ entries: state.entries.filter((e) => e.clientId !== clientId) })),

      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
    }),
    {
      name: 'hisabche.outbox',
      storage: createJSONStorage(() => AsyncStorage),
      // Never persist a transient `syncing` state — a crash mid-flight
      // would otherwise strand the entry forever.
      partialize: (state) => ({
        entries: state.entries.map((e) => (e.status === 'syncing' ? { ...e, status: 'pending' as const } : e)),
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)
