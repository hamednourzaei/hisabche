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

import { memo, useMemo, useState } from 'react'
import {
  apiErrorMessage,
  useQualityEvents,
  useRecordQualityEvent,
  useSubmitWarrantyClaim,
  useWarranties,
  useWarrantyClaims,
  type WarrantyItem,
} from '@hisabche/api'
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
  onOpenRepair,
}: {
  productId?: string | undefined
  t?: Translate | undefined
  onOpenRepair?: ((serialNumber: string | null) => void) | undefined
}) {
  const { data: warranties = [], isError: loadFailed } = useWarranties()
  const { data: claims = [] } = useWarrantyClaims()
  const { data: qualityEvents = [] } = useQualityEvents(
    productId ? { sourceType: 'return', sourceId: productId } : undefined,
  )
  const submitClaim = useSubmitWarrantyClaim()
  const recordQuality = useRecordQualityEvent()
  const [claimIssue, setClaimIssue] = useState('')
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null)

  const handleClaim = async (warrantyId: string) => {
    setClaimFeedback(null)
    if (!claimIssue.trim()) {
      setClaimFeedback(t('warehouse.extClaimIssueRequired', 'شرح مشکل را وارد کنید.'))
      return
    }
    try {
      await submitClaim.mutateAsync({
        warrantyId,
        claimDate: today,
        issueDescription: claimIssue.trim(),
        disposition: 'repair',
      })
      setClaimIssue('')
      setClaimFeedback(t('warehouse.extClaimCreated', 'ادعای گارانتی ثبت شد.'))
    } catch (err) {
      setClaimFeedback(apiErrorMessage(err, t('warehouse.extLoadFailed', 'خطا در ثبت ادعا')))
    }
  }

  const handleQualityCheck = async (warrantyId: string, pid: string) => {
    setClaimFeedback(null)
    try {
      await recordQuality.mutateAsync({
        sourceType: 'return',
        sourceId: warrantyId,
        eventKind: 'check',
        productId: pid,
        quantity: 1,
        notes: 'Warranty inspection check',
      })
      setClaimFeedback(t('warehouse.extQualityLogged', 'بازرسی کیفیت ثبت شد.'))
    } catch (err) {
      setClaimFeedback(apiErrorMessage(err, t('warehouse.extLoadFailed', 'خطا در ثبت بازرسی')))
    }
  }

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
              <div className="flex items-center gap-2">
                <Badge variant={active ? 'default' : 'secondary'}>
                  {active ? t('warehouse.extActive', 'معتبر') : t('warehouse.extExpired', 'منقضی')}
                </Badge>
                <button
                  type="button"
                  onClick={() => handleClaim(w.id)}
                  disabled={submitClaim.isPending}
                  className="rounded-md border border-[hsl(var(--border-default))] px-2 py-1 text-xs font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
                >
                  {t('warehouse.extSubmitClaim', 'ثبت ادعا')}
                </button>
                <button
                  type="button"
                  onClick={() => handleQualityCheck(w.id, w.productId)}
                  disabled={recordQuality.isPending}
                  className="rounded-md border border-[hsl(var(--border-default))] px-2 py-1 text-xs font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
                >
                  {t('warehouse.extLogQuality', 'ثبت بازرسی')}
                </button>
                {onOpenRepair ? (
                  <button
                    type="button"
                    onClick={() => onOpenRepair(w.serialNumber ?? null)}
                    className="rounded-md border border-[hsl(var(--border-default))] px-2 py-1 text-xs font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
                  >
                    {t('repairs.createFromWarranty', 'ثبت تعمیر')}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 space-y-2 border-t border-[hsl(var(--border-default))] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={claimIssue}
            onChange={(e) => setClaimIssue(e.target.value)}
            placeholder={t('warehouse.extClaimIssuePlaceholder', 'شرح عیب برای ثبت ادعای گارانتی')}
            className="h-8 min-w-52 flex-1 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-xs"
          />
          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('warehouse.extClaimsCount', 'ادعاها')}: {claims.length} ·{' '}
            {t('warehouse.extQualityCount', 'رویداد کیفیت')}: {qualityEvents.length}
          </span>
        </div>
        {claimFeedback ? (
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{claimFeedback}</p>
        ) : null}
      </div>
    </section>
  )
})
