// packages/ui/src/components/ui/activity/index.ts
// ─── Activity Design System ────────────────────────────────────────────────
// Consolidated: this folder previously held ~19 files, most of them dead
// (no consumer anywhere in the app). Only the pieces that make up the real
// /activities page remain, plus the two new files that replace the old
// EntityActivityCard/ActivityItem/VirtualizedActivityList/ActivityMotion
// stack with a single, simpler card + list pair.

export { ActivitiesPage } from "./ActivitiesPage";
export { ActivityGroupCard } from "./ActivityGroupCard";
export { ActivityFeedList } from "./ActivityFeedList";
export { ActivitySkeleton } from "./ActivitySkeleton";
export { ActivityEmptyState } from "./ActivityEmptyState";

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  ActivityItemDto,
  ActivityGroupDto,
  EntitySummaryDto,
} from "@hisabche/api";
