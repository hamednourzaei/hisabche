// ============================================
// Hisabche UI — Barrel Exports v6.0
// ============================================

import './styles/lite-mode.css'

// ---------- Utils ----------
export { cn, formatCurrency, formatDate } from './lib/utils'

// ---------- shadcn/ui Components ----------
export { Button, buttonVariants } from './components/ui/button'
export { Input } from './components/ui/input'
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/card'
export { Badge, badgeVariants } from './components/ui/badge'
export { Skeleton } from './components/ui/skeleton'
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from './components/ui/dialog'
export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from './components/ui/sheet'
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from './components/ui/dropdown-menu'
export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator } from './components/ui/select'
export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption } from './components/ui/table'
export { Toaster } from './components/ui/sonner'

// ---------- Feedback ----------
export { Toast, ToastContainer, type ToastProps, type ToastVariant } from './components/ui/toast'
export { SaveIndicator, type SaveIndicatorProps } from './components/ui/save-indicator'
export { Celebration, type CelebrationProps } from './components/ui/celebration'
export { ErrorBoundary } from './components/ui/error-boundary'

// ---------- Navigation (Legacy) ----------
export { DashboardSidebar, BottomNav, type NavItem } from './components/ui/dashboard-sidebar'
export { DashboardHeader } from './components/ui/dashboard-header'
export { CommandPalette } from './components/ui/command-palette'
export { GlassNavbar } from './components/ui/landing-section'

// ---------- ✨ NEW: Enterprise Navigation System ----------
export { NavigationProvider, useNavigation } from './hooks/menu/use-navigation-state'
export { TopNav } from './components/ui/navigation/top-nav'
export { SideNav } from './components/ui/navigation/side-nav'
export { NavigationRegistry } from './components/ui/navigation/navigation-registry'

// ---------- Data Display ----------
export { EmptyState, type EmptyStateProps } from './components/ui/empty-state'
export { StockStatsCard } from './components/ui/stock-stats-card'
export { SyncStatus, type SyncStatusProps } from './components/ui/sync-status'
export { OfflineBanner, type OfflineBannerProps } from './components/ui/offline-banner'
export { OfflineQueue, type OfflineQueueProps } from './components/ui/offline-queue'
export { RealtimeIndicator } from './components/ui/realtime-indicator'
export { LandingPreview } from './components/ui/landing-preview'
export { AnimatedCounter } from './components/ui/landing-section'

// ---------- Forms ----------
export { SearchInput, type SearchInputProps } from './components/ui/search-input'
export { ProductPicker } from './components/ui/product-picker'
export { CustomerPicker } from './components/ui/customer-picker'

// ---------- Layout ----------
export { Section, FeatureCard, SectionHeading } from './components/ui/landing-section'
export { GradientMesh } from './components/ui/landing-section'
export { ShimmerCTA } from './components/ui/landing-section'
export { LivingBackground } from './components/ui/living-background'
export { Fab, type FabAction, type FabProps } from './components/ui/fab'

// ---------- Auth ----------
export { AuthShell } from './components/ui/auth/AuthShell'
export { AuthContainer } from './components/ui/auth/containers/auth-container'

// ---------- Modals ----------
export { Modal } from './components/ui/Modal'
export { AddProductModal } from './components/ui/add-product-modal'
export { AddCustomerModal } from './components/ui/baqidari'
export { PaymentModal } from './components/ui/baqidari'
export { InviteModal } from './components/ui/invite-modal'

// ---------- Pages (Pure UI) ----------
export { BaqidariView, BaqidariSkeleton } from './components/ui/baqidari'
export { BaqidariContainer as BaqidariPage } from './components/ui/baqidari/containers/baqidari-container'
export { GodamView } from './components/ui/godam/godam-view'
export { GodamSkeleton } from './components/ui/godam/godam-skeleton'
export { ProductDetailPage } from './components/ui/godam-detail'
export { InvoicesContainer } from './components/ui/invoices/containers/invoices-container'
export { InvoicesView } from './components/ui/invoices/invoices-view'
export { InvoicesSkeleton } from './components/ui/invoices/invoices-skeleton'
export { InvoiceDetailPage } from './components/ui/invoice-detail/invoice-detail-page'
export { SettingsPage } from './components/ui/settings'
export { QuickInvoicePage } from './components/ui/quick-invoice'
export { SyncCenterPage } from './components/ui/sync-center'
export { WorkspacePage } from './components/ui/workspace'
export { OnboardingPage } from './components/ui/onboarding/onboarding-page'
export { CustomerDetailView } from './components/ui/baqidari'

// ---------- Containers (Logic) ----------
export { DashboardContainer } from './components/ui/dashboard/containers/dashboard-container'
export { GodamContainer } from './components/ui/godam/containers/godam-container'
export { ProductDetailContainer } from './components/ui/godam-detail/containers/godam-detail-container'
export { InvoiceDetailContainer } from './components/ui/invoice-detail/containers/invoice-detail-container'
export { QuickInvoiceContainer } from './components/ui/quick-invoice/containers/quick-invoice-container'
export { SyncCenterContainer } from './components/ui/sync-center/containers/sync-center-container'
export { OnboardingContainer } from './components/ui/onboarding/containers/onboarding-container'

// ---------- Dashboard ----------
export { DashboardView } from './components/ui/dashboard/dashboard-view'
export { StatCard } from './components/ui/dashboard/dashboard-stats'
export { DashboardInvoices } from './components/ui/dashboard/dashboard-invoices'
export { useDashboard } from './hooks/dashboard/use-dashboard'

export type SupportedLanguage = 'fa-AF' | 'fa-IR'