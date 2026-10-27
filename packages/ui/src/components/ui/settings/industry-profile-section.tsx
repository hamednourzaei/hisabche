// packages/ui/src/components/ui/settings/industry-profile-section.tsx
'use client'

// ============================================
// The industry profile, editable in Settings.
//
// One component for web and the Windows/mobile shell. It never invents a
// second source of truth: it reads the trades the auth store already holds and
// writes them through the existing `PATCH /api/auth/profile` contract (online)
// or the local engine's same endpoint (offline).
//
// ⚠️ THE SELECTOR IS NOT THE AUTHORIZATION. A member's screen may hide it, but
// the authoritative backend refuses an industry write from a non-owner with
// 403 INDUSTRY_OWNER_ONLY. Hiding a button is a courtesy, never a control.
// ============================================

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@hisabche/store'
import { BUSINESS_TYPES, BUSINESS_MODELS } from '@hisabche/ui-contract'
import { apiErrorMessage } from '@hisabche/api'
import { industrySupportNoteKey } from '../../../lib/industry-support-note'

export interface IndustryProfileSectionProps {
  /** Overrides the auth store (the desktop shell keeps its own session). */
  businessTypes?: readonly string[] | undefined
  /** Defaults to the auth store's role; only `owner` may save. */
  canEdit?: boolean | undefined
  /** Overrides the online store write. Must call the same profile contract. */
  onSave?: ((businessTypes: string[]) => Promise<void>) | undefined
}

export function IndustryProfileSection({
  businessTypes,
  canEdit,
  onSave,
}: IndustryProfileSectionProps = {}) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as Parameters<typeof tOriginal>[0])
      return value && value !== key ? value : (fallback ?? key)
    } catch {
      return fallback ?? key
    }
  }

  const storeTypes = useAuthStore((state) => state.user?.businessTypes)
  const storeRole = useAuthStore((state) => state.user?.role)
  const updateProfile = useAuthStore((state) => state.updateProfile)

  const current = useMemo(
    () => [
      ...new Set((businessTypes ?? storeTypes ?? []).map((value) => value.trim()).filter(Boolean)),
    ],
    [businessTypes, storeTypes],
  )

  const [selected, setSelected] = useState<readonly string[]>(current)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // A profile arriving from a server read or a sync must replace a draft only
  // when the person has not started editing; otherwise their click is lost.
  useEffect(() => {
    setSelected((previous) => (previous.length === 0 ? current : previous))
  }, [current])

  const noteKey = industrySupportNoteKey(selected)
  const editable = canEdit ?? storeRole === 'owner'
  const options = useMemo(
    () => [...BUSINESS_MODELS, ...BUSINESS_TYPES].filter((option) => option.id !== 'other'),
    [],
  )

  const toggle = (id: string) => {
    setSaved(false)
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    )
  }

  const save = async () => {
    setIsSaving(true)
    setError(null)
    setSaved(false)
    try {
      if (onSave) {
        await onSave([...selected])
      } else {
        await updateProfile({ businessTypes: [...selected] })
      }
      setSaved(true)
    } catch (cause) {
      setError(apiErrorMessage(cause, t('settings.industrySaveFailed', 'ذخیره‌ی صنف انجام نشد')))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      data-industry-section=""
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
            {t('settings.industryTitle', 'صنف و نوع کسب‌وکار')}
          </h2>
        </div>
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'settings.industryHint',
            'صنف تعیین می‌کند واحد پیش‌فرض، ستون‌های فاکتور و ترتیب داشبورد چه باشد.',
          )}
        </p>

        {editable ? null : (
          <p
            role="status"
            data-industry-readonly=""
            className="text-xs text-[hsl(var(--fg-tertiary))]"
          >
            {t('settings.industryOwnerOnly', 'تنها مالک کسب‌وکار می‌تواند صنف را تغییر دهد.')}
          </p>
        )}

        <div className="max-h-64 overflow-y-auto rounded-xl border border-[hsl(var(--border-default))] p-2">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {options.map((option) => {
              const checked = selected.includes(option.id)
              return (
                <li key={option.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[hsl(var(--surface-muted))]">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!editable || isSaving}
                      onChange={() => toggle(option.id)}
                    />
                    <span>{t(option.labelKey, option.labelFa)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        {noteKey ? (
          <p role="note" data-industry-note="" className="text-xs text-[hsl(var(--fg-secondary))]">
            {t(noteKey)}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            data-industry-error=""
            className="text-xs text-[hsl(var(--color-destructive))]"
          >
            {error}
          </p>
        ) : null}
        {saved ? (
          <p
            role="status"
            data-industry-saved=""
            className="text-xs text-[hsl(var(--color-success))]"
          >
            {t('settings.industrySaved', 'صنف ذخیره شد.')}
          </p>
        ) : null}

        {editable ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save()}
            data-industry-save=""
            className="h-9 rounded-lg bg-[hsl(var(--color-primary))] px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            {isSaving ? t('common.saving', 'در حال ذخیره…') : t('common.save', 'ذخیره')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
