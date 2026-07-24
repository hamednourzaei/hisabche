// packages/ui/src/components/ui/activity/index.ts
// ─── Activity Design System ────────────────────────────────────────────────

export { ActivityCenter } from "./ActivityCenter";
export { ActivitiesPage } from "./ActivitiesPage";
export { ActivityItem } from "./ActivityItem";
export { ActivityTimeline } from "./ActivityTimeline";
export { EntityActivityCard } from "./EntityActivityCard";
export { ActivityHeader } from "./ActivityHeader";
export { ActivityFooter } from "./ActivityFooter";
export { ActivitySkeleton } from "./ActivitySkeleton";
export { ActivityEmptyState } from "./ActivityEmptyState";
export { ActivityToolbar } from "./ActivityToolbar";
export { VirtualizedActivityList } from "./VirtualizedActivityList";
export { ActivityMotion } from "./ActivityMotion";
export { ActivityPreview } from "./ActivityPreview";
export { CommandPalette } from "./CommandPalette";
export { KeyboardNavigator } from "./KeyboardNavigator";
export { AccessibleCard } from "./AccessibleCard";
export { SyncStatus } from "./SyncStatus";
export { RealtimeStatus } from "./RealtimeStatus";

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  ActivityItemDto,
  ActivityGroupDto,
  EntitySummaryDto,
} from "@hisabche/api";

// ─── Hooks ──────────────────────────────────────────────────────────────────
export { useActivityAnalytics } from "../../../hooks/activity/useActivityAnalytics";
export { useActivityKeyboard } from "../../../hooks/activity/useActivityKeyboard";
export { useOfflineActivities } from "../../../hooks/activity/useOfflineActivities";
export {
  useReducedMotion,
  useFocusTrap,
  useEscapeKey,
  useAriaAnnouncer,
  useKeyboardShortcuts,
} from "../../../hooks/activity/useAccessibility";
export { useMotionDuration, useMotionEasing } from "../../../lib/activity/motion";