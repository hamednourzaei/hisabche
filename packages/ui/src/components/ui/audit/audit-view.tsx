// packages/ui/src/components/ui/audit/audit-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Shield, Search, Download, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id: string;
  created_at: string;
  ip_address?: string;
  user_name?: string;
  details?: Record<string, any>;
}

interface AuditViewProps {
  t: (key: string, fallback?: string) => string;
  logs: AuditLog[];
  total: number;
  page: number;
  isLoading: boolean;
  error?: string | null;
  filters: {
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  };
  onFiltersChange: (filters: any) => void;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

const ACTIONS = ["create", "update", "delete", "login", "logout", "export", "view"] as const;
const ENTITIES = ["invoice", "product", "customer", "employee", "project", "workspace", "user", "workspace"] as const;

export function AuditView({ 
  t, 
  logs, 
  total, 
  page, 
  isLoading, 
  error,
  filters, 
  onFiltersChange, 
  onPageChange,
  onRefresh,
  onExport
}: AuditViewProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || "");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        onFiltersChange({ ...filters, search: searchTerm || undefined, page: 1 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, filters, onFiltersChange]);

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      create: "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]",
      update: "bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]",
      delete: "bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]",
      login: "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]",
      logout: "bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]",
      export: "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
      view: "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]",
    };
    const actionLabels: Record<string, string> = {
      create: "ایجاد",
      update: "ویرایش",
      delete: "حذف",
      login: "ورود",
      logout: "خروج",
      export: "خروجی",
      view: "مشاهده",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[action] || map.view)}>
        {actionLabels[action] || action}
      </span>
    );
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("fa-AF", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return date;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 30));

  const clearFilters = () => {
    setSearchTerm("");
    onFiltersChange({ 
      action: undefined, 
      entityType: undefined, 
      startDate: undefined, 
      endDate: undefined, 
      search: undefined,
      page: 1 
    });
  };

  const hasFilters = !!(filters.action || filters.entityType || filters.startDate || filters.endDate || filters.search);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("audit.title", "حسابرسی")}</h1>
          <span className="text-xs text-[hsl(var(--fg-tertiary))] bg-[hsl(var(--surface-muted))] px-2 py-1 rounded-full">
            {total.toLocaleString("fa-AF")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
                "hover:bg-[hsl(var(--surface-muted))]",
                isLoading && "animate-spin"
              )}
              disabled={isLoading}
            >
              <RefreshCw className="size-4" />
              {t("audit.refresh", "بروزرسانی")}
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
                "hover:bg-[hsl(var(--surface-muted))]",
              )}
            >
              <Download className="size-4" />
              {t("audit.export", "خروجی")}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("audit.search", "جستجو در گزارش‌ها...")}
            className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] pr-9 pl-3 py-2 text-xs focus:border-[hsl(var(--color-primary))] focus:outline-none"
          />
        </div>

        <select
          value={filters.action || ""}
          onChange={(e) => onFiltersChange({ ...filters, action: e.target.value || undefined, page: 1 })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        >
          <option value="">{t("common.all", "همه عملیات‌ها")}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{t(`audit.${a}`, a)}</option>
          ))}
        </select>

        <select
          value={filters.entityType || ""}
          onChange={(e) => onFiltersChange({ ...filters, entityType: e.target.value || undefined, page: 1 })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        >
          <option value="">{t("common.all", "همه موجودیت‌ها")}</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{t(`audit.${e}`, e)}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.startDate || ""}
          onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || undefined, page: 1 })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        />

        <input
          type="date"
          value={filters.endDate || ""}
          onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || undefined, page: 1 })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          >
            {t("common.clear", "پاک کردن")}
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center">
          <AlertCircle className="size-8 mx-auto mb-2 text-[hsl(var(--color-destructive))]" />
          <p className="text-[hsl(var(--color-destructive))]">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 text-sm text-[hsl(var(--color-primary))] hover:underline"
            >
              {t("audit.retry", "تلاش مجدد")}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">{t("audit.noLogs", "هیچ گزارشی موجود نیست")}</p>
            <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
              {t("audit.noLogsHint", "با انجام عملیات‌ها، گزارش‌ها در اینجا نمایش داده می‌شوند")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("audit.date", "تاریخ")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("audit.action", "عملیات")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs">
                    {t("audit.entity", "موجودیت")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs hidden sm:table-cell">
                    {t("audit.user", "کاربر")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs hidden md:table-cell">
                    {t("audit.details", "جزئیات")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">{actionBadge(log.action)}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                      {log.entity_type}
                      {log.entity_id && (
                        <span className="block text-[10px] font-mono text-[hsl(var(--fg-tertiary))]">
                          {log.entity_id.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden sm:table-cell">
                      {log.user_name || log.user_id?.slice(0, 8) || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-tertiary))] hidden md:table-cell max-w-[150px] truncate">
                      {log.details ? JSON.stringify(log.details).slice(0, 50) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t("audit.showing", "نمایش")} {(page - 1) * 30 + 1} - {Math.min(page * 30, total)} {t("audit.of", "از")} {total.toLocaleString("fa-AF")}
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onPageChange(Math.max(1, page - 1))} 
              disabled={page === 1}
              className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40 hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="text-sm text-[hsl(var(--fg-secondary))]">
              {page} / {totalPages}
            </span>
            <button 
              onClick={() => onPageChange(Math.min(totalPages, page + 1))} 
              disabled={page >= totalPages}
              className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40 hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}