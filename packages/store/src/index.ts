// ============================================
// Hisabche Store — Barrel Exports
// ============================================

// Auth
export { useAuthStore, type User, type AuthState } from './slices/auth.slice'

// Theme
export { useThemeStore, type ThemeMode, type ThemeState } from './slices/theme.slice'

// Currency
export {
  useCurrencyStore,
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type ExchangeRate,
  type CurrencyState,
} from './slices/currency.slice'

// Cart
export { useCartStore, type CartItem } from './slices/cart.slice'
export { useWarehouseStore } from './slices/warehouse.slice'
// packages/store/src/index.ts
export * from './slices/onboarding.slice'
export type { BusinessType, StoreSize, Currency, Language } from './slices/onboarding.slice'
export { usePreferencesStore } from './slices/preferences.slice'
export { useSyncStore } from './slices/sync.slice'
export { useDeviceStore } from './slices/device.slice'
export type { PerformanceMode } from './slices/device.slice'
export {
  useBackupStore,
  type BackupRecord,
  type AuditEntry,
  type DeletedItem,
} from './slices/backup.slice'
export {
  useWorkspaceStore,
  type WorkspaceRole,
  type WorkspaceMember,
  type WorkspaceInvite,
} from './slices/workspace.slice'
