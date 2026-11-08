'use client'

// ============================================
// «جزئیات جلسه» — only facts that exist.
//
// ⚠️ NO «DELIVERY TIME» AND NO HISTORY LOG. There is no `delivered_at` column
// and no per-session event table (M4 audit), so the only time the row carries
// is `updatedAt` — labelled «آخرین تغییر», never as the delivery time. The
// audit-history section the original brief asked for is omitted, not invented
// from status guesses.
//
// ⚠️ REFERENCES ARE REFERENCES. A package-credit id and an invoice id are shown
// as what they are. The invoice opens the existing invoice screen; nothing is
// created or corrected from here.
//
// ⚠️ NO CANCELLATION REASON ROW: no column stores one.
// ============================================

import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '../capability/capability-kit'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../sheet'
import { useDateFormat } from '../../../hooks/use-date-format'
import type { ServiceSessionRow } from './service-delivery-model'
import { SessionSyncBadge } from './service-delivery-view'
import { PackageGrantsPanel } from './package-grants-panel'
import { SessionDepositPanel } from './session-deposit-panel'

export interface ServiceSessionDetailsProps {
  open: boolean
  onClose: () => void
  session: ServiceSessionRow | null
  /** The branch is a fact of the tenant: shown only when the tenant has branches. */
  hasBranches: boolean
  onOpenInvoice: (invoiceId: string) => void
  onOpenSyncCentre?: (() => void) | undefined
  /** May this person suspend / resume one of the customer's packages? (payment.cancel - manager by default.) */
  maySuspendPackage?: boolean | undefined
  /** V54 5.4: may this person take a booking deposit? (invoice.create, as the server asks.) */
  mayTakeDeposit?: boolean | undefined
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-[hsl(var(--fg-secondary))]">{label}</dt>
      <dd className="text-sm text-[hsl(var(--fg-primary))]">{value}</dd>
    </div>
  )
}

export function ServiceSessionDetails({
  open,
  onClose,
  session,
  hasBranches,
  onOpenInvoice,
  onOpenSyncCentre,
  maySuspendPackage = false,
  mayTakeDeposit = false,
}: ServiceSessionDetailsProps) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const dates = useDateFormat()

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="end" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('serviceDelivery.details.title', 'جزئیات جلسه')}</SheetTitle>
        </SheetHeader>

        {session ? (
          <dl className="space-y-3 pt-4">
            <Fact
              label={t('serviceDelivery.fields.customer', 'مشتری')}
              value={
                session.customerName ??
                t('serviceDelivery.unknown.customer', 'نام مشتری خوانده نشد')
              }
            />
            <Fact
              label={t('serviceDelivery.fields.service', 'خدمت')}
              value={
                session.serviceName ?? t('serviceDelivery.unknown.service', 'نام خدمت خوانده نشد')
              }
            />
            <Fact
              label={t('serviceDelivery.fields.practitioner', 'مجری')}
              value={session.practitionerName ?? t('serviceDelivery.noPractitioner', 'بدون مجری')}
            />
            {hasBranches ? (
              <Fact
                label={t('serviceDelivery.fields.branch', 'شعبه')}
                value={session.branchName ?? t('serviceDelivery.noBranch', 'بدون شعبه')}
              />
            ) : null}
            <Fact
              label={t('serviceDelivery.details.when', 'تاریخ و ساعت')}
              value={
                <span dir="ltr" className="tabular-nums">
                  {session.sessionDate} · {session.startTime}–{session.endTime}
                </span>
              }
            />
            <Fact
              label={t('serviceDelivery.columns.duration', 'مدت (دقیقه)')}
              value={
                <span dir="ltr" className="tabular-nums">
                  {session.durationMinutes}
                </span>
              }
            />
            <Fact
              label={t('serviceDelivery.columns.status', 'وضعیت')}
              value={
                <Badge tone={session.status === 'delivered' ? 'good' : 'info'}>
                  {t(`serviceDelivery.status.${session.status}`, session.status)}
                </Badge>
              }
            />
            <Fact
              label={t('serviceDelivery.columns.settlement', 'تسویه')}
              value={t(
                `serviceDelivery.settlement.${session.settlementMethod}`,
                session.settlementMethod,
              )}
            />
            {session.settlementReason ? (
              <Fact
                label={t('serviceDelivery.fields.reason', 'دلیل رایگان‌بودن')}
                value={session.settlementReason}
              />
            ) : null}

            {session.cancellationReason ? (
              <Fact
                label={t('serviceDelivery.details.cancellationReason', 'دلیل لغو')}
                value={session.cancellationReason}
              />
            ) : null}

            {session.packageCreditId ? (
              <Fact
                label={t('serviceDelivery.details.packageCredit', 'ثبت اعتبار بسته')}
                value={
                  <span dir="ltr" className="tabular-nums text-xs">
                    {session.packageCreditId}
                  </span>
                }
              />
            ) : null}

            {session.invoiceId ? (
              <Fact
                label={t('serviceDelivery.details.invoice', 'فاکتور مرتبط')}
                value={
                  <button
                    type="button"
                    onClick={() => {
                      if (session.invoiceId) onOpenInvoice(session.invoiceId)
                    }}
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    <span dir="ltr" className="tabular-nums text-xs">
                      {session.invoiceId}
                    </span>
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </button>
                }
              />
            ) : null}

            <Fact
              label={t('serviceDelivery.columns.sync', 'ارسال به سرور')}
              value={
                <span className="flex flex-col items-start gap-1">
                  <SessionSyncBadge state={session.sync} code={session.syncCode} t={t} />
                  {onOpenSyncCentre ? (
                    <button
                      type="button"
                      onClick={onOpenSyncCentre}
                      className="text-xs underline underline-offset-2"
                    >
                      {t('serviceDelivery.sync.openSync', 'مرکز همگام‌سازی')}
                    </button>
                  ) : null}
                </span>
              }
            />

            <Fact
              label={t('serviceDelivery.details.lastChange', 'آخرین تغییر')}
              value={
                session.updatedAt ? (
                  <span dir="ltr" className="tabular-nums">
                    {dates.dateTime(session.updatedAt)}
                  </span>
                ) : (
                  t('serviceDelivery.details.lastChangeUnknown', 'زمان آخرین تغییر خوانده نشد')
                )
              }
            />

            {session.clientNotes ? (
              <Fact
                label={t('serviceDelivery.fields.clientNotes', 'یادداشت برای مشتری')}
                value={<span className="whitespace-pre-wrap">{session.clientNotes}</span>}
              />
            ) : null}

            {session.internalNotes ? (
              <Fact
                label={t('serviceDelivery.details.internalNotes', 'یادداشت داخلی')}
                value={<span className="whitespace-pre-wrap">{session.internalNotes}</span>}
              />
            ) : null}
          </dl>
        ) : null}

        {session && session.status !== 'cancelled' ? (
          <div className="border-t border-[hsl(var(--border-default))] pt-4">
            <SessionDepositPanel
              sessionId={session.id}
              customerId={session.customerId}
              mayWrite={mayTakeDeposit && session.status !== 'no_show'}
            />
          </div>
        ) : null}

        {session ? (
          <div className="border-t border-[hsl(var(--border-default))] pt-4">
            <PackageGrantsPanel customerId={session.customerId} maySuspend={maySuspendPackage} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
