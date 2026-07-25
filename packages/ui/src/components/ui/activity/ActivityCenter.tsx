// packages/ui/src/components/ui/activity/ActivityCenter.tsx
// REDESIGNED: این فایل تقریباً هیچ کلاس md:/lg: نداشت — همه‌ی
// اندازه‌ها ثابت و برای دسکتاپ طراحی شده بودند. اکنون هر زیرکامپوننت
// (دکمه، پنل، هدر، تولبار، چیپ فیلتر، فوتر) سه پله (پایه=موبایل،
// md=تبلت، lg=دسکتاپ) دارد. عرض و ارتفاع پنل هم نسبت به viewport
// (100vw / 100vh) محدود شده‌اند تا در صفحه‌های کوچک سرریز نشوند.
"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, X, Search, CloudOff, RefreshCw, Cloud, AlertCircle } from "lucide-react";
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

interface ActivityPopoverProps {
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

// ━━━ Custom Hooks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Hook for managing activity feed state and filtering
 */
function useActivityFeed(filter: FilterType, searchQuery: string) {
  const debouncedSearch = useDebounce(searchQuery, 300);

  const activityFilter = useMemo<ActivityFilter>(() => {
    const entityType = filter === "all" || filter === "unread" 
      ? undefined 
      : FILTER_ENTITY_MAP[filter as Exclude<FilterType, "all" | "unread">];
    
    const result: ActivityFilter = {};
    if (entityType) result.type = entityType;
    if (debouncedSearch) result.search = debouncedSearch;
    return result;
  }, [filter, debouncedSearch]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    error,
  } = useInfiniteActivities(activityFilter);

  const { data: unreadCount = 0 } = useUnreadActivityCount();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllActivitiesAsRead();

  const allGroups = useMemo<ActivityGroupDto[]>(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  const filteredGroups = useMemo(() => {
    let groups = allGroups;

    if (filter === "unread") {
      groups = groups.filter((g) => g.unreadCount > 0);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      groups = groups.filter(
        (group) =>
          group.entitySummary.label.toLowerCase().includes(lowerQuery) ||
          (group.entitySummary.subtitle?.toLowerCase().includes(lowerQuery) ?? false) ||
          group.activities.some((a: ActivityItemDto) => 
            a.title.toLowerCase().includes(lowerQuery)
          )
      );
    }

    return sortActivities(groups);
  }, [allGroups, filter, searchQuery]);

  const filterCounts = useMemo(() => ({
    all: allGroups.length,
    unread: allGroups.filter((g) => g.unreadCount > 0).length,
    invoices: allGroups.filter((g) => g.entityType === "invoice").length,
    payments: allGroups.filter((g) => g.entityType === "payment").length,
    customers: allGroups.filter((g) => g.entityType === "customer").length,
  }), [allGroups]);

  const pendingCount = useMemo(
    () => allGroups.filter((g) => g.unreadCount > 0).length,
    [allGroups]
  );

  return {
    allGroups,
    filteredGroups,
    filterCounts,
    pendingCount,
    unreadCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    refetch,
    fetchNextPage,
    markAllAsRead,
    isMarkingAll,
  };
}

/**
 * Hook for managing online/offline state and sync
 */
function useSyncStatus(onSync: () => Promise<void>) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (!isOnline) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      if (!isSyncingRef.current) {
        isSyncingRef.current = true;
        setIsSyncing(true);
        onSync()
          .then(() => setLastSynced(new Date()))
          .catch(console.error)
          .finally(() => {
            isSyncingRef.current = false;
            setIsSyncing(false);
          });
      }
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isOnline, onSync]);

  const handleManualSync = useCallback(async () => {
    if (isSyncingRef.current || !isOnline) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await onSync();
      setLastSynced(new Date());
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, onSync]);

  return { isOnline, isSyncing, lastSynced, handleManualSync };
}

// ━━━ Sub-components ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Filter Chip ──────────────────────────────────────────────

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
        // ✅ سه پله برای پدینگ، فونت و ارتفاع
        "shrink-0 rounded-full font-medium transition-all duration-200",
        "px-2.5 md:px-3 lg:px-3.5 py-1 md:py-1.5 lg:py-1.5",
        "text-[11px] md:text-xs lg:text-sm",
        "min-h-[32px] md:min-h-[36px] lg:min-h-[38px] min-w-[44px]",
        active
          ? "bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.3)]"
          : "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted)/0.8)]",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2"
      )}
      aria-pressed={active}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count !== undefined && count > 0 && (
          <span className={cn(
            "font-bold text-[9px] md:text-[10px] lg:text-xs",
            active ? "text-white/80" : "text-[hsl(var(--fg-tertiary))]"
          )}>
            ({count})
          </span>
        )}
      </span>
    </button>
  );
});
FilterChip.displayName = "FilterChip";

// ── Sync Status ──────────────────────────────────────────────

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
      <span className="flex items-center gap-1.5 text-[11px] md:text-xs text-[hsl(var(--color-warning))]">
        <CloudOff className="size-3 md:size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{t("activity.offline")}</span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 bg-[hsl(var(--color-warning)/0.1)] rounded text-[9px] md:text-[10px]">
            {pendingCount}
          </span>
        )}
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">
        <RefreshCw className={cn(
          "size-3 md:size-3.5",
          !prefersReducedMotion && "animate-spin"
        )} aria-hidden="true" />
        <span className="hidden sm:inline">{t("activity.syncing")}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onSync}
      className="flex items-center gap-1.5 text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
      aria-label={t("activity.sync")}
    >
      <Cloud className="size-3 md:size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">
        {lastSynced
          ? new Date(lastSynced).toLocaleTimeString("fa-AF", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : t("activity.sync")}
      </span>
    </button>
  );
});
SyncStatus.displayName = "SyncStatus";

// ── Error State ──────────────────────────────────────────────

const ErrorState = memo(function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-10 lg:py-12 px-4 text-center">
      <AlertCircle className="size-10 md:size-11 lg:size-12 text-[hsl(var(--color-destructive))] mb-3" aria-hidden="true" />
      <p className="text-xs md:text-sm text-[hsl(var(--fg-secondary))] mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-3.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-[hsl(var(--color-primary))] text-white hover:opacity-90 transition-opacity"
      >
        {t("activity.retry")}
      </button>
    </div>
  );
});
ErrorState.displayName = "ErrorState";

// ── Popover Button ───────────────────────────────────────────

const PopoverButton = memo(function PopoverButton({
  isOpen,
  unreadCount,
  onClick,
}: {
  isOpen: boolean;
  unreadCount: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-xl text-[hsl(var(--fg-secondary))]",
        "p-2 md:p-2.5 lg:p-3",
        "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
        "transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2",
        isOpen && "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))]"
      )}
      aria-label={t("activity.title")}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <Bell className="size-[18px] md:size-5 lg:size-[22px]" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[18px] md:min-w-[20px] h-[18px] md:h-[20px] px-1 text-[10px] md:text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
});
PopoverButton.displayName = "PopoverButton";

// ── Popover Panel ────────────────────────────────────────────

const PopoverPanel = memo(function PopoverPanel({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose]);

  useEscapeKey(() => {
    if (isOpen) onClose();
  });

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Activity feed"
      className={cn(
        "absolute end-0 top-full mt-2 z-50 flex flex-col",
        // ✅ FIX: ارتفاع پنل نسبت به viewport محدود می‌شود تا روی
        // موبایل با صفحه‌ی کوچک (مثلاً لندسکیپ) سرریز نکند.
        "max-h-[min(560px,80vh)] md:max-h-[min(600px,85vh)]",
        "rounded-xl md:rounded-2xl border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))] shadow-2xl shadow-black/20",
        "transition-all duration-200",
        prefersReducedMotion && "duration-0",
        "animate-in fade-in-0 slide-in-from-top-2",
        // ✅ FIX: سه پله برای عرض — موبایل تقریباً تمام‌عرض (با
        // حاشیه‌ی کوچک)، تبلت عرض ثابت متوسط، دسکتاپ عرض ثابت بزرگ‌تر
        "w-[calc(100vw-1.5rem)] xs:w-[calc(100vw-2rem)] sm:w-[400px] md:w-[440px] lg:w-[480px]"
      )}
    >
      {children}
    </div>
  );
});
PopoverPanel.displayName = "PopoverPanel";

// ── Popover Header ───────────────────────────────────────────

const PopoverHeader = memo(function PopoverHeader({
  unreadCount,
  isMarkingAll,
  onMarkAllRead,
  onClose,
  isOnline,
  isSyncing,
  lastSynced,
  pendingCount,
  onSync,
}: {
  unreadCount: number;
  isMarkingAll: boolean;
  onMarkAllRead: () => void;
  onClose: () => void;
  isOnline: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingCount: number;
  onSync: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2.5 md:py-3 border-b border-[hsl(var(--border-default))]">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm md:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("activity.title")}
        </h3>
        {unreadCount > 0 && (
          <span className="shrink-0 text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
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
          onSync={onSync}
        />
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={isMarkingAll}
            className={cn(
              "rounded-lg font-medium",
              "px-1.5 md:px-2 py-1",
              "text-[10px] md:text-[11px]",
              "text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]",
              "transition-colors disabled:opacity-40",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
              "min-h-[30px] md:min-h-[32px]"
            )}
            aria-label={t("activity.markAllRead")}
          >
            {t("activity.markAllRead")}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          aria-label={t("action.close")}
        >
          <X className="size-3.5 md:size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});
PopoverHeader.displayName = "PopoverHeader";

// ── Popover Toolbar ──────────────────────────────────────────

const PopoverToolbar = memo(function PopoverToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  filterCounts,
  searchRef,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  filterCounts: ReturnType<typeof useActivityFeed>["filterCounts"];
  searchRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();

  return (
    <div className="px-2.5 md:px-3 py-2 border-b border-[hsl(var(--border-default))] space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("activity.search")}
          className={cn(
            "w-full rounded-lg border border-[hsl(var(--border-default))] bg-transparent",
            "h-8 md:h-9",
            "ps-8 pe-10 text-xs md:text-sm text-[hsl(var(--fg-primary))]",
            "placeholder:text-[hsl(var(--fg-tertiary))]",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
          )}
          aria-label={t("activity.search")}
        />
        {/* ✅ FIX: میانبر کیبورد فقط جایی معنا دارد که کیبورد فیزیکی
            باشد — روی موبایل مخفی می‌شود چون فضا را اشغال می‌کند و
            کاربردی هم ندارد. */}
        <kbd className="hidden md:block absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))] px-1.5 py-0.5 rounded">
          /
        </kbd>
      </div>

      {/* Filter Chips */}
      <div 
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" 
        role="tablist"
        aria-label="Activity filters"
      >
        <FilterChip
          label={t("activity.filter.all")}
          active={filter === "all"}
          onClick={() => onFilterChange("all")}
          count={filterCounts.all}
        />
        <FilterChip
          label={t("activity.filter.unread")}
          active={filter === "unread"}
          onClick={() => onFilterChange("unread")}
          count={filterCounts.unread}
        />
        <FilterChip
          label={t("activity.filter.invoices")}
          active={filter === "invoices"}
          onClick={() => onFilterChange("invoices")}
          count={filterCounts.invoices}
        />
        <FilterChip
          label={t("activity.filter.payments")}
          active={filter === "payments"}
          onClick={() => onFilterChange("payments")}
          count={filterCounts.payments}
        />
        <FilterChip
          label={t("activity.filter.customers")}
          active={filter === "customers"}
          onClick={() => onFilterChange("customers")}
          count={filterCounts.customers}
        />
      </div>
    </div>
  );
});
PopoverToolbar.displayName = "PopoverToolbar";

// ── Popover Body ─────────────────────────────────────────────

const PopoverBody = memo(function PopoverBody({
  isLoading,
  filteredGroups,
  hasNextPage,
  isFetchingNextPage,
  error,
  onRetry,
  onActivityClick,
  onLoadMore,
  search,
  filter,
}: {
  isLoading: boolean;
  filteredGroups: ActivityGroupDto[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;
  onRetry: () => void;
  onActivityClick: (activity: ActivityItemDto, group: ActivityGroupDto) => void;
  onLoadMore: () => void;
  search: string;
  filter: FilterType;
}) {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    if (isLoading && filteredGroups.length === 0) {
      setAnnouncement(t("activity.loading"));
    } else if (filteredGroups.length > 0) {
      setAnnouncement(t("activity.loaded", { count: filteredGroups.length }));
    }
  }, [isLoading, filteredGroups.length, t]);

  if (error) {
    return (
      <div className="p-3 md:p-4">
        <ErrorState message={error.message || t("activity.error")} onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading && filteredGroups.length === 0) {
    return (
      <ActivityMotion type="fade">
        <ActivitySkeleton />
      </ActivityMotion>
    );
  }

  if (filteredGroups.length === 0) {
    return (
      <ActivityMotion type="fade">
        <div className="py-6 md:py-8">
          <ActivityEmptyState
            title={
              search ? t("activity.empty.search") : t("activity.empty.title")
            }
            subtitle={
              search
                ? t("activity.empty.searchHint", { query: search })
                : filter === "unread"
                ? t("activity.empty.unread")
                : t("activity.empty.all")
            }
          />
        </div>
      </ActivityMotion>
    );
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <VirtualizedActivityList
        groups={filteredGroups}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        fetchNextPage={onLoadMore}
        isFetchingNextPage={isFetchingNextPage}
        onActivityClick={onActivityClick}
        estimateSize={180}
        onLoadMore={onLoadMore}
      />
    </>
  );
});
PopoverBody.displayName = "PopoverBody";

// ── Popover Footer ───────────────────────────────────────────

const PopoverFooter = memo(function PopoverFooter({
  hasItems,
  onViewAll,
}: {
  hasItems: boolean;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();

  if (!hasItems) return null;

  return (
    <button
      type="button"
      onClick={onViewAll}
      className={cn(
        "flex items-center justify-center gap-1.5 font-medium",
        "px-3 md:px-4 py-2 md:py-2.5",
        "text-[11px] md:text-xs",
        "text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]",
        "border-t border-[hsl(var(--border-default))]",
        "hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
        "min-h-[40px] md:min-h-[44px]"
      )}
      aria-label={t("activity.viewAll")}
    >
      {t("activity.viewAll")}
      <span className="text-[hsl(var(--fg-tertiary))]" aria-hidden="true">→</span>
    </button>
  );
});
PopoverFooter.displayName = "PopoverFooter";

// ━━━ Main Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ActivityCenter = memo(function ActivityCenter({
  className,
  offlineMode = false,
}: ActivityPopoverProps) {
  const { t } = useTranslation();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const openTimeRef = useRef(Date.now());

  const { trackActivityEvent } = useActivityAnalytics();

  const {
    filteredGroups,
    filterCounts,
    pendingCount,
    unreadCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    refetch,
    fetchNextPage,
    markAllAsRead,
    isMarkingAll,
  } = useActivityFeed(filter, search);

  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { isOnline, isSyncing, lastSynced, handleManualSync } = useSyncStatus(handleRefetch);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    openTimeRef.current = Date.now();
    trackActivityEvent(activityAnalyticsEvents.OPEN_FEED, { unreadCount });
  }, [trackActivityEvent, unreadCount]);

  const handleClose = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.CLOSE_FEED, {
      duration: Date.now() - openTimeRef.current,
    });
    setIsOpen(false);
  }, [trackActivityEvent]);

  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter);
    trackActivityEvent(activityAnalyticsEvents.FILTER, { filter: newFilter });
  }, [trackActivityEvent]);

  const handleMarkAllRead = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.MARK_ALL_READ, {
      count: unreadCount,
    });
    markAllAsRead();
  }, [trackActivityEvent, unreadCount, markAllAsRead]);

  const handleLoadMore = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.LOAD_MORE, {
      currentCount: filteredGroups.length,
    });
    fetchNextPage();
  }, [filteredGroups.length, trackActivityEvent, fetchNextPage]);

  const handleActivityClick = useCallback(
    (activity: ActivityItemDto, group: ActivityGroupDto) => {
      trackActivityEvent(activityAnalyticsEvents.CLICK_ACTIVITY, {
        entity_type: group.entityType,
        entity_id: group.entityId,
        has_unread: group.hasUnread,
      });
      setIsOpen(false);
      const route = group.entitySummary.route || "/dashboard";
      router.push(route);
    },
    [trackActivityEvent, router]
  );

  const handleViewAll = useCallback(() => {
    trackActivityEvent(activityAnalyticsEvents.VIEW_ALL);
    setIsOpen(false);
    router.push("/activities");
  }, [trackActivityEvent, router]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (search.length >= 2) {
      trackActivityEvent(activityAnalyticsEvents.SEARCH, {
        query: search,
        resultsCount: filteredGroups.length,
      });
    }
  }, [search, filteredGroups.length, trackActivityEvent]);

  return (
    <div className={cn("relative", className)}>
      <PopoverButton
        isOpen={isOpen}
        unreadCount={unreadCount}
        onClick={handleOpen}
      />

      <PopoverPanel isOpen={isOpen} onClose={handleClose}>
        <PopoverHeader
          unreadCount={unreadCount}
          isMarkingAll={isMarkingAll}
          onMarkAllRead={handleMarkAllRead}
          onClose={handleClose}
          isOnline={isOnline}
          isSyncing={isSyncing}
          lastSynced={lastSynced}
          pendingCount={pendingCount}
          onSync={handleManualSync}
        />

        {!isOnline && (
          <div className="px-3 md:px-4 py-2 bg-[hsl(var(--color-warning)/0.08)] border-b border-[hsl(var(--border-default))]">
            <p className="text-[11px] md:text-xs text-[hsl(var(--color-warning))] flex items-center gap-2">
              <CloudOff className="size-3 md:size-3.5" aria-hidden="true" />
              {t("activity.offlineBanner")}
            </p>
          </div>
        )}

        <PopoverToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={handleFilterChange}
          filterCounts={filterCounts}
          searchRef={searchRef}
        />

        <div className="overflow-y-auto flex-1 p-2.5 md:p-3">
          <PopoverBody
            isLoading={isLoading}
            filteredGroups={filteredGroups}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            error={error}
            onRetry={handleRetry}
            onActivityClick={handleActivityClick}
            onLoadMore={handleLoadMore}
            search={search}
            filter={filter}
          />
        </div>

        <PopoverFooter
          hasItems={filteredGroups.length > 0}
          onViewAll={handleViewAll}
        />
      </PopoverPanel>
    </div>
  );
});

ActivityCenter.displayName = "ActivityCenter";