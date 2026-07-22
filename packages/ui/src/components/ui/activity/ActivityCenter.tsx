// packages/ui/src/components/ui/activity/ActivityCenter.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, X, Search, CloudOff, RefreshCw, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInfiniteActivities,
  useUnreadCount as useUnreadActivityCount,
  useMarkAllAsRead as useMarkAllActivitiesAsRead,
  type ActivityGroupDto,
  type ActivityItemDto,
  type ActivityFilter,
} from "@hisabche/api";
import { VirtualizedActivityList } from "./VirtualizedActivityList";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { ActivityEmptyState } from "./ActivityEmptyState";
import { ActivityMotion } from "./ActivityMotion";
import { sortActivities } from "../../../lib/activity/utils";
import { useActivityAnalytics, activityAnalyticsEvents } from "../../../hooks/activity/useActivityAnalytics";
import { useReducedMotion, useEscapeKey } from "../../../hooks/activity/useAccessibility";
import { useDebounce } from "../../../hooks/activity/useDebounce";

// ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ActivityCenterProps {
  className?: string;
  offlineMode?: boolean;
}

type FilterType = "all" | "unread" | "invoices" | "payments" | "customers";

// ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FILTER_ENTITY_MAP: Record<Exclude<FilterType, "all" | "unread">, string> = {
  invoices: "invoice",
  payments: "payment",
  customers: "customer",
};

// ━━━ Components ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FilterChip = memo(function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-200",
        active
          ? "bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.3)]"
          : "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted)/0.8)]",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2"
      )}
      aria-pressed={active}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "ms-1 text-[9px] font-bold",
          active ? "text-white/80" : "text-[hsl(var(--fg-tertiary))]"
        )}>
          ({count})
        </span>
      )}
    </button>
  );
});
FilterChip.displayName = "FilterChip";

// ━━━ Sync Status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SyncStatus = memo(function SyncStatus({
  isOnline,
  isSyncing,
  lastSynced,
  pendingCount,
  onSync,
}: {
  isOnline: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingCount: number;
  onSync: () => void;
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--color-warning))]">
        <CloudOff className="size-3.5" />
        {t("activity.offline")}
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 bg-[hsl(var(--color-warning)/0.1)] rounded text-[9px]">
            {pendingCount}
          </span>
        )}
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--fg-tertiary))]">
        <RefreshCw className={cn(
          "size-3.5",
          !prefersReducedMotion && "animate-spin"
        )} />
        {t("activity.syncing")}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onSync}
      className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
      aria-label={t("activity.sync")}
    >
      <Cloud className="size-3.5" />
      {lastSynced
        ? new Date(lastSynced).toLocaleTimeString("fa-AF", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : t("activity.sync")}
    </button>
  );
});
SyncStatus.displayName = "SyncStatus";

// ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const getEntityTypeFilter = (filter: FilterType): string | undefined => {
  if (filter === "all" || filter === "unread") return undefined;
  return FILTER_ENTITY_MAP[filter];
};

const filterGroupsByType = (
  groups: ActivityGroupDto[],
  filter: FilterType
): ActivityGroupDto[] => {
  if (filter === "all") return groups;
  if (filter === "unread") {
    return groups.filter((group) => group.unreadCount > 0);
  }
  
  const targetType = FILTER_ENTITY_MAP[filter];
  return groups.filter((group) => group.entityType === targetType);
};

const searchGroups = (
  groups: ActivityGroupDto[],
  query: string
): ActivityGroupDto[] => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return groups;
  
  return groups.filter(
    (group) =>
      group.entitySummary.label.toLowerCase().includes(lowerQuery) ||
      (group.entitySummary.subtitle?.toLowerCase().includes(lowerQuery) ?? false) ||
      group.activities.some((activity: ActivityItemDto) => 
        activity.title.toLowerCase().includes(lowerQuery)
      )
  );
};

// ━━━ Main Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ActivityCenter = memo(function ActivityCenter({
  className,
  offlineMode = false,
}: ActivityCenterProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const openTimeRef = useRef(Date.now());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ━━━ Accessibility ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const prefersReducedMotion = useReducedMotion();

  // ━━━ Analytics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { trackActivityEvent } = useActivityAnalytics();

  // ━━━ Online/Offline state ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ━━━ Debounced search ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const debouncedSearch = useDebounce(search, 300);

  // ━━━ Activity filter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const activityFilter = useMemo<ActivityFilter>(() => {
    const entityType = getEntityTypeFilter(filter);
    const result: ActivityFilter = {};
    
    if (entityType) {
      result.type = entityType;
    }
    if (debouncedSearch) {
      result.search = debouncedSearch;
    }
    
    return result;
  }, [filter, debouncedSearch]);

  // ━━━ Data ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteActivities(activityFilter);

  const { data: unreadCount = 0 } = useUnreadActivityCount();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllActivitiesAsRead();

  // ━━━ Flatten pages ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const allGroups = useMemo<ActivityGroupDto[]>(() => {
    return data?.pages.flatMap((page) => page.data) ?? [];
  }, [data]);

  // ━━━ Filtered groups ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const filteredGroups = useMemo(() => {
    const typeFiltered = filterGroupsByType(allGroups, filter);
    
    if (!search.trim()) {
      return sortActivities(typeFiltered);
    }

    const searched = searchGroups(typeFiltered, search);
    return sortActivities(searched);
  }, [allGroups, filter, search]);

  // ━━━ Counts for filter chips ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const filterCounts = useMemo(() => {
    return {
      all: allGroups.length,
      unread: allGroups.filter((g) => g.unreadCount > 0).length,
      invoices: allGroups.filter((g) => g.entityType === "invoice").length,
      payments: allGroups.filter((g) => g.entityType === "payment").length,
      customers: allGroups.filter((g) => g.entityType === "customer").length,
    };
  }, [allGroups]);

  // ━━━ Pending count ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const pendingCount = useMemo(() => {
    return allGroups.filter((g) => g.unreadCount > 0).length;
  }, [allGroups]);

  // ━━━ Sync Handler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSync = useCallback(async () => {
    // ✅ جلوگیری از sync همزمان
    if (isSyncing) return;
    if (!isOnline) return;
    
    setIsSyncing(true);
    try {
      await refetch();
      setLastSynced(new Date());
      trackActivityEvent(activityAnalyticsEvents.SYNC);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refetch, trackActivityEvent]);

  // ━━━ Open/Close Handlers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleOpen = useCallback(() => {
    setOpen(true);
    openTimeRef.current = Date.now();
    trackActivityEvent(activityAnalyticsEvents.OPEN_FEED, { unreadCount });
  }, [trackActivityEvent, unreadCount]);

  const handleClose = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.CLOSE_FEED, {
      duration: Date.now() - openTimeRef.current,
    });
    setOpen(false);
  }, [trackActivityEvent]);

  // ━━━ Filter Change Handler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter);
    trackActivityEvent(activityAnalyticsEvents.FILTER, { filter: newFilter });
  }, [trackActivityEvent]);

  // ━━━ Mark All Read Handler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleMarkAllRead = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.MARK_ALL_READ, {
      count: unreadCount,
      totalActivities: allGroups.length,
    });
    markAllAsRead();
  }, [trackActivityEvent, unreadCount, allGroups.length, markAllAsRead]);

  // ━━━ Load More Handler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleLoadMore = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.LOAD_MORE, {
      currentCount: allGroups.length,
    });
    fetchNextPage();
  }, [allGroups.length, trackActivityEvent, fetchNextPage]);

  // ━━━ Activity Click Handler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleActivityClick = useCallback((activity: ActivityItemDto, group: ActivityGroupDto) => {
    trackActivityEvent(activityAnalyticsEvents.CLICK_ACTIVITY, {
      entity_type: group.entityType,
      entity_id: group.entityId,
      has_unread: group.hasUnread,
    });
    setOpen(false);
    const route = group.entitySummary.route || "/dashboard";
    router.push(route);
  }, [trackActivityEvent, router]);

  // ━━━ View All Handler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleViewAll = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.VIEW_ALL);
    setOpen(false);
    router.push("/activities");
  }, [trackActivityEvent, router]);

  // ━━━ Effects ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // ✅ فقط یکبار sync روی online (بدون setInterval)
  useEffect(() => {
    if (isOnline) {
      // با تاخیر ۱ ثانیه تا از لوپ جلوگیری شود
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        handleSync();
      }, 1000);
    }
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isOnline, handleSync]);

  // ❌ حذف setInterval
  // useEffect(() => {
  //   if (!isOnline) return;
  //   const interval = setInterval(handleSync, 60000);
  //   return () => clearInterval(interval);
  // }, [isOnline, handleSync]);

  // Search analytics
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 2) {
      trackActivityEvent(activityAnalyticsEvents.SEARCH, {
        query: debouncedSearch,
        resultsCount: allGroups.length,
      });
    }
  }, [debouncedSearch, allGroups.length, trackActivityEvent]);

  // Escape key
  useEscapeKey(() => {
    if (open) handleClose();
  });

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        handleClose();
      }
    };
    const timeout = setTimeout(() => document.addEventListener("mousedown", handleMouseDown), 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, handleClose]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  // ━━━ Render ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className={cn("relative", className)}>
      {/* ━━━ Button ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "relative p-2 rounded-xl text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
          "transition-all duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2",
          open && "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))]"
        )}
        aria-label={t("activity.title")}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ━━━ Panel ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("activity.title")}
          className={cn(
            "absolute end-0 top-full mt-2 z-50 w-[440px] max-h-[560px] flex flex-col",
            "rounded-2xl border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-elevated))] shadow-2xl shadow-black/20",
            "transition-all duration-200",
            prefersReducedMotion && "duration-0",
            "animate-in fade-in-0 slide-in-from-top-2"
          )}
        >
          {/* ━━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[hsl(var(--border-default))]">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {t("activity.title")}
              </h3>
              {unreadCount > 0 && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
                  {unreadCount} {t("activity.new")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <SyncStatus
                isOnline={isOnline}
                isSyncing={isSyncing}
                lastSynced={lastSynced}
                pendingCount={pendingCount}
                onSync={handleSync}
              />
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[11px] font-medium",
                    "text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]",
                    "transition-colors disabled:opacity-40",
                    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  )}
                  aria-label={t("activity.markAllRead")}
                >
                  {t("activity.markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
                aria-label={t("action.close")}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* ━━━ Offline Banner ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {!isOnline && (
            <div className="px-4 py-2 bg-[hsl(var(--color-warning)/0.08)] border-b border-[hsl(var(--border-default))]">
              <p className="text-[11px] text-[hsl(var(--color-warning))] flex items-center gap-2">
                <CloudOff className="size-3.5" />
                {t("activity.offlineBanner")}
              </p>
            </div>
          )}

          {/* ━━━ Toolbar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="px-3 py-2 border-b border-[hsl(var(--border-default))] space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[hsl(var(--fg-tertiary))]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("activity.search")}
                className={cn(
                  "w-full h-8 rounded-lg border border-[hsl(var(--border-default))] bg-transparent",
                  "ps-8 pe-10 text-xs text-[hsl(var(--fg-primary))]",
                  "placeholder:text-[hsl(var(--fg-tertiary))]",
                  "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                )}
                aria-label={t("activity.search")}
              />
              <kbd className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))] px-1.5 py-0.5 rounded">
                /
              </kbd>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" role="tablist">
              <FilterChip
                label={t("activity.filter.all")}
                active={filter === "all"}
                onClick={() => handleFilterChange("all")}
                count={filterCounts.all}
              />
              <FilterChip
                label={t("activity.filter.unread")}
                active={filter === "unread"}
                onClick={() => handleFilterChange("unread")}
                count={filterCounts.unread}
              />
              <FilterChip
                label={t("activity.filter.invoices")}
                active={filter === "invoices"}
                onClick={() => handleFilterChange("invoices")}
                count={filterCounts.invoices}
              />
              <FilterChip
                label={t("activity.filter.payments")}
                active={filter === "payments"}
                onClick={() => handleFilterChange("payments")}
                count={filterCounts.payments}
              />
              <FilterChip
                label={t("activity.filter.customers")}
                active={filter === "customers"}
                onClick={() => handleFilterChange("customers")}
                count={filterCounts.customers}
              />
            </div>
          </div>

          {/* ━━━ Body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="overflow-y-auto flex-1 p-3">
            {isLoading && allGroups.length === 0 ? (
              <ActivityMotion type="fade">
                <ActivitySkeleton />
              </ActivityMotion>
            ) : filteredGroups.length === 0 ? (
              <ActivityMotion type="fade">
                <ActivityEmptyState
                  title={
                    search
                      ? t("activity.empty.search")
                      : t("activity.empty.title")
                  }
                  subtitle={
                    search
                      ? t("activity.empty.searchHint", { query: search })
                      : filter === "unread"
                      ? t("activity.empty.unread")
                      : t("activity.empty.all")
                  }
                />
              </ActivityMotion>
            ) : (
              <VirtualizedActivityList
                groups={filteredGroups}
                isLoading={isLoading}
                hasNextPage={hasNextPage}
                fetchNextPage={fetchNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onActivityClick={handleActivityClick}
                estimateSize={180}
                onLoadMore={handleLoadMore}
              />
            )}
          </div>

          {/* ━━━ Footer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {filteredGroups.length > 0 && (
            <button
              type="button"
              onClick={handleViewAll}
              className={cn(
                "flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium",
                "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]",
                "border-t border-[hsl(var(--border-default))]",
                "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150",
                "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              )}
              aria-label={t("activity.viewAll")}
            >
              {t("activity.viewAll")}
              <span className="text-[hsl(var(--fg-tertiary))]">→</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

ActivityCenter.displayName = "ActivityCenter";