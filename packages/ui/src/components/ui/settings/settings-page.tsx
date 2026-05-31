"use client"

import { useTranslation } from "react-i18next"
import {
  useBackupStore,
  useDeviceStore,
  useAuthStore,
} from "@hisabche/store"
import {
  Button,
  Card,
  CardContent,
  Badge,
} from "@hisabche/ui"
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
} from "lucide-react"

export function SettingsPage() {
  const { t } = useTranslation()
  const {
    autoBackupEnabled,
    setAutoBackup,
    addBackup,
    exportData,
    backups,
  } = useBackupStore()
  const { performanceMode, setPerformanceMode } =
    useDeviceStore()
  const { user, logout } = useAuthStore()

  const handleExportJSON = () => {
    const data = exportData()
    const blob = new Blob([data], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hisabche-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    a.click()
    addBackup({
      id: `backup-${Date.now()}`,
      timestamp: Date.now(),
      size: `${Math.floor(blob.size / 1024)} KB`,
      type: "manual",
      status: "completed",
    })
  }

  const latestBackup = backups?.[0]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* ── Header ── */}
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-[var(--hisab-muted-fg)]">
          {t(
            "settings.description",
            "مدیریت حساب، بکاپ و تنظیمات برنامه"
          )}
        </p>
      </div>

      {/* ── Account ── */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hisab-primary)]/10 text-lg font-bold text-[var(--hisab-primary)]">
              {user?.fullName?.charAt(0) || "ح"}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">
                {user?.fullName ||
                  t("common.noName", "کاربر")}
              </h2>
              <p className="truncate text-sm text-[var(--hisab-muted-fg)]">
                {user?.email}
              </p>
            </div>
            <Badge variant="success" className="ms-auto shrink-0">
              {t("common.active", "فعال")}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--hisab-border)] p-4 text-start">
              <p className="mb-1 text-xs text-[var(--hisab-muted-fg)]">
                {t(
                  "settings.businessName",
                  "کسب‌وکار"
                )}
              </p>
              <p className="font-medium">
                {user?.businessName ||
                  t("settings.notSet", "ثبت نشده")}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--hisab-border)] p-4 text-start">
              <p className="mb-1 text-xs text-[var(--hisab-muted-fg)]">
                {t(
                  "settings.memberSince",
                  "تاریخ عضویت"
                )}
              </p>
              <p className="font-medium">
                {user?.createdAt
                  ? new Date(
                      user.createdAt
                    ).toLocaleDateString("fa-AF")
                  : "-"}
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            className="mt-5"
            icon={<LogOut className="size-4" aria-hidden />}
            onClick={logout}
          >
            {t("auth.signOut")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Backup ── */}
      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Database
              className="size-5 text-[var(--hisab-primary)]"
              aria-hidden
            />
            <h2 className="text-lg font-semibold">
              {t("settings.backup")}
            </h2>
          </div>

          {/* Auto-backup toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] p-4">
            <div className="text-start">
              <p className="font-medium">
                {t(
                  "settings.autoBackup",
                  "بکاپ خودکار"
                )}
              </p>
              <p className="text-sm text-[var(--hisab-muted-fg)]">
                {t(
                  "settings.autoBackupDesc",
                  "هر ۲۴ ساعت بکاپ گرفته شود"
                )}
              </p>
            </div>
            <button
              onClick={() =>
                setAutoBackup(!autoBackupEnabled)
              }
              role="switch"
              aria-checked={autoBackupEnabled}
              className={`relative h-7 w-14 shrink-0 rounded-full transition-all ${
                autoBackupEnabled
                  ? "bg-[var(--hisab-primary)]"
                  : "bg-[var(--hisab-muted)]"
              }`}
            >
              <div
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  autoBackupEnabled
                    ? "right-1"
                    : "right-8"
                }`}
              />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="outline"
              icon={
                <FileJson
                  className="size-4"
                  aria-hidden
                />
              }
              onClick={handleExportJSON}
            >
              {t(
                "settings.exportJSON",
                "خروجی JSON"
              )}
            </Button>
            <Button
              variant="outline"
              icon={
                <FileText
                  className="size-4"
                  aria-hidden
                />
              }
            >
              {t(
                "settings.exportCSV",
                "خروجی CSV"
              )}
            </Button>
            <Button
              variant="outline"
              icon={
                <Cloud
                  className="size-4"
                  aria-hidden
                />
              }
            >
              {t("settings.sync", "همگام‌سازی")}
            </Button>
          </div>

          {latestBackup && (
            <div className="rounded-xl border border-[var(--hisab-success)]/20 bg-[var(--hisab-success)]/5 p-4 text-start">
              <div className="mb-2 flex items-center gap-2 text-[var(--hisab-success)]">
                <Shield className="size-4" aria-hidden />
                <span className="font-medium">
                  {t(
                    "settings.lastBackup",
                    "آخرین بکاپ"
                  )}
                </span>
              </div>
              <div className="space-y-1 text-sm text-[var(--hisab-muted-fg)]">
                <p>
                  {t(
                    "settings.backupCount",
                    "تعداد بکاپ‌ها"
                  )}
                  : {backups.length}
                </p>
                <p>
                  {t(
                    "settings.backupDate",
                    "تاریخ"
                  )}
                  :{" "}
                  {new Date(
                    latestBackup.timestamp
                  ).toLocaleDateString("fa-AF")}
                </p>
                <p>
                  {t(
                    "settings.backupSize",
                    "حجم"
                  )}
                  : {latestBackup.size}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Performance ── */}
      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Monitor
              className="size-5 text-[var(--hisab-primary)]"
              aria-hidden
            />
            <h2 className="text-lg font-semibold">
              {t("settings.performance", "عملکرد")}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              ["auto", "normal", "lite"] as const
            ).map((mode) => (
              <Button
                key={mode}
                variant={
                  performanceMode === mode
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  setPerformanceMode(mode)
                }
              >
                {mode === "auto" &&
                  t(
                    "settings.perfAuto",
                    "خودکار"
                  )}
                {mode === "normal" &&
                  t(
                    "settings.perfNormal",
                    "معمولی"
                  )}
                {mode === "lite" &&
                  t(
                    "settings.perfLite",
                    "اقتصادی"
                  )}
              </Button>
            ))}
          </div>

          <p className="text-sm text-[var(--hisab-muted-fg)]">
            {t(
              "settings.perfDesc",
              "حالت اقتصادی برای دستگاه‌های ضعیف‌تر مناسب است"
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Safety ── */}
      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Shield
              className="size-5 text-[var(--hisab-primary)]"
              aria-hidden
            />
            <h2 className="text-lg font-semibold">
              {t("settings.safety", "امنیت داده‌ها")}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              t(
                "settings.safety1",
                "اطلاعات شما به‌صورت امن ذخیره می‌شود"
              ),
              t(
                "settings.safety2",
                "بدون اینترنت هم قابل استفاده است"
              ),
              t(
                "settings.safety3",
                "بازیابی اطلاعات تا ۳۰ روز ممکن است"
              ),
              t(
                "settings.safety4",
                "همگام‌سازی رمزنگاری‌شده انجام می‌شود"
              ),
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-[var(--hisab-border)] p-3 text-start"
              >
                <Check
                  className="size-4 shrink-0 text-[var(--hisab-success)]"
                  aria-hidden
                />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Storage ── */}
      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Download
              className="size-5 text-[var(--hisab-primary)]"
              aria-hidden
            />
            <h2 className="text-lg font-semibold">
              {t("settings.storage", "حافظه و کش")}
            </h2>
          </div>

          <div className="rounded-xl border border-[var(--hisab-border)] p-4 text-start">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-[var(--hisab-muted-fg)]">
                {t("settings.cache", "کش برنامه")}
              </span>
              <Badge variant="secondary">24 MB</Badge>
            </div>
            <Button
              variant="outline"
              icon={
                <Trash2
                  className="size-4"
                  aria-hidden
                />
              }
            >
              {t(
                "settings.clearCache",
                "پاک کردن کش"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}