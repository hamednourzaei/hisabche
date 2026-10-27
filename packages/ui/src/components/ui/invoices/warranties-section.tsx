'use client'

// ============================================
// packages/ui/src/components/ui/invoices/warranties-section.tsx
//
// Warranties Section (Option 18 / Warranties & RMA)
// Lands in: Sales -> Invoice Detail / Stock
// Reuses Badge, ShieldCheck.
// ============================================

import { memo } from 'react'
import { useWarranties, type WarrantyItem } from '@hisabche/api'
import { isWarrantyActive } from '@hisabche/validation'
import { toIsoDay } from '@hisabche/formatting'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '../badge'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

export const WarrantiesSection = memo(function WarrantiesSection() {
  const { data: warranties = [] } = useWarranties()

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            گارانتی و ضمانت‌نامه‌ها
          </h3>
        </div>
        <Badge variant="outline">{(warranties as WarrantyItem[]).length} گارانتی</Badge>
      </div>

      <div className="space-y-2">
        {(warranties as WarrantyItem[]).map((w) => {
          const active = isWarrantyActive(w, toIsoDay(new Date()))
          return (
            <div
              key={w.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]"
            >
              <div>
                <span className="font-mono text-sm text-[hsl(var(--fg-primary))]">
                  سریال: {w.serialNumber || 'عمومی'}
                </span>
                <span className="ms-3 text-xs text-[hsl(var(--fg-tertiary))]">
                  مدت: {w.warrantyMonths} ماه (تا {w.endDate})
                </span>
              </div>
              <Badge variant={active ? 'default' : 'secondary'}>{active ? 'معتبر' : 'منقضی'}</Badge>
            </div>
          )
        })}
      </div>
    </section>
  )
})
