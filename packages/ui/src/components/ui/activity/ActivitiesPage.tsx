// packages/ui/src/components/ui/activity/ActivitiesPage.tsx
// REDESIGNED: پاسخگویی مجزا برای موبایل / تبلت (md) / دسکتاپ (lg+).
// قبلاً فقط دو پله (پایه = موبایل، md = «همه‌ی بقیه») وجود داشت، یعنی
// تبلت ۷۶۸px و دسکتاپ ۱۹۲۰px دقیقاً یک ظاهر داشتند. اکنون max-width
// صفحه، اسپیسینگ، اندازه‌ی فونت و چیدمان فیلترها هرکدام سه پله دارند.
"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
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
import { useDebounce } from "../../../hooks/activity/useDebounce";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = "all" | "unread" | "invoices" | "payments" | "customers";

const FILTER_ENTITY_MAP: Record<Exclude<FilterType, "all" | "unread">, string> = {
  invoices: "invoice",
  payments: "payment",
  customers: "customer",
};

const getEntityTypeFilter = (filter: FilterType): string | undefined => {
  if (filter === "all" || filter === "unread") return undefined;
  return FILTER_ENTITY_MAP[filter];
};

const filterGroupsByType = (
  groups: ActivityGroupDto[],
  filter: FilterType
): ActivityGroupDto[] => {
  if (filter === "all") return groups;
  if (filter === "unread") return groups.filter((g) => g.unreadCount > 0);
  const targetType = FILTER_ENTITY_MAP[filter];
  return groups.filter((g) => g.entityType === targetType);
};

const searchGroups = (groups: ActivityGroupDto[], query: string): ActivityGroupDto[] => {
  const q = query.toLowerCase().trim();
  if (!q) return groups;
  return groups.filter(
    (group) =>
      group.entitySummary.label.toLowerCase().includes(q) ||
      (group.entitySummary.subtitle?.toLowerCase().includes(q) ?? false) ||
      group.activities.some((a: ActivityItemDto) => a.title.toLowerCase().includes(q))
  );
};

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({
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
        // ✅ سه پله: موبایل فشرده، تبلت (md) کمی بازتر، دسکتاپ (lg) راحت‌تر
        "shrink-0 px-2 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2 rounded-full font-medium transition-all duration-200",
        "text-[10px] md:text-xs lg:text-sm",
        "min-h-[28px] md:min-h-[36px] lg:min-h-[40px]",
        active
          ? "bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.3)]"
          : "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted)/0.8)]",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2"
      )}
      aria-pressed={active}
    >
      <span className="flex items-center gap-1 lg:gap-1.5">
        {label}
        {count !== undefined && count > 0 && (
          <span className={cn(
            "font-bold text-[8px] md:text-[10px] lg:text-xs",
            active ? "text-white/80" : "text-[hsl(var(--fg-tertiary))]"
          )}>
            ({count})
          </span>
        )}
      </span>
    </button>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export function ActivitiesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 300);

  const activityFilter = useMemo<ActivityFilter>(() => {
    const entityType = getEntityTypeFilter(filter);
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
  } = useInfiniteActivities(activityFilter);

  const { data: unreadCount = 0 } = useUnreadActivityCount();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllActivitiesAsRead();

  const allGroups = useMemo<ActivityGroupDto[]>(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  const filteredGroups = useMemo(() => {
    const typeFiltered = filterGroupsByType(allGroups, filter);
    return search.trim() ? searchGroups(typeFiltered, search) : typeFiltered;
  }, [allGroups, filter, search]);

  const filterCounts = useMemo(
    () => ({
      all: allGroups.length,
      unread: allGroups.filter((g) => g.unreadCount > 0).length,
      invoices: allGroups.filter((g) => g.entityType === "invoice").length,
      payments: allGroups.filter((g) => g.entityType === "payment").length,
      customers: allGroups.filter((g) => g.entityType === "customer").length,
    }),
    [allGroups]
  );

  const handleActivityClick = useCallback(
    (_activity: ActivityItemDto, group: ActivityGroupDto) => {
      const route = group.entitySummary.route || "/dashboard";
      router.push(route);
    },
    [router]
  );

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  return (
    // ✅ FIX: max-width سه‌پله‌ای — موبایل تمام‌عرض، تبلت (md) کمی
    // محدود، دسکتاپ (lg) عریض‌تر تا در صفحه‌نمایش‌های بزرگ باریک و
    // گم نشود. پدینگ افقی هم به همین ترتیب رشد می‌کند.
    <div className="flex flex-col h-full w-full max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto px-3 md:px-4 lg:px-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 pb-3 md:pb-4 lg:pb-5">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <h1 className="font-bold text-[hsl(var(--fg-primary))] truncate text-lg md:text-xl lg:text-2xl">
            {t("nav.events", "رخدادها")}
          </h1>
          {unreadCount > 0 && (
            <span className="shrink-0 font-bold rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] text-[10px] md:text-xs lg:text-sm px-1.5 md:px-2 lg:px-2.5 py-0.5 lg:py-1">
              {unreadCount} {t("activity.new")}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            disabled={isMarkingAll}
            className={cn(
              "rounded-lg font-medium",
              "px-2 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2",
              "text-[10px] md:text-xs lg:text-sm",
              "text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]",
              "transition-colors disabled:opacity-40",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
              "min-h-[28px] md:min-h-[36px] lg:min-h-[40px]"
            )}
          >
            {t("activity.markAllRead")}
          </button>
        )}
      </div>

      {/* ─── Toolbar ────────────────────────────────────────── */}
      <div className="space-y-2 md:space-y-3 lg:space-y-4 pb-3 md:pb-4 lg:pb-5">
        <div className="relative">
          <Search className="absolute start-2.5 md:start-3 lg:start-3.5 top-1/2 -translate-y-1/2 size-3.5 md:size-4 lg:size-[18px] text-[hsl(var(--fg-tertiary))]" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("activity.search")}
            className={cn(
              "w-full rounded-lg md:rounded-xl border border-[hsl(var(--border-default))] bg-transparent",
              "h-9 md:h-10 lg:h-11",
              "ps-8 md:ps-9 lg:ps-10 pe-3 md:pe-4 lg:pe-5",
              "text-xs md:text-sm lg:text-base text-[hsl(var(--fg-primary))]",
              "placeholder:text-[hsl(var(--fg-tertiary))]",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            )}
          />
        </div>

        {/* ✅ FIX: روی موبایل اسکرول افقی (چیپ‌ها جا نمی‌شوند)، از md
            به بعد wrap می‌شود چون فضای کافی برای نمایش همه در یک یا
            دو خط بدون اسکرول هست. */}
        <div
          className="flex items-center gap-1 md:gap-1.5 lg:gap-2 overflow-x-auto md:overflow-x-visible md:flex-wrap pb-0.5 md:pb-0 scrollbar-hide"
          role="tablist"
        >
          <FilterChip label={t("activity.filter.all")} active={filter === "all"} onClick={() => setFilter("all")} count={filterCounts.all} />
          <FilterChip label={t("activity.filter.unread")} active={filter === "unread"} onClick={() => setFilter("unread")} count={filterCounts.unread} />
          <FilterChip label={t("activity.filter.invoices")} active={filter === "invoices"} onClick={() => setFilter("invoices")} count={filterCounts.invoices} />
          <FilterChip label={t("activity.filter.payments")} active={filter === "payments"} onClick={() => setFilter("payments")} count={filterCounts.payments} />
          <FilterChip label={t("activity.filter.customers")} active={filter === "customers"} onClick={() => setFilter("customers")} count={filterCounts.customers} />
        </div>
      </div>

      {/* ─── Body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] rounded-xl md:rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading && allGroups.length === 0 ? (
          <ActivitySkeleton />
        ) : filteredGroups.length === 0 ? (
          <div className="p-4 md:p-6 lg:p-8">
            <ActivityEmptyState
              title={search ? t("activity.empty.search") : t("activity.empty.title")}
              subtitle={
                search
                  ? t("activity.empty.searchHint", { query: search })
                  : filter === "unread"
                    ? t("activity.empty.unread")
                    : t("activity.empty.all")
              }
            />
          </div>
        ) : (
          <VirtualizedActivityList
            groups={filteredGroups}
            isLoading={isLoading}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onActivityClick={handleActivityClick}
            estimateSize={160}
            onLoadMore={handleLoadMore}
          />
        )}
      </div>
    </div>
  );
}

ActivitiesPage.displayName = "ActivitiesPage";