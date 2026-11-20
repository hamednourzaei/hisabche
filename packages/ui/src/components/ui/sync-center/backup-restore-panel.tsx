// «Bring a Hisabche archive back» — the missing half of portability.
//
// The file is read only inside the change handler, never during render. The
// local engine validates the checksum, the workspace and every conflicting id
// before it writes anything, and restores in ONE transaction. A refused
// archive therefore leaves the business exactly as it was; the error code is
// shown, not swallowed into a green success state.
'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Upload } from 'lucide-react'
import { useRestoreWorkspaceBackup } from '@hisabche/api'

import { Button } from '../button'

export function BackupRestorePanel() {
  const t = useTranslations()
  const restore = useRestoreWorkspaceBackup()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Allow the same file to be chosen again after a failed attempt.
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage(null)
    setFailed(false)
    try {
      const archive: unknown = JSON.parse(await file.text())
      const result = await restore(archive)
      setMessage(
        t('sync.restore.success')
          .replace('{count}', String(result.totalRows))
          .replace('{tables}', String(result.restoredTables.length)),
      )
    } catch (cause) {
      setFailed(true)
      const code = (cause as { response?: { data?: { code?: string } } } | null)?.response?.data
        ?.code
      setMessage(code ? `${t('sync.restore.failed')} (${code})` : t('sync.restore.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      data-backup-restore=""
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('sync.restore.title')}
      </h2>
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('sync.restore.hint')}</p>

      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void onFile(event)}
        aria-label={t('sync.restore.select')}
      />
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="size-4" aria-hidden="true" />
        )}
        <span className="ms-1.5">
          {busy ? t('sync.restore.restoring') : t('sync.restore.select')}
        </span>
      </Button>

      {message ? (
        <p
          role={failed ? 'alert' : 'status'}
          className={
            failed
              ? 'text-xs text-[hsl(var(--color-destructive))]'
              : 'text-xs text-[hsl(var(--fg-secondary))]'
          }
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
