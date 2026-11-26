'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'

export interface RuntimeModuleView {
  id: string
  version: string
  latestVersion?: string | undefined
  status: 'up_to_date' | 'update_available' | 'downloading' | 'incompatible' | 'disabled'
  compatible: boolean
  offlineSupported: boolean
}

export interface RuntimeUpdateViewModel {
  state:
    | 'UP_TO_DATE'
    | 'CHECKING'
    | 'UPDATE_AVAILABLE'
    | 'DOWNLOADING'
    | 'PAUSED'
    | 'VERIFYING'
    | 'COMPATIBILITY_CHECK'
    | 'READY_TO_INSTALL'
    | 'INSTALLING'
    | 'ACTIVATING'
    | 'RESTART_REQUIRED'
    | 'ACTIVE'
    | 'ROLLBACK_REQUIRED'
    | 'ROLLING_BACK'
    | 'FAILED'
    | 'UNSUPPORTED'
    | 'INCOMPATIBLE'
  coreVersion: string
  bootstrapVersion: string
  channel: 'development' | 'internal' | 'beta' | 'stable'
  /** Real download progress [0..100], or null when not downloading. Never fabricated. */
  progressPercent: number | null
  lastSuccessfulUpdateIso: string | null
  verificationStatus: 'verified' | 'pending' | 'failed'
  compatibilityStatus: 'compatible' | 'incompatible' | 'safe_mode'
  rollbackStatus: 'none' | 'rolled_back' | 'quarantined'
  failureDetails: string | null
  storageUsedBytes: number
  releaseNotes: string | null
  financialWorkActive: boolean
  modules: readonly RuntimeModuleView[]
}

export interface RuntimeUpdateCenterProps {
  model: RuntimeUpdateViewModel
  onCheckUpdates: () => void
  onPauseOrResume: () => void
  onRetry: () => void
  onUpdateModule: (moduleId: string) => void
  onUpdateAllCompatible: () => void
}

function resolveHeadlineKey(state: RuntimeUpdateViewModel['state']): string {
  switch (state) {
    case 'UPDATE_AVAILABLE':
    case 'READY_TO_INSTALL':
      return 'status.updateAvailable'
    case 'RESTART_REQUIRED':
      return 'status.restartRequired'
    case 'DOWNLOADING':
    case 'INSTALLING':
    case 'ACTIVATING':
    case 'VERIFYING':
      return 'status.inProgress'
    case 'FAILED':
    case 'INCOMPATIBLE':
    case 'ROLLBACK_REQUIRED':
    case 'ROLLING_BACK':
      return 'status.attentionNeeded'
    default:
      return 'status.upToDate'
  }
}

export function RuntimeUpdateCenter({
  model,
  onCheckUpdates,
  onPauseOrResume,
  onRetry,
  onUpdateModule,
  onUpdateAllCompatible,
}: RuntimeUpdateCenterProps): React.JSX.Element {
  const t = useTranslations('runtimeUpdate')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const headlineKey = resolveHeadlineKey(model.state)
  const compatibleUpdatesCount = model.modules.filter(
    (m) => m.status === 'update_available' && m.compatible,
  ).length

  return (
    <section
      aria-label={t('title')}
      className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 text-start"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h2>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{t(headlineKey)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCheckUpdates}
            className="rounded-lg bg-[hsl(var(--color-primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--color-primary-fg))]"
          >
            {t('actions.checkNow')}
          </button>

          {model.state === 'DOWNLOADING' || model.state === 'PAUSED' ? (
            <button
              type="button"
              onClick={onPauseOrResume}
              className="rounded-lg border border-[hsl(var(--border-default))] px-3 py-1.5 text-sm text-[hsl(var(--fg-primary))]"
            >
              {model.state === 'PAUSED' ? t('actions.resume') : t('actions.pause')}
            </button>
          ) : null}

          {model.state === 'FAILED' ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-[hsl(var(--border-default))] px-3 py-1.5 text-sm text-[hsl(var(--fg-primary))]"
            >
              {t('actions.retry')}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className="rounded-lg border border-[hsl(var(--border-default))] px-3 py-1.5 text-sm text-[hsl(var(--fg-secondary))]"
          >
            {showDiagnostics ? t('actions.hideDiagnostics') : t('actions.showDiagnostics')}
          </button>
        </div>
      </div>

      {model.progressPercent !== null ? (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
            <div
              className="h-full bg-[hsl(var(--color-primary))]"
              style={{ width: `${Math.max(0, Math.min(100, model.progressPercent))}%` }}
            />
          </div>
        </div>
      ) : null}

      {model.financialWorkActive ? (
        <p className="mt-3 text-xs text-[hsl(var(--fg-secondary))]">
          {t('notices.deferredDuringFinancialOps')}
        </p>
      ) : null}

      {showDiagnostics ? (
        <div className="mt-5 space-y-4 border-t border-[hsl(var(--border-default))] pt-4">
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[hsl(var(--fg-secondary))]">{t('fields.coreVersion')}</dt>
              <dd className="font-mono text-[hsl(var(--fg-primary))]">{model.coreVersion}</dd>
            </div>
            <div>
              <dt className="text-[hsl(var(--fg-secondary))]">{t('fields.bootstrapVersion')}</dt>
              <dd className="font-mono text-[hsl(var(--fg-primary))]">{model.bootstrapVersion}</dd>
            </div>
            <div>
              <dt className="text-[hsl(var(--fg-secondary))]">{t('fields.channel')}</dt>
              <dd className="text-[hsl(var(--fg-primary))]">{model.channel}</dd>
            </div>
            <div>
              <dt className="text-[hsl(var(--fg-secondary))]">{t('fields.verification')}</dt>
              <dd className="text-[hsl(var(--fg-primary))]">{model.verificationStatus}</dd>
            </div>
            <div>
              <dt className="text-[hsl(var(--fg-secondary))]">{t('fields.compatibility')}</dt>
              <dd className="text-[hsl(var(--fg-primary))]">{model.compatibilityStatus}</dd>
            </div>
            <div>
              <dt className="text-[hsl(var(--fg-secondary))]">{t('fields.rollback')}</dt>
              <dd className="text-[hsl(var(--fg-primary))]">{model.rollbackStatus}</dd>
            </div>
          </dl>

          {model.failureDetails ? (
            <p className="rounded-lg border border-[hsl(var(--border-default))] p-3 text-xs text-[hsl(var(--fg-primary))]">
              {model.failureDetails}
            </p>
          ) : null}

          {model.releaseNotes ? (
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{model.releaseNotes}</p>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('modulesTitle')}
              </h3>
              {compatibleUpdatesCount > 0 ? (
                <button
                  type="button"
                  onClick={onUpdateAllCompatible}
                  className="rounded-md bg-[hsl(var(--color-primary))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-primary-fg))]"
                >
                  {t('actions.updateAllCompatible')}
                </button>
              ) : null}
            </div>
            <ul className="divide-y divide-[hsl(var(--border-default))]">
              {model.modules.map((mod) => (
                <li key={mod.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-medium text-[hsl(var(--fg-primary))]">{mod.id}</span>
                    <span className="ms-2 font-mono text-[hsl(var(--fg-secondary))]">
                      {mod.version}
                    </span>
                  </div>
                  {mod.status === 'update_available' && mod.compatible ? (
                    <button
                      type="button"
                      onClick={() => onUpdateModule(mod.id)}
                      className="rounded border border-[hsl(var(--border-default))] px-2 py-1 text-xs text-[hsl(var(--fg-primary))]"
                    >
                      {t('actions.updateModule')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
