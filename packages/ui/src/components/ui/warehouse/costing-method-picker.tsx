'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/costing-method-picker.tsx
//
// «بهای تمام‌شده: FIFO / میانگین موزون» (owner, 18 Oct 2026).
//
// One setting for the whole business (`inventory_settings.costing_method`),
// read by Postgres when a sale takes goods off the cost layers:
//   · FIFO — the oldest purchase is used first; every sale is costed at the
//     price of the layer it came out of.
//   · میانگین موزون (avco) — every sale is costed at the weighted average of
//     the layers still open.
// Every purchase stays its own layer either way: the method only decides how
// a SALE is costed. Changing it does not re-cost sales already recorded.
//
// ⚠️ `=== true` on the capability: one not read yet is NOT permission.
//
// A change is CONFIRMED first (owner, 18 Oct 2026): switching back and forth
// month by month makes the profit and stock history hard to read. The server
// writes every change to the workspace's audit log (who, when, from → to).
// ============================================

import { useState } from 'react'

import {
  useInventorySettings,
  useMyCapabilities,
  useSetCostingMethod,
  type CostingMethod,
} from '@hisabche/api'

import { SelectField } from '../select-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'

/** The two a person may choose; `standard` has no standard-cost entry screen. */
const CHOICES: readonly CostingMethod[] = ['fifo', 'avco']

export function CostingMethodPicker({ t }: { t: (key: string, fallback?: string) => string }) {
  const settings = useInventorySettings()
  const setMethod = useSetCostingMethod()
  const capabilities = useMyCapabilities()
  const canConfigure = capabilities.can('inventory.configure') === true
  /** The method waiting for «ثبت»; null = nothing asked. */
  const [pending, setPending] = useState<CostingMethod | null>(null)

  if (!settings.data) return null
  const current = settings.data.costingMethod

  const label = (method: CostingMethod) =>
    method === 'avco'
      ? t('warehouse.costing.avco', 'میانگین موزون')
      : method === 'fifo'
        ? t('warehouse.costing.fifo', 'اولین خرید، اولین فروش (FIFO)')
        : t('warehouse.costing.standard', 'بهای استاندارد')

  return (
    <div
      data-costing-method=""
      className="flex items-center gap-2"
      title={t(
        'warehouse.costing.hint',
        'هر خرید با قیمت خودش ثبت می‌ماند؛ این فقط می‌گوید فروش با کدام بها حساب شود. فروش‌های ثبت‌شده دوباره حساب نمی‌شوند.',
      )}
    >
      <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-secondary))]">
        {t('warehouse.costing.label', 'بهای تمام‌شده')}
      </span>
      <SelectField
        value={current}
        onChange={(next) => {
          if (next !== current) setPending(next as CostingMethod)
        }}
        // A business still on `standard` keeps seeing what it is on.
        options={(CHOICES.includes(current) ? CHOICES : [...CHOICES, current]).map((method) => ({
          value: method,
          label: label(method),
        }))}
        aria-label={t('warehouse.costing.label', 'بهای تمام‌شده')}
        disabled={!canConfigure || setMethod.isPending}
        className="w-auto min-w-[11rem]"
      />

      <Dialog open={pending !== null} onOpenChange={(open) => (open ? null : setPending(null))}>
        <DialogContent data-costing-confirm="" className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('warehouse.costing.confirmTitle', 'روش بهای تمام‌شده عوض شود؟')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'warehouse.costing.confirmBody',
                'از این به بعد بهای هر فروش با روش تازه حساب می‌شود و سود و ارزش موجودیِ آینده تغییر می‌کند. فروش‌های ثبت‌شده دوباره حساب نمی‌شوند. این تغییر با نام شما در گزارش فعالیت‌ها ثبت می‌شود.',
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">
            {label(current)} ← {pending ? label(pending) : ''}
          </p>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="h-9 rounded-full border border-[hsl(var(--border-default))] px-4 text-xs"
            >
              {t('common.cancel', 'انصراف')}
            </button>
            <button
              type="button"
              data-costing-confirm-yes=""
              disabled={setMethod.isPending}
              onClick={() => {
                if (!pending) return
                setMethod.mutate(pending, { onSuccess: () => setPending(null) })
              }}
              className="h-9 rounded-full bg-[hsl(var(--color-primary))] px-5 text-xs font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
            >
              {t('warehouse.costing.confirmYes', 'بله، عوض شود')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
