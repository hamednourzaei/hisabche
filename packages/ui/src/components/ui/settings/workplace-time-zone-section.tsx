// ============================================
// Settings → «منطقه‌ی زمانی»: where this business is.
//
// It decides what «today» and «now» are for the people who work here — an
// employee's attendance link reads the day in this zone, not on their phone
// and not on the manager's. A branch in another zone may have its own.
//
// ⚠️ THERE IS NO DEFAULT. Until the owner chooses, the panel says «not set».
// The device's own zone is OFFERED («this device is in …») and never shown as
// the answer: a shop in Kabul opened from a laptop in Dubai is not in Dubai.
// ⚠️ The list of zones and the device's zone exist only in the browser, so
// both are read after mount.
// ⚠️ A branch with no zone of its own is in the business's zone; that choice
// is a real option («same as the business»), not an empty field.
// ============================================
'use client'

import { memo, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Globe } from 'lucide-react'
import {
  apiErrorMessage,
  useSetBranchTimeZone,
  useSetWorkspaceTimeZone,
  useWorkplaceTimeZones,
} from '@hisabche/api'

import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

/** Refusals this panel can explain. Anything else gets the general sentence. */
export const TIME_ZONE_REFUSALS = ['TIME_ZONE_INVALID', 'TIME_ZONE_SCHEMA_REQUIRED'] as const

/** The value of «same as the business» in a branch's select. Never sent as a zone. */
const INHERIT = 'inherit'

export const WorkplaceTimeZoneSection = memo(function WorkplaceTimeZoneSection() {
  const t = useTranslations('settings.timeZone')
  const toast = useToast()
  const zones = useWorkplaceTimeZones()
  const saveBusiness = useSetWorkspaceTimeZone()
  const saveBranch = useSetBranchTimeZone()
  const [chosen, setChosen] = useState<string | null>(null)

  const [device, setDevice] = useState<{ zone: string; all: string[] }>({ zone: '', all: [] })
  useEffect(() => {
    const supported =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
    setDevice({
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
      all: supported,
    })
  }, [])

  const current = zones.data?.timeZone ?? null
  const value = chosen ?? current ?? ''
  // The stored zone stays selectable even where this browser does not list it.
  const names = [...new Set([...(current ? [current] : []), ...device.all])]
  const options = names.map((zone) => ({ value: zone, label: zone }))

  const explain = (error: unknown): string => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status
    if (status === 403) return t('ownerOnly')
    const raw = apiErrorMessage(error, '')
    const code = TIME_ZONE_REFUSALS.find((known) => raw.includes(known))
    return code ? t(code) : t('failed')
  }

  const save = () => {
    if (!chosen || chosen === current) return
    saveBusiness.mutate(chosen, {
      onSuccess: () => {
        setChosen(null)
        toast.success(t('saved'))
      },
      onError: (error) => toast.error(explain(error)),
    })
  }

  return (
    <section className={`${card} p-5`} aria-labelledby="workplace-time-zone-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]">
          <Globe className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="workplace-time-zone-title"
            className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
          >
            {t('title')}
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">{t('description')}</p>

          {zones.isLoading ? (
            <p className="mt-4 text-sm text-[hsl(var(--fg-tertiary))]">{t('loading')}</p>
          ) : zones.isError || !zones.data ? (
            // A failed read is not «no zone»: say it could not be read.
            <p role="alert" className="mt-4 text-sm text-[hsl(var(--color-destructive))]">
              {t('unreadable')}
            </p>
          ) : !zones.data.configurable ? (
            <p className="mt-4 text-sm text-[hsl(var(--fg-secondary))]">
              {t('TIME_ZONE_SCHEMA_REQUIRED')}
            </p>
          ) : (
            <>
              {current === null ? (
                <p
                  data-time-zone-unset
                  className="mt-4 text-sm font-medium text-[hsl(var(--color-warning))]"
                >
                  {t('notSet')}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <SelectField
                  aria-label={t('title')}
                  name="timeZone"
                  className="w-64"
                  value={value}
                  onChange={setChosen}
                  placeholder={t('choose')}
                  disabled={saveBusiness.isPending}
                  options={options}
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={!chosen || chosen === current || saveBusiness.isPending}
                  className="h-9 rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
                >
                  {t('save')}
                </button>
              </div>

              {device.zone && device.zone !== value ? (
                <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('deviceZone', { zone: device.zone })}{' '}
                  <button
                    type="button"
                    onClick={() => setChosen(device.zone)}
                    className="font-medium text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
                  >
                    {t('useDeviceZone')}
                  </button>
                </p>
              ) : null}

              {zones.data.branches.length > 0 ? (
                <div className="mt-5 space-y-2">
                  <h3 className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
                    {t('branchesTitle')}
                  </h3>
                  <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('branchesHelp')}</p>
                  <ul className="space-y-2">
                    {zones.data.branches.map((branch) => (
                      <li key={branch.id} className="flex flex-wrap items-center gap-3">
                        <span className="min-w-32 text-sm text-[hsl(var(--fg-primary))]">
                          {branch.name}
                        </span>
                        <SelectField
                          aria-label={t('branchZone', { name: branch.name })}
                          name={`branchTimeZone-${branch.id}`}
                          className="w-64"
                          value={branch.timeZone ?? INHERIT}
                          disabled={saveBranch.isPending}
                          onChange={(next) =>
                            saveBranch.mutate(
                              {
                                branchId: branch.id,
                                timeZone: next === INHERIT ? null : next,
                              },
                              {
                                onSuccess: () => toast.success(t('saved')),
                                onError: (error) => toast.error(explain(error)),
                              },
                            )
                          }
                          options={[
                            { value: INHERIT, label: t('sameAsBusiness') },
                            ...[
                              ...new Set([
                                ...(branch.timeZone ? [branch.timeZone] : []),
                                ...device.all,
                              ]),
                            ].map((zone) => ({ value: zone, label: zone })),
                          ]}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
})
