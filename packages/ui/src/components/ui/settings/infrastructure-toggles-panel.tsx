'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  DEFAULT_INFRASTRUCTURE_SETTINGS,
  buildNginxConfigDirectives,
  type InfrastructureSettings,
  type UpdateInfrastructureSettingsInput,
} from '@hisabche/validation'
import { useInfrastructureSettings, useUpdateInfrastructureSettings } from '@hisabche/api'
import { Switch } from '../switch'
import { Badge } from '../badge'

export interface InfrastructureTogglesPanelProps {
  initialSettings?: InfrastructureSettings
  onSave?: (settings: UpdateInfrastructureSettingsInput) => Promise<void> | void
  isSavingExternal?: boolean
}

export function InfrastructureTogglesPanel({
  initialSettings,
  onSave,
  isSavingExternal,
}: InfrastructureTogglesPanelProps) {
  const t = useTranslations('admin.infrastructure')
  const query = useInfrastructureSettings()
  const mutation = useUpdateInfrastructureSettings()

  const activeSettings = initialSettings ?? query.data ?? DEFAULT_INFRASTRUCTURE_SETTINGS

  const [form, setForm] = useState<InfrastructureSettings>(() => activeSettings)
  const [prevSettings, setPrevSettings] = useState(activeSettings)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (activeSettings !== prevSettings) {
    setPrevSettings(activeSettings)
    setForm(activeSettings)
  }

  const handleToggle = (key: keyof InfrastructureSettings) => (checked: boolean) => {
    setForm((prev) => ({ ...prev, [key]: checked }))
    setSavedSuccess(false)
  }

  const handleNumberChange =
    (key: 'rateLimitRps' | 'rateLimitBurst') => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10)
      if (!isNaN(val)) {
        setForm((prev) => ({ ...prev, [key]: val }))
        setSavedSuccess(false)
      }
    }

  const handleTextChange =
    (key: 'maintenanceNotice' | 'cacheBypassHeader') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
      setSavedSuccess(false)
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSavedSuccess(false)

    const payload: UpdateInfrastructureSettingsInput = {
      nginxProxyEnabled: form.nginxProxyEnabled,
      rateLimitingEnabled: form.rateLimitingEnabled,
      rateLimitRps: form.rateLimitRps,
      rateLimitBurst: form.rateLimitBurst,
      cacheBypassEnabled: form.cacheBypassEnabled,
      cacheBypassHeader: form.cacheBypassHeader,
      maintenanceMode: form.maintenanceMode,
      maintenanceNotice: form.maintenanceNotice,
      wsCompressionEnabled: form.wsCompressionEnabled,
      upstreamHealthCheck: form.upstreamHealthCheck,
      hstsEnabled: form.hstsEnabled,
      hstsMaxAge: form.hstsMaxAge,
    }

    try {
      if (onSave) {
        await onSave(payload)
      } else {
        await mutation.mutateAsync(payload)
      }
      setSavedSuccess(true)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'STEP_UP_CANCELLED') return
      setErrorMessage(t('saveError'))
    }
  }

  const isSaving = mutation.isPending || Boolean(isSavingExternal)
  const nginxDirectives = buildNginxConfigDirectives(form)

  return (
    <section
      data-testid="infrastructure-toggles-panel"
      className="space-y-6 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 text-start"
    >
      <header className="border-b border-[hsl(var(--border-default))] pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">{t('title')}</h2>
            <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{t('subtitle')}</p>
          </div>
          <Badge variant={form.nginxProxyEnabled ? 'success' : 'secondary'}>
            {form.nginxProxyEnabled ? t('enabled') : t('disabled')}
          </Badge>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nginx Proxy Main Toggle */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-4">
          <div className="space-y-1">
            <label
              htmlFor="toggle-nginx-proxy"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('nginxProxy')}
            </label>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('nginxProxyDesc')}</p>
          </div>
          <Switch
            id="toggle-nginx-proxy"
            data-testid="toggle-nginx-proxy"
            checked={form.nginxProxyEnabled}
            onCheckedChange={handleToggle('nginxProxyEnabled')}
          />
        </div>

        {/* Rate Limiting */}
        <div className="space-y-3 rounded-lg border border-[hsl(var(--border-default))] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label
                htmlFor="toggle-rate-limiting"
                className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
              >
                {t('rateLimiting')}
              </label>
              <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('rateLimitingDesc')}</p>
            </div>
            <Switch
              id="toggle-rate-limiting"
              data-testid="toggle-rate-limiting"
              checked={form.rateLimitingEnabled}
              onCheckedChange={handleToggle('rateLimitingEnabled')}
            />
          </div>

          {form.rateLimitingEnabled && (
            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--fg-secondary))]">
                  {t('rateLimitRps')}
                </label>
                <input
                  type="number"
                  data-testid="input-rate-limit-rps"
                  min={1}
                  max={10000}
                  value={form.rateLimitRps}
                  onChange={handleNumberChange('rateLimitRps')}
                  className="w-full rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-1.5 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[hsl(var(--fg-secondary))]">
                  {t('rateLimitBurst')}
                </label>
                <input
                  type="number"
                  data-testid="input-rate-limit-burst"
                  min={1}
                  max={1000}
                  value={form.rateLimitBurst}
                  onChange={handleNumberChange('rateLimitBurst')}
                  className="w-full rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-1.5 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cache Bypass */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border-default))] p-4">
          <div className="space-y-1">
            <label
              htmlFor="toggle-cache-bypass"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('cacheBypass')}
            </label>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('cacheBypassDesc')}</p>
          </div>
          <Switch
            id="toggle-cache-bypass"
            data-testid="toggle-cache-bypass"
            checked={form.cacheBypassEnabled}
            onCheckedChange={handleToggle('cacheBypassEnabled')}
          />
        </div>

        {/* Emergency Maintenance Mode */}
        <div className="space-y-3 rounded-lg border border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--color-warning)/0.05)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label
                htmlFor="toggle-maintenance-mode"
                className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
              >
                {t('maintenance')}
              </label>
              <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('maintenanceDesc')}</p>
            </div>
            <Switch
              id="toggle-maintenance-mode"
              data-testid="toggle-maintenance-mode"
              checked={form.maintenanceMode}
              onCheckedChange={handleToggle('maintenanceMode')}
            />
          </div>

          {form.maintenanceMode && (
            <div className="pt-2">
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--fg-secondary))]">
                {t('maintenanceNotice')}
              </label>
              <input
                type="text"
                data-testid="input-maintenance-notice"
                maxLength={280}
                value={form.maintenanceNotice}
                onChange={handleTextChange('maintenanceNotice')}
                placeholder="پیام اطلاع‌رسانی به کاربران..."
                className="w-full rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-1.5 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
              />
            </div>
          )}
        </div>

        {/* WebSocket Realtime Compression */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border-default))] p-4">
          <div className="space-y-1">
            <label
              htmlFor="toggle-ws-compression"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('wsCompression')}
            </label>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('wsCompressionDesc')}</p>
          </div>
          <Switch
            id="toggle-ws-compression"
            data-testid="toggle-ws-compression"
            checked={form.wsCompressionEnabled}
            onCheckedChange={handleToggle('wsCompressionEnabled')}
          />
        </div>

        {/* Upstream Health Check */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border-default))] p-4">
          <div className="space-y-1">
            <label
              htmlFor="toggle-upstream-health"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('upstreamHealth')}
            </label>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('upstreamHealthDesc')}</p>
          </div>
          <Switch
            id="toggle-upstream-health"
            data-testid="toggle-upstream-health"
            checked={form.upstreamHealthCheck}
            onCheckedChange={handleToggle('upstreamHealthCheck')}
          />
        </div>

        {/* HSTS / TLS */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--border-default))] p-4">
          <div className="space-y-1">
            <label
              htmlFor="toggle-hsts"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('hsts')}
            </label>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('hstsDesc')}</p>
          </div>
          <Switch
            id="toggle-hsts"
            data-testid="toggle-hsts"
            checked={form.hstsEnabled}
            onCheckedChange={handleToggle('hstsEnabled')}
          />
        </div>

        {/* Live Nginx Directives Preview */}
        <details className="rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('nginxPreview')}
          </summary>
          <pre
            dir="ltr"
            data-testid="nginx-directives-preview"
            className="mt-3 overflow-x-auto rounded-md bg-[hsl(var(--surface-base))] p-3 text-xs text-[hsl(var(--fg-secondary))]"
          >
            {nginxDirectives}
          </pre>
        </details>

        {/* Status Alerts */}
        {savedSuccess && (
          <div
            data-testid="save-success-alert"
            className="rounded-lg border border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.1)] p-3 text-sm text-[hsl(var(--color-success))]"
          >
            {t('saved')}
          </div>
        )}

        {errorMessage && (
          <div
            data-testid="save-error-alert"
            className="rounded-lg border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.1)] p-3 text-sm text-[hsl(var(--color-destructive))]"
          >
            {errorMessage}
          </div>
        )}

        {/* Footer with Metadata & Submit */}
        <footer className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[hsl(var(--fg-tertiary))]">
            <span>{t('updatedAt', { date: form.updatedAt ?? '—' })}</span>
            <span className="ms-3">{t('updatedBy', { user: form.updatedBy ?? 'system' })}</span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            data-testid="btn-save-infrastructure"
            className="inline-flex items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--color-primary-fg))] transition-colors hover:bg-[hsl(var(--color-primary)/0.9)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? '...' : t('saveChanges')}
          </button>
        </footer>
      </form>
    </section>
  )
}
