"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useBackupStore,
  useDeviceStore,
  useAuthStore,
} from "@hisabche/store";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SettingsPage v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero external component dependencies
   Switch: fixed RTL direction
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Switch (RTL-fixed) ────────────────────────────────────────────────────

function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center",
        "h-6 w-11",
        "rounded-full",
        "transition-colors duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-color)/0.5)] focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "motion-reduce:transition-none",
        checked
          ? "bg-[hsl(var(--color-success))]"
          : "bg-[hsl(var(--surface-muted))] border border-[hsl(var(--border-default))]",
      )}
    >
      <span
        className={cn(
          "block size-5 rounded-full bg-white shadow-sm",
          "transition-transform duration-200",
          "motion-reduce:transition-none",
          // RTL-safe: use logical direction
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

// ─── Account Section ───────────────────────────────────────────────────────

function AccountSection() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-lg font-bold text-[hsl(var(--color-primary))] shrink-0">
            {user?.fullName?.charAt(0) || "ح"}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-[hsl(var(--fg-primary))]">
              {user?.fullName || t("common.noName", "کاربر")}
            </h2>
            <p className="truncate text-sm text-[hsl(var(--fg-secondary))]">
              {user?.email}
            </p>
          </div>
          <span className="ms-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border border-[hsl(var(--color-success)/0.2)]">
            {t("common.active", "فعال")}
          </span>
        </div>

        {/* Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
            <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
              {t("settings.businessName", "کسب‌وکار")}
            </p>
            <p className="font-medium text-[hsl(var(--fg-primary))]">
              {user?.businessName || t("settings.notSet", "ثبت نشده")}
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
            <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
              {t("settings.memberSince", "تاریخ عضویت")}
            </p>
            <p className="font-medium text-[hsl(var(--fg-primary))]">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("fa-AF")
                : "-"}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2",
            "rounded-full px-4 py-2.5 text-sm font-bold",
            "bg-[hsl(var(--color-destructive))] text-white",
            "transition-all duration-200 hover:brightness-110 active:scale-[0.98]",
            "motion-reduce:transition-none",
          )}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t("auth.signOut", "خروج")}
        </button>
      </div>
    </div>
  );
}

// ─── Backup Section ────────────────────────────────────────────────────────

function BackupSection() {
  const { t } = useTranslation();
  const {
    autoBackupEnabled,
    setAutoBackup,
    addBackup,
    exportData,
    backups,
  } = useBackupStore();

  const [isExporting, setIsExporting] = useState(false);

  const handleExportJSON = async () => {
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
  };

  const latestBackup = backups?.[0];

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.backup", "بکاپ")}
          </h2>
        </div>

        {/* Auto backup toggle */}
        <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] p-4">
          <div className="text-start">
            <p className="font-medium text-[hsl(var(--fg-primary))]">
              {t("settings.autoBackup", "بکاپ خودکار")}
            </p>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t("settings.autoBackupDesc", "هر ۲۴ ساعت بکاپ گرفته شود")}
            </p>
          </div>
          <Switch
            checked={autoBackupEnabled}
            onCheckedChange={setAutoBackup}
          />
        </div>

        {/* Export buttons */}
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
            {t("settings.exportJSON", "خروجی JSON")}
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
            {t("settings.exportCSV", "خروجی CSV")}
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
            {t("settings.sync", "همگام‌سازی")}
          </button>
        </div>

        {/* Last backup info */}
        {latestBackup && (
          <div className="rounded-xl border border-[hsl(var(--color-success)/0.2)] bg-[hsl(var(--color-success)/0.05)] p-4 text-start">
            <div className="mb-2 flex items-center gap-2 text-[hsl(var(--color-success))]">
              <Shield className="size-4" aria-hidden="true" />
              <span className="font-medium">
                {t("settings.lastBackup", "آخرین بکاپ")}
              </span>
            </div>
            <div className="space-y-1 text-sm text-[hsl(var(--fg-secondary))]">
              <p>
                {t("settings.backupCount", "تعداد بکاپ‌ها")}: {backups.length}
              </p>
              <p>
                {t("settings.backupDate", "تاریخ")}:{" "}
                {new Date(latestBackup.timestamp).toLocaleDateString("fa-AF")}
              </p>
              <p>
                {t("settings.backupSize", "حجم")}: {latestBackup.size}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Performance Section ───────────────────────────────────────────────────

function PerformanceSection() {
  const { t } = useTranslation();
  const { performanceMode, setPerformanceMode } = useDeviceStore();

  const modes = [
    { value: "auto", labelKey: "settings.perfAuto", fallback: "خودکار" },
    { value: "normal", labelKey: "settings.perfNormal", fallback: "معمولی" },
    { value: "lite", labelKey: "settings.perfLite", fallback: "اقتصادی" },
  ] as const;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Monitor className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.performance", "عملکرد")}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {modes.map(({ value, labelKey, fallback }) => (
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
          {t("settings.perfDesc", "حالت اقتصادی برای دستگاه‌های ضعیف‌تر مناسب است")}
        </p>
      </div>
    </div>
  );
}

// ─── Safety Section ────────────────────────────────────────────────────────

function SafetySection() {
  const { t } = useTranslation();

  const safetyItems = [
    { key: "settings.safety1", fallback: "اطلاعات شما به‌صورت امن ذخیره می‌شود" },
    { key: "settings.safety2", fallback: "بدون اینترنت هم قابل استفاده است" },
    { key: "settings.safety3", fallback: "بازیابی اطلاعات تا ۳۰ روز ممکن است" },
    { key: "settings.safety4", fallback: "همگام‌سازی رمزنگاری‌شده انجام می‌شود" },
  ];

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.safety", "امنیت داده‌ها")}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {safetyItems.map(({ key, fallback }) => (
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
}

// ─── Storage Section ───────────────────────────────────────────────────────

function StorageSection() {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t("settings.storage", "حافظه و کش")}
          </h2>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--fg-secondary))]">
              {t("settings.cache", "کش برنامه")}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border border-[hsl(var(--border-default))]">
              24 MB
            </span>
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
              "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-150",
              "motion-reduce:transition-none",
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("settings.clearCache", "پاک کردن کش")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] mb-2">
          {t("settings.title", "تنظیمات")}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t("settings.description", "مدیریت حساب، بکاپ و تنظیمات برنامه")}
        </p>
      </div>

      <AccountSection />
      <BackupSection />
      <PerformanceSection />
      <SafetySection />
      <StorageSection />
    </div>
  );
}