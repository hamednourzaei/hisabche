// ============================================
// apps/desktop/electron/main/packs.ts
//
// V62 Slice 8 — Desktop feature-pack store & flag gate.
// Flags default OFF: `packs.delivery=off`, `packs.installer=full`.
// ============================================

import { app } from 'electron'
import { PackStore } from '@hisabche/app-bridge/packs-node'

export type DesktopPackDeliveryMode = 'off' | 'on'
export type DesktopInstallerVariant = 'full' | 'core'

export function getPackDeliveryMode(): DesktopPackDeliveryMode {
  return process.env.HISABCHE_PACKS_DELIVERY === 'on' ? 'on' : 'off'
}

export function getInstallerVariant(): DesktopInstallerVariant {
  return process.env.HISABCHE_PACKS_INSTALLER === 'core' ? 'core' : 'full'
}

export function isPackDeliveryEnabled(): boolean {
  return getPackDeliveryMode() === 'on'
}

let cachedStore: PackStore | null = null

export function getDesktopPackStore(): PackStore {
  if (!cachedStore) {
    cachedStore = new PackStore(app.getPath('userData'))
    cachedStore.cleanupInterruptedStaging()
  }
  return cachedStore
}
