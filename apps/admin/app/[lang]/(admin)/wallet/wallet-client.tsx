'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { WalletPaymentMethod, WalletTopup } from '@hisabche/api'
import { CURRENCY_CODES } from '@hisabche/validation'
import { walletAmountToMinor, walletErrorText, walletMoney } from '@hisabche/ui'

import { Button, Input } from '@/components/ui'
import {
  EmptyState,
  ErrorState,
  FilterPill,
  ListSkeleton,
  Panel,
} from '@/components/admin-shell/admin-ui'
import {
  fetchTopupReceiptUrl,
  useAdjustWallet,
  useAdminTopups,
  useAdminWalletLedger,
  useAdminWalletMethods,
  useAdminWalletSearch,
  useDecideTopup,
  useSaveWalletMethod,
  type AdminWalletMethodInput,
  type AdminWalletWorkspace,
  type TopupStatusFilter,
} from '@/hooks/use-admin-wallet'

/**
 * Business wallets, from the platform side: the top-up queue (check the
 * tracking number and receipt against the account, then approve with the
 * amount that actually arrived), the payment methods businesses pay into, and
 * a business's wallet — its balances, ledger and a noted adjustment.
 */

const TABS = ['queue', 'methods', 'businesses'] as const
type Tab = (typeof TABS)[number]

const STATUSES: TopupStatusFilter[] = ['pending', 'approved', 'rejected', 'cancelled', 'all']

const selectClass = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm'

export function WalletClient() {
  const t = useTranslations()
  const [tab, setTab] = useState<Tab>('queue')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((option) => (
          <FilterPill key={option} selected={tab === option} onClick={() => setTab(option)}>
            {t(`admin.wallet.tabs.${option}`)}
          </FilterPill>
        ))}
      </div>
      {tab === 'queue' && <QueueTab />}
      {tab === 'methods' && <MethodsTab />}
      {tab === 'businesses' && <BusinessesTab />}
    </div>
  )
}

// ─── The top-up queue ────────────────────────────────────────────────────────

function QueueTab() {
  const t = useTranslations()
  const [status, setStatus] = useState<TopupStatusFilter>('pending')
  const { data = [], isLoading, isError, error, refetch } = useAdminTopups(status)
  const methods = useAdminWalletMethods()
  const methodOf = new Map((methods.data ?? []).map((m) => [m.id, m]))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((option) => (
          <FilterPill key={option} selected={status === option} onClick={() => setStatus(option)}>
            {t(`wallet.status.${option}`)}
          </FilterPill>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.wallet.queueHint')}</p>
      {isError ? (
        <ErrorState message={walletErrorText(error, t)} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState title={t('admin.wallet.queueEmpty')} />
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <TopupRow key={row.id} row={row} method={methodOf.get(row.methodId) ?? null} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TopupRow({ row, method }: { row: WalletTopup; method: WalletPaymentMethod | null }) {
  const t = useTranslations()
  const lang = useLocale()
  const decide = useDecideTopup()
  const [credited, setCredited] = useState('')
  const [note, setNote] = useState('')
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const creditedMinor = credited.trim() ? walletAmountToMinor(credited, row.currency) : null
  const creditedInvalid = credited.trim() !== '' && (creditedMinor === null || creditedMinor <= 0)

  const openReceipt = async () => {
    setReceiptError(null)
    try {
      const url = await fetchTopupReceiptUrl(row.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setReceiptError(walletErrorText(err, t))
    }
  }

  return (
    <Panel as="li" className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span dir="ltr" className="font-semibold tabular-nums">
          {walletMoney(row.amountMinor, row.currency, lang)}
        </span>
        <span>{method ? `${method.title} · ${t(`wallet.methodKind.${method.kind}`)}` : '—'}</span>
        <span className="text-muted-foreground">{t(`wallet.status.${row.status}`)}</span>
        <time
          className="text-xs text-muted-foreground"
          dateTime={row.createdAt}
          suppressHydrationWarning
        >
          {new Date(row.createdAt).toLocaleString()}
        </time>
      </div>
      <div className="grid gap-1 text-xs sm:grid-cols-2">
        <span>
          {t('wallet.topup.reference')}:{' '}
          <code dir="ltr" className="select-all font-mono">
            {row.payerReference}
          </code>
        </span>
        {row.cardLast4 ? (
          <span>
            {t('wallet.topup.cardLast4')}:{' '}
            <code dir="ltr" className="font-mono">
              {row.cardLast4}
            </code>
          </span>
        ) : null}
        <span>
          {t('wallet.topup.paidAt')}: <span dir="ltr">{row.paidAt}</span>
        </span>
        <span>
          {t('admin.subscriptions.workspaceId')}:{' '}
          <code dir="ltr" className="select-all font-mono">
            {row.workspaceId}
          </code>
        </span>
      </div>
      {row.memberNote ? (
        <p className="text-xs">
          {t('admin.wallet.memberNote')}: {row.memberNote}
        </p>
      ) : null}
      {row.hasReceipt ? (
        <Button size="sm" variant="outline" onClick={() => void openReceipt()}>
          {t('admin.wallet.openReceipt')}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{t('admin.wallet.noReceipt')}</p>
      )}
      {receiptError ? (
        <p role="alert" className="text-xs text-destructive">
          {receiptError}
        </p>
      ) : null}

      {row.status === 'pending' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.wallet.creditedAmount', { currency: row.currency })}
            </span>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={credited}
              placeholder={t('admin.wallet.creditedPlaceholder')}
              onChange={(event) => setCredited(event.target.value)}
              className="w-44"
            />
          </label>
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.wallet.decisionNote')}
            </span>
            <Input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            disabled={decide.isPending || creditedInvalid}
            onClick={() => decide.mutate({ id: row.id, decision: 'approve', creditedMinor, note })}
          >
            {t('admin.wallet.approve')}
          </Button>
          <Button
            variant="outline"
            // A refusal must say why: the business reads this note.
            disabled={decide.isPending || note.trim() === ''}
            onClick={() => decide.mutate({ id: row.id, decision: 'reject', note })}
          >
            {t('admin.wallet.reject')}
          </Button>
        </div>
      ) : row.creditedAmountMinor !== null || row.adminNote ? (
        <p className="text-xs text-muted-foreground">
          {row.creditedAmountMinor !== null
            ? `${t('admin.wallet.credited')}: ${walletMoney(row.creditedAmountMinor, row.currency, lang)} `
            : ''}
          {row.adminNote ?? ''}
        </p>
      ) : null}

      {creditedInvalid ? (
        <p className="text-xs text-destructive">{t('wallet.errors.WALLET_AMOUNT_INVALID')}</p>
      ) : null}
      {decide.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {walletErrorText(decide.error, t)}
        </p>
      ) : null}
    </Panel>
  )
}

// ─── Payment methods ─────────────────────────────────────────────────────────

const EMPTY_METHOD: AdminWalletMethodInput = {
  kind: 'card_to_card',
  currency: 'IRT',
  title: '',
  instructions: '',
  destination: '',
  isActive: true,
  sortOrder: 0,
}

function MethodsTab() {
  const t = useTranslations()
  const { data = [], isLoading, isError, error, refetch } = useAdminWalletMethods()
  const [editing, setEditing] = useState<{
    id: string | null
    input: AdminWalletMethodInput
  } | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('admin.wallet.methodsHint')}</p>
        <Button size="sm" onClick={() => setEditing({ id: null, input: EMPTY_METHOD })}>
          {t('admin.wallet.addMethod')}
        </Button>
      </div>
      {editing ? (
        <MethodForm
          key={editing.id ?? 'new'}
          id={editing.id}
          initial={editing.input}
          onDone={() => setEditing(null)}
        />
      ) : null}
      {isError ? (
        <ErrorState message={walletErrorText(error, t)} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={2} />
      ) : data.length === 0 ? (
        <EmptyState title={t('wallet.topup.noMethods')} hint={t('admin.wallet.noMethodsHint')} />
      ) : (
        <ul className="space-y-2">
          {data.map((m) => (
            <Panel as="li" key={m.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="font-medium">{m.title}</span>
              <span className="text-muted-foreground">
                {t(`wallet.methodKind.${m.kind}`)} · {m.currency}
              </span>
              <code dir="ltr" className="font-mono text-xs">
                {m.destination}
              </code>
              <span className="text-xs text-muted-foreground">
                {m.isActive ? t('admin.wallet.active') : t('admin.wallet.inactive')}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ms-auto"
                onClick={() => {
                  const { id, ...input } = m
                  setEditing({ id, input })
                }}
              >
                {t('admin.wallet.edit')}
              </Button>
            </Panel>
          ))}
        </ul>
      )}
    </div>
  )
}

function MethodForm({
  id,
  initial,
  onDone,
}: {
  id: string | null
  initial: AdminWalletMethodInput
  onDone: () => void
}) {
  const t = useTranslations()
  const save = useSaveWalletMethod()
  const [input, setInput] = useState(initial)
  const set = <K extends keyof AdminWalletMethodInput>(key: K, value: AdminWalletMethodInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }))

  return (
    <Panel className="space-y-3 p-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">{t('admin.wallet.kind')}</span>
          <select
            className={selectClass}
            value={input.kind}
            onChange={(event) => set('kind', event.target.value as AdminWalletMethodInput['kind'])}
          >
            <option value="card_to_card">{t('wallet.methodKind.card_to_card')}</option>
            <option value="foreign_currency">{t('wallet.methodKind.foreign_currency')}</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">{t('admin.wallet.currency')}</span>
          <select
            className={selectClass}
            dir="ltr"
            value={input.currency}
            onChange={(event) => set('currency', event.target.value)}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <Input
          label={t('admin.wallet.methodTitle')}
          value={input.title}
          maxLength={120}
          onChange={(event) => set('title', event.target.value)}
        />
        <Input
          label={t('admin.wallet.destination')}
          dir="ltr"
          value={input.destination}
          maxLength={200}
          onChange={(event) => set('destination', event.target.value)}
        />
      </div>
      <label className="block space-y-1">
        <span className="block text-xs text-muted-foreground">
          {t('admin.wallet.instructions')}
        </span>
        <textarea
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          rows={3}
          maxLength={2000}
          value={input.instructions}
          onChange={(event) => set('instructions', event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={input.isActive}
          onChange={(event) => set('isActive', event.target.checked)}
        />
        <span>{t('admin.wallet.active')}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={save.isPending || !input.title.trim() || !input.destination.trim()}
          onClick={() => save.mutate({ id, input }, { onSuccess: onDone })}
        >
          {t('admin.wallet.save')}
        </Button>
        <Button variant="outline" onClick={onDone}>
          {t('admin.wallet.cancel')}
        </Button>
      </div>
      {save.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {walletErrorText(save.error, t)}
        </p>
      ) : null}
    </Panel>
  )
}

// ─── A business's wallet ─────────────────────────────────────────────────────

function BusinessesTab() {
  const t = useTranslations()
  const lang = useLocale()
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selected, setSelected] = useState<AdminWalletWorkspace | null>(null)
  const search = useAdminWalletSearch(submitted)

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSelected(null)
          setSubmitted(q)
        }}
      >
        <Input
          value={q}
          maxLength={100}
          placeholder={t('admin.wallet.searchPlaceholder')}
          onChange={(event) => setQ(event.target.value)}
          className="w-72"
        />
        <Button type="submit" disabled={!q.trim()}>
          {t('admin.wallet.search')}
        </Button>
      </form>

      {!submitted ? null : search.isError ? (
        <ErrorState
          message={walletErrorText(search.error, t)}
          onRetry={() => void search.refetch()}
        />
      ) : search.isLoading ? (
        <ListSkeleton rows={2} height="h-12" />
      ) : (search.data ?? []).length === 0 ? (
        <EmptyState title={t('admin.wallet.noBusinesses')} />
      ) : (
        <ul className="space-y-2">
          {(search.data ?? []).map((w) => (
            <Panel as="li" key={w.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium">{w.name}</span>
              <span dir="ltr" className="text-xs tabular-nums text-muted-foreground">
                {w.balances.length === 0
                  ? t('wallet.noBalance')
                  : w.balances
                      .map((b) => walletMoney(b.balanceMinor, b.currency, lang))
                      .join(' · ')}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ms-auto"
                onClick={() => setSelected(w)}
              >
                {t('admin.wallet.open')}
              </Button>
            </Panel>
          ))}
        </ul>
      )}

      {selected ? <BusinessWallet key={selected.id} workspace={selected} /> : null}
    </div>
  )
}

function BusinessWallet({ workspace }: { workspace: AdminWalletWorkspace }) {
  const t = useTranslations()
  const lang = useLocale()
  const ledger = useAdminWalletLedger(workspace.id)
  const adjust = useAdjustWallet()
  const [currency, setCurrency] = useState(workspace.balances[0]?.currency ?? 'IRT')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const amountMinor = walletAmountToMinor(amount, currency)
  const amountInvalid = amount.trim() !== '' && (amountMinor === null || amountMinor === 0)

  return (
    <Panel className="space-y-4 p-4 text-sm">
      <h3 className="font-semibold">{workspace.name}</h3>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{t('admin.wallet.adjustHint')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.wallet.currency')}
            </span>
            <select
              className={selectClass}
              dir="ltr"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.wallet.adjustAmount')}
            </span>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-44"
            />
          </label>
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.wallet.adjustNote')}
            </span>
            <Input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            disabled={adjust.isPending || amountMinor === null || amountMinor === 0 || !note.trim()}
            onClick={() =>
              amountMinor !== null &&
              adjust.mutate(
                { workspaceId: workspace.id, currency, amountMinor, note },
                {
                  onSuccess: () => {
                    setAmount('')
                    setNote('')
                  },
                },
              )
            }
          >
            {t('admin.wallet.adjust')}
          </Button>
        </div>
        {amountInvalid ? (
          <p className="text-xs text-destructive">{t('wallet.errors.WALLET_AMOUNT_INVALID')}</p>
        ) : null}
        {adjust.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {walletErrorText(adjust.error, t)}
          </p>
        ) : adjust.isSuccess ? (
          <p role="status" className="text-xs text-success">
            {t('admin.wallet.adjusted')}
          </p>
        ) : null}
      </div>

      {ledger.isError ? (
        <ErrorState
          message={walletErrorText(ledger.error, t)}
          onRetry={() => void ledger.refetch()}
        />
      ) : ledger.isLoading ? (
        <ListSkeleton rows={3} height="h-10" />
      ) : (ledger.data ?? []).length === 0 ? (
        <EmptyState title={t('wallet.history.empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {(ledger.data ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
              <time
                dateTime={row.createdAt}
                suppressHydrationWarning
                className="text-muted-foreground"
              >
                {new Date(row.createdAt).toLocaleString()}
              </time>
              <span>{t(`wallet.kind.${row.kind}`)}</span>
              <span dir="ltr" className={row.amountMinor < 0 ? 'text-destructive' : 'text-success'}>
                {row.amountMinor > 0 ? '+' : ''}
                {walletMoney(row.amountMinor, row.currency, lang)}
              </span>
              <span dir="ltr" className="tabular-nums text-muted-foreground">
                = {walletMoney(row.balanceAfter, row.currency, lang)}
              </span>
              {row.note ? <span className="text-muted-foreground">{row.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
