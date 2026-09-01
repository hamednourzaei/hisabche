'use client'

// ============================================
// packages/ui/src/components/ui/customers/containers/customer-360-container.tsx
//
// Customer 360 — the SECOND consumer of `Entity360`.
//
// ---------------------------------------------------------------------------
// WHY A SECOND ONE MATTERS
//
// One consumer can pass by accident: a component shaped around a single
// caller looks general and is not. The second is what proves the section
// order, the capability gating and the omit-don't-empty rule actually work
// for an entity with a different shape — a customer has no lines, no audit
// tab, and its money means the opposite of an invoice's.
//
// It also uses the party ledger endpoint built in P0.1, which until now no
// screen called.
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useCustomer, useLedger } from '@hisabche/api'
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
} from '../../capability/capability-kit'
import { WorkStateNote } from '../../state/work-state'

export interface Customer360ContainerProps {
  customerId: string
  /** Capabilities the SERVER granted. Never invented client-side. */
  capabilities?: readonly string[]
}

export const Customer360Container = memo(function Customer360Container({
  customerId,
  capabilities,
}: Customer360ContainerProps) {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const customer = useCustomer(customerId)
  const ledger = useLedger(customerId)

  if (customer.isLoading) return <Loading label={t('common.loading', 'در حال بارگذاری…')} />
  if (customer.error) return <ErrorNote message={(customer.error as Error).message} />
  if (!customer.data) return null

  const data = customer.data as Record<string, any>
  const toMinor = (value: unknown) => Math.round((Number(value) || 0) * 100)

  const sections: Partial<Record<DetailSection, React.ReactNode>> = {
    overview: (
      <StatGrid>
        <Stat label={t('customers.name', 'نام')} value={String(data['fullName'] ?? '—')} />
        <Stat label={t('customers.phone', 'تلفن')} value={String(data['phone'] || '—')} />
        <Stat
          label={t('customers.terms', 'شرایط')}
          value={
            <Badge tone={data['type'] === 'credit' ? 'warn' : 'neutral'}>
              {data['type'] === 'credit'
                ? t('customers.credit', 'نسیه')
                : t('customers.cash', 'نقدی')}
            </Badge>
          }
        />
        <Stat label={t('customers.address', 'آدرس')} value={String(data['address'] || '—')} />
      </StatGrid>
    ),
  }

  // The financial section is gated by the contract, but it is ALSO omitted
  // when the ledger could not be read — an empty statement and a statement
  // that failed to load are different facts, and only one of them means the
  // customer owes nothing.
  if (ledger.data) {
    const summary = ledger.data as Record<string, any>
    sections.financial = (
      <StatGrid>
        <Stat
          label={t('ledger.opening', 'مانده‌ی ابتدای دوره')}
          value={<Money minor={toMinor(summary['openingBalance'])} />}
        />
        <Stat
          label={t('ledger.debit', 'بدهکار')}
          value={<Money minor={toMinor(summary['totalDebit'])} />}
        />
        <Stat
          label={t('ledger.credit', 'بستانکار')}
          value={<Money minor={toMinor(summary['totalCredit'])} />}
        />
        <Stat
          label={t('ledger.closing', 'مانده‌ی نهایی')}
          value={<Money minor={toMinor(summary['closingBalance'])} />}
          hint={
            Number(summary['closingBalance']) < 0
              ? t('ledger.we_owe', 'ما بدهکاریم')
              : t('ledger.they_owe', 'مشتری بدهکار است')
          }
        />
      </StatGrid>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      {/* The second consumer of the state vocabulary, too — so the same
          sentence appears here as on the data hub when a read fails. */}
      <WorkStateNote
        t={t}
        hasError={Boolean(ledger.error)}
        isLoading={ledger.isLoading}
        onAction={() => ledger.refetch()}
        actionLabelKey="common.retry"
      />

      <Entity360
        t={t}
        entity="customer"
        {...(capabilities ? { capabilities } : {})}
        header={
          <CapabilityHeader
            title={String(data['fullName'] ?? '')}
            description={String(data['phone'] ?? '')}
          />
        }
        sections={sections}
      />
    </div>
  )
})

Customer360Container.displayName = 'Customer360Container'
