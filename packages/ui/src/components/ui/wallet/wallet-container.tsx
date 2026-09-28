'use client'

// ============================================
// packages/ui/src/components/ui/wallet/wallet-container.tsx
//
// The business's wallet — web and desktop both mount this. One wallet per
// WORKSPACE, one balance per currency (docs/wallet-01-migration.sql).
//
//   · balances       — what the business holds, per currency;
//   · top up         — pay into a method the platform defined, then file the
//                      tracking number (and a receipt) for the admin to check;
//   · requests       — the business's top-up requests and what became of them;
//   · history        — every movement, newest first, from the ledger.
//
// ⚠️ A top-up is a REQUEST. Nothing here says «charged» until the platform
// approves it, and the balance shown is the server's, never a local sum.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Wallet } from 'lucide-react'
import {
  useCancelWalletTopup,
  useRequestWalletTopup,
  useWallet,
  useWalletTopups,
  useWalletTransactions,
  type WalletPaymentMethod,
  type WalletTopup,
  type WalletTransaction,
} from '@hisabche/api'

import { toIsoDay } from '@hisabche/formatting'

import { useDateFormat } from '../../../hooks/use-date-format'
import { JalaliDatePicker } from '../jalali-datepicker'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Field,
  ListSection,
  Loading,
  Panel,
  SelectField,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'
import {
  fileToBase64,
  statusOf,
  walletAmountToMinor,
  walletErrorText,
  walletMoney,
} from './wallet-format'

/** Same ceiling as the server (RECEIPT_MAX_BYTES); checked here only to say so sooner. */
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024
const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

const STATUS_TONE: Record<WalletTopup['status'], string> = {
  pending: 'warn',
  approved: 'good',
  rejected: 'bad',
  cancelled: 'neutral',
}

export function WalletContainer() {
  const t = useTranslations()
  const wallet = useWallet()

  const status = wallet.isError ? statusOf(wallet.error) : null

  return (
    <CapabilityPage>
      <CapabilityHeader title={t('wallet.title')} description={t('wallet.description')} />

      {wallet.isLoading ? (
        <Loading rows={2} />
      ) : status === 403 ? (
        <EmptyState title={t('wallet.forbidden')} description={t('wallet.forbiddenHint')} />
      ) : status === 503 ? (
        <EmptyState title={t('wallet.notConfigured')} description={t('wallet.notConfiguredHint')} />
      ) : wallet.isError ? (
        <ErrorNote
          message={walletErrorText(wallet.error, t)}
          onRetry={() => void wallet.refetch()}
          retryLabel={t('wallet.retry')}
        />
      ) : wallet.data ? (
        <>
          {wallet.data.balances.length === 0 ? (
            <EmptyState
              icon={<Wallet className="size-8" aria-hidden="true" />}
              title={t('wallet.noBalance')}
              description={t('wallet.noBalanceHint')}
            />
          ) : (
            <StatGrid>
              {wallet.data.balances.map((balance) => (
                <Stat
                  key={balance.currency}
                  label={t('wallet.balanceIn', { currency: balance.currency })}
                  value={<BalanceFigure minor={balance.balanceMinor} currency={balance.currency} />}
                  icon={Wallet}
                />
              ))}
            </StatGrid>
          )}

          <TopupForm methods={wallet.data.methods} />
          <TopupRequests methods={wallet.data.methods} />
          <History />
        </>
      ) : null}
    </CapabilityPage>
  )
}

function BalanceFigure({ minor, currency }: { minor: number; currency: string }) {
  const lang = useLocale()
  return (
    <span dir="ltr" className="tabular-nums">
      {walletMoney(minor, currency, lang)}
    </span>
  )
}

// ─── Top up ──────────────────────────────────────────────────────────────

function TopupForm({ methods }: { methods: WalletPaymentMethod[] }) {
  const t = useTranslations()
  const request = useRequestWalletTopup()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [last4, setLast4] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Today on this device, set after mount: reading the clock during render
  // would differ between the server's render and the browser's. (The server
  // allows one day ahead, for a device east of UTC.)
  useEffect(() => {
    setPaidAt((current) => current || toIsoDay(new Date()))
  }, [])

  const method = methods.find((m) => m.id === methodId) ?? methods[0] ?? null
  const amountMinor = method ? walletAmountToMinor(amount, method.currency) : null

  if (methods.length === 0) {
    return (
      <Panel title={t('wallet.topup.title')}>
        <EmptyState
          title={t('wallet.topup.noMethods')}
          description={t('wallet.topup.noMethodsHint')}
        />
      </Panel>
    )
  }

  const submit = async () => {
    setLocalError(null)
    if (!method) return
    if (amountMinor === null || amountMinor <= 0) {
      return setLocalError(t('wallet.errors.WALLET_AMOUNT_INVALID'))
    }
    if (!reference.trim()) return setLocalError(t('wallet.topup.referenceRequired'))
    if (method.kind === 'card_to_card' && !/^[0-9]{4}$/.test(last4)) {
      return setLocalError(t('wallet.errors.WALLET_CARD_LAST4_REQUIRED'))
    }
    if (receipt && receipt.size > RECEIPT_MAX_BYTES) {
      return setLocalError(t('wallet.errors.WALLET_RECEIPT_TOO_LARGE'))
    }
    let base64: string | null = null
    try {
      base64 = receipt ? await fileToBase64(receipt) : null
    } catch {
      return setLocalError(t('wallet.errors.WALLET_RECEIPT_EMPTY'))
    }
    request.mutate(
      {
        methodId: method.id,
        amountMinor,
        payerReference: reference.trim(),
        cardLast4: method.kind === 'card_to_card' ? last4 : null,
        paidAt,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(base64 ? { receipt: { base64 } } : {}),
      },
      {
        onSuccess: () => {
          setAmount('')
          setReference('')
          setLast4('')
          setNote('')
          setReceipt(null)
          if (fileRef.current) fileRef.current.value = ''
        },
      },
    )
  }

  return (
    <Panel title={t('wallet.topup.title')} description={t('wallet.topup.howItWorks')}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <SelectField
          label={t('wallet.topup.method')}
          value={method?.id ?? ''}
          onChange={(value) => {
            setMethodId(value)
            request.reset()
          }}
          options={methods.map((m) => ({
            value: m.id,
            label: `${m.title} · ${t(`wallet.methodKind.${m.kind}`)} · ${m.currency}`,
          }))}
        />

        {method ? (
          <div
            className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-3 text-sm"
            data-wallet-instructions=""
          >
            <p className="font-medium text-[hsl(var(--fg-primary))]">{t('wallet.topup.payTo')}</p>
            <p dir="ltr" className="select-all break-all font-mono text-base">
              {method.destination}
            </p>
            {method.instructions ? (
              <p className="whitespace-pre-line text-[hsl(var(--fg-secondary))]">
                {method.instructions}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('wallet.topup.amount', { currency: method?.currency ?? '' })}
            value={amount}
            onChange={setAmount}
            dir="ltr"
          />
          <Field
            label={t('wallet.topup.reference')}
            value={reference}
            onChange={setReference}
            dir="ltr"
          />
          {method?.kind === 'card_to_card' ? (
            <Field
              label={t('wallet.topup.cardLast4')}
              value={last4}
              onChange={(value) => setLast4(value.replace(/\D/g, '').slice(0, 4))}
              dir="ltr"
            />
          ) : null}
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
              {t('wallet.topup.paidAt')}
            </span>
            <JalaliDatePicker value={paidAt} onChange={setPaidAt} />
          </div>
        </div>

        <Field label={t('wallet.topup.note')} value={note} onChange={setNote} />

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-[hsl(var(--fg-primary))]">
            {t('wallet.topup.receipt')}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept={RECEIPT_ACCEPT}
            onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
            {t('wallet.topup.receiptHint')}
          </span>
        </label>

        {localError ? <ErrorNote message={localError} /> : null}
        {request.isError ? <ErrorNote message={walletErrorText(request.error, t)} /> : null}
        {request.isSuccess ? (
          <p role="status" className="text-sm text-[hsl(var(--color-success))]">
            {t('wallet.topup.sent')}
          </p>
        ) : null}

        <ActionButton type="submit" disabled={request.isPending}>
          {t('wallet.topup.submit')}
        </ActionButton>
      </form>
    </Panel>
  )
}

// ─── Requests ────────────────────────────────────────────────────────────

function TopupRequests({ methods }: { methods: WalletPaymentMethod[] }) {
  const t = useTranslations()
  const lang = useLocale()
  const { date } = useDateFormat()
  const topups = useWalletTopups()
  const cancel = useCancelWalletTopup()
  const titleOf = useMemo(() => new Map(methods.map((m) => [m.id, m.title])), [methods])

  return (
    <ListSection title={t('wallet.requests.title')} description={t('wallet.requests.hint')}>
      {topups.isLoading ? (
        <Loading rows={2} />
      ) : topups.isError ? (
        <ErrorNote
          message={walletErrorText(topups.error, t)}
          onRetry={() => void topups.refetch()}
          retryLabel={t('wallet.retry')}
        />
      ) : (topups.data ?? []).length === 0 ? (
        <EmptyState title={t('wallet.requests.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wallet.col.date')}</TableHead>
                <TableHead>{t('wallet.col.method')}</TableHead>
                <TableHead className="text-end">{t('wallet.col.amount')}</TableHead>
                <TableHead>{t('wallet.col.reference')}</TableHead>
                <TableHead>{t('wallet.col.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topups.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {date(row.paidAt)}
                  </TableCell>
                  {/* A method since removed from the list is still named by its id. */}
                  <TableCell>{titleOf.get(row.methodId) ?? '—'}</TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">
                    {walletMoney(row.creditedAmountMinor ?? row.amountMinor, row.currency, lang)}
                    {row.creditedAmountMinor !== null &&
                    row.creditedAmountMinor !== row.amountMinor ? (
                      <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                        {t('wallet.requests.declared', {
                          amount: walletMoney(row.amountMinor, row.currency, lang),
                        })}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell dir="ltr" className="font-mono text-xs">
                    {row.payerReference}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[row.status]}>{t(`wallet.status.${row.status}`)}</Badge>
                    {row.adminNote ? (
                      <span className="mt-1 block text-xs text-[hsl(var(--fg-tertiary))]">
                        {row.adminNote}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.status === 'pending' ? (
                      <ActionButton
                        variant="quiet"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(row.id)}
                      >
                        {t('wallet.requests.cancel')}
                      </ActionButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {cancel.isError ? <ErrorNote message={walletErrorText(cancel.error, t)} /> : null}
    </ListSection>
  )
}

// ─── History ─────────────────────────────────────────────────────────────

function History() {
  const t = useTranslations()
  const lang = useLocale()
  const { dateTime } = useDateFormat()
  const history = useWalletTransactions()
  const rows: WalletTransaction[] = history.data?.pages.flat() ?? []

  return (
    <ListSection title={t('wallet.history.title')}>
      {history.isLoading ? (
        <Loading rows={3} />
      ) : history.isError ? (
        <ErrorNote
          message={walletErrorText(history.error, t)}
          onRetry={() => void history.refetch()}
          retryLabel={t('wallet.retry')}
        />
      ) : rows.length === 0 ? (
        <EmptyState title={t('wallet.history.empty')} />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('wallet.col.date')}</TableHead>
                  <TableHead>{t('wallet.col.kind')}</TableHead>
                  <TableHead className="text-end">{t('wallet.col.amount')}</TableHead>
                  <TableHead className="text-end">{t('wallet.col.balanceAfter')}</TableHead>
                  <TableHead>{t('wallet.col.note')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {dateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>{t(`wallet.kind.${row.kind}`)}</TableCell>
                    <TableCell
                      dir="ltr"
                      className={
                        row.amountMinor < 0
                          ? 'text-end tabular-nums text-[hsl(var(--color-destructive))]'
                          : 'text-end tabular-nums text-[hsl(var(--color-success))]'
                      }
                    >
                      {row.amountMinor > 0 ? '+' : ''}
                      {walletMoney(row.amountMinor, row.currency, lang)}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end tabular-nums">
                      {walletMoney(row.balanceAfter, row.currency, lang)}
                    </TableCell>
                    <TableCell className="text-xs text-[hsl(var(--fg-secondary))]">
                      {row.note ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {history.hasNextPage ? (
            <ActionButton
              variant="quiet"
              disabled={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {t('wallet.history.more')}
            </ActionButton>
          ) : null}
        </div>
      )}
    </ListSection>
  )
}
