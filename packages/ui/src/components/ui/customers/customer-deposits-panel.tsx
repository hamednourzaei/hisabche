'use client'

// ============================================
// packages/ui/src/components/ui/customers/customer-deposits-panel.tsx
//
// Order deposits — the money a customer paid BEFORE the invoice existed — on
// the customer's own page, where a person meets it.
//
//   deposit        Dr cash | bank          Cr customer advances
//   apply          Dr customer advances    Cr receivable
//   refund         Dr customer advances    Cr cash | bank
//
// ⚠️ NOTHING HERE BOOKS ANYTHING. The apply/refund routes call one Postgres
// function each (docs/order-deposit-apply-refund-01-migration.sql) and this
// component only sends the request and shows what came back. There is no
// second ledger path and no optimistic «done» — the row changes when the server
// answers, and the queries are invalidated from the hook.
//
// ⚠️ AMOUNTS ARE INTEGER MINOR UNITS IN BOTH DIRECTIONS. What the person types
// is major units of the deposit's OWN currency; `parseAmountMinor` converts it
// with that currency's precision. An UNKNOWN currency (a row older than the
// column) is not guessed: the actions are refused for that row.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorCode,
  apiErrorMessage,
  useApplyOrderDeposit,
  useCustomerDeposits,
  useOpenInvoices,
  usePostOrderDepositReceipt,
  useRefundOrderDeposit,
  type CustomerDepositRecord,
  type OpenInvoice,
} from '@hisabche/api'
import { fractionDigits, FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { parseAmountMinor } from '../../../lib/bank-statement-csv'
import { useActionAvailability } from '../../../lib/capability'
import { Badge } from '../badge'
import { Button } from '../button'
import { Money } from '../capability/capability-kit'
import { MoneyInput } from '../money-input'
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '../Modal'
import { SelectField } from '../select-field'
import { Textarea } from '../textarea'

/** The digits of a currency this build knows, or null when it does not. */
function digitsOf(currency: string | null): 0 | 2 | 3 | null {
  if (!currency || !(currency in FRACTION_DIGITS)) return null
  return fractionDigits(currency as KnownCurrency)
}

const STATUS_TONE: Record<
  CustomerDepositRecord['status'],
  'success' | 'secondary' | 'warning' | 'outline'
> = {
  available: 'success',
  partially_used: 'outline',
  fully_used: 'secondary',
  pending_posting: 'warning',
  posting_unknown: 'outline',
}

/** A code the server answered, turned into the sentence a person can act on. */
function refusalText(error: unknown, t: (key: string) => string, fallback: string): string {
  const code = apiErrorCode(error)
  const known: Record<string, string> = {
    DEPOSIT_INSUFFICIENT_BALANCE: t('errorInsufficient'),
    DEPOSIT_APPLY_EXCEEDS_INVOICE: t('errorExceedsInvoice'),
    DEPOSIT_CURRENCY_MISMATCH: t('errorCurrency'),
    DEPOSIT_CUSTOMER_MISMATCH: t('errorCustomer'),
    DEPOSIT_INVOICE_NOT_FINAL: t('errorInvoiceNotFinal'),
    DEPOSIT_INVOICE_NOT_POSTED: t('errorInvoiceNotPosted'),
    DEPOSIT_PENDING_POSTING: t('errorPendingPosting'),
    DEPOSIT_REFUND_NOT_POSTED: t('errorRefundNotPosted'),
    DEPOSIT_REFUND_REASON_REQUIRED: t('errorReason'),
    DEPOSIT_REFUND_REASON_TOO_LONG: t('errorReasonLong'),
    DEPOSIT_IDEMPOTENCY_CONFLICT: t('errorIdempotency'),
    DEPOSIT_CURRENCY_UNKNOWN: t('errorCurrencyUnknown'),
    DEPOSIT_ACCOUNTS_MISSING: t('errorAccounts'),
    FORBIDDEN: t('errorPermission'),
    // The device answers a viewer with the capability it is missing, not the
    // generic FORBIDDEN: both mean the same thing to the person reading it.
    CAPABILITY_REQUIRED: t('errorPermission'),
  }
  if (code && known[code]) return known[code]
  return apiErrorMessage(error, fallback)
}

export interface CustomerDepositsPanelProps {
  customerId: string
  formatDate: (value: string | null) => string
}

type Dialog =
  | { kind: 'apply'; deposit: CustomerDepositRecord }
  | { kind: 'refund'; deposit: CustomerDepositRecord }
  | null

export function CustomerDepositsPanel({ customerId, formatDate }: CustomerDepositsPanelProps) {
  const t = useTranslations('customerDeposits')
  const availability = useActionAvailability('order.deposits')
  const depositsQuery = useCustomerDeposits(customerId)
  const openInvoicesQuery = useOpenInvoices('customer', customerId)
  const applyDeposit = useApplyOrderDeposit()
  const refundDeposit = useRefundOrderDeposit()
  const postReceipt = usePostOrderDepositReceipt()

  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)

  const deposits = depositsQuery.data ?? []

  const close = () => {
    setDialog(null)
    setPanelError(null)
  }

  const onPost = (deposit: CustomerDepositRecord) => {
    setPanelError(null)
    setNotice(null)
    postReceipt.mutate(
      { orderId: deposit.orderId, depositId: deposit.id, customerId },
      {
        onSuccess: () => setNotice(t('postSuccess')),
        onError: (error) => setPanelError(refusalText(error, t, t('postFailed'))),
      },
    )
  }

  return (
    <section className="space-y-3 border-t border-[hsl(var(--border-default))] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[hsl(var(--fg-primary))]">{t('title')}</h3>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('subtitle')}</p>
        </div>
      </div>

      {!availability.available && (
        <p className="rounded-xl bg-[hsl(var(--surface-muted))] px-3 py-2 text-xs text-[hsl(var(--fg-secondary))]">
          {t('unavailable')}
        </p>
      )}

      {notice && (
        <p className="rounded-xl bg-[hsl(var(--color-success)/0.12)] px-3 py-2 text-xs font-medium text-[hsl(var(--color-success))]">
          {notice}
        </p>
      )}
      {panelError && (
        <p className="rounded-xl bg-[hsl(var(--color-destructive)/0.12)] px-3 py-2 text-xs font-medium text-[hsl(var(--color-destructive))]">
          {panelError}
        </p>
      )}

      {depositsQuery.isLoading ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('loading')}</p>
      ) : depositsQuery.isError ? (
        // A failed read is not «no deposits»: say the read failed.
        <p className="text-xs text-[hsl(var(--color-destructive))]">{t('loadFailed')}</p>
      ) : deposits.length === 0 ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {deposits.map((deposit) => {
            const digits = digitsOf(deposit.currency)
            const canMove =
              availability.available &&
              digits !== null &&
              deposit.status !== 'pending_posting' &&
              deposit.remainingMinor > 0
            return (
              <li
                key={deposit.id}
                className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--fg-tertiary))]">
                      <span>{formatDate(deposit.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t('orderReference', { id: deposit.orderId.slice(0, 8) })}</span>
                      <Badge size="sm" variant={STATUS_TONE[deposit.status]}>
                        {t(`status.${deposit.status}`)}
                      </Badge>
                      {deposit.pendingSync && (
                        <Badge size="sm" variant="warning">
                          {t('pendingSync')}
                        </Badge>
                      )}
                    </p>
                    {digits === null || deposit.currency === null ? (
                      // ⚠️ NOT A ZERO AND NOT A GUESS. A row older than the
                      // currency column has no precision, so every figure here
                      // would be invented. Say it cannot be computed.
                      <p className="text-xs text-[hsl(var(--color-warning))]">
                        {t('errorCurrencyUnknown')}
                      </p>
                    ) : (
                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <Figure
                          label={t('amount')}
                          minor={deposit.amountMinor}
                          currency={deposit.currency}
                        />
                        <Figure
                          label={t('applied')}
                          minor={deposit.appliedMinor}
                          currency={deposit.currency}
                        />
                        <Figure
                          label={t('refunded')}
                          minor={deposit.refundedMinor}
                          currency={deposit.currency}
                        />
                        <Figure
                          label={t('remaining')}
                          minor={deposit.remainingMinor}
                          currency={deposit.currency}
                          strong
                        />
                      </dl>
                    )}
                    {deposit.journalEntryId && (
                      <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
                        {t('entry', { id: deposit.journalEntryId.slice(0, 8) })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {deposit.status === 'pending_posting' && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={postReceipt.isPending}
                        onClick={() => onPost(deposit)}
                      >
                        {t('postReceipt')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canMove}
                      title={digits === null ? t('errorCurrencyUnknown') : undefined}
                      onClick={() => {
                        setNotice(null)
                        setPanelError(null)
                        setDialog({ kind: 'apply', deposit })
                      }}
                    >
                      {t('applyAction')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canMove}
                      title={digits === null ? t('errorCurrencyUnknown') : undefined}
                      onClick={() => {
                        setNotice(null)
                        setPanelError(null)
                        setDialog({ kind: 'refund', deposit })
                      }}
                    >
                      {t('refundAction')}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dialog?.kind === 'apply' && (
        <ApplyDialog
          deposit={dialog.deposit}
          invoices={openInvoicesQuery.data ?? []}
          invoicesLoading={openInvoicesQuery.isLoading}
          pending={applyDeposit.isPending}
          onClose={close}
          onSubmit={(invoiceId, amountMinor) => {
            setPanelError(null)
            applyDeposit.mutate(
              {
                orderId: dialog.deposit.orderId,
                depositId: dialog.deposit.id,
                customerId,
                invoiceId,
                amountMinor,
              },
              {
                onSuccess: () => {
                  close()
                  setNotice(t('applySuccess'))
                },
                onError: (error) => setPanelError(refusalText(error, t, t('applyFailed'))),
              },
            )
          }}
        />
      )}

      {dialog?.kind === 'refund' && (
        <RefundDialog
          deposit={dialog.deposit}
          pending={refundDeposit.isPending}
          onClose={close}
          onSubmit={(amountMinor, reason, method) => {
            setPanelError(null)
            refundDeposit.mutate(
              {
                orderId: dialog.deposit.orderId,
                depositId: dialog.deposit.id,
                customerId,
                amountMinor,
                reason,
                method,
              },
              {
                onSuccess: () => {
                  close()
                  setNotice(t('refundSuccess'))
                },
                onError: (error) => setPanelError(refusalText(error, t, t('refundFailed'))),
              },
            )
          }}
        />
      )}
    </section>
  )
}

/**
 * One figure of a deposit.
 *
 * ⚠️ `currency` IS A KNOWN ONE. The caller only renders these when the row's
 * currency resolved to digits; `Money` falls back to two decimals for a currency
 * it does not know, which on a 0-decimal currency is silently out by 100×.
 */
function Figure({
  label,
  minor,
  currency,
  strong = false,
}: {
  label: string
  minor: number
  currency: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-[hsl(var(--fg-tertiary))]">{label}</dt>
      <dd
        className={cn(
          strong ? 'font-bold text-[hsl(var(--fg-primary))]' : 'text-[hsl(var(--fg-secondary))]',
        )}
      >
        <Money minor={minor} currency={currency} bare />
      </dd>
    </div>
  )
}

function ApplyDialog({
  deposit,
  invoices,
  invoicesLoading,
  pending,
  onClose,
  onSubmit,
}: {
  deposit: CustomerDepositRecord
  invoices: OpenInvoice[]
  invoicesLoading: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (invoiceId: string, amountMinor: number) => void
}) {
  const t = useTranslations('customerDeposits')
  const digits = digitsOf(deposit.currency)
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const amountMinor = useMemo(
    () => (digits === null ? null : parseAmountMinor(amount, digits)),
    [amount, digits],
  )

  const submit = () => {
    if (!invoiceId) {
      setError(t('applyInvoiceRequired'))
      return
    }
    if (digits === null) {
      setError(t('errorCurrencyUnknown'))
      return
    }
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('errorAmount'))
      return
    }
    if (amountMinor > deposit.remainingMinor) {
      setError(t('errorInsufficient'))
      return
    }
    setError(null)
    onSubmit(invoiceId, amountMinor)
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{t('applyTitle')}</ModalTitle>
          <ModalCloseButton onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('applyRemaining')}</p>
          {invoicesLoading ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('loadingInvoices')}</p>
          ) : invoices.length === 0 ? (
            <p className="text-xs text-[hsl(var(--color-warning))]">{t('applyNoInvoice')}</p>
          ) : (
            <SelectField
              value={invoiceId}
              onChange={setInvoiceId}
              placeholder={t('applyInvoicePlaceholder')}
              aria-label={t('applyInvoice')}
              options={invoices.map((invoice) => ({
                value: invoice.invoiceId,
                // The figure the server counted (what this invoice still owes),
                // not one subtracted here from two other rounded numbers.
                label: `${invoice.invoiceNumber} · ${invoice.outstanding}${
                  deposit.currency ? ` ${deposit.currency}` : ''
                }`,
              }))}
            />
          )}
          <MoneyInput
            value={amount}
            onChange={setAmount}
            label={t('applyAmount')}
            placeholder={t('applyAmountPlaceholder')}
          />
          {error && <p className="text-xs text-[hsl(var(--color-destructive))]">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} type="button">
            {t('cancel')}
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={pending || invoices.length === 0}
            onClick={submit}
          >
            {t('applySubmit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function RefundDialog({
  deposit,
  pending,
  onClose,
  onSubmit,
}: {
  deposit: CustomerDepositRecord
  pending: boolean
  onClose: () => void
  onSubmit: (amountMinor: number, reason: string, method: string) => void
}) {
  const t = useTranslations('customerDeposits')
  const digits = digitsOf(deposit.currency)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState<string | null>(null)

  const amountMinor = useMemo(
    () => (digits === null ? null : parseAmountMinor(amount, digits)),
    [amount, digits],
  )

  const submit = () => {
    if (digits === null) {
      setError(t('errorCurrencyUnknown'))
      return
    }
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('errorAmount'))
      return
    }
    if (amountMinor > deposit.remainingMinor) {
      setError(t('errorInsufficient'))
      return
    }
    // The same rule the column and the function enforce: 3..500 after trim.
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setError(t('errorReason'))
      return
    }
    if (trimmed.length > 500) {
      setError(t('errorReasonLong'))
      return
    }
    setError(null)
    onSubmit(amountMinor, trimmed, method)
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{t('refundTitle')}</ModalTitle>
          <ModalCloseButton onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('refundRemaining')}</p>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            label={t('refundAmount')}
            placeholder={t('refundAmountPlaceholder')}
          />
          <SelectField
            value={method}
            onChange={setMethod}
            aria-label={t('refundMethod')}
            options={[
              { value: 'cash', label: t('methodCash') },
              { value: 'bank', label: t('methodBank') },
            ]}
          />
          <Textarea
            label={t('refundReason')}
            value={reason}
            maxLength={500}
            placeholder={t('refundReasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">{t('refundReasonHint')}</p>
          {error && <p className="text-xs text-[hsl(var(--color-destructive))]">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} type="button">
            {t('cancel')}
          </Button>
          <Button type="button" loading={pending} disabled={pending} onClick={submit}>
            {t('refundSubmit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
