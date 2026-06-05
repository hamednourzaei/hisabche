"use client"

import { Button } from "../button"
import { Card, CardContent } from "../card"
import { Badge } from "../badge"
import {
  Cloud, CloudOff, RefreshCw, Clock, Check, AlertTriangle,
  Download, History, Database, Shield, Activity, HardDrive, Wifi,
} from "lucide-react"

interface BackupItem {
  id: string; timestamp: number; size: string
  type: "auto" | "manual"; status: "completed" | "failed"
}

interface AuditItem {
  id: string; action: string; entity: string; timestamp: number
}

export interface SyncCenterPageProps {
  t: (key: string, fallback?: string) => string
  timeAgo: (ts: number) => string
  isOnline: boolean; isSyncing: boolean; pendingCount: number
  lastSyncedAt: number | null; autoBackupEnabled: boolean
  backups: BackupItem[]; auditLog: AuditItem[]
  onSync: () => void; onBackup: () => void; onToggleAutoBackup: () => void
}

export function SyncCenterPage({
  t, timeAgo, isOnline, isSyncing, pendingCount, lastSyncedAt,
  autoBackupEnabled, backups, auditLog,
  onSync, onBackup, onToggleAutoBackup,
}: SyncCenterPageProps) {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
          <Shield className="size-8 text-primary" aria-hidden />
          {t("sync.title", "مرکز همگام‌سازی")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("sync.description", "مدیریت امنیت، بکاپ و وضعیت اتصال برنامه")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="interactive-card border-border transition-all hover:border-primary/30">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isOnline ? "bg-success/10" : "bg-warning/10"}`}>
              {isOnline ? <Cloud className="size-7 text-success" aria-hidden /> : <CloudOff className="size-7 text-warning" aria-hidden />}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{isOnline ? t("sync.online", "آنلاین") : t("sync.offline", "آفلاین")}</p>
              <p className="text-xs text-muted-foreground">{t("sync.connectionStatus", "وضعیت اتصال")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="interactive-card border-border transition-all hover:border-primary/30">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Database className="size-7 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{backups.length}</p>
              <p className="text-xs text-muted-foreground">{t("sync.backups", "بکاپ")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="interactive-card border-border transition-all hover:border-primary/30">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${pendingCount > 0 ? "bg-warning/10" : "bg-success/10"}`}>
              <AlertTriangle className={`size-7 ${pendingCount > 0 ? "text-warning" : "text-success"}`} aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">{t("sync.pending", "عملیات معلق")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="interactive-card border-border transition-all hover:border-primary/30">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <HardDrive className="size-7 text-accent" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">24 MB</p>
              <p className="text-xs text-muted-foreground">{t("sync.localStorage", "حافظه محلی")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">{t("sync.quickActions", "عملیات سریع")}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onSync} disabled={isSyncing} className="gap-2">
              <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden />
              {t("sync.syncNow", "همگام‌سازی الآن")}
            </Button>
            <Button variant="outline" onClick={onBackup} className="gap-2">
              <Download className="size-4" aria-hidden />
              {t("sync.manualBackup", "بکاپ دستی")}
            </Button>
            <Button variant={autoBackupEnabled ? "default" : "outline"} onClick={onToggleAutoBackup} className="gap-2">
              <Database className="size-4" aria-hidden />
              {t("sync.autoBackup", "بکاپ خودکار")}
            </Button>
          </div>
          {lastSyncedAt && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Clock className="size-4 text-success" aria-hidden />
              {t("sync.lastSynced", "آخرین همگام‌سازی")}: {timeAgo(lastSyncedAt)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">{t("sync.backupHistory", "تاریخچه بکاپ")}</h2>
          </div>
          {backups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center">
              <Database className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("sync.noBackups", "هنوز بکاپی ثبت نشده")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.slice(0, 6).map((backup) => (
                <div key={backup.id} className="interactive-card flex items-center justify-between rounded-xl border border-border p-4 transition-all hover:border-primary/30">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${backup.status === "completed" ? "bg-success/10" : "bg-destructive/10"}`}>
                      {backup.status === "completed" ? <Check className="size-5 text-success" aria-hidden /> : <AlertTriangle className="size-5 text-destructive" aria-hidden />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{backup.type === "auto" ? t("sync.autoBackup", "بکاپ خودکار") : t("sync.manualBackup", "بکاپ دستی")}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(backup.timestamp)} • {backup.size}</p>
                    </div>
                  </div>
                  <Badge variant={backup.status === "completed" ? "success" : "destructive"}>
                    {backup.status === "completed" ? t("sync.success", "موفق") : t("sync.error", "خطا")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">{t("sync.recentActivity", "فعالیت‌های اخیر")}</h2>
          </div>
          {auditLog.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center">
              <History className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("sync.noActivity", "هنوز فعالیتی ثبت نشده")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLog.slice(0, 10).map((item) => (
                <div key={item.id} className="interactive-card flex items-center justify-between rounded-xl border border-border p-3 transition-all hover:border-primary/30">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.entity}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Status */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Wifi className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">{t("sync.networkStatus", "وضعیت شبکه")}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-4 text-start">
              <p className="mb-1 text-sm text-muted-foreground">{t("sync.internet", "اینترنت")}</p>
              <p className={`font-semibold ${isOnline ? "text-success" : "text-warning"}`}>
                {isOnline ? t("sync.connected", "متصل") : t("sync.disconnected", "قطع")}
              </p>
            </div>
            <div className="rounded-2xl border border-border p-4 text-start">
              <p className="mb-1 text-sm text-muted-foreground">{t("sync.serverStatus", "وضعیت سرور")}</p>
              <p className="font-semibold text-success">{t("sync.stable", "پایدار")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}