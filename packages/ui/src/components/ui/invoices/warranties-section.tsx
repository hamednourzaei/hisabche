'use client'

// ============================================
// packages/ui/src/components/ui/invoices/warranties-section.tsx
//
// Warranties Section (Option 18 / Warranties & RMA)
// Mounted on the product page (warehouse-detail-container) only when the
// business profile carries the `serialized_items` capability. With a
// `productId` it lists that product's warranties; without one, all of them.
// Reuses Badge, ShieldCheck.
// ============================================

import { memo, useMemo } from 'react'
import { useWarranties, type WarrantyItem } from '@hisabche/api'
import { isWarrantyActive } from '@hisabche/validation'
import { toIsoDay } from '@hisabche/formatting'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '../badge'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

type Translate = (key: string, fallback?: string) => string

const identity: Translate = (_key, fallback) => fallback ?? _key

export const WarrantiesSection = memo(function WarrantiesSection({
  productId,
  t = identity,
}: {
  productId?: string | undefined
  t?: Translate | undefined
}) {
  const { data: warranties = [], isError: loadFailed } = useWarranties()

  const list = useMemo(() => {
    const all = warranties as WarrantyItem[]
    return productId ? all.filter((w) => w.productId === productId) : all
  }, [warranties, productId])

  const today = toIsoDay(new Date())

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('warehouse.extWarrantiesTitle', 'گارانتی و ضمانت‌نامه‌ها')}
          </h3>
        </div>
        <Badge variant="outline">
          {list.length} {t('warehouse.extWarrantiesCount', 'گارانتی')}
        </Badge>
      </div>

      {loadFailed ? (
        <p role="alert" className="mb-3 text-xs text-[hsl(var(--color-destructive))]">
          {t('warehouse.extLoadFailed', 'خواندن اطلاعات انجام نشد')}
        </p>
      ) : null}

      <div className="space-y-2">
        {!loadFailed && list.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('warehouse.extWarrantiesEmpty', 'هنوز گارانتی‌ای برای این کالا ثبت نشده است.')}
          </p>
        ) : null}
        {list.map((w) => {
          const active = isWarrantyActive(w, today)
          return (
            <div
              key={w.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]"
            >
              <div>
                <span className="font-mono text-sm text-[hsl(var(--fg-primary))]">
                  {t('warehouse.extSerial', 'سریال')}:{' '}
                  {w.serialNumber || t('warehouse.extSerialGeneral', 'عمومی')}
                </span>
                <span className="ms-3 text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('warehouse.extDuration', 'مدت')}: {w.warrantyMonths}{' '}
                  {t('warehouse.extMonths', 'ماه')} ({t('warehouse.extUntil', 'تا')} {w.endDate})
                </span>
              </div>
              <Badge variant={active ? 'default' : 'secondary'}>
                {active ? t('warehouse.extActive', 'معتبر') : t('warehouse.extExpired', 'منقضی')}
              </Badge>
            </div>
          )
        })}
      </div>
    </section>
  )
})
