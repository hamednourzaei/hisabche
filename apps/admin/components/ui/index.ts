// ============================================
// Admin UI surface.
//
// Re-exports `@hisabche/ui` rather than owning copies. This directory used to
// hold duplicated Button/Card/Input/Badge/AuthShell/sidebar files; they had
// already drifted — the local Button dropped `@radix-ui/react-slot` and
// silently ignored `asChild`, so composed buttons rendered the wrong element.
// That drift is exactly why the admin login stopped looking like the main app.
//
// Keeping this barrel (instead of importing `@hisabche/ui` everywhere) means
// existing `@/components/ui` imports keep working, and there is one obvious
// place to look if the admin ever genuinely needs its own variant.
// ============================================

export {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  DashboardSidebar,
  BottomNav,
  DashboardHeader,
  TopNav,
  NotificationBell,
} from '@hisabche/ui'

export type { ButtonVariant, ButtonSize, NavItem } from '@hisabche/ui'
