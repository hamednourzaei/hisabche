// ============================================
// packages/app-shell/src/features/sync/sync-identity.ts
//
// Re-export shared identity helper from @hisabche/sync
// ============================================

export {
  deriveStableBatchId,
  getPersistentDeviceId,
  getPersistentDeviceIdAsync,
  type DeviceIdStorage,
  type AsyncDeviceIdStorage,
} from '@hisabche/sync'
