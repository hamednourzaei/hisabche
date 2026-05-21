"use client"

import React from "react"

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

export default function SettingsPage() {
  const {
    autoBackupEnabled,
    setAutoBackup,
    addBackup,
    exportData,
    backups,
  } = useBackupStore()

  const {
    performanceMode,
    setPerformanceMode,
  } = useDeviceStore()

  const {
    user,
    logout,
  } = useAuthStore()

  const handleExportJSON =
    () => {
      const data =
        exportData()

      const blob =
        new Blob(
          [data],
          {
            type: "application/json",
          }
        )

      const url =
        URL.createObjectURL(
          blob
        )

      const a =
        document.createElement(
          "a"
        )

      a.href = url

      a.download = `hisabche-backup-${new Date()
        .toISOString()
        .slice(
          0,
          10
        )}.json`

      a.click()

      addBackup({
        id: `backup-${Date.now()}`,

        timestamp:
          Date.now(),

        size: `${Math.floor(
          blob.size /
            1024
        )} KB`,

        type: "manual",

        status:
          "completed",
      })
    }

  const latestBackup =
    backups?.[0]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-[var(--hisab-foreground)]">
          تنظیمات
        </h1>

        <p className="text-sm text-[var(--hisab-muted-fg)]">
          مدیریت
          حساب،
          بکاپ و
          تنظیمات
          برنامه
        </p>
      </div>

      {/* ACCOUNT */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hisab-primary)]/10 text-lg font-bold text-[var(--hisab-primary)]">
              {user?.fullName?.charAt(
                0
              ) || "ح"}
            </div>

            <div>
              <h2 className="font-semibold text-[var(--hisab-foreground)]">
                {user?.fullName ||
                  "کاربر"}
              </h2>

              <p className="text-sm text-[var(--hisab-muted-fg)]">
                {
                  user?.email
                }
              </p>
            </div>

            <Badge
              variant="success"
              className="ms-auto"
            >
              فعال
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--hisab-border)] p-4">
              <p className="mb-1 text-xs text-[var(--hisab-muted-fg)]">
                کسب‌وکار
              </p>

              <p className="font-medium text-[var(--hisab-foreground)]">
                {user?.businessName ||
                  "ثبت نشده"}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--hisab-border)] p-4">
              <p className="mb-1 text-xs text-[var(--hisab-muted-fg)]">
                تاریخ عضویت
              </p>

              <p className="font-medium text-[var(--hisab-foreground)]">
                {user?.createdAt
                  ? new Date(
                      user.createdAt
                    ).toLocaleDateString(
                      "fa-IR"
                    )
                  : "-"}
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            className="mt-5"
            icon={
              <LogOut className="size-4" />
            }
            onClick={
              logout
            }
          >
            خروج از
            حساب
          </Button>
        </CardContent>
      </Card>

      {/* BACKUP */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Database className="size-5 text-[var(--hisab-primary)]" />

            <h2 className="text-lg font-semibold text-[var(--hisab-foreground)]">
              بکاپ و
              بازیابی
            </h2>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] p-4">
            <div>
              <p className="font-medium text-[var(--hisab-foreground)]">
                بکاپ
                خودکار
              </p>

              <p className="text-sm text-[var(--hisab-muted-fg)]">
                هر ۲۴
                ساعت
                بکاپ
                گرفته
                شود
              </p>
            </div>

            <button
              onClick={() =>
                setAutoBackup(
                  !autoBackupEnabled
                )
              }
              className={`relative h-7 w-14 rounded-full transition-all ${
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
                <FileJson className="size-4" />
              }
              onClick={
                handleExportJSON
              }
            >
              خروجی
              JSON
            </Button>

            <Button
              variant="outline"
              icon={
                <FileText className="size-4" />
              }
            >
              خروجی
              CSV
            </Button>

            <Button
              variant="outline"
              icon={
                <Cloud className="size-4" />
              }
            >
              همگام‌سازی
            </Button>
          </div>

          {latestBackup && (
            <div className="rounded-xl border border-[var(--hisab-success)]/20 bg-[var(--hisab-success)]/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-[var(--hisab-success)]">
                <Shield className="size-4" />

                <span className="font-medium">
                  آخرین
                  بکاپ
                </span>
              </div>

              <div className="space-y-1 text-sm text-[var(--hisab-muted-fg)]">
                <p>
                  تعداد
                  بکاپ‌ها:
                  {
                    backups.length
                  }
                </p>

                <p>
                  تاریخ:
                  {" "}
                  {new Date(
                    latestBackup.timestamp
                  ).toLocaleDateString(
                    "fa-IR"
                  )}
                </p>

                <p>
                  حجم:
                  {" "}
                  {
                    latestBackup.size
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PERFORMANCE */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Monitor className="size-5 text-[var(--hisab-primary)]" />

            <h2 className="text-lg font-semibold text-[var(--hisab-foreground)]">
              عملکرد
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                "auto",
                "normal",
                "lite",
              ] as const
            ).map(
              (
                mode
              ) => (
                <Button
                  key={
                    mode
                  }
                  variant={
                    performanceMode ===
                    mode
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    setPerformanceMode(
                      mode
                    )
                  }
                >
                  {mode ===
                    "auto" &&
                    "خودکار"}

                  {mode ===
                    "normal" &&
                    "معمولی"}

                  {mode ===
                    "lite" &&
                    "اقتصادی"}
                </Button>
              )
            )}
          </div>

          <p className="text-sm text-[var(--hisab-muted-fg)]">
            حالت
            اقتصادی
            برای
            دستگاه‌های
            ضعیف‌تر
            مناسب
            است و
            انیمیشن‌ها
            را کاهش
            می‌دهد.
          </p>
        </CardContent>
      </Card>

      {/* SAFETY */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-[var(--hisab-primary)]" />

            <h2 className="text-lg font-semibold text-[var(--hisab-foreground)]">
              امنیت
              داده‌ها
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "اطلاعات شما به‌صورت امن ذخیره می‌شود",
              "بدون اینترنت هم قابل استفاده است",
              "بازیابی اطلاعات تا ۳۰ روز ممکن است",
              "همگام‌سازی رمزنگاری‌شده انجام می‌شود",
            ].map(
              (
                item
              ) => (
                <div
                  key={
                    item
                  }
                  className="flex items-center gap-2 rounded-xl border border-[var(--hisab-border)] p-3"
                >
                  <Check className="size-4 text-[var(--hisab-success)]" />

                  <span className="text-sm text-[var(--hisab-foreground)]">
                    {item}
                  </span>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* STORAGE */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Download className="size-5 text-[var(--hisab-primary)]" />

            <h2 className="text-lg font-semibold text-[var(--hisab-foreground)]">
              حافظه و
              کش
            </h2>
          </div>

          <div className="rounded-xl border border-[var(--hisab-border)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-[var(--hisab-muted-fg)]">
                کش
                برنامه
              </span>

              <Badge variant="secondary">
                24 MB
              </Badge>
            </div>

            <Button
              variant="outline"
              icon={
                <Trash2 className="size-4" />
              }
            >
              پاک کردن
              کش
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}