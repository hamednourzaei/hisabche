"use client"

import { Button, Card, CardContent, Badge } from "@hisabche/ui"
import {
  Cloud, CloudOff, RefreshCw, Clock, Check, AlertTriangle,
  Download, History, Database, Shield, Activity, HardDrive, Wifi,
} from "lucide-react"

interface BackupItem {
  id: string
  timestamp: number
  size: string
  type: "auto" | "manual"
  status: "completed" | "failed"
}

interface AuditItem {
  id: string
  action: string
  entity: string
  timestamp: number
}

export interface SyncCenterPageProps {
  t: (key: string, fallback?: string) => string
  timeAgo: (ts: number) => string
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: number | null
  autoBackupEnabled: boolean
  backups: BackupItem[]
  auditLog: AuditItem[]
  onSync: () => void
  onBackup: () => void
  onToggleAutoBackup: () => void
}

export function SyncCenterPage({
  t, timeAgo, isOnline, isSyncing, pendingCount, lastSyncedAt,
  autoBackupEnabled, backups, auditLog,
  onSync, onBackup, onToggleAutoBackup,
}: SyncCenterPageProps) {
  return (
    <div className="hisab-root space-y-6 p-6">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold">
          <Shield className="size-8 text-[var(--hisab-primary)]" />
          {t("sync.title", "مرکز همگام‌سازی")}
        </h1>
        <p className="text-sm text-[var(--hisab-muted-fg)]">{t("sync.description", "مدیریت امنیت، بکاپ و وضعیت اتصال برنامه")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="interactive-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isOnline ? "bg-[var(--hisab-success)]/10" : "bg-[var(--hisab-warning)]/10"}`}>
              {isOnline ? <Cloud className="size-7 text-[var(--hisab-success)]" /> : <CloudOff className="size-7 text-[var(--hisab-warning)]" />}
            </div>
            <div>
              <p className="text-xl font-bold">{isOnline ? t("sync.online", "آنلاین") : t("sync.offline", "آفلاین")}</p>
              <p className="text-xs text-[var(--hisab-muted-fg)]">{t("sync.connectionStatus", "وضعیت اتصال")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="interactive-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hisab-primary)]/10"><Database className="size-7 text-[var(--hisab-primary)]" /></div>
            <div>
              <p className="text-xl font-bold">{backups.length}</p>
              <p className="text-xs text-[var(--hisab-muted-fg)]">{t("sync.backups", "بکاپ")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="interactive-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${pendingCount > 0 ? "bg-[var(--hisab-warning)]/10" : "bg-[var(--hisab-success)]/10"}`}>
              <AlertTriangle className={`size-7 ${pendingCount > 0 ? "text-[var(--hisab-warning)]" : "text-[var(--hisab-success)]"}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{pendingCount}</p>
              <p className="text-xs text-[var(--hisab-muted-fg)]">{t("sync.pending", "عملیات معلق")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="interactive-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hisab-accent)]/10"><HardDrive className="size-7 text-[var(--hisab-accent)]" /></div>
            <div>
              <p className="text-xl font-bold">24 MB</p>
              <p className="text-xs text-[var(--hisab-muted-fg)]">{t("sync.localStorage", "حافظه محلی")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2"><Activity className="size-5 text-[var(--hisab-primary)]" /><h2 className="text-lg font-semibold">{t("sync.quickActions", "عملیات سریع")}</h2></div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onSync} loading={isSyncing} icon={<RefreshCw className="size-4" />}>{t("sync.syncNow", "همگام‌سازی الآن")}</Button>
            <Button variant="outline" onClick={onBackup} icon={<Download className="size-4" />}>{t("sync.manualBackup", "بکاپ دستی")}</Button>
            <Button variant={autoBackupEnabled ? "default" : "outline"} onClick={onToggleAutoBackup} icon={<Database className="size-4" />}>{t("sync.autoBackup", "بکاپ خودکار")}</Button>
          </div>
          {lastSyncedAt && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] p-4 text-sm text-[var(--hisab-muted-fg)]">
              <Clock className="size-4 text-[var(--hisab-success)]" />{t("sync.lastSynced", "آخرین همگام‌سازی")}: {timeAgo(lastSyncedAt)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2"><History className="size-5 text-[var(--hisab-primary)]" /><h2 className="text-lg font-semibold">{t("sync.backupHistory", "تاریخچه بکاپ")}</h2></div>
          {backups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--hisab-border)] py-10 text-center"><Database className="mx-auto mb-3 size-10 text-[var(--hisab-muted-fg)]" /><p className="text-sm text-[var(--hisab-muted-fg)]">{t("sync.noBackups", "هنوز بکاپی ثبت نشده")}</p></div>
          ) : (
            <div className="space-y-3">
              {backups.slice(0, 6).map((backup) => (
                <div key={backup.id} className="interactive-card flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${backup.status === "completed" ? "bg-[var(--hisab-success)]/10" : "bg-[var(--hisab-destructive)]/10"}`}>
                      {backup.status === "completed" ? <Check className="size-5 text-[var(--hisab-success)]" /> : <AlertTriangle className="size-5 text-[var(--hisab-destructive)]" />}
                    </div>
                    <div>
                      <p className="font-medium">{backup.type === "auto" ? t("sync.autoBackup", "بکاپ خودکار") : t("sync.manualBackup", "بکاپ دستی")}</p>
                      <p className="text-xs text-[var(--hisab-muted-fg)]">{timeAgo(backup.timestamp)} • {backup.size}</p>
                    </div>
                  </div>
                  <Badge variant={backup.status === "completed" ? "success" : "destructive"}>{backup.status === "completed" ? t("sync.success", "موفق") : t("sync.error", "خطا")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2"><Shield className="size-5 text-[var(--hisab-primary)]" /><h2 className="text-lg font-semibold">{t("sync.recentActivity", "فعالیت‌های اخیر")}</h2></div>
          {auditLog.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--hisab-border)] py-10 text-center"><History className="mx-auto mb-3 size-10 text-[var(--hisab-muted-fg)]" /><p className="text-sm text-[var(--hisab-muted-fg)]">{t("sync.noActivity", "هنوز فعالیتی ثبت نشده")}</p></div>
          ) : (
            <div className="space-y-2">
              {auditLog.slice(0, 10).map((item) => (
                <div key={item.id} className="interactive-card flex items-center justify-between p-3">
                  <div className="flex items-center gap-3"><div className="h-2 w-2 rounded-full bg-[var(--hisab-primary)]" /><div><p className="text-sm font-medium">{item.action}</p><p className="text-xs text-[var(--hisab-muted-fg)]">{item.entity}</p></div></div>
                  <span className="text-xs text-[var(--hisab-muted-fg)]">{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2"><Wifi className="size-5 text-[var(--hisab-primary)]" /><h2 className="text-lg font-semibold">{t("sync.networkStatus", "وضعیت شبکه")}</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--hisab-border)] p-4">
              <p className="mb-1 text-sm text-[var(--hisab-muted-fg)]">{t("sync.internet", "اینترنت")}</p>
              <p className={`font-semibold ${isOnline ? "text-[var(--hisab-success)]" : "text-[var(--hisab-warning)]"}`}>{isOnline ? t("sync.connected", "متصل") : t("sync.disconnected", "قطع")}</p>
            </div>
            <div className="rounded-2xl border border-[var(--hisab-border)] p-4">
              <p className="mb-1 text-sm text-[var(--hisab-muted-fg)]">{t("sync.serverStatus", "وضعیت سرور")}</p>
              <p className="font-semibold text-[var(--hisab-success)]">{t("sync.stable", "پایدار")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}