// ============================================
// «به‌روزرسانی» — look, download, install.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THIS REPLACED
//
// A single button labelled «تازه‌سازی» wired to a main-process call that
// returned `void`. Pressing it did one of two things: nothing at all, or — if
// an update happened to exist — raised an operating-system notification the
// person had no reason to expect and no way to act on from inside the app.
//
// The three steps are separate because they cost different things. Looking is
// a few kilobytes. Downloading is ~80 MB, which on a metered connection in
// Kabul or Herat is a decision, not a side effect. Installing closes the app.
// ============================================

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// The desktop primitives, not the shared package's: this app's `Badge`
// takes `tone`, and `settings-page.tsx` beside it uses the same set.
import { Badge, Button, Card } from '@/components/ui/primitives'

import { bridge } from '@/shared/lib/bridge'

/** Mirrors `UpdateStatus` in the IPC contract. */
type UpdateStatus =
  | { state: 'unsupported'; reason: 'development' | 'no-feed' }
  | { state: 'none'; currentVersion: string }
  | { state: 'available'; version: string; notes: string | null }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export function UpdateSection() {
  const t = useTranslations()
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [busy, setBusy] = useState(false)

  // ⚠️ SUBSCRIBED ONCE, AND UNSUBSCRIBED. `onUpdateStatus` returns its own
  // teardown: without calling it, every visit to this screen adds another
  // listener to the same main-process emitter and the percentage jumps as N
  // copies of each event arrive.
  useEffect(() => {
    const off = bridge()?.app.onUpdateStatus((next) => setStatus(next))
    return () => off?.()
  }, [])

  const check = useCallback(async () => {
    setBusy(true)
    try {
      const next = await bridge()?.app.checkUpdates()
      if (next) setStatus(next)
    } finally {
      setBusy(false)
    }
  }, [])

  const download = useCallback(async () => {
    setBusy(true)
    try {
      const next = await bridge()?.app.downloadUpdate()
      if (next) setStatus(next)
    } finally {
      setBusy(false)
    }
  }, [])

  // ⚠️ No confirmation dialog from the main process — it could not be
  // translated by the renderer that owns every other string here. The button
  // says what it does instead.
  const install = useCallback(() => {
    void bridge()?.app.installUpdate()
  }, [])

  return (
    <Card>
      <h2 className="mb-3 text-sm font-bold">{t('update.title')}</h2>

      <div className="flex flex-col gap-3 text-sm">
        <StatusLine status={status} t={t} />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void check()}>
            {t('update.check')}
          </Button>

          {status?.state === 'available' ? (
            <Button size="sm" disabled={busy} onClick={() => void download()}>
              {t('update.download')}
            </Button>
          ) : null}

          {status?.state === 'ready' ? (
            <Button size="sm" onClick={install}>
              {t('update.installAndRestart')}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function StatusLine({ status, t }: { status: UpdateStatus | null; t: (key: string) => string }) {
  if (!status) {
    return <span className="text-[hsl(var(--fg-tertiary))]">{t('update.idle')}</span>
  }

  switch (status.state) {
    case 'unsupported':
      // Not an error. A local build and a fork both land here legitimately,
      // and colouring it red would teach people to ignore a red state.
      return (
        <span className="text-[hsl(var(--fg-tertiary))]">
          {status.reason === 'development' ? t('update.devBuild') : t('update.noFeed')}
        </span>
      )

    case 'none':
      return (
        <div className="flex items-center justify-between">
          <span className="text-[hsl(var(--fg-secondary))]">{t('update.upToDate')}</span>
          <span className="tabular-nums text-[hsl(var(--fg-tertiary))]">
            {status.currentVersion}
          </span>
        </div>
      )

    case 'available':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Badge tone="success">{t('update.available')}</Badge>
            <span className="tabular-nums">{status.version}</span>
          </div>
          {status.notes ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-[hsl(var(--fg-tertiary))]">
              {status.notes}
            </p>
          ) : null}
        </div>
      )

    case 'downloading':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--fg-secondary))]">{t('update.downloading')}</span>
            <span className="tabular-nums">{status.percent}%</span>
          </div>
          {/* A real bar, not a spinner: an 80 MB download on a slow line needs
              to show that it is moving, and how much is left. */}
          <div
            role="progressbar"
            aria-valuenow={status.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]"
          >
            <div
              className="h-full rounded-full bg-[hsl(var(--color-primary))] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        </div>
      )

    case 'ready':
      return (
        <div className="flex items-center justify-between">
          <Badge tone="success">{t('update.ready')}</Badge>
          <span className="tabular-nums">{status.version}</span>
        </div>
      )

    case 'error':
      return (
        <div className="flex flex-col gap-1">
          <Badge tone="danger">{t('update.failed')}</Badge>
          {/* The real message, not a generic one — «could not reach the
              server» and «the download was corrupt» need different actions. */}
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{status.message}</p>
        </div>
      )
  }
}
