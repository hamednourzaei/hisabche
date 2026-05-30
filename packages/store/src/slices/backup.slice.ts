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

export interface DeletedItem {
  id: string
  entity: string
  entityId: string
  data: string
  deletedAt: number
  restored: boolean
}

interface BackupState {
  backups: BackupRecord[]
  lastBackupAt: number | null
  autoBackupEnabled: boolean
  auditLog: AuditEntry[]
  trashBin: DeletedItem[]
  exportData: () => string
  getAuditLog: () => AuditEntry[]
  setAutoBackup: (enabled: boolean) => void
  addBackup: (backup: BackupRecord) => void
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void
  moveToTrash: (item: Omit<DeletedItem, 'id' | 'deletedAt' | 'restored'>) => void
  restoreFromTrash: (id: string) => DeletedItem | undefined
  emptyTrash: () => void
  getTrashItems: () => DeletedItem[]
  createBackup: () => BackupRecord
  scheduleAutoBackup: () => void
  exportAllData: () => string
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set, get) => ({
      backups: [],
      lastBackupAt: null,
      autoBackupEnabled: true,
      auditLog: [],
      trashBin: [],

      setAutoBackup: (enabled) => {
        set({ autoBackupEnabled: enabled })
        if (enabled) get().scheduleAutoBackup()
      },

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

      moveToTrash: (item) =>
        set((s) => ({
          trashBin: [
            { ...item, id: `trash-${Date.now()}`, deletedAt: Date.now(), restored: false },
            ...s.trashBin,
          ].slice(0, 100),
          auditLog: [
            {
              id: `audit-${Date.now()}`,
              timestamp: Date.now(),
              action: 'delete',
              entity: item.entity,
              entityId: item.entityId,
              details: `حذف ${item.entity}: ${item.entityId}`,
            },
            ...s.auditLog,
          ].slice(0, 200),
        })),

      restoreFromTrash: (id) => {
        const item = get().trashBin.find((i) => i.id === id)
        if (!item || item.restored) return undefined
        set((s) => ({
          trashBin: s.trashBin.map((i) => (i.id === id ? { ...i, restored: true } : i)),
          auditLog: [
            {
              id: `audit-${Date.now()}`,
              timestamp: Date.now(),
              action: 'restore',
              entity: item.entity,
              entityId: item.entityId,
              details: `بازیابی ${item.entity}: ${item.entityId}`,
            },
            ...s.auditLog,
          ].slice(0, 200),
        }))
        return item
      },

      emptyTrash: () => set((s) => ({ trashBin: s.trashBin.filter((i) => i.restored) })),

      getTrashItems: () => get().trashBin.filter((i) => !i.restored),

      createBackup: () => {
  const state = get()
  
  // ═══ جمع‌آوری همه دیتا از localStorage ═══
  const allData: Record<string, unknown> = {}
  
  // همه کلیدهای hisabche-* رو جمع کن
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('hisabche-')) {
        try {
          allData[key] = JSON.parse(localStorage.getItem(key) || '')
        } catch {
          allData[key] = localStorage.getItem(key)
        }
      }
    }
  }
  
  const exportPayload = {
    backups: state.backups,
    auditLog: state.auditLog,
    trashBin: state.trashBin,
    allData, // ✅ کل دیتای برنامه
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }
  
  const data = JSON.stringify(exportPayload)
  const sizeKB = Math.floor(new Blob([data]).size / 1024)
  
  const backup: BackupRecord = {
    id: `backup-${Date.now()}`,
    timestamp: Date.now(),
    size: sizeKB > 0 ? `${sizeKB} KB` : '< 1 KB',
    type: 'auto',
    status: 'completed',
  }
  
  // ذخیره خود backup توی localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(`hisabche-backup-${backup.id}`, data)
  }
  
  return backup
},
      scheduleAutoBackup: () => {
        if (typeof window === 'undefined') return
        const runBackup = () => {
          const { autoBackupEnabled, createBackup, addBackup } = get()
          if (autoBackupEnabled) {
            const backup = createBackup()
            addBackup(backup)
          }
        }
        // هر ۲۴ ساعت
        setInterval(runBackup, 24 * 60 * 60 * 1000)
        // اولین backup بعد از ۵ دقیقه
        setTimeout(runBackup, 5 * 60 * 1000)
      },

      exportAllData: () => {
        const state = get()
        return JSON.stringify(
          {
            backups: state.backups,
            auditLog: state.auditLog,
            trashBin: state.trashBin,
            exportedAt: new Date().toISOString(),
            version: '1.0',
          },
          null,
          2,
        )
      },

      exportData: () => {
        const state = get()
        return JSON.stringify(
          { backups: state.backups, auditLog: state.auditLog, exportedAt: new Date().toISOString() },
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