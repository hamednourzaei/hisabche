// ============================================
// Hisabche UI — Barrel Exports
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

// ---------- Custom Components (unchanged) ----------
export { Toast, ToastContainer, type ToastProps, type ToastVariant } from './components/ui/toast'
export { SearchInput, type SearchInputProps } from './components/ui/search-input'
export { Fab, type FabAction, type FabProps } from './components/ui/fab'
export { SyncStatus, type SyncStatusProps } from './components/ui/sync-status'
export { OfflineBanner, type OfflineBannerProps } from './components/ui/offline-banner'
export { SaveIndicator, type SaveIndicatorProps } from "./components/ui/save-indicator"
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
export { AnimatedCounter, GradientMesh, GlassNavbar, ShimmerCTA, Section, FeatureCard, SectionHeading } from "./components/ui/landing-section"
export { LivingBackground } from "./components/ui/living-background"
export { default as AuthShell } from "./components/ui/auth/AuthShell"

// ---------- Baqidari Feature ----------
export { BaqidariPage } from "./components/ui/baqidari"
export { AddCustomerModal } from "./components/ui/baqidari"
export { PaymentModal } from "./components/ui/baqidari"
export { CustomerDetailView } from "./components/ui/baqidari"

// ---------- Shared Components ----------
export { Modal } from "./components/ui/Modal"
// ---------- Quick Invoice ----------
export { QuickInvoicePage } from "./components/ui/quick-invoice"
export { GodamPage } from "./components/ui/godam"
export { ProductDetailPage } from "./components/ui/godam-detail"
export { InvoicesPage } from "./components/ui/invoices"
export { InvoiceDetailPage } from "./components/ui/invoice-detail"
export { SettingsPage } from "./components/ui/settings"
export { DashboardPage } from "./components/ui/dashboard"
export { CommandPalette } from "./components/ui/command-palette"
export { SyncCenterPage } from "./components/ui/sync-center"
// ---------- Workspace ----------
export { WorkspacePage } from "./components/ui/workspace"
export { InviteModal } from "./components/ui/invite-modal"
export { RealtimeIndicator } from "./components/ui/realtime-indicator"