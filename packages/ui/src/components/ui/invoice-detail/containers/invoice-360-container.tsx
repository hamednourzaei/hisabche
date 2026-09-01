'use client'

// ============================================
// packages/ui/src/components/ui/invoice-detail/containers/invoice-360-container.tsx
//
// PHASE 6, actually consumed — Invoice 360 on the shared shell.
//
// ---------------------------------------------------------------------------
// STANDS BESIDE THE EXISTING DETAIL SCREEN
//
// The invoice detail page works and is used daily. §80 says protect that. So
// this does not replace it: it is the first real consumer of `Entity360`, which
// otherwise was a component nothing rendered — and a component nothing renders
// is not a completed phase, whatever its tests say.
//
// ---------------------------------------------------------------------------
// SECTIONS ARE OMITTED, NOT EMPTIED
//
// A section this invoice has nothing for is simply not passed, and `Entity360`
// then does not render a tab for it. An empty tab costs a click and teaches
// the reader the app is unfinished.
//
// `financial` and `audit` are additionally gated: both are passed only when
// the caller says the actor holds the capability. ⚠️ That is a rendering
// courtesy — §1.8 — and the endpoints behind them enforce the same thing.
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useInvoice } from '@hisabche/api'
import type { DetailSection } from '@hisabche/ui-contract'

import { Entity360 } from '../../entity/entity-360'
import {
  Badge,
  CapabilityHeader,
  ErrorNote,
  Loading,
  Money,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../capability/capability-kit'

export interface Invoice360ContainerProps {
  invoiceId: string
  /** Capabilities the SERVER granted. Never invented client-side. */
  capabilities?: readonly string[]
}

export const Invoice360Container = memo(function Invoice360Container({
  invoiceId,
  capabilities,
}: Invoice360ContainerProps) {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const invoice = useInvoice(invoiceId)

  if (invoice.isLoading) return <Loading label={t('common.loading', 'در حال بارگذاری…')} />
  if (invoice.error) return <ErrorNote message={(invoice.error as Error).message} />
  if (!invoice.data) return null

  const data = invoice.data as Record<string, any>
  const items: Array<Record<string, any>> = Array.isArray(data['items']) ? data['items'] : []

  // Money crosses no unit boundary here — the invoice endpoint reports major
  // units, so it is converted once, at the display edge, exactly as elsewhere.
  const toMinor = (value: unknown) => Math.round((Number(value) || 0) * 100)

  const sections: Partial<Record<DetailSection, React.ReactNode>> = {
    overview: (
      <StatGrid>
        <Stat label={t('invoices.number', 'شماره')} value={String(data['invoiceNumber'] ?? '—')} />
        <Stat label={t('invoices.customer', 'مشتری')} value={String(data['customerName'] ?? '—')} />
        <Stat
          label={t('invoices.status', 'وضعیت')}
          value={
            <Badge>{t(`invoices.status_${data['status']}`, String(data['status'] ?? '—'))}</Badge>
          }
        />
        <Stat
          label={t('invoices.total', 'مبلغ کل')}
          value={<Money minor={toMinor(data['total'])} />}
        />
      </StatGrid>
    ),
  }

  // Only when there are lines. An invoice with none is a draft, and an empty
  // "Lines" tab on it says nothing the overview did not.
  if (items.length > 0) {
    sections.lines = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('invoices.item', 'کالا')}</TableHead>
            <TableHead>{t('invoices.quantity', 'تعداد')}</TableHead>
            <TableHead>{t('invoices.price', 'قیمت')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={String(item['id'] ?? index)}>
              <TableCell>{String(item['description'] ?? item['productName'] ?? '—')}</TableCell>
              <TableCell dir="ltr" className="tabular-nums">
                {String(item['quantity'] ?? 0)}
              </TableCell>
              <TableCell>
                <Money minor={toMinor(item['unitPrice'] ?? item['price'])} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const holds = (capability: string) => capabilities?.includes(capability) ?? false

  if (holds('ledger.read')) {
    sections.financial = (
      <StatGrid>
        <Stat
          label={t('invoices.paid', 'پرداخت‌شده')}
          value={<Money minor={toMinor(data['paidAmount'])} />}
        />
        <Stat
          label={t('invoices.remaining', 'مانده')}
          value={
            <Money minor={toMinor(Number(data['total'] ?? 0) - Number(data['paidAmount'] ?? 0))} />
          }
        />
      </StatGrid>
    )
  }

  return (
    <Entity360
      t={t}
      entity="invoice"
      {...(capabilities ? { capabilities } : {})}
      header={
        <CapabilityHeader
          title={`${t('invoices.title', 'فاکتور')} ${String(data['invoiceNumber'] ?? '')}`}
          description={String(data['customerName'] ?? '')}
        />
      }
      sections={sections}
    />
  )
})

Invoice360Container.displayName = 'Invoice360Container'
