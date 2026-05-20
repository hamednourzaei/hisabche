// ============================================
// Hisabche UI — Barrel Exports
// ============================================

import './styles/lite-mode.css'

// ---------- Utils ----------
export { cn, formatCurrency, formatDate } from './lib/utils'

// ---------- Components ----------
export { Button, buttonVariants, type ButtonProps } from './components/ui/button'
export { Input, type InputProps } from './components/ui/input'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui/card'
export { Badge, badgeVariants, type BadgeProps } from './components/ui/badge'
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  type SkeletonProps,
} from './components/ui/skeleton'
export { Toast, ToastContainer, type ToastProps, type ToastVariant } from './components/ui/toast'
export { SearchInput, type SearchInputProps } from './components/ui/search-input'
export { Fab, type FabAction, type FabProps } from './components/ui/fab'
export { SyncStatus, type SyncStatusProps } from './components/ui/sync-status'
export { OfflineBanner, type OfflineBannerProps } from './components/ui/offline-banner'
export { SaveIndicator, type SaveIndicatorProps } from './components/ui/save-indicator'
export { OfflineQueue, type OfflineQueueProps } from './components/ui/offline-queue'
export { EmptyState, type EmptyStateProps } from './components/ui/empty-state'
export { Celebration, type CelebrationProps } from './components/ui/celebration'
export { ErrorBoundary } from './components/ui/error-boundary'
export { DashboardSidebar, BottomNav, type NavItem } from './components/ui/dashboard-sidebar'
export { DashboardHeader } from './components/ui/dashboard-header'
export { ProductPicker } from "./components/ui/product-picker"
export { CustomerPicker } from "./components/ui/customer-picker"
export type SupportedLanguage = 'fa-AF' | 'fa-IR'
export { AddProductModal } from "./components/ui/add-product-modal"
export { StockStatsCard } from "./components/ui/stock-stats-card"
export { LandingPreview } from "./components/ui/landing-preview"
export {
  AnimatedCounter, GradientMesh, GlassNavbar, ShimmerCTA,
  Section, FeatureCard, SectionHeading,
} from "./components/ui/landing-section"