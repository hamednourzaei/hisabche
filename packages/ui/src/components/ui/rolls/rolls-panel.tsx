// ============================================
// packages/ui/src/components/ui/rolls/rolls-panel.tsx
//
// WP-04 — the roll panel. The shop picks a roll, records a cut (with waste), a
// partial sale or a return, and reads the roll-centric report with the cost
// still on each roll. All writes go through the offline hooks; the server is
// the sync authority. An unknown cost is shown as unknown, never as zero.
// ============================================
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  useConsumeRoll,
  useCutRoll,
  useLocalRolls,
  useReturnRoll,
  useRollReport,
} from '@hisabche/api'

import { SelectField } from '../select-field'

type Action = 'consume' | 'cut' | 'return'

export function RollsPanel() {
  const t = useTranslations('rolls')
  const { data: rolls = [] } = useLocalRolls()
  const { data: report = [] } = useRollReport()
  const consume = useConsumeRoll()
  const cut = useCutRoll()
  const returned = useReturnRoll()

  const [action, setAction] = useState<Action>('consume')
  const [rollId, setRollId] = useState<string>('')
  const [length, setLength] = useState<string>('')
  const [waste, setWaste] = useState<string>('')

  const costOf = (id: string) => report.find((row) => row.id === id)?.cost ?? null

  const submit = () => {
    const id = rollId || rolls[0]?.id
    const value = Number(length)
    if (!id || !Number.isFinite(value) || value <= 0) return
    const key = crypto.randomUUID()
    if (action === 'consume') consume.mutate({ id, length: value, clientRequestId: key })
    else if (action === 'return') returned.mutate({ id, length: value, clientRequestId: key })
    else
      cut.mutate({
        id,
        cutLength: value,
        wasteLength: Math.max(0, Number(waste) || 0),
        clientRequestId: key,
      })
    setLength('')
    setWaste('')
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm">{t('number')}</span>
          <SelectField
            value={rollId || rolls[0]?.id || ''}
            onChange={setRollId}
            placeholder={rolls[0]?.roll_number ?? ''}
            options={rolls.map((roll) => ({ value: roll.id, label: roll.roll_number }))}
            aria-label={t('number')}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          {t('length')}
          <input
            className="w-28 rounded border border-border bg-background px-2 py-1"
            inputMode="decimal"
            value={length}
            onChange={(event) => setLength(event.target.value)}
          />
        </label>
        {action === 'cut' && (
          <label className="flex flex-col gap-1 text-sm">
            {t('waste')}
            <input
              className="w-28 rounded border border-border bg-background px-2 py-1"
              inputMode="decimal"
              value={waste}
              onChange={(event) => setWaste(event.target.value)}
            />
          </label>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-sm">{t('confirm')}</span>
          <SelectField
            value={action}
            onChange={(value) => setAction(value as Action)}
            options={[
              { value: 'consume', label: t('consume') },
              { value: 'cut', label: t('cut') },
              { value: 'return', label: t('return') },
            ]}
            aria-label={t('confirm')}
          />
        </div>
        <button
          type="button"
          className="rounded bg-[hsl(var(--color-primary))] px-4 py-2 text-[hsl(var(--color-primary-fg))]"
          onClick={submit}
        >
          {t('confirm')}
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {rolls.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          rolls.map((roll) => {
            const cost = costOf(roll.id)
            return (
              <div
                key={roll.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{roll.roll_number}</span>
                <span>
                  {t('remaining')}: {roll.remaining_length} {roll.unit}
                </span>
                <span>
                  {t('location')}: {roll.location ?? '—'}
                </span>
                <span>
                  {t('cost')}:{' '}
                  {cost === null
                    ? t('unknownCost')
                    : `${cost.remainingCostMinor} / ${cost.consumedCostMinor + cost.remainingCostMinor}`}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
