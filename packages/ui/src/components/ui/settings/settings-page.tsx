// packages/ui/src/components/ui/settings/settings-page.tsx
'use client'

import { useState, useCallback, useEffect, useMemo, useRef, memo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useBackupStore, useDeviceStore, useAuthStore } from '@hisabche/store'
import {
  useWorkspaces,
  useUpdateWorkspace,
  useUploadBrandAsset,
  useDeleteBrandAsset,
  useWorkspaceBackup,
} from '@hisabche/api'
import {
  BRAND_ASSET_ERROR_TAXONOMY,
  type BrandAssetErrorCode,
  type BrandAssetType,
} from '@hisabche/validation'
import {
  BrandImageProcessingError,
  processBrandAssetFile,
  type ProcessedBrandAsset,
} from '../../../lib/brand-image-processor'
import { cn } from '../../../lib/utils'
import { SettingsCollapsible, SettingsLinkRow, SettingsQuickChips } from './settings-compact'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { persistedBytes } from '../../../lib/persisted-bytes'
import { HardwareSection } from './hardware-section'
import { BookCurrencySection } from './book-currency-section'
import { IndustryProfileSection } from './industry-profile-section'
import { PagesAndTabsSettings } from './pages-and-tabs-settings'
import { OperatingProfileSettings } from './operating-profile-settings'
import { CreditLimitModeSection } from './credit-limit-mode-section'
import { MetalUnitSection } from './metal-unit-section'
import { LanguageSection } from './language-section'
import { WorkplaceTimeZoneSection } from './workplace-time-zone-section'
import { TwoFactorSection } from './two-factor-section'
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
  Loader2,
  CreditCard,
  ChevronLeft,
  ListChecks,
  Stamp,
  Upload,
  X,
  Plug,
  Languages,
  Coins,
  Clock,
  DatabaseBackup,
  Gauge,
  HardDrive,
  Briefcase,
  LayoutGrid,
  ScanBarcode,
  ShieldCheck,
} from 'lucide-react'
import { buildCsvZip, formatBytes, formatNumber, toIsoDay } from '@hisabche/formatting'
import { localizePath } from '@hisabche/ui-contract'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { useActionAvailability } from '../../../lib/capability'
import { CloudRequiredNotice } from '../cloud-required-notice'

/* ═══════════════════════════════════════════════════════════════════════════
   SettingsPage v3 — Memoized · Performance Optimized
   ✅ memo · useCallback · ثابت‌های خارج از کامپوننت
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Constants ─────────────────────────────────────────────────────────────

const PERFORMANCE_MODES = [
  { value: 'auto', labelKey: 'settings.perfAuto' },
  { value: 'normal', labelKey: 'settings.perfNormal' },
  { value: 'lite', labelKey: 'settings.perfLite' },
] as const

// ─── Account Section ──────────────────────────────────────────────────────

const AccountSection = memo(function AccountSection({
  onLogout,
}: {
  onLogout?: (() => void | Promise<void>) | undefined
} = {}) {
  const tOriginal = useTranslations()
  const intlLocale = useIntlLocale()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )
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
    setBusinessNameDraft(user?.businessName ?? workspace?.name ?? '')
    setProfileError(null)
    setIsEditingProfile(true)
  }, [user?.fullName, user?.businessName, workspace?.name])

  const cancelEditProfile = useCallback(() => {
    setIsEditingProfile(false)
    setProfileError(null)
  }, [])

  const saveProfile = useCallback(async () => {
    const fullName = fullNameDraft.trim()
    if (!fullName) {
      setProfileError(t('settings.fullNameRequired'))
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
      toast.success(t('settings.profileSaved'))
    } catch (err) {
      setProfileError(err instanceof Error && err.message ? err.message : t('settings.saveFailed'))
    } finally {
      setIsSavingProfile(false)
    }
  }, [fullNameDraft, businessNameDraft, updateProfile, updateWorkspace, workspace, toast, t])
  const handleLogout = useCallback(() => {
    if (onLogout) {
      void onLogout()
    } else {
      logout()
    }
  }, [onLogout, logout])

  const showEmail = user?.email && !user.email.endsWith('.local')
  const displayBusinessName = user?.businessName || workspace?.name || t('settings.notSet')

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-lg font-bold text-[hsl(var(--color-primary))] shrink-0">
            {(user?.fullName?.trim() || displayBusinessName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-[hsl(var(--fg-primary))]">
              {user?.fullName || t('common.noName')}
            </h2>
            {showEmail ? (
              <p className="truncate text-sm text-[hsl(var(--fg-secondary))]">{user.email}</p>
            ) : null}
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
                {t('settings.fullName')}
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
                placeholder={t('settings.businessNamePlaceholder')}
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
                {isSavingProfile ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={cancelEditProfile}
                disabled={isSavingProfile}
                className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 text-sm text-[hsl(var(--fg-secondary))]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-start">
              <p className="mb-1 text-xs text-[hsl(var(--fg-tertiary))]">
                {t('settings.businessName')}
              </p>
              <p className="font-medium text-[hsl(var(--fg-primary))]">{displayBusinessName}</p>
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
            {t('settings.editProfile')}
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

// ─── Logo, stamp and signature ───────────────────────────────────────────
// Owner, 18 Oct 2026: «بعضیا یک مهر، یک امضا و یک لوگو دارن» — three images,
// each uploaded once: the logo heads every invoice, the stamp and the
// signature sit at its foot (InvoiceDocument). Each is its own column on the
// workspace (`logo_url`, `stamp_url`, `signature_url`).

/**
 * Turn an upload failure into something the user can act on.
 *
 * The one failure worth naming is a database whose column for this image does
 * not exist yet (`workspace-stamp-migration.sql`, `workspace-signature-01`) —
 * no amount of retrying will help and "try again" would be a lie.
 */
type TranslateFn = (key: string, values?: Record<string, string | number>) => string

function resolveBrandAssetError(error: unknown, t: TranslateFn): string {
  if (error instanceof BrandImageProcessingError) {
    const spec = BRAND_ASSET_ERROR_TAXONOMY[error.code]
    return t(spec.i18nKey)
  }
  const maybeAxios = error as {
    name?: string
    code?: string
    response?: { status?: number; data?: { code?: string; error?: string } }
    message?: string
  } | null
  const serverCode = maybeAxios?.response?.data?.code as BrandAssetErrorCode | undefined
  if (serverCode && serverCode in BRAND_ASSET_ERROR_TAXONOMY) {
    return t(BRAND_ASSET_ERROR_TAXONOMY[serverCode].i18nKey)
  }
  const status = maybeAxios?.response?.status
  if (status === 401) return t(BRAND_ASSET_ERROR_TAXONOMY.AUTH_EXPIRED.i18nKey)
  if (status === 403) return t(BRAND_ASSET_ERROR_TAXONOMY.PERMISSION_DENIED.i18nKey)
  if (status === 429) return t(BRAND_ASSET_ERROR_TAXONOMY.RATE_LIMITED.i18nKey)
  if (maybeAxios?.code === 'ECONNABORTED') {
    return t(BRAND_ASSET_ERROR_TAXONOMY.UPLOAD_TIMEOUT.i18nKey)
  }
  if (maybeAxios?.message && /network/i.test(maybeAxios.message)) {
    return t(BRAND_ASSET_ERROR_TAXONOMY.NETWORK_INTERRUPTION.i18nKey)
  }
  if (maybeAxios?.message && /not supported|-migration|signature-01/i.test(maybeAxios.message)) {
    return t('settings.imageNotSupported')
  }
  return t('settings.stampUploadFailed')
}

type BrandImageField = 'logoUrl' | 'stampUrl' | 'signatureUrl'
type BrandImageColumn = 'logo_url' | 'stamp_url' | 'signature_url'

const BRAND_IMAGES: ReadonlyArray<{
  assetType: BrandAssetType
  field: BrandImageField
  column: BrandImageColumn
  labelKey: string
}> = [
  {
    assetType: 'logo',
    field: 'logoUrl',
    column: 'logo_url',
    labelKey: 'settings.brandImages.logo',
  },
  {
    assetType: 'stamp',
    field: 'stampUrl',
    column: 'stamp_url',
    labelKey: 'settings.brandImages.stamp',
  },
  {
    assetType: 'signature',
    field: 'signatureUrl',
    column: 'signature_url',
    labelKey: 'settings.brandImages.signature',
  },
]

type WorkspaceImages = {
  id: string
  logo_url?: string | null
  stamp_url?: string | null
  signature_url?: string | null
  myRole?: string
}

/** One image: drag-and-drop, format-aware optimization preview, cancelable upload, confirmed delete. */
const BrandImageSlot = memo(function BrandImageSlot({
  t,
  workspaceId,
  label,
  assetType,
  field,
  column,
  current,
}: {
  t: TranslateFn
  workspaceId: string | undefined
  label: string
  assetType: BrandAssetType
  field: BrandImageField
  column: BrandImageColumn
  current: string | null
}) {
  const uploadBrandAsset = useUploadBrandAsset()
  const deleteBrandAsset = useDeleteBrandAsset()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeWorkspaceRef = useRef<string | undefined>(workspaceId)

  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'processing' | 'uploading' | 'deleting'>('idle')
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lastProcessed, setLastProcessed] = useState<ProcessedBrandAsset | null>(null)

  const toast = useToast()
  const isBusy = phase !== 'idle' || uploadBrandAsset.isPending || deleteBrandAsset.isPending

  useEffect(() => {
    if (
      activeWorkspaceRef.current &&
      activeWorkspaceRef.current !== workspaceId &&
      abortRef.current
    ) {
      abortRef.current.abort()
      abortRef.current = null
      setPhase('idle')
      setUploadPercent(null)
      setError(t(BRAND_ASSET_ERROR_TAXONOMY.WORKSPACE_SWITCHED.i18nKey))
    }
    activeWorkspaceRef.current = workspaceId
    setConfirmDelete(false)
  }, [workspaceId, t])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const handlePickFile = useCallback(() => {
    if (isBusy) return
    fileInputRef.current?.click()
  }, [isBusy])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase('idle')
    setUploadPercent(null)
    setError(t('settings.brandAssets.cancelled'))
  }, [t])

  const processAndUploadFile = useCallback(
    async (file: File) => {
      if (isBusy) return
      if (!workspaceId) {
        setError(t('settings.stampNoWorkspace'))
        return
      }
      const targetWorkspaceId = workspaceId
      const controller = new AbortController()
      abortRef.current = controller
      setError(null)
      setConfirmDelete(false)
      setUploadPercent(null)
      setPhase('processing')

      try {
        const processed = await processBrandAssetFile(file, assetType, controller.signal)
        if (controller.signal.aborted || activeWorkspaceRef.current !== targetWorkspaceId) {
          throw new BrandImageProcessingError(
            'WORKSPACE_SWITCHED',
            'Workspace changed during upload.',
          )
        }
        setLastProcessed(processed)
        setPhase('uploading')

        const commaIdx = processed.previewDataUrl.indexOf(',')
        const dataBase64 = commaIdx >= 0 ? processed.previewDataUrl.slice(commaIdx + 1) : ''

        const res = await uploadBrandAsset.mutateAsync({
          workspaceId: targetWorkspaceId,
          assetType,
          mimeType: processed.mimeType,
          dataBase64,
          originalBytes: processed.originalBytes,
          processingDurationMs: processed.processingMs,
          signal: controller.signal,
          onProgress: (pct: number) => {
            if (!controller.signal.aborted) setUploadPercent(pct)
          },
        })

        const saved = (res.workspace as Record<string, unknown> | undefined)?.[column]
        if (saved) {
          toast.success(t('settings.imageSaved'))
          setError(null)
        } else {
          setError(t('settings.imageNotSupported'))
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError' || controller.signal.aborted) {
          if (activeWorkspaceRef.current !== targetWorkspaceId) {
            setError(t(BRAND_ASSET_ERROR_TAXONOMY.WORKSPACE_SWITCHED.i18nKey))
          }
        } else {
          setError(resolveBrandAssetError(err, t))
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setPhase('idle')
        setUploadPercent(null)
      }
    },
    [isBusy, workspaceId, assetType, column, uploadBrandAsset, t, toast],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      void processAndUploadFile(file)
    },
    [processAndUploadFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (isBusy) return
      const file = e.dataTransfer.files?.[0]
      if (file) void processAndUploadFile(file)
    },
    [isBusy, processAndUploadFile],
  )

  const handleConfirmRemove = useCallback(async () => {
    if (!workspaceId || isBusy) return
    setPhase('deleting')
    setError(null)
    try {
      const res = await deleteBrandAsset.mutateAsync({ workspaceId, assetType })
      const persisted = (res.workspace as Record<string, unknown> | undefined)?.[column]
      if (persisted === null || persisted === undefined) {
        setConfirmDelete(false)
        setLastProcessed(null)
        toast.success(t('settings.imageRemoved'))
      } else {
        setError(t('settings.stampUploadFailed'))
      }
    } catch (err) {
      setError(resolveBrandAssetError(err, t))
    } finally {
      setPhase('idle')
    }
  }, [workspaceId, isBusy, deleteBrandAsset, assetType, column, t, toast])

  const previewSrc =
    current ?? (phase === 'uploading' ? (lastProcessed?.previewDataUrl ?? null) : null)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!isBusy) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'space-y-2 rounded-xl border p-3 transition-colors duration-150 motion-reduce:transition-none',
        isDragging
          ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.04)]'
          : 'border-[hsl(var(--border-default))]',
      )}
      data-brand-image={field}
    >
      <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{label}</p>
      <div className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-muted))] p-2">
        {previewSrc ? (
          <span
            aria-hidden="true"
            className="block h-20 w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${JSON.stringify(previewSrc)})` }}
          />
        ) : (
          <span className="px-2 text-center text-xs text-[hsl(var(--fg-tertiary))]">
            {t('settings.stampNotSet')}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
        {t('settings.brandAssets.dropHint')}
      </p>

      {lastProcessed && (
        <div className="space-y-0.5 text-[11px] text-[hsl(var(--fg-secondary))]">
          {lastProcessed.outputWidth && lastProcessed.outputHeight && (
            <p>
              {t('settings.brandAssets.dimensions', {
                width: lastProcessed.outputWidth,
                height: lastProcessed.outputHeight,
              })}
            </p>
          )}
          <p>
            {t('settings.brandAssets.optimizedInfo', {
              size: formatBytes(lastProcessed.optimizedBytes, 'fa'),
              original: formatBytes(lastProcessed.originalBytes, 'fa'),
            })}
          </p>
        </div>
      )}

      {phase === 'processing' && (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('settings.brandAssets.processing')}
        </p>
      )}
      {phase === 'uploading' && (
        <div className="space-y-1">
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {uploadPercent !== null
              ? t('settings.brandAssets.uploadingProgress', { percent: uploadPercent })
              : t('settings.brandAssets.uploading')}
          </p>
          {uploadPercent !== null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
              <div
                className="h-full bg-[hsl(var(--color-primary))] transition-all duration-150 motion-reduce:transition-none"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePickFile}
            disabled={isBusy || !workspaceId}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150 disabled:opacity-40',
              'motion-reduce:transition-none',
            )}
          >
            {isBusy ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            {current ? t('settings.brandAssets.replace') : t('settings.uploadStamp')}
          </button>

          {(phase === 'processing' || phase === 'uploading') && (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--border-default))] px-3 py-2 text-xs font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
            >
              {t('settings.brandAssets.cancel')}
            </button>
          )}
        </div>

        {current && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isBusy}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              'text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.08)]',
              'transition-colors duration-150 disabled:opacity-40 motion-reduce:transition-none',
            )}
          >
            <X className="size-4" aria-hidden="true" />
            {t('settings.removeStamp')}
          </button>
        )}

        {current && confirmDelete && (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-2">
            <span className="flex-1 text-xs text-[hsl(var(--color-destructive))]">
              {t('settings.brandAssets.confirmDelete')}
            </span>
            <button
              type="button"
              onClick={() => void handleConfirmRemove()}
              disabled={isBusy}
              className="rounded-md bg-[hsl(var(--color-destructive))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-destructive-fg))] disabled:opacity-40"
            >
              {t('settings.brandAssets.confirmDeleteButton')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isBusy}
              className="rounded-md border border-[hsl(var(--border-default))] px-2.5 py-1 text-xs text-[hsl(var(--fg-secondary))]"
            >
              {t('settings.brandAssets.cancelDeleteButton')}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
})
BrandImageSlot.displayName = 'BrandImageSlot'

export const BusinessStampSection = memo(function BusinessStampSection() {
  const tOriginal = useTranslations()
  const t: TranslateFn = useCallback(
    (key, values) => {
      const v = (tOriginal as (k: string, vals?: Record<string, string | number>) => string)(
        key,
        values,
      )
      return v && v !== key ? v : key
    },
    [tOriginal],
  )
  const { data: workspaces } = useWorkspaces()
  const stampAvailability = useActionAvailability('settings.business_stamp')

  // ✅ فرض تک-workspace: اولین workspace کاربر (فعلاً هیچ workspace-switcher‌ای در برنامه نیست)
  const workspace = useMemo(
    () => (Array.isArray(workspaces) ? workspaces[0] : undefined) as WorkspaceImages | undefined,
    [workspaces],
  )
  const canEdit = workspace?.myRole === 'owner' || workspace?.myRole === 'admin'

  if (!canEdit) return null

  if (stampAvailability.requiresOnline) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        <CloudRequiredNotice variant="card" title={t('settings.businessStamp')} />
      </div>
    )
  }

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

        <div className="grid gap-3 sm:grid-cols-3">
          {BRAND_IMAGES.map((image) => (
            <BrandImageSlot
              key={image.field}
              t={t}
              workspaceId={workspace?.id}
              label={t(image.labelKey)}
              assetType={image.assetType}
              field={image.field}
              column={image.column}
              current={workspace?.[image.column] ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
BusinessStampSection.displayName = 'BusinessStampSection'

// ─── Backup Section ───────────────────────────────────────────────────────

const BackupSection = memo(function BackupSection() {
  const tOriginal = useTranslations()
  const intlLocale = useIntlLocale()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )
  // G7 — `exportData` is no longer read: it returned localStorage metadata,
  // not the business's data. The store still owns the local history list.
  const { addBackup, backups } = useBackupStore()
  const fetchBackup = useWorkspaceBackup()

  const [isExporting, setIsExporting] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
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
        size: formatBytes(blob.size, intlLocale),
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
      setExportError(err instanceof Error ? err.message : t('settings.backupFailed'))
    } finally {
      setIsExporting(false)
    }
  }, [fetchBackup, addBackup, intlLocale, t])

  // CSV: the same backup the JSON button fetches. A CSV holds ONE table, so
  // the download is a zip with one CSV per data set (buildCsvZip) — each one
  // goes back in through the import screen as it is.
  const handleExportCSV = useCallback(async () => {
    setIsExportingCsv(true)
    setExportError(null)
    try {
      const backup = await fetchBackup()
      const archive = buildCsvZip(
        Object.entries(backup.data).map(([name, rows]) => ({ name, rows })),
      )
      const blob = new Blob([archive], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hisabche-backup-${toIsoDay(new Date())}-csv.zip`
      a.click()
      URL.revokeObjectURL(url)
      addBackup({
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        size: formatBytes(blob.size, intlLocale),
        type: 'manual',
        status: 'completed',
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('settings.backupFailed'))
    } finally {
      setIsExportingCsv(false)
    }
  }, [fetchBackup, addBackup, intlLocale, t])

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

        {/* ⚠️ No «automatic backup every 24 hours» switch (live audit #19/#70):
            nothing ever scheduled it, and what it would have copied was this
            device's own storage, not the business's records. Said as it is. */}
        <p className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-sm text-[hsl(var(--fg-secondary))]">
          {t('settings.backupWhere')}
        </p>

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
            onClick={() => void handleExportCSV()}
            disabled={isExportingCsv}
            data-export-csv=""
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150 disabled:opacity-40',
              'motion-reduce:transition-none',
            )}
          >
            {isExportingCsv ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="size-4" aria-hidden="true" />
            )}
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
          {PERFORMANCE_MODES.map(({ value, labelKey }) => (
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
              {t(labelKey)}
            </button>
          ))}
        </div>

        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('settings.perfDesc')}</p>
      </div>
    </div>
  )
})
PerformanceSection.displayName = 'PerformanceSection'

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

export const StorageSection = memo(function StorageSection() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const locale = useIntlLocale()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [entries, setEntries] = useState<number | null>(null)
  // The read cache on the device, which the estimate does not count (persisted-bytes.ts).
  const [local, setLocal] = useState<number | null>(null)
  const [estimate, setEstimate] = useState<StorageEstimate>({ state: 'measuring' })
  const [clearing, setClearing] = useState(false)

  // The cache size is read after mount and kept current: every fetch, removal
  // and reset changes it, and the cache announces each one.
  useEffect(() => {
    const cache = queryClient.getQueryCache()
    const read = () => {
      setEntries(cache.getAll().length)
      setLocal(persistedBytes())
    }
    read()
    // A query created while ANOTHER component renders notifies the cache then; a
    // synchronous setState here is «Cannot update a component while rendering a
    // different component». Deferring one microtask moves it out of that render.
    let live = true
    const unsubscribe = cache.subscribe(() =>
      queueMicrotask(() => {
        if (live) read()
      }),
    )
    return () => {
      live = false
      unsubscribe()
    }
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
        : formatBytes(estimate.usage + (local ?? 0), locale)

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
              {entries === null
                ? '—'
                : `${formatNumber(entries, locale)} ${t('settings.cacheEntriesUnit')}`}
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
      href={localizePath('/approvals?tab=workflows', lang)}
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

// ─── Main Page ─────────────────────────────────────────────────────────────

export interface SettingsPageProps {
  /** Custom logout handler (e.g. for offline checks / LogoutPendingDialog). */
  onLogout?: (() => void | Promise<void>) | undefined
  /**
   * The account card. Windows and Android pass their own: signing out there
   * must ask about unsent offline changes first (LogoutPendingDialog).
   */
  accountSlot?: ReactNode | undefined
  /** What only a device has — its database, version, updates, display. */
  deviceSlot?: ReactNode | undefined
}

/**
 * ⚠️ ONE SETTINGS PAGE FOR WEB, WINDOWS AND ANDROID (owner, 21 Oct 2026).
 * The shells used to draw their own two-column page with four of these
 * sections; now they render this one and fill only the two slots above.
 */
export const SettingsPage = memo(function SettingsPage({
  onLogout,
  accountSlot,
  deviceSlot,
}: SettingsPageProps = {}) {
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

      {accountSlot ?? <AccountSection onLogout={onLogout} />}
      {/* Small settings as titled chips; each opens in the middle of the
          screen (owner request, 9 Nov 2026). */}
      <SettingsQuickChips
        items={[
          {
            id: 'language',
            icon: Languages,
            titleKey: 'settings.quick.language',
            render: () => <LanguageSection />,
          },
          {
            id: 'bookCurrency',
            icon: Coins,
            titleKey: 'settings.quick.bookCurrency',
            render: () => <BookCurrencySection />,
          },
          {
            id: 'timeZone',
            icon: Clock,
            titleKey: 'settings.quick.timeZone',
            render: () => <WorkplaceTimeZoneSection />,
          },
          {
            id: 'twoFactor',
            icon: ShieldCheck,
            titleKey: 'settings.quick.twoFactor',
            render: () => <TwoFactorSection />,
          },
          {
            id: 'backup',
            icon: DatabaseBackup,
            titleKey: 'settings.quick.backup',
            render: () => <BackupSection />,
          },
          {
            id: 'performance',
            icon: Gauge,
            titleKey: 'settings.quick.performance',
            render: () => <PerformanceSection />,
          },
          {
            id: 'storage',
            icon: HardDrive,
            titleKey: 'settings.quick.storage',
            render: () => <StorageSection />,
          },
        ]}
      />
      <BusinessStampSection />
      <IndustryProfileSection />
      {/* After the business type: Hisabche shaped the workspace from it; here
          the person adds or removes pages and tabs for themselves. Both closed
          until opened. */}
      <SettingsCollapsible
        id="operating-profile"
        icon={Briefcase}
        titleKey="settings.operatingProfile.title"
      >
        <OperatingProfileSettings />
      </SettingsCollapsible>
      <SettingsCollapsible
        id="pages-and-tabs"
        icon={LayoutGrid}
        titleKey="settings.quick.pagesAndTabs"
      >
        <PagesAndTabsSettings />
      </SettingsCollapsible>
      <CreditLimitModeSection />
      <MetalUnitSection />
      <SettingsLinkRow>
        <BillingSection />
        <WorkflowTemplatesSection />
        <DevelopersSection />
      </SettingsLinkRow>
      <SettingsCollapsible id="hardware" icon={ScanBarcode} titleKey="hardware.scannerTitle">
        <HardwareSection />
      </SettingsCollapsible>
      {deviceSlot}
    </div>
  )
})

SettingsPage.displayName = 'SettingsPage'
