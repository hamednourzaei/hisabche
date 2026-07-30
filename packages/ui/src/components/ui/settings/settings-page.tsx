// packages/ui/src/components/ui/settings/settings-page.tsx
"use client";

import { useState, useCallback, useMemo, useRef, memo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useBackupStore,
  useDeviceStore,
  useAuthStore,
} from "@hisabche/store";
import { useWorkspaces, useUpdateWorkspace } from "@hisabche/api";
import { cn } from "@/lib/utils";
import { Switch } from "../switch";
import {
  Shield,
  Monitor,
  Database,
  FileJson,
  FileText,
  Cloud,
  Download,
  Trash2,
  LogOut,
  Check,
  Loader2,
  CreditCard,
  ChevronLeft,
  ListChecks,
  Stamp,
  Upload,
  X,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SettingsPage v3 — Memoized · Performance Optimized
   ✅ memo · useCallback · ثابت‌های خارج از کامپوننت
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Constants ─────────────────────────────────────────────────────────────

const SAFETY_ITEMS = [
  { key: "settings.safety1", fallback: "اطلاعات شما به‌صورت امن ذخیره می‌شود" },
  { key: "settings.safety2", fallback: "بدون اینترنت هم قابل استفاده است" },
  { key: "settings.safety3", fallback: "بازیابی اطلاعات تا ۳۰ روز ممکن است" },
  { key: "settings.safety4", fallback: "همگام‌سازی رمزنگاری‌شده انجام می‌شود" },
] as const;

const PERFORMANCE_MODES = [
  { value: "auto", labelKey: "settings.perfAuto", fallback: "خودکار" },
  { value: "normal", labelKey: "settings.perfNormal", fallback: "معمولی" },
  { value: "lite", labelKey: "settings.perfLite", fallback: "اقتصادی" },
] as const;

// ─── Account Section ──────────────────────────────────────────────────────

const AccountSection = memo(function AccountSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const { user, logout } = useAuthStore();

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-lg font-bold text-[hsl(var(--color-primary))] shrink-0">
            {user?.fullName?.charAt(0) || "ح"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-[hsl(var(--fg-primary))]">
              {user?.fullName || t("common.noName")}
            </h2>
            <p className="truncate text-sm text-[hsl(var(--fg-secondary))]">
              {user?.email}
            </p>
          </div>
          <span className="ms-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border border-[hsl(var(--color-success)/0.2)]">
            {t("common.active")}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
            <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
              {t("settings.businessName")}
            </p>
            <p className="font-medium text-[hsl(var(--fg-primary))]">
              {user?.businessName || t("settings.notSet")}
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
            <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
              {t("settings.memberSince")}
            </p>
            <p className="font-medium text-[hsl(var(--fg-primary))]">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("fa-AF")
                : "-"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2",
            "rounded-full px-4 py-2.5 text-sm font-bold",
            "bg-[hsl(var(--color-destructive))] text-white",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "motion-reduce:transition-none",
          )}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t("auth.signOut")}
        </button>
      </div>
    </div>
  );
});
AccountSection.displayName = "AccountSection";

// ─── Business Stamp Section ───────────────────────────────────────────────
// آپلود مهر/امضای صاحب کسب‌وکار — یک‌بار ثبت می‌شود و طبق business.stampUrl
// روی همه‌ی فاکتورها (InvoiceDocument) نمایش داده می‌شود.

const ALLOWED_STAMP_TYPES = ["image/png", "image/svg+xml"];
const MAX_STAMP_SIZE = 1024 * 1024; // 1MB — چون به‌صورت data URL در ستون متنی ذخیره می‌شود

const BusinessStampSection = memo(function BusinessStampSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const { data: workspaces } = useWorkspaces();
  const updateWorkspace = useUpdateWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ فرض تک-workspace: اولین workspace کاربر (فعلاً هیچ workspace-switcher‌ای در برنامه نیست)
  const workspace = useMemo(
    () => (Array.isArray(workspaces) ? workspaces[0] : undefined) as
      | { id: string; stamp_url?: string | null; myRole?: string }
      | undefined,
    [workspaces],
  );
  const workspaceId = workspace?.id;
  const stampUrl: string | null = workspace?.stamp_url ?? null;
  const canEdit = workspace?.myRole === "owner" || workspace?.myRole === "admin";
  const isSaving = updateWorkspace.isPending;

  const handlePickFile = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !workspaceId) return;

      if (!ALLOWED_STAMP_TYPES.includes(file.type)) {
        setError(t("settings.stampInvalidType"));
        return;
      }
      if (file.size > MAX_STAMP_SIZE) {
        setError(t("settings.stampTooLarge"));
        return;
      }
      setError(null);

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        updateWorkspace.mutate({ id: workspaceId, stampUrl: dataUrl });
      };
      reader.onerror = () => setError(t("settings.stampUploadFailed"));
      reader.readAsDataURL(file);
    },
    [workspaceId, updateWorkspace, t],
  );

  const handleRemove = useCallback(() => {
    if (!workspaceId) return;
    updateWorkspace.mutate({ id: workspaceId, stampUrl: null });
  }, [workspaceId, updateWorkspace]);

  if (!canEdit) return null;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Stamp className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.businessStamp")}
          </h2>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("settings.businessStampDesc")}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-40 shrink-0 items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-muted))]">
            {stampUrl ? (
              <img src={stampUrl} alt="" className="max-h-16 max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-[hsl(var(--fg-tertiary))]">
                {t("settings.stampNotSet")}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePickFile}
              disabled={isSaving || !workspaceId}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
                "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
                "transition-colors duration-150 disabled:opacity-40",
                "motion-reduce:transition-none",
              )}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {t("settings.uploadStamp")}
            </button>

            {stampUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSaving}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                  "text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.08)]",
                  "transition-colors duration-150 disabled:opacity-40",
                )}
              >
                <X className="size-4" aria-hidden="true" />
                {t("settings.removeStamp")}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-[hsl(var(--color-destructive))]">{error}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
});
BusinessStampSection.displayName = "BusinessStampSection";

// ─── Backup Section ───────────────────────────────────────────────────────

const BackupSection = memo(function BackupSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const {
    autoBackupEnabled,
    setAutoBackup,
    addBackup,
    exportData,
    backups,
  } = useBackupStore();

  const [isExporting, setIsExporting] = useState(false);

  const handleExportJSON = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = exportData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hisabche-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      addBackup({
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        size: `${Math.floor(blob.size / 1024)} KB`,
        type: "manual",
        status: "completed",
      });
    } finally {
      setIsExporting(false);
    }
  }, [exportData, addBackup]);

  const latestBackup = backups?.[0];

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.backup")}
          </h2>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] p-4">
          <div className="min-w-0 text-start">
            <p className="font-medium text-[hsl(var(--fg-primary))]">
              {t("settings.autoBackup")}
            </p>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t("settings.autoBackupDesc")}
            </p>
          </div>
          <Switch checked={autoBackupEnabled} onCheckedChange={setAutoBackup} className="shrink-0" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExporting}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150 disabled:opacity-40",
              "motion-reduce:transition-none",
            )}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileJson className="size-4" aria-hidden="true" />
            )}
            {t("settings.exportJSON")}
          </button>

          <button
            type="button"
            disabled
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]",
              "opacity-40 cursor-not-allowed",
            )}
          >
            <FileText className="size-4" aria-hidden="true" />
            {t("settings.exportCSV")}
          </button>

          <button
            type="button"
            disabled
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]",
              "opacity-40 cursor-not-allowed",
            )}
          >
            <Cloud className="size-4" aria-hidden="true" />
            {t("settings.sync")}
          </button>
        </div>

        {latestBackup && (
          <div className="rounded-xl border border-[hsl(var(--color-success)/0.2)] bg-[hsl(var(--color-success)/0.05)] p-4 text-start">
            <div className="mb-2 flex items-center gap-2 text-[hsl(var(--color-success))]">
              <Shield className="size-4" aria-hidden="true" />
              <span className="font-medium">
                {t("settings.lastBackup")}
              </span>
            </div>
            <div className="space-y-1 text-sm text-[hsl(var(--fg-secondary))]">
              <p>
                {t("settings.backupCount")}: {backups.length}
              </p>
              <p>
                {t("settings.backupDate")}:{" "}
                {new Date(latestBackup.timestamp).toLocaleDateString("fa-AF")}
              </p>
              <p>
                {t("settings.backupSize")}: {latestBackup.size}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
BackupSection.displayName = "BackupSection";

// ─── Performance Section ──────────────────────────────────────────────────

const PerformanceSection = memo(function PerformanceSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };
  const { performanceMode, setPerformanceMode } = useDeviceStore();

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Monitor className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.performance")}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERFORMANCE_MODES.map(({ value, labelKey, fallback }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPerformanceMode(value)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                "motion-reduce:transition-none",
                performanceMode === value
                  ? "bg-[var(--gradient-brand)] text-white shadow-sm"
                  : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]",
              )}
            >
              {t(labelKey, fallback)}
            </button>
          ))}
        </div>

        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("settings.perfDesc")}
        </p>
      </div>
    </div>
  );
});
PerformanceSection.displayName = "PerformanceSection";

// ─── Safety Section ───────────────────────────────────────────────────────

const SafetySection = memo(function SafetySection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.safety")}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SAFETY_ITEMS.map(({ key, fallback }) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border-default))] p-3 text-start"
            >
              <Check className="size-4 shrink-0 text-[hsl(var(--color-success))]" aria-hidden="true" />
              <span className="text-sm text-[hsl(var(--fg-primary))]">
                {t(key, fallback)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
SafetySection.displayName = "SafetySection";

// ─── Storage Section ──────────────────────────────────────────────────────

const StorageSection = memo(function StorageSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  const handleClearCache = useCallback(() => {
    // TODO: Implement cache clearing
    console.log("Cache cleared");
  }, []);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.storage")}
          </h2>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--fg-secondary))]">
              {t("settings.cache")}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border border-[hsl(var(--border-default))]">
              24 MB
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearCache}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("settings.clearCache")}
          </button>
        </div>
      </div>
    </div>
  );
});
StorageSection.displayName = "StorageSection";

// ─── Billing Link ────────────────────────────────────────────────────────────

const BillingSection = memo(function BillingSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  return (
    <Link
      href="/billing"
      className={cn(
        "flex items-center gap-3 rounded-2xl p-4 sm:p-5",
        "border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
        "transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))]",
        "motion-reduce:transition-none"
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0">
        <CreditCard className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">
          {t("nav.billing")}
        </p>
        <p className="text-sm text-[hsl(var(--fg-secondary))] truncate">
          {t("nav.billing.description")}
        </p>
      </div>
      <ChevronLeft className="size-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0" aria-hidden="true" />
    </Link>
  );
});
BillingSection.displayName = "BillingSection";

const WorkflowTemplatesSection = memo(function WorkflowTemplatesSection() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  return (
    <Link
      href="/workflow-templates"
      className={cn(
        "flex items-center gap-3 rounded-2xl p-4 sm:p-5",
        "border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
        "transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))]",
        "motion-reduce:transition-none"
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0">
        <ListChecks className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">
          {t("workflow.templates.title")}
        </p>
        <p className="text-sm text-[hsl(var(--fg-secondary))] truncate">
          {t("workflow.templates.description")}
        </p>
      </div>
      <ChevronLeft className="size-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0" aria-hidden="true" />
    </Link>
  );
});
WorkflowTemplatesSection.displayName = "WorkflowTemplatesSection";

// ─── Main Page ─────────────────────────────────────────────────────────────

export const SettingsPage = memo(function SettingsPage() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] mb-2">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("settings.description")}
        </p>
      </div>

      <AccountSection />
      <BusinessStampSection />
      <BillingSection />
      <WorkflowTemplatesSection />
      <BackupSection />
      <PerformanceSection />
      <SafetySection />
      <StorageSection />
    </div>
  );
});

SettingsPage.displayName = "SettingsPage";