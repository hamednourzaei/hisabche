// «Download a full copy of your data» — Markdown or Excel (owner's request).
//
// ⚠️ ONE panel, not a button per row of the backup list: that list is local
// browser records, and every row's button would have downloaded TODAY's data
// while appearing to download that old copy (G1).
//
// Pro and Enterprise only, decided by the server (402 otherwise); the plan
// shown here is only a hint for which buttons to offer.
'use client'

import { useState } from 'react'
import { localizePath } from '@hisabche/ui-contract'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'
import { useDownloadWorkspaceBackup, useSubscription, type BackupFileFormat } from '@hisabche/api'

import { Button } from '../button'

export function BackupDownloadPanel() {
  const t = useTranslations()
  const lang = useRouteLang()
  const download = useDownloadWorkspaceBackup()
  const { data: subscription } = useSubscription()
  const [busy, setBusy] = useState<BackupFileFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allowed =
    !!subscription && ['pro', 'enterprise'].includes(subscription.plan) && !subscription.isTrial

  const run = async (format: BackupFileFormat) => {
    setBusy(format)
    setError(null)
    try {
      await download(format)
    } catch (cause) {
      // A blob request cannot read the JSON body, so the status decides.
      const status = (cause as { status?: number } | null)?.status
      setError(
        status === 402
          ? t('sync.download.requiresPlan')
          : status === 403
            ? t('sync.download.ownerOnly')
            : t('sync.download.failed'),
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      data-backup-download=""
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('sync.download.title')}
      </h2>
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('sync.download.hint')}</p>

      {allowed ? (
        <div className="flex flex-wrap gap-2">
          {(['md', 'xlsx'] as const).map((format) => (
            <Button
              key={format}
              variant="outline"
              disabled={busy !== null}
              onClick={() => void run(format)}
            >
              {busy === format ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              <span className="ms-1.5">
                {busy === format
                  ? t('sync.download.downloading')
                  : format === 'md'
                    ? t('sync.download.markdown')
                    : t('sync.download.excel')}
              </span>
            </Button>
          ))}
        </div>
      ) : subscription ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('sync.download.requiresPlan')}{' '}
          <a
            href={localizePath('/billing', lang)}
            className="font-medium text-[hsl(var(--color-primary))] hover:underline"
          >
            {t('sync.download.upgrade')}
          </a>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
    </section>
  )
}
