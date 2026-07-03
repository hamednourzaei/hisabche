// packages/ui/src/components/ui/audit/audit-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Shield, Search, Download, Calendar } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id: string;
  created_at: string;
  ip_address?: string;
}

interface AuditViewProps {
  t: (key: string, fallback?: string) => string;
  logs: AuditLog[];
  total: number;
  page: number;
  isLoading: boolean;
  filters: {
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  };
  onFiltersChange: (filters: any) => void;
  onPageChange: (page: number) => void;
}

const ACTIONS = ["create", "update", "delete", "login", "logout", "export", "view"] as const;
const ENTITIES = ["invoice", "product", "customer", "employee", "project", "workspace"] as const;

export function AuditView({ t, logs, total, page, isLoading, filters, onFiltersChange, onPageChange }: AuditViewProps) {
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
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", map[action] || map.view)}>
        {t(`audit.${action}`, action)}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fa-AF", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t("audit.title", "حسابرسی")}</h1>
        </div>
        <button className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
          "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
          "hover:bg-[hsl(var(--surface-muted))]",
        )}>
          <Download className="size-4" />
          {t("audit.export", "خروجی")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.action || ""}
          onChange={(e) => onFiltersChange({ ...filters, action: e.target.value || undefined })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        >
          <option value="">{t("common.all", "همه عملیات‌ها")}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{t(`audit.${a}`, a)}</option>
          ))}
        </select>
        <select
          value={filters.entityType || ""}
          onChange={(e) => onFiltersChange({ ...filters, entityType: e.target.value || undefined })}
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
          onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || undefined })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        />
        <input
          type="date"
          value={filters.endDate || ""}
          onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || undefined })}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs"
        />
      </div>

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
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                <th className="px-4 py-3 text-start font-medium">{t("audit.date", "تاریخ")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("audit.action", "عملیات")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("audit.entity", "موجودیت")}</th>
                <th className="px-4 py-3 text-start font-medium hidden sm:table-cell">ID</th>
                <th className="px-4 py-3 text-start font-medium hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors">
                  <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">{actionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">{log.entity_type}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[hsl(var(--fg-tertiary))] hidden sm:table-cell">{log.entity_id?.slice(0, 8) || "-"}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--fg-tertiary))] hidden md:table-cell">{log.ip_address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
            className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40">
            {t("action.previous", "قبلی")}
          </button>
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{page} / {Math.ceil(total / 30)}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= Math.ceil(total / 30)}
            className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40">
            {t("action.next", "بعدی")}
          </button>
        </div>
      )}
    </div>
  );
}