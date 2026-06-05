"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useBackupStore,
  useDeviceStore,
  useAuthStore,
} from "@hisabche/store"
import { Button } from "../button"
import { Card, CardContent } from "../card"
import { Badge } from "../badge"
import { Switch } from "../switch"
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

// Settings sections as separate components for clean separation
function AccountSection() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            {user?.fullName?.charAt(0) || "ح"}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              {user?.fullName || t("common.noName", "کاربر")}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Badge variant="success" className="ms-auto shrink-0">
            {t("common.active", "فعال")}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4 text-start">
            <p className="mb-1 text-xs text-muted-foreground">
              {t("settings.businessName", "کسب‌وکار")}
            </p>
            <p className="font-medium">
              {user?.businessName || t("settings.notSet", "ثبت نشده")}
            </p>
          </div>
          <div className="rounded-xl border p-4 text-start">
            <p className="mb-1 text-xs text-muted-foreground">
              {t("settings.memberSince", "تاریخ عضویت")}
            </p>
            <p className="font-medium">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("fa-AF")
                : "-"}
            </p>
          </div>
        </div>

        <Button
          variant="destructive"
          className="mt-5"
          onClick={logout}
        >
          <LogOut className="me-2 size-4" aria-hidden />
          {t("auth.signOut")}
        </Button>
      </CardContent>
    </Card>
  )
}

function BackupSection() {
  const { t } = useTranslation()
  const {
    autoBackupEnabled,
    setAutoBackup,
    addBackup,
    exportData,
    backups,
  } = useBackupStore()

  const [isExporting, setIsExporting] = useState(false)

  const handleExportJSON = async () => {
    setIsExporting(true)
    try {
      const data = exportData()
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `hisabche-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      addBackup({
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        size: `${Math.floor(blob.size / 1024)} KB`,
        type: "manual",
        status: "completed",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const latestBackup = backups?.[0]

  return (
    <Card className="glass-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{t("settings.backup")}</h2>
        </div>

        <div className="flex items-center justify-between rounded-xl border p-4">
          <div className="text-start">
            <p className="font-medium">{t("settings.autoBackup", "بکاپ خودکار")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.autoBackupDesc", "هر ۲۴ ساعت بکاپ گرفته شود")}
            </p>
          </div>
          <Switch
            checked={autoBackupEnabled}
            onCheckedChange={setAutoBackup}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={handleExportJSON}
            disabled={isExporting}
          >
            <FileJson className="me-2 size-4" aria-hidden />
            {t("settings.exportJSON", "خروجی JSON")}
          </Button>
          <Button variant="outline" disabled>
            <FileText className="me-2 size-4" aria-hidden />
            {t("settings.exportCSV", "خروجی CSV")}
          </Button>
          <Button variant="outline" disabled>
            <Cloud className="me-2 size-4" aria-hidden />
            {t("settings.sync", "همگام‌سازی")}
          </Button>
        </div>

        {latestBackup && (
          <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-start">
            <div className="mb-2 flex items-center gap-2 text-success">
              <Shield className="size-4" aria-hidden />
              <span className="font-medium">{t("settings.lastBackup", "آخرین بکاپ")}</span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t("settings.backupCount", "تعداد بکاپ‌ها")}: {backups.length}</p>
              <p>{t("settings.backupDate", "تاریخ")}: {new Date(latestBackup.timestamp).toLocaleDateString("fa-AF")}</p>
              <p>{t("settings.backupSize", "حجم")}: {latestBackup.size}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PerformanceSection() {
  const { t } = useTranslation()
  const { performanceMode, setPerformanceMode } = useDeviceStore()

  const modes = [
    { value: "auto", labelKey: "settings.perfAuto", fallback: "خودکار" },
    { value: "normal", labelKey: "settings.perfNormal", fallback: "معمولی" },
    { value: "lite", labelKey: "settings.perfLite", fallback: "اقتصادی" },
  ] as const

  return (
    <Card className="glass-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Monitor className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{t("settings.performance", "عملکرد")}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {modes.map(({ value, labelKey, fallback }) => (
            <Button
              key={value}
              variant={performanceMode === value ? "default" : "outline"}
              onClick={() => setPerformanceMode(value)}
            >
              {t(labelKey, fallback)}
            </Button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {t("settings.perfDesc", "حالت اقتصادی برای دستگاه‌های ضعیف‌تر مناسب است")}
        </p>
      </CardContent>
    </Card>
  )
}

function SafetySection() {
  const { t } = useTranslation()

  const safetyItems = [
    { key: "settings.safety1", fallback: "اطلاعات شما به‌صورت امن ذخیره می‌شود" },
    { key: "settings.safety2", fallback: "بدون اینترنت هم قابل استفاده است" },
    { key: "settings.safety3", fallback: "بازیابی اطلاعات تا ۳۰ روز ممکن است" },
    { key: "settings.safety4", fallback: "همگام‌سازی رمزنگاری‌شده انجام می‌شود" },
  ]

  return (
    <Card className="glass-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{t("settings.safety", "امنیت داده‌ها")}</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {safetyItems.map(({ key, fallback }) => (
            <div key={key} className="flex items-center gap-2 rounded-xl border p-3 text-start">
              <Check className="size-4 shrink-0 text-success" aria-hidden />
              <span className="text-sm">{t(key, fallback)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StorageSection() {
  const { t } = useTranslation()

  return (
    <Card className="glass-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{t("settings.storage", "حافظه و کش")}</h2>
        </div>

        <div className="rounded-xl border p-4 text-start">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("settings.cache", "کش برنامه")}</span>
            <Badge variant="secondary">24 MB</Badge>
          </div>
          <Button variant="outline">
            <Trash2 className="me-2 size-4" aria-hidden />
            {t("settings.clearCache", "پاک کردن کش")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.description", "مدیریت حساب، بکاپ و تنظیمات برنامه")}
        </p>
      </div>

      <AccountSection />
      <BackupSection />
      <PerformanceSection />
      <SafetySection />
      <StorageSection />
    </div>
  )
}