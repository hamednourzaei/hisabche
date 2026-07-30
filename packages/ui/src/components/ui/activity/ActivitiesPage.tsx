// packages/ui/src/components/ui/activity/ActivitiesPage.tsx
// Activity / Events feed. Rebuilt on top of the app's shadcn-style
// primitives (Tabs, Badge) instead of a bespoke, overbuilt implementation.
// Data layer (hooks, filter semantics, click-through routing) is untouched —
// only presentation changed.
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInfiniteActivities,
  useUnreadCount as useUnreadActivityCount,
  useMarkAllAsRead as useMarkAllActivitiesAsRead,
  type ActivityGroupDto,
  type ActivityItemDto,
  type ActivityFilter,
} from "@hisabche/api";
import { Tabs, TabsList, TabsTrigger } from "../tabs";
import { Badge } from "../badge";
import { ActivityFeedList } from "./ActivityFeedList";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { ActivityEmptyState } from "./ActivityEmptyState";
import { useDebounce } from "../../../hooks/activity/useDebounce";
import { AuditContainer } from "../audit/containers/audit-container";

// ─── Filter mapping (kept exactly as before — this logic is correct) ───────

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

// ─── Main Page Component ──────────────────────────────────────────────────────

type SectionType = "activity" | "audit";

export function ActivitiesPage() {
  const t = useTranslations();
  const router = useRouter();
  const [section, setSection] = useState<SectionType>("activity");
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

  return (
    <div className="flex flex-col h-full w-full max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto px-3 md:px-4 lg:px-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 pb-3 md:pb-4 lg:pb-5">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-bold text-[hsl(var(--fg-primary))] truncate text-lg md:text-xl lg:text-2xl">
            {t("nav.events")}
          </h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" size="sm" className="shrink-0">
              {unreadCount} {t("activity.new")}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            disabled={isMarkingAll}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-lg font-medium",
              "px-2 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2",
              "text-[11px] md:text-xs lg:text-sm",
              "text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]",
              "transition-colors disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-color)/0.4)]",
              "min-h-[28px] md:min-h-[36px] lg:min-h-[40px]"
            )}
          >
            <CheckCheck className="size-3.5 md:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("activity.markAllRead")}</span>
          </button>
        )}
      </div>

      {/* ─── Section switch: activity feed vs audit log ────── */}
      <Tabs value={section} onValueChange={(v) => setSection(v as SectionType)}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="activity">{t("nav.events")}</TabsTrigger>
          <TabsTrigger value="audit">{t("nav.history")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "audit" ? (
        <div className="pt-3 md:pt-4 lg:pt-5">
          <AuditContainer />
        </div>
      ) : (
        <>
      {/* ─── Toolbar: search + filter tabs ─────────────────── */}
      <div className="space-y-2 md:space-y-3 lg:space-y-4 pb-3 md:pb-4 lg:pb-5 pt-3 md:pt-4 lg:pt-5">
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
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring-color)/0.4)]"
            )}
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <TabsList className="w-full md:w-auto flex-nowrap md:flex-wrap justify-start">
            <TabsTrigger value="all">
              {t("activity.filter.all")}
              {filterCounts.all > 0 && (
                <span className="text-[hsl(var(--fg-tertiary))] font-normal">({filterCounts.all})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread">
              {t("activity.filter.unread")}
              {filterCounts.unread > 0 && (
                <span className="text-[hsl(var(--fg-tertiary))] font-normal">({filterCounts.unread})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices">
              {t("activity.filter.invoices")}
              {filterCounts.invoices > 0 && (
                <span className="text-[hsl(var(--fg-tertiary))] font-normal">({filterCounts.invoices})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments">
              {t("activity.filter.payments")}
              {filterCounts.payments > 0 && (
                <span className="text-[hsl(var(--fg-tertiary))] font-normal">({filterCounts.payments})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers">
              {t("activity.filter.customers")}
              {filterCounts.customers > 0 && (
                <span className="text-[hsl(var(--fg-tertiary))] font-normal">({filterCounts.customers})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] rounded-xl md:rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] overflow-hidden">
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
          <ActivityFeedList
            groups={filteredGroups}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            onActivityClick={handleActivityClick}
          />
        )}
      </div>
        </>
      )}
    </div>
  );
}

ActivitiesPage.displayName = "ActivitiesPage";
