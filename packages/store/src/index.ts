// ============================================
// Hisabche Store — Barrel Exports
// ============================================

// Auth
export {
  useAuthStore,
  type User,
  type AuthState,
} from './slices/auth.slice'

// Theme
export {
  useThemeStore,
  type ThemeMode,
  type ThemeState,
} from './slices/theme.slice'

// Currency
export {
  useCurrencyStore,
  type CurrencyCode,
  type ExchangeRate,
  type CurrencyState,
} from './slices/currency.slice'

// Cart
export {
  useCartStore,
  type CartItem,
} from './slices/cart.slice'
export { useGodamStore } from './slices/godam.slice'
export { useOnboardingStore } from './slices/onboarding.slice'
export type { BusinessType, StoreSize, OnboardingState } from './slices/onboarding.slice'
export { usePreferencesStore } from './slices/preferences.slice'
export { useSyncStore } from './slices/sync.slice'
export { useDeviceStore } from './slices/device.slice'
export type { PerformanceMode } from './slices/device.slice'
export { useBackupStore } from './slices/backup.slice'
export type { BackupRecord, AuditEntry } from './slices/backup.slice'