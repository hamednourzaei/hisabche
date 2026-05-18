import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface BackupRecord {
  id: string
  timestamp: number
  size: string
  type: 'auto' | 'manual'
  status: 'completed' | 'failed'
}

export interface AuditEntry {
  id: string
  timestamp: number
  action: string
  entity: string
  entityId: string
  details: string
}

interface BackupState {
  backups: BackupRecord[]
  lastBackupAt: number | null
  autoBackupEnabled: boolean
  auditLog: AuditEntry[]

  setAutoBackup: (enabled: boolean) => void
  addBackup: (backup: BackupRecord) => void
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void
  exportData: () => string
  getAuditLog: () => AuditEntry[]
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set, get) => ({
      backups: [],
      lastBackupAt: null,
      autoBackupEnabled: true,
      auditLog: [],

      setAutoBackup: (enabled) => set({ autoBackupEnabled: enabled }),

      addBackup: (backup) =>
        set((s) => ({
          backups: [backup, ...s.backups].slice(0, 50),
          lastBackupAt: backup.timestamp,
        })),

      addAuditEntry: (entry) =>
        set((s) => ({
          auditLog: [
            { ...entry, id: `audit-${Date.now()}`, timestamp: Date.now() },
            ...s.auditLog,
          ].slice(0, 200),
        })),

      exportData: () => {
        const state = get()
        return JSON.stringify(
          {
            backups: state.backups,
            auditLog: state.auditLog,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        )
      },

      getAuditLog: () => get().auditLog,
    }),
    {
      name: 'hisabche-backup',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
    },
  ),
)