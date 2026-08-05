// ============================================
// @hisabche/mobile-ui — mobile design system.
// Tokens derive from the production web system (globals.css v3.1).
// ============================================

// Tokens
export * from './tokens/colors'
export * from './tokens/layout'
export * from './tokens/typography'

// Theme
export { ThemeProvider, useTheme, type Theme, type ThemeMode } from './theme/theme-provider'

// Text & numbers
export { Text, type TextProps, type TextTone } from './components/text'
export { Money, type MoneyProps, type MoneySize } from './components/money'

// Surfaces
export { Screen, type ScreenProps } from './components/screen'
export { MobileCard, type MobileCardProps, type CardVariant } from './components/mobile-card'
export { BottomSheet, type BottomSheetProps } from './components/bottom-sheet'
export { ActionSheet, type ActionSheetProps, type ActionSheetItem } from './components/action-sheet'

// Metrics
export { HeroMetricCard, type HeroMetricCardProps } from './components/hero-metric-card'
export { MetricCard, type MetricCardProps } from './components/metric-card'
export { TrendPill, type TrendPillProps } from './components/trend-pill'
export { Sparkline, type SparklineProps } from './components/sparkline'

// Controls
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/button'
export { Input, type InputProps } from './components/input'
export { SearchBar, type SearchBarProps } from './components/search-bar'
export { FilterBar, type FilterBarProps, type FilterOption } from './components/filter-bar'
export { QuickAction, type QuickActionProps } from './components/quick-action'
export { FloatingButton, type FloatingButtonProps } from './components/floating-button'
export { SwipeRow, type SwipeRowProps, type SwipeAction } from './components/swipe-row'

// Indicators
export { Badge, badgePalette, type BadgeProps, type BadgeTone } from './components/badge'
export { StatusChip, type StatusChipProps } from './components/status-chip'
export { Avatar, type AvatarProps } from './components/avatar'
export { Skeleton, type SkeletonProps } from './components/skeleton'
export { OfflineBanner, type OfflineBannerProps } from './components/offline-banner'

// Structure & states
export { SectionHeader, type SectionHeaderProps } from './components/section-header'
export { EmptyState, type EmptyStateProps } from './components/empty-state'
export { ErrorState, type ErrorStateProps } from './components/error-state'
