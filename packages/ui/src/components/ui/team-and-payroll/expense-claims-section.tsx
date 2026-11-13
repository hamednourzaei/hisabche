'use client'
// ============================================
// https://github.com/hisabche — «مطالبات هزینه» (V61 B.2.18)
// packages/ui/src/components/ui/team-and-payroll/expense-claims-section.tsx
//
// An employee paid for something out of their own pocket; the business owes it
// back. The life of a claim, and who may move it:
//
//   draft ──submit──► submitted ──approve──► approved ──reimburse──► reimbursed
//                          └────reject────► rejected
//
// ⚠️ THE BUTTONS ARE THE SERVER'S RULES, NOT THE SCREEN'S. `canApprove…`,
//    `canReject…` and `canReimburse…` (packages/validation) decide which action
//    is offered; the endpoint enforces the same three, so a stale screen cannot
//    approve twice.
// ⚠️ A CLAIM IS NOT ALWAYS IN ONE CURRENCY. Every line carries its own currency
//    and the total exists only when all of them agree — otherwise the row says
//    so and the claim cannot be reimbursed (the service refuses it too).
// ⚠️ AMOUNTS ARE ENTERED IN THE LINE'S CURRENCY, as minor units of it
//    (`typedMinor`), never «× 100».
// ⚠️ APPROVAL BOOKS NOTHING TO THE LEDGER YET — see the note the screen shows.
//    The service has no expense account role to post to; a decision about which
//    account carries «expenses» is the owner's, and a fake entry is worse.
// ============================================
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  apiErrorMessage,
  useApproveExpenseClaim,
  useCreateExpenseClaim,
  useEmployees,
  useExpenseClaims,
  useReimburseExpenseClaim,
  useRejectExpenseClaim,
  EXPENSE_CLAIM_STATUSES,
} from '@hisabche/api'
import {
  CURRENCY_CODES,
  calculateExpenseReportTotal,
  canApproveExpenseReport,
  canRejectExpenseReport,
  canReimburseExpenseReport,
  expenseReportCurrency,
  type ExpenseClaimLine as DomainLine,
  type ExpenseReportStatus,
} from '@hisabche/validation'

import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { LabeledSelect, typedMinor, useMoneyText } from '../business-packs/pack-shared'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'
import { employeeName, type EmployeeRow } from './employee-list-table'

/** The categories offered in the form. The column is free text on the server. */
export const EXPENSE_CATEGORIES = ['travel', 'meals', 'transport', 'supplies', 'other'] as const

/** Refusals this screen can explain; anything else gets the general sentence. */
export const EXPENSE_CLAIM_ERROR_CODES = [
  'EXPENSE_CLAIM_CANNOT_APPROVE',
  'EXPENSE_CLAIM_CANNOT_REJECT',
  'EXPENSE_CLAIM_ALREADY_REIMBURSED_OR_UNAPPROVED',
  'EXPENSE_CLAIM_MIXED_CURRENCY',
  'EXPENSE_CLAIM_CURRENCY_MISMATCH',
  'EXPENSE_CLAIM_HAS_NO_LINES',
] as const

interface ClaimLineRow {
  id: string
  category: string
  amount_minor: number
  currency: string
}

/** A claim as the screen reads it: every field checked, nothing assumed. */
export interface ClaimRow {
  id: string
  title: string
  status: string
  employeeId: string
  createdAt: string
  rejectedReason: string | null
  paymentId: string | null
  lines: ClaimLineRow[]
}

/** The API sends raw snake_case rows; read each field, never trust the shape. */
export function toClaimRow(raw: Record<string, unknown>): ClaimRow | null {
  if (typeof raw.id !== 'string' || raw.id === '') return null
  const lines = Array.isArray(raw.expense_lines)
    ? (raw.expense_lines as Array<Record<string, unknown>>).map((l): ClaimLineRow => ({
        id: String(l.id ?? ''),
        category: String(l.category ?? ''),
        amount_minor: Number(l.amount_minor ?? 0),
        currency: String(l.currency ?? ''),
      }))
    : []
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    status: String(raw.status ?? ''),
    employeeId: String(raw.employee_id ?? ''),
    createdAt: String(raw.created_at ?? ''),
    rejectedReason: typeof raw.rejected_reason === 'string' ? raw.rejected_reason : null,
    paymentId: typeof raw.payment_id === 'string' ? raw.payment_id : null,
    lines,
  }
}

/**
 * The claim's total, or null when it has none (no lines, or more than one
 * currency). Uses the SAME functions as the service — the screen and the server
 * cannot disagree about what a claim adds up to.
 */
export function claimTotalOf(row: Pick<ClaimRow, 'lines'>): {
  minor: number
  currency: string
} | null {
  const lines: DomainLine[] = row.lines.map((l) => ({
    id: l.id,
    category: l.category,
    amountMinor: l.amount_minor,
    currency: l.currency,
  }))
  const total = calculateExpenseReportTotal({ lines })
  const currency = expenseReportCurrency(lines)
  if (total === null || currency === null) return null
  return { minor: total, currency }
}

function isStatus(value: string): value is ExpenseReportStatus {
  return (EXPENSE_CLAIM_STATUSES as readonly string[]).includes(value)
}

export function ExpenseClaimsSection() {
  const t = useTranslations('expenseClaims')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  // The table's column labels live outside this namespace (`expenseClaims.columns.*`),
  // so the table gets a reader that resolves a full key and falls back honestly.
  const tAll = useTranslations()
  const label = (key: string, fallback?: string): string => {
    const value = tAll(key as Parameters<typeof tAll>[0])
    return value && value !== key ? value : (fallback ?? key)
  }
  const tCurrency = useTranslations('currency')
  const toast = useToast()
  const { date } = useDateFormat()
  const money = useMoneyText()
  const bookCurrency = useBookCurrency()

  const claims = useExpenseClaims()
  const employeesQuery = useEmployees({ page: 1, limit: 200 })
  const create = useCreateExpenseClaim()
  const approve = useApproveExpenseClaim()
  const reject = useRejectExpenseClaim()
  const reimburse = useReimburseExpenseClaim()

  const [employeeId, setEmployeeId] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('travel')
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState('')
  const [lines, setLines] = useState<
    Array<{ category: string; amount_minor: number; currency: string }>
  >([])
  const [rejectFor, setRejectFor] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const chosenCurrency = currency || bookCurrency || ''

  const employees = useMemo(
    () =>
      asList<EmployeeRow>((employeesQuery.data as { employees?: unknown } | undefined)?.employees),
    [employeesQuery.data],
  )
  const employeeById = useMemo(() => {
    const map = new Map<string, string>()
    for (const employee of employees) map.set(employee.id, employeeName(employee))
    return map
  }, [employees])

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employeeName(employee) || employee.employee_code || employee.id,
      })),
    [employees],
  )

  const errorText = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = EXPENSE_CLAIM_ERROR_CODES.find((known) => raw.includes(known))
    return code ? tr(`errors.${code}`) : tr('errors.general')
  }

  const rows = useMemo(
    () =>
      asList<Record<string, unknown>>(claims.data)
        .map(toClaimRow)
        .filter((row): row is ClaimRow => row !== null)
        .filter((row) =>
          search.trim() ? row.title.toLowerCase().includes(search.toLowerCase()) : true,
        ),
    [claims.data, search],
  )

  const addLine = () => {
    const minor = typedMinor(amountText, chosenCurrency)
    if (!chosenCurrency || minor === null || minor <= 0) {
      toast.error(tr('errors.formIncomplete'))
      return
    }
    setLines((current) => [...current, { category, amount_minor: minor, currency: chosenCurrency }])
    setAmountText('')
  }

  const submit = (asDraft: boolean) => {
    if (!employeeId || !title.trim() || lines.length === 0) {
      toast.error(tr('errors.formIncomplete'))
      return
    }
    create.mutate(
      { employee_id: employeeId, title: title.trim(), submit: !asDraft, lines },
      {
        onSuccess: () => {
          setTitle('')
          setLines([])
          setAmountText('')
          toast.success(tr('messages.saved'))
        },
        onError: (error) => toast.error(errorText(error)),
      },
    )
  }

  const columns: TableColumn<ClaimRow>[] = [
    {
      id: 'title',
      labelKey: 'expenseClaims.columns.title',
      labelFallback: 'عنوان',
      locked: true,
      render: (row) => row.title || '—',
    },
    {
      id: 'employee',
      labelKey: 'expenseClaims.columns.employee',
      labelFallback: 'کارمند',
      showFrom: 'sm',
      render: (row) => employeeById.get(row.employeeId) ?? tr('unknownEmployee'),
    },
    {
      id: 'created',
      labelKey: 'expenseClaims.columns.created',
      labelFallback: 'تاریخ ثبت',
      showFrom: 'md',
      render: (row) => (row.createdAt ? date(row.createdAt) : '—'),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'total',
      labelKey: 'expenseClaims.columns.total',
      labelFallback: 'جمع',
      align: 'end',
      render: (row) => {
        const total = claimTotalOf(row)
        return total ? money(total.minor, total.currency) : tr('mixedCurrency')
      },
      sortValue: (row) => claimTotalOf(row)?.minor ?? 0,
    },
    {
      id: 'status',
      labelKey: 'expenseClaims.columns.status',
      labelFallback: 'وضعیت',
      render: (row) => (isStatus(row.status) ? tr(`status.${row.status}`) : '—'),
    },
    {
      id: 'actions',
      labelKey: 'expenseClaims.columns.actions',
      labelFallback: 'اقدام',
      render: (row) => {
        const status = isStatus(row.status) ? row.status : null
        if (!status) return '—'
        const total = claimTotalOf(row)
        return (
          <div className="flex flex-wrap gap-1">
            {canApproveExpenseReport(status) ? (
              <Button
                size="sm"
                disabled={approve.isPending}
                onClick={() =>
                  approve.mutate(row.id, {
                    onSuccess: () => toast.success(tr('messages.approved')),
                    onError: (error) => toast.error(errorText(error)),
                  })
                }
              >
                {tr('actions.approve')}
              </Button>
            ) : null}
            {canRejectExpenseReport(status) ? (
              <Button size="sm" variant="outline" onClick={() => setRejectFor(row.id)}>
                {tr('actions.reject')}
              </Button>
            ) : null}
            {canReimburseExpenseReport(status, row.paymentId) && total ? (
              <Button
                size="sm"
                disabled={reimburse.isPending}
                onClick={() =>
                  reimburse.mutate(
                    { id: row.id, currency: total.currency },
                    {
                      onSuccess: () => toast.success(tr('messages.reimbursed')),
                      onError: (error) => toast.error(errorText(error)),
                    },
                  )
                }
              >
                {tr('actions.reimburse')}
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{tr('approvalNote')}</p>

      <div className="grid gap-3 rounded-2xl border border-[hsl(var(--border-default))] p-4 sm:grid-cols-3">
        <LabeledSelect
          name="employee_id"
          label={tr('form.employee')}
          value={employeeId}
          onChange={setEmployeeId}
          options={employeeOptions}
        />
        <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
          {tr('form.title')}
          <Input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
        </label>
        <LabeledSelect
          name="category"
          label={tr('form.category')}
          value={category}
          onChange={setCategory}
          options={EXPENSE_CATEGORIES.map((value) => ({
            value,
            label: tr(`categories.${value}`),
          }))}
        />
        <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
          {tr('form.amount')}
          <Input
            name="amount_minor"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
          />
        </label>
        <LabeledSelect
          name="currency"
          label={tr('form.currency')}
          value={chosenCurrency}
          onChange={setCurrency}
          options={CURRENCY_CODES.map((code) => ({
            value: code,
            label: `${tCurrency(code.toLowerCase())} (${code})`,
          }))}
        />
        <div className="flex items-end">
          <Button size="sm" variant="outline" onClick={addLine}>
            {tr('form.addLine')}
          </Button>
        </div>

        <div className="sm:col-span-3" data-field="lines">
          <p className="mb-1 text-xs text-[hsl(var(--fg-secondary))]">{tr('form.lines')}</p>
          {lines.length === 0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{tr('form.noLines')}</p>
          ) : (
            <ul className="space-y-1">
              {lines.map((line, index) => (
                <li
                  key={`${line.category}-${line.currency}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border-default))] px-3 py-1.5 text-sm"
                >
                  <span>
                    {tr(`categories.${line.category}`)} — {money(line.amount_minor, line.currency)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setLines((current) => current.filter((_, position) => position !== index))
                    }
                  >
                    {tr('form.removeLine')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <Button size="sm" disabled={create.isPending} onClick={() => submit(false)}>
            {tr('form.submit')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={create.isPending}
            onClick={() => submit(true)}
          >
            {tr('form.saveDraft')}
          </Button>
        </div>
      </div>

      {rejectFor ? (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[hsl(var(--border-default))] p-4">
          <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
            {tr('reject.reason')}
            <Input
              name="rejected_reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              maxLength={400}
            />
          </label>
          <Button
            size="sm"
            disabled={!rejectReason.trim() || reject.isPending}
            onClick={() =>
              reject.mutate(
                { id: rejectFor, reason: rejectReason.trim() },
                {
                  onSuccess: () => {
                    setRejectFor(null)
                    setRejectReason('')
                    toast.success(tr('messages.rejected'))
                  },
                  onError: (error) => toast.error(errorText(error)),
                },
              )
            }
          >
            {tr('reject.confirm')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRejectFor(null)
              setRejectReason('')
            }}
          >
            {tr('reject.cancel')}
          </Button>
        </div>
      ) : null}

      {claims.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('loading')}</p>
      ) : claims.isError ? (
        // A failed read is NOT «you have no claims» (AGENTS.md §3).
        <div
          role="alert"
          className="rounded-xl border border-[hsl(var(--color-destructive))] p-3 text-sm"
        >
          {tr('loadFailed')}{' '}
          <Button size="sm" variant="outline" onClick={() => void claims.refetch()}>
            {tr('retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          tableId="team-expense-claims"
          t={label}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          searchValue={search}
          onSearchChange={setSearch}
          actions={
            <SelectField
              name="statusFilter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: tr('filter.all') },
                ...EXPENSE_CLAIM_STATUSES.map((status) => ({
                  value: status,
                  label: tr(`status.${status}`),
                })),
              ]}
            />
          }
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      )}
    </div>
  )
}
