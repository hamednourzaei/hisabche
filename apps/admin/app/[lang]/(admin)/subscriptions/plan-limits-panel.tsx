'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, apiErrorMessage } from '@hisabche/api'

import { Button, Input } from '@/components/ui'
import { Panel } from '@/components/admin-shell/admin-ui'

/**
 * Plan limits — per plan, and per workspace (which wins).
 *
 *   GET/PUT /admin/plan-limits[/:plan]
 *   GET/PUT /admin/workspace-limits/:workspaceId
 *
 * A field left EMPTY is not sent: that layer inherits. «Unlimited» sends null.
 * AI questions cannot be unlimited — the server refuses it too.
 */
type Key = 'invoices' | 'users' | 'aiMonthly'
const KEYS: Key[] = ['invoices', 'users', 'aiMonthly']
type Values = Partial<Record<Key, number | null>>
interface PlanRow {
  plan: string
  defaults: Record<Key, number | null>
  settings: Values
}

/** Form state per field: '' = inherit, 'unlimited', or a number as text. */
type Field = string

function toFields(values: Values): Record<Key, Field> {
  const out = {} as Record<Key, Field>
  for (const key of KEYS) {
    const v = values[key]
    out[key] = v === undefined ? '' : v === null ? 'unlimited' : String(v)
  }
  return out
}

function toPatch(fields: Record<Key, Field>): Values {
  const out: Values = {}
  for (const key of KEYS) {
    const f = fields[key].trim()
    if (f === '') continue
    out[key] = f === 'unlimited' ? null : Number(f)
  }
  return out
}

function LimitFields({
  fields,
  onChange,
  defaults,
}: {
  fields: Record<Key, Field>
  onChange: (next: Record<Key, Field>) => void
  defaults?: Record<Key, number | null> | undefined
}) {
  const t = useTranslations()
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {KEYS.map((key) => (
        <label key={key} className="space-y-1 text-sm">
          <span className="block text-xs text-muted-foreground">{t(`admin.limits.${key}`)}</span>
          <Input
            type="number"
            min={0}
            step={1}
            disabled={fields[key] === 'unlimited'}
            value={fields[key] === 'unlimited' ? '' : fields[key]}
            placeholder={
              defaults
                ? t('admin.limits.default', {
                    value:
                      defaults[key] === null
                        ? t('admin.limits.unlimitedValue')
                        : String(defaults[key]),
                  })
                : ''
            }
            onChange={(event) => onChange({ ...fields, [key]: event.target.value })}
          />
          {key !== 'aiMonthly' ? (
            <span className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={fields[key] === 'unlimited'}
                onChange={(event) =>
                  onChange({ ...fields, [key]: event.target.checked ? 'unlimited' : '' })
                }
              />
              {t('admin.limits.unlimited')}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  )
}

function PlanRowEditor({ row }: { row: PlanRow }) {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [fields, setFields] = useState(() => toFields(row.settings))
  useEffect(() => setFields(toFields(row.settings)), [row.settings])
  const save = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/admin/plan-limits/${row.plan}`, toPatch(fields))
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'plan-limits'] }),
  })
  return (
    <form
      className="space-y-2 rounded-xl border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <h3 className="text-sm font-medium">{t(`admin.plan.${row.plan}`)}</h3>
      <LimitFields fields={fields} onChange={setFields} defaults={row.defaults} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('admin.limits.save')}
        </Button>
        {save.isSuccess ? (
          <span className="text-xs text-emerald-500">{t('admin.limits.saved')}</span>
        ) : null}
        {save.isError ? (
          <span role="alert" className="text-xs text-destructive">
            {apiErrorMessage(save.error, t('admin.error.generic'))}
          </span>
        ) : null}
      </div>
    </form>
  )
}

export function PlanLimitsPanel() {
  const t = useTranslations()
  const { data } = useQuery({
    queryKey: ['admin', 'plan-limits'],
    queryFn: async ({ signal }) => {
      const { data: body } = await apiClient.get('/admin/plan-limits', { signal })
      return body as { configured: boolean; plans: PlanRow[] }
    },
  })

  return (
    <Panel className="space-y-3 p-4" data-plan-limits="">
      <h2 className="text-sm font-semibold">{t('admin.limits.title')}</h2>
      <p className="text-xs text-muted-foreground">{t('admin.limits.hint')}</p>
      {data && !data.configured ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          {t('admin.limits.notConfigured')}
        </p>
      ) : null}
      {data?.plans.map((row) => (
        <PlanRowEditor key={row.plan} row={row} />
      ))}
      <WorkspaceLimits />
    </Panel>
  )
}

function WorkspaceLimits() {
  const t = useTranslations()
  const [workspaceId, setWorkspaceId] = useState('')
  const [loaded, setLoaded] = useState<string | null>(null)
  const [fields, setFields] = useState(() => toFields({}))
  const [note, setNote] = useState('')

  const load = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get(`/admin/workspace-limits/${id}`)
      return data as { limits: Values; note: string | null }
    },
    onSuccess: (data, id) => {
      setFields(toFields(data.limits))
      setNote(data.note ?? '')
      setLoaded(id)
    },
  })
  const save = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/admin/workspace-limits/${loaded}`, { limits: toPatch(fields), note })
    },
  })

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <h3 className="text-sm font-medium">{t('admin.limits.workspaceTitle')}</h3>
      <p className="text-xs text-muted-foreground">{t('admin.limits.workspaceHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          dir="ltr"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          className="w-80 font-mono"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!workspaceId.trim() || load.isPending}
          onClick={() => load.mutate(workspaceId.trim())}
        >
          {t('admin.limits.load')}
        </Button>
      </div>
      {loaded ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <LimitFields fields={fields} onChange={setFields} />
          <label className="block space-y-1 text-sm">
            <span className="block text-xs text-muted-foreground">{t('admin.limits.note')}</span>
            <Input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={save.isPending}>
              {t('admin.limits.save')}
            </Button>
            {save.isSuccess ? (
              <span className="text-xs text-emerald-500">{t('admin.limits.saved')}</span>
            ) : null}
            {save.isError ? (
              <span role="alert" className="text-xs text-destructive">
                {apiErrorMessage(save.error, t('admin.error.generic'))}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
      {load.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(load.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </div>
  )
}
