// packages/ui/src/components/ui/settings/settings-page.tsx
'use client'

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useBackupStore, useDeviceStore, useAuthStore } from '@hisabche/store'
import { useWorkspaces, useUpdateWorkspace, useWorkspaceBackup } from '@hisabche/api'
import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Switch } from '../switch'
import { HardwareSection } from './hardware-section'
import { useToast } from '../toast-provider'
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
  Plug,
  ShoppingBag,
} from 'lucide-react'
import { formatBytes, formatNumber, toIsoDay } from '@hisabche/formatting'
import { localizePath } from '@hisabche/ui-contract'
import { useRouteLang } from '../../../hooks/use-locale-push'

/* ═══════════════════════════════════════════════════════════════════════════
   SettingsPage v3 — Memoized · Performance Optimized
   ✅ memo · useCallback · ثابت‌های خارج از کامپوننت
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Constants ─────────────────────────────────────────────────────────────

const SAFETY_ITEMS = [
  { key: 'settings.safety1', fallback: 'اطلاعات شما به‌صورت امن ذخیره می‌شود' },
  { key: 'settings.safety2', fallback: 'بدون اینترنت هم قابل استفاده است' },
  { key: 'settings.safety3', fallback: 'بازیابی اطلاعات تا ۳۰ روز ممکن است' },
  { key: 'settings.safety4', fallback: 'همگام‌سازی رمزنگاری‌شده انجام می‌شود' },
] as const

const PERFORMANCE_MODES = [
  { value: 'auto', labelKey: 'settings.perfAuto', fallback: 'خودکار' },
  { value: 'normal', labelKey: 'settings.perfNormal', fallback: 'معمولی' },
  { value: 'lite', labelKey: 'settings.perfLite', fallback: 'اقتصادی' },
] as const

// ─── Account Section ──────────────────────────────────────────────────────

const AccountSection = memo(function AccountSection() {
  const tOriginal = useTranslations()
  const intlLocale = useIntlLocale()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const { user, logout, updateProfile } = useAuthStore()
  const { data: workspaces } = useWorkspaces()
  const updateWorkspace = useUpdateWorkspace()
  const toast = useToast()

  /**
   * The workspace whose name the sidebar and the invoice document show.
   *
   * «نام کسب‌وکار» is presented as ONE field, but it lives in two records:
   * `profiles.business_name` (the account) and `workspaces.name` (what every
   * document and the sidebar actually render). Editing only the profile looked
   * like the change had been discarded, because the name on screen never moved
   * and came back unchanged after a re-login. Saving writes both.
   */
  const workspace = useMemo(
    () =>
      (Array.isArray(workspaces) ? workspaces[0] : undefined) as
        { id: string; name?: string; myRole?: string } | undefined,
    [workspaces],
  )

  // ✅ این فیلدها قبلاً فقط خواندنی بودند («تنظیم نشده» / «-») در حالی که
  // endpoint PATCH /api/auth/profile از قبل وجود داشت و هیچ‌جا استفاده
  // نمی‌شد. حالا کاربر می‌تواند نام و نام کسب‌وکار را ویرایش کند.
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [fullNameDraft, setFullNameDraft] = useState('')
  const [businessNameDraft, setBusinessNameDraft] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const startEditProfile = useCallback(() => {
    setFullNameDraft(user?.fullName ?? '')
    setBusinessNameDraft(user?.businessName ?? '')
    setProfileError(null)
    setIsEditingProfile(true)
  }, [user?.fullName, user?.businessName])

  const cancelEditProfile = useCallback(() => {
    setIsEditingProfile(false)
    setProfileError(null)
  }, [])

  const saveProfile = useCallback(async () => {
    const fullName = fullNameDraft.trim()
    if (!fullName) {
      setProfileError(t('settings.fullNameRequired', 'نام نمی‌تواند خالی باشد'))
      return
    }
    const businessName = businessNameDraft.trim()

    setIsSavingProfile(true)
    setProfileError(null)
    try {
      await updateProfile({ fullName, businessName })

      // Keep the workspace name in step — see the note on `workspace` above.
      // Only an owner/admin may rename it, so a member's profile edit still
      // succeeds instead of failing on a permission they were never offered.
      const canRenameWorkspace =
        workspace?.id && (workspace.myRole === 'owner' || workspace.myRole === 'admin')

      if (canRenameWorkspace && businessName && businessName !== workspace?.name) {
        await updateWorkspace.mutateAsync({ id: workspace!.id, name: businessName })
      }

      setIsEditingProfile(false)
      toast.success(t('settings.profileSaved', 'اطلاعات ذخیره شد'))
    } catch (err) {
      setProfileError(
        err instanceof Error && err.message
          ? err.message
          : t('settings.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.'),
      )
    } finally {
      setIsSavingProfile(false)
    }
  }, [fullNameDraft, businessNameDraft, updateProfile, updateWorkspace, workspace, toast, t])
  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-lg font-bold text-[hsl(var(--color-primary))] shrink-0">
            {user?.fullName?.charAt(0) || 'ح'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-[hsl(var(--fg-primary))]">
              {user?.fullName || t('common.noName')}
            </h2>
            <p className="truncate text-sm text-[hsl(var(--fg-secondary))]">{user?.email}</p>
          </div>
          <span className="ms-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border border-[hsl(var(--color-success)/0.2)]">
            {t('common.active')}
          </span>
        </div>

        {isEditingProfile ? (
          <div className="space-y-3">
            <div>
              <label
                className="mb-1 block text-xs text-[hsl(var(--fg-tertiary))]"
                htmlFor="profile-full-name"
              >
                {t('settings.fullName', 'نام')}
              </label>
              <input
                id="profile-full-name"
                value={fullNameDraft}
                onChange={(e) => setFullNameDraft(e.target.value)}
                className={
                  'w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'
                }
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs text-[hsl(var(--fg-tertiary))]"
                htmlFor="profile-business-name"
              >
                {t('settings.businessName')}
              </label>
              <input
                id="profile-business-name"
                value={businessNameDraft}
                onChange={(e) => setBusinessNameDraft(e.target.value)}
                placeholder={t('settings.businessNamePlaceholder', 'مثلاً: فروشگاه حسابچه')}
                className={
                  'w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'
                }
              />
            </div>
            {profileError ? (
              <p className="text-xs text-[hsl(var(--color-destructive))]">{profileError}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSavingProfile}
                className="rounded-full bg-[hsl(var(--color-primary))] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSavingProfile
                  ? t('common.saving', 'در حال ذخیره...')
                  : t('common.save', 'ذخیره')}
              </button>
              <button
                type="button"
                onClick={cancelEditProfile}
                disabled={isSavingProfile}
                className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 text-sm text-[hsl(var(--fg-secondary))]"
              >
                {t('common.cancel', 'انصراف')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
              <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
                {t('settings.businessName')}
              </p>
              <p className="font-medium text-[hsl(var(--fg-primary))]">
                {user?.businessName || t('settings.notSet')}
              </p>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
              <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
                {t('settings.memberSince')}
              </p>
              <p className="font-medium text-[hsl(var(--fg-primary))]">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(intlLocale) : '-'}
              </p>
            </div>
          </div>
        )}

        {!isEditingProfile ? (
          <button
            type="button"
            onClick={startEditProfile}
            className="w-full rounded-full border border-[hsl(var(--border-default))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {t('settings.editProfile', 'ویرایش اطلاعات')}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2',
            'rounded-full px-4 py-2.5 text-sm font-bold',
            'bg-[hsl(var(--color-destructive))] text-white',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'motion-reduce:transition-none',
          )}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  )
})
AccountSection.displayName = 'AccountSection'

// ─── Business Stamp Section ───────────────────────────────────────────────
// آپلود مهر/امضای صاحب کسب‌وکار — یک‌بار ثبت می‌شود و طبق business.stampUrl
// روی همه‌ی فاکتورها (InvoiceDocument) نمایش داده می‌شود.

/**
 * Turn an upload failure into something the user can act on.
 *
 * The one failure worth naming is a database that has not run
 * `docs/workspace-stamp-migration.sql` — the stamp column does not exist, so no
 * amount of retrying will help and "try again" would be a lie.
 */
function stampErrorMessage(error: unknown, t: (key: string, fallback?: string) => string): string {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (/stamp.*not supported|workspace-stamp-migration/i.test(message)) {
    return t(
      'settings.stampNotSupported',
      'ذخیره‌ی مهر روی این سرور هنوز فعال نیست. با پشتیبانی تماس بگیرید.',
    )
  }

  return t('settings.stampUploadFailed')
}

const ALLOWED_STAMP_TYPES = ['image/png', 'image/svg+xml']
const MAX_STAMP_SIZE = 1024 * 1024 // 1MB — چون به‌صورت data URL در ستون متنی ذخیره می‌شود

export const BusinessStampSection = memo(function BusinessStampSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const { data: workspaces } = useWorkspaces()
  const updateWorkspace = useUpdateWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  // ✅ فرض تک-workspace: اولین workspace کاربر (فعلاً هیچ workspace-switcher‌ای در برنامه نیست)
  const workspace = useMemo(
    () =>
      (Array.isArray(workspaces) ? workspaces[0] : undefined) as
        { id: string; stamp_url?: string | null; myRole?: string } | undefined,
    [workspaces],
  )
  const workspaceId = workspace?.id
  const stampUrl: string | null = workspace?.stamp_url ?? null
  const canEdit = workspace?.myRole === 'owner' || workspace?.myRole === 'admin'
  const isSaving = updateWorkspace.isPending

  const handlePickFile = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (!workspaceId) {
        // Picking a file before the workspace query resolves used to do
        // nothing at all, with no explanation.
        setError(
          t('settings.stampNoWorkspace', 'کسب‌وکار هنوز بارگذاری نشده — کمی بعد دوباره تلاش کنید.'),
        )
        return
      }

      if (!ALLOWED_STAMP_TYPES.includes(file.type)) {
        setError(t('settings.stampInvalidType', 'فقط تصویر PNG یا SVG پذیرفته می‌شود.'))
        return
      }
      if (file.size > MAX_STAMP_SIZE) {
        setError(t('settings.stampTooLarge', 'حجم تصویر باید کمتر از ۱ مگابایت باشد.'))
        return
      }
      setError(null)

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        // Both branches report. Silence on either one is what made this read
        // as a missing feature rather than a request that succeeded or failed.
        updateWorkspace.mutate(
          { id: workspaceId, stampUrl: dataUrl },
          {
            onSuccess: (updated) => {
              setError(null)
              // A server without the stamp column answers 200 and drops the
              // field. That is a FAILURE from the user's side, and saying
              // "saved" while nothing was saved is the worse of the two lies.
              const saved = (updated as { stamp_url?: string | null } | undefined)?.stamp_url
              if (saved) {
                toast.success(t('settings.stampSaved', 'مهر با موفقیت ذخیره شد'))
              } else {
                setError(
                  t(
                    'settings.stampNotSupported',
                    'ذخیره‌ی مهر روی این سرور هنوز فعال نیست. با پشتیبانی تماس بگیرید.',
                  ),
                )
              }
            },
            onError: (err) => setError(stampErrorMessage(err, t)),
          },
        )
      }
      reader.onerror = () => setError(t('settings.stampUploadFailed', 'بارگذاری تصویر ناموفق بود.'))
      reader.readAsDataURL(file)
    },
    [workspaceId, updateWorkspace, t, toast],
  )

  const handleRemove = useCallback(() => {
    if (!workspaceId) return
    updateWorkspace.mutate(
      { id: workspaceId, stampUrl: null },
      {
        onSuccess: () => {
          setError(null)
          toast.success(t('settings.stampRemoved', 'مهر حذف شد'))
        },
        onError: (err) => setError(stampErrorMessage(err, t)),
      },
    )
  }, [workspaceId, updateWorkspace, t, toast])

  if (!canEdit) return null

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Stamp className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t('settings.businessStamp')}
          </h2>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('settings.businessStampDesc')}</p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-40 shrink-0 items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-muted))]">
            {stampUrl ? (
              <img src={stampUrl} alt="" className="max-h-16 max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-[hsl(var(--fg-tertiary))]">
                {t('settings.stampNotSet')}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePickFile}
              disabled={isSaving || !workspaceId}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
                'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
                'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                'transition-colors duration-150 disabled:opacity-40',
                'motion-reduce:transition-none',
              )}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {t('settings.uploadStamp')}
            </button>

            {stampUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSaving}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
                  'text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.08)]',
                  'transition-colors duration-150 disabled:opacity-40',
                )}
              >
                <X className="size-4" aria-hidden="true" />
                {t('settings.removeStamp')}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-[hsl(var(--color-destructive))]">{error}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
})
BusinessStampSection.displayName = 'BusinessStampSection'

// ─── Backup Section ───────────────────────────────────────────────────────

const BackupSection = memo(function BackupSection() {
  const tOriginal = useTranslations()
  const intlLocale = useIntlLocale()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  // G7 — `exportData` is no longer read: it returned localStorage metadata,
  // not the business's data. The store still owns the local history list.
  const { autoBackupEnabled, setAutoBackup, addBackup, backups } = useBackupStore()
  const fetchBackup = useWorkspaceBackup()

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // ─── G7 — the backup now contains the business's data ────────────────────
  //
  // This used to download `useBackupStore().exportData()`, which returns
  // `{ backups, auditLog }` FROM LOCALSTORAGE — the list of previous backup
  // entries, and a client-side log. No invoices, no customers, no products.
  //
  // The file downloaded, it was named `hisabche-backup-<date>.json`, and it
  // would have been discovered worthless at the moment someone needed it.
  //
  // It now fetches the real export from the server. `useBackupStore` is kept
  // ONLY for the local history list below — that part was always honest about
  // what it is.
  const handleExportJSON = useCallback(async () => {
    setIsExporting(true)
    try {
      const backup = await fetchBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hisabche-backup-${toIsoDay(new Date())}.json`
      a.click()
      URL.revokeObjectURL(url)

      addBackup({
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        size: `${Math.floor(blob.size / 1024)} KB`,
        type: 'manual',
        status: 'completed',
      })
    } catch (err) {
      // Recorded as FAILED, and not silently. A backup history that shows a
      // green tick for a download that errored is how someone comes to believe
      // they have a backup they do not have — the same defect one level up.
      addBackup({
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        size: '—',
        type: 'manual',
        status: 'failed',
      })
      setExportError(
        err instanceof Error
          ? err.message
          : t('settings.backupFailed', 'دانلود پشتیبان ناموفق بود'),
      )
    } finally {
      setIsExporting(false)
    }
  }, [fetchBackup, addBackup, t])

  const latestBackup = backups?.[0]

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t('settings.backup')}
          </h2>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] p-4">
          <div className="min-w-0 text-start">
            <p className="font-medium text-[hsl(var(--fg-primary))]">{t('settings.autoBackup')}</p>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('settings.autoBackupDesc')}
            </p>
          </div>
          <Switch
            checked={autoBackupEnabled}
            onCheckedChange={setAutoBackup}
            className="shrink-0"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExporting}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150 disabled:opacity-40',
              'motion-reduce:transition-none',
            )}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileJson className="size-4" aria-hidden="true" />
            )}
            {t('settings.exportJSON')}
          </button>

          <button
            type="button"
            disabled
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]',
              'opacity-40 cursor-not-allowed',
            )}
          >
            <FileText className="size-4" aria-hidden="true" />
            {t('settings.exportCSV')}
          </button>

          <button
            type="button"
            disabled
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]',
              'opacity-40 cursor-not-allowed',
            )}
          >
            <Cloud className="size-4" aria-hidden="true" />
            {t('settings.sync')}
          </button>
        </div>

        {exportError && (
          // A failed export must SAY so. The previous version could not fail —
          // it serialised localStorage — so this path is new, and silence here
          // would leave someone believing they had downloaded their data.
          <p
            role="alert"
            className="rounded-xl border border-[hsl(var(--color-destructive)/0.2)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-sm text-[hsl(var(--color-destructive))]"
          >
            {exportError}
          </p>
        )}

        {latestBackup && (
          <div className="rounded-xl border border-[hsl(var(--color-success)/0.2)] bg-[hsl(var(--color-success)/0.05)] p-4 text-start">
            <div className="mb-2 flex items-center gap-2 text-[hsl(var(--color-success))]">
              <Shield className="size-4" aria-hidden="true" />
              <span className="font-medium">{t('settings.lastBackup')}</span>
            </div>
            <div className="space-y-1 text-sm text-[hsl(var(--fg-secondary))]">
              <p>
                {t('settings.backupCount')}: {backups.length}
              </p>
              <p>
                {t('settings.backupDate')}:{' '}
                {new Date(latestBackup.timestamp).toLocaleDateString(intlLocale)}
              </p>
              <p>
                {t('settings.backupSize')}: {latestBackup.size}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
BackupSection.displayName = 'BackupSection'

// ─── Performance Section ──────────────────────────────────────────────────

const PerformanceSection = memo(function PerformanceSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const { performanceMode, setPerformanceMode } = useDeviceStore()

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Monitor className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t('settings.performance')}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERFORMANCE_MODES.map(({ value, labelKey, fallback }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPerformanceMode(value)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                'motion-reduce:transition-none',
                performanceMode === value
                  ? 'bg-[image:var(--gradient-brand)] text-white shadow-sm'
                  : 'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              )}
            >
              {t(labelKey, fallback)}
            </button>
          ))}
        </div>

        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('settings.perfDesc')}</p>
      </div>
    </div>
  )
})
PerformanceSection.displayName = 'PerformanceSection'

// ─── Safety Section ───────────────────────────────────────────────────────

const SafetySection = memo(function SafetySection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t('settings.safety')}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SAFETY_ITEMS.map(({ key, fallback }) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border-default))] p-3 text-start"
            >
              <Check
                className="size-4 shrink-0 text-[hsl(var(--color-success))]"
                aria-hidden="true"
              />
              <span className="text-sm text-[hsl(var(--fg-primary))]">{t(key, fallback)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
SafetySection.displayName = 'SafetySection'

// ─── Storage Section ──────────────────────────────────────────────────────

/**
 * What this device keeps, and the one part of it that is safe to throw away.
 *
 * ⚠️ This section used to show a constant «24 MB» and a button that only
 * logged to the console. Now both numbers are measured:
 *
 *   · «data read from the server» — the entries in the TanStack Query cache,
 *     which is exactly what «clear cache» empties (`resetQueries`: the cached
 *     answers go, open screens fetch theirs again);
 *   · «this app's storage» — `navigator.storage.estimate()`, the browser's own
 *     figure for this origin. A browser that does not report it says so rather
 *     than showing a guess.
 *
 * Nothing else is touched. Unsent changes live in the outbox, drafts and the
 * session in their own stores — clearing a read cache must never cost somebody
 * an invoice they have not sent yet.
 */
type StorageEstimate =
  | { state: 'measuring' }
  | { state: 'unavailable' }
  | { state: 'measured'; usage: number; quota: number | null }

const StorageSection = memo(function StorageSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const locale = useIntlLocale()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [entries, setEntries] = useState<number | null>(null)
  const [estimate, setEstimate] = useState<StorageEstimate>({ state: 'measuring' })
  const [clearing, setClearing] = useState(false)

  // The cache size is read after mount and kept current: every fetch, removal
  // and reset changes it, and the cache announces each one.
  useEffect(() => {
    const cache = queryClient.getQueryCache()
    const read = () => setEntries(cache.getAll().length)
    read()
    return cache.subscribe(read)
  }, [queryClient])

  const measure = useCallback(async () => {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!storage || typeof storage.estimate !== 'function') {
      setEstimate({ state: 'unavailable' })
      return
    }
    try {
      const { usage, quota } = await storage.estimate()
      if (typeof usage !== 'number') {
        setEstimate({ state: 'unavailable' })
        return
      }
      setEstimate({ state: 'measured', usage, quota: typeof quota === 'number' ? quota : null })
    } catch {
      setEstimate({ state: 'unavailable' })
    }
  }, [])

  useEffect(() => {
    void measure()
  }, [measure])

  const handleClearCache = useCallback(async () => {
    setClearing(true)
    try {
      // Refetch failures do not reject here — each open screen shows its own
      // error state; the cache itself is already empty.
      await queryClient.resetQueries()
      toast.success(tOriginal('settings.cacheCleared'))
    } finally {
      setClearing(false)
      void measure()
    }
  }, [queryClient, measure, toast, tOriginal])

  const storageText =
    estimate.state === 'measuring'
      ? t('settings.storageMeasuring')
      : estimate.state === 'unavailable'
        ? t('settings.storageUnavailable')
        : estimate.quota !== null
          ? tOriginal('settings.storageOfQuota', {
              used: formatBytes(estimate.usage, locale),
              quota: formatBytes(estimate.quota, locale),
            })
          : formatBytes(estimate.usage, locale)

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {t('settings.storage')}
          </h2>
        </div>

        <dl className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('settings.cacheEntries')}
            </dt>
            <dd className="rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-2.5 py-0.5 text-xs font-medium tabular-nums text-[hsl(var(--fg-secondary))]">
              {entries === null ? '—' : formatNumber(entries, locale)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('settings.deviceStorage')}
            </dt>
            <dd className="text-xs font-medium tabular-nums text-[hsl(var(--fg-secondary))]">
              {storageText}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('settings.cacheHint')}</p>

        <button
          type="button"
          onClick={() => void handleClearCache()}
          disabled={clearing}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
            'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
          )}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t('settings.clearCache')}
        </button>
      </div>
    </div>
  )
})
StorageSection.displayName = 'StorageSection'

// ─── Billing Link ────────────────────────────────────────────────────────────

const BillingSection = memo(function BillingSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const lang = useRouteLang()

  return (
    <Link
      href={localizePath('/billing', lang)}
      className={cn(
        'flex items-center gap-3 rounded-2xl p-4 sm:p-5',
        'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        'transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))]',
        'motion-reduce:transition-none',
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0">
        <CreditCard className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">{t('nav.billing')}</p>
        <p className="text-sm text-[hsl(var(--fg-secondary))] truncate">
          {t('nav.billing_description')}
        </p>
      </div>
      <ChevronLeft
        className="size-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
})
BillingSection.displayName = 'BillingSection'

const WorkflowTemplatesSection = memo(function WorkflowTemplatesSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const lang = useRouteLang()

  return (
    <Link
      href={localizePath('/workflow-templates', lang)}
      className={cn(
        'flex items-center gap-3 rounded-2xl p-4 sm:p-5',
        'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        'transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))]',
        'motion-reduce:transition-none',
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0">
        <ListChecks className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">
          {t('workflow.templates.title')}
        </p>
        <p className="text-sm text-[hsl(var(--fg-secondary))] truncate">
          {t('workflow.templates.description')}
        </p>
      </div>
      <ChevronLeft
        className="size-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
})
WorkflowTemplatesSection.displayName = 'WorkflowTemplatesSection'

// API keys and webhooks live on their own screen; settings is where an owner
// looks for «connect another system», so the door is here.
const DevelopersSection = memo(function DevelopersSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const lang = useRouteLang()

  return (
    <Link
      href={localizePath('/developers', lang)}
      className={cn(
        'flex items-center gap-3 rounded-2xl p-4 sm:p-5',
        'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        'transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))]',
        'motion-reduce:transition-none',
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0">
        <Plug className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">{t('developer.title')}</p>
        <p className="text-sm text-[hsl(var(--fg-secondary))] truncate">
          {t('developer.settingsLink')}
        </p>
      </div>
      <ChevronLeft
        className="size-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
})
DevelopersSection.displayName = 'DevelopersSection'

// Website and integration orders — the queue a storefront fills.
const OrdersSection = memo(function OrdersSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const lang = useRouteLang()

  return (
    <Link
      href={localizePath('/orders', lang)}
      className={cn(
        'flex items-center gap-3 rounded-2xl p-4 sm:p-5',
        'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        'transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))]',
        'motion-reduce:transition-none',
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] shrink-0">
        <ShoppingBag className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[hsl(var(--fg-primary))]">{t('orders.title')}</p>
        <p className="text-sm text-[hsl(var(--fg-secondary))] truncate">
          {t('settings.ordersLink')}
        </p>
      </div>
      <ChevronLeft
        className="size-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
})
OrdersSection.displayName = 'OrdersSection'

// ─── Main Page ─────────────────────────────────────────────────────────────

export const SettingsPage = memo(function SettingsPage() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] mb-2">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('settings.description')}</p>
      </div>

      <AccountSection />
      <BusinessStampSection />
      <BillingSection />
      <WorkflowTemplatesSection />
      <DevelopersSection />
      <OrdersSection />
      <BackupSection />
      <HardwareSection />
      <PerformanceSection />
      <SafetySection />
      <StorageSection />
    </div>
  )
})

SettingsPage.displayName = 'SettingsPage'
