'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { FEATURE_PACKS, PACK_IDS, type PackId } from '@hisabche/validation'

export type DevicePackStatus = 'installed' | 'available' | 'downloading' | 'failed'

export interface DeviceModulesPanelProps {
  installedPacks: readonly PackId[]
  downloadingPacks?: readonly PackId[]
  failedPacks?: readonly PackId[]
  deliveryEnabled?: boolean
  onInstall?: (packId: PackId) => void
  onRemove?: (packId: PackId) => void
  onRetry?: (packId: PackId) => void
}

export function DeviceModulesPanel({
  installedPacks,
  downloadingPacks = [],
  failedPacks = [],
  deliveryEnabled = false,
  onInstall,
  onRemove,
  onRetry,
}: DeviceModulesPanelProps) {
  const t = useTranslations('packs')

  const statusOf = (id: PackId): DevicePackStatus => {
    if (downloadingPacks.includes(id)) return 'downloading'
    if (failedPacks.includes(id)) return 'failed'
    if (id === 'core' || installedPacks.includes(id)) return 'installed'
    return 'available'
  }

  return (
    <section
      data-testid="device-modules-panel"
      className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-start"
    >
      <div className="mb-3 space-y-1">
        <h2 className="text-sm font-bold text-[hsl(var(--fg-primary))]">{t('settings.title')}</h2>
        <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('settings.subtitle')}</p>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('settings.codeOnlyNotice')}</p>
      </div>

      <div className="divide-y divide-[hsl(var(--border-default))]">
        {PACK_IDS.map((packId) => {
          const def = FEATURE_PACKS[packId]
          const status = statusOf(packId)
          return (
            <div
              key={packId}
              data-pack-row={packId}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {t(`${packId}.label`)}
                  </span>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))] tabular-nums">
                    {t('settings.sizeKb', { kb: def.budgetKb })}
                  </span>
                </div>
                <p className="truncate text-xs text-[hsl(var(--fg-secondary))]">
                  {t(`${packId}.description`)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  data-pack-status={status}
                  className="rounded-full bg-[hsl(var(--surface-muted))] px-2.5 py-0.5 text-xs text-[hsl(var(--fg-primary))]"
                >
                  {t(`status.${status}`)}
                </span>

                {deliveryEnabled && packId !== 'core' ? (
                  status === 'installed' && onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(packId)}
                      className="rounded-lg border border-[hsl(var(--border-default))] px-2.5 py-1 text-xs text-[hsl(var(--fg-primary))]"
                    >
                      {t('actions.remove')}
                    </button>
                  ) : status === 'failed' && onRetry ? (
                    <button
                      type="button"
                      onClick={() => onRetry(packId)}
                      className="rounded-lg bg-[hsl(var(--color-primary))] px-2.5 py-1 text-xs text-[hsl(var(--color-primary-fg))]"
                    >
                      {t('actions.retry')}
                    </button>
                  ) : status === 'available' && onInstall ? (
                    <button
                      type="button"
                      onClick={() => onInstall(packId)}
                      className="rounded-lg bg-[hsl(var(--color-primary))] px-2.5 py-1 text-xs text-[hsl(var(--color-primary-fg))]"
                    >
                      {t('actions.install')}
                    </button>
                  ) : null
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
