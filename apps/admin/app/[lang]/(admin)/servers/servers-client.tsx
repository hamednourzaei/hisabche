'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'

import { Button, Card, Input } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import {
  useAdminInstances,
  useAdminScale,
  useSetAdminScale,
  type ServerInstance,
} from '@/hooks/use-admin-servers'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber } from '@/lib/admin-format'

/** Green under 65 %, amber under 85 %, red above — semantic tokens only. */
function tone(value: number): string {
  return value >= 85
    ? 'bg-[hsl(var(--color-destructive))]'
    : value >= 65
      ? 'bg-[hsl(var(--color-warning))]'
      : 'bg-[hsl(var(--color-success))]'
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span dir="ltr" className="font-mono tabular-nums">
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-accent">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tone(value)}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

export function ServersClient() {
  const dateLocale = useAdminLocale()
  const t = useTranslations()
  const { data, isError, refetch } = useAdminInstances()
  const instances = data?.instances ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (instances.length === 0) return
    if (!selectedId || !instances.some((i) => i.id === selectedId)) setSelectedId(instances[0]!.id)
  }, [instances, selectedId])

  if (isError) {
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
  }

  const selected: ServerInstance | undefined = instances.find((i) => i.id === selectedId)

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4">
        {data && !data.shared ? (
          <p className="rounded-lg border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.1)] p-2 text-xs">
            {t('admin.servers.notShared')}
          </p>
        ) : null}

        {instances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.servers.empty')}</p>
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label={t('admin.servers.pick')}
            >
              {instances.map((instance) => (
                <button
                  key={instance.id}
                  type="button"
                  role="tab"
                  aria-selected={instance.id === selectedId}
                  onClick={() => setSelectedId(instance.id)}
                  className={
                    instance.id === selectedId
                      ? 'rounded-xl border border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] px-3 py-1.5 text-sm font-medium'
                      : 'rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent'
                  }
                >
                  <span dir="ltr" className="font-mono">
                    {instance.id}
                  </span>
                  <span className="ms-2 text-xs tabular-nums">
                    {instance.cpuPercent.toFixed(0)}%
                  </span>
                  {instance.isSelf ? (
                    <span className="ms-2 text-xs">({t('admin.servers.self')})</span>
                  ) : null}
                </button>
              ))}
            </div>

            {selected ? (
              <div className="grid gap-4 sm:grid-cols-3" data-server={selected.id}>
                <Meter label={t('admin.servers.cpu')} value={selected.cpuPercent} />
                <Meter label={t('admin.servers.ram')} value={selected.memoryPercent} />
                <div className="space-y-1.5">
                  <span className="text-sm">{t('admin.servers.gpu')}</span>
                  <p className="text-xs text-muted-foreground">{t('admin.servers.noGpu')}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.servers.uptime')}:{' '}
                  {t('admin.servers.seconds', {
                    n: adminNumber(selected.uptimeSeconds, dateLocale),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.servers.inflight')}: {selected.inflightRequests}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.servers.commit')}:{' '}
                  <code dir="ltr" className="font-mono">
                    {selected.commit ?? '—'}
                  </code>
                </p>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <ScalePanel />
    </div>
  )
}

function ScalePanel() {
  const t = useTranslations()
  const { data: scale } = useAdminScale()
  const setScale = useSetAdminScale()
  const [count, setCount] = useState('')

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">{t('admin.servers.scaleTitle')}</h2>
      <p className="text-xs text-muted-foreground">{t('admin.servers.scaleHint')}</p>

      {!scale ? null : !scale.configured ? (
        <p className="rounded-lg border border-border p-2 text-xs">
          {t('admin.servers.scaleNotConfigured')}
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setScale.mutate(Number(count))
          }}
        >
          {scale.count !== null ? (
            <p className="w-full text-sm">{t('admin.servers.scaleCurrent', { n: scale.count })}</p>
          ) : null}
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">
              {t('admin.servers.scaleNew', { max: scale.max })}
            </span>
            <Input
              type="number"
              min={1}
              max={scale.max}
              step={1}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              className="w-32"
            />
          </label>
          <Button
            type="submit"
            disabled={setScale.isPending || !count || Number(count) === scale.count}
          >
            {t('admin.servers.scaleApply')}
          </Button>
        </form>
      )}

      {setScale.isSuccess ? (
        <p role="status" className="text-xs text-[hsl(var(--color-success))]">
          {t('admin.servers.scaleDone')}
        </p>
      ) : null}
      {setScale.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {t('admin.servers.scaleError')}{' '}
          {(setScale.error as { response?: { data?: { detail?: string } } }).response?.data
            ?.detail || apiErrorMessage(setScale.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </Card>
  )
}
