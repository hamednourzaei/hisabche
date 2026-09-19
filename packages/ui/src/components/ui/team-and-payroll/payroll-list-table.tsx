'use client'

// ============================================
// Request #100 — «حقوق به کارمندهام اضافه کردم اما در قسمت حقوق نمایش داده
// نمی‌شود، و جمع حقوق هم نمایش داده نمی‌شود».
//
// Same DataTable as the employee and warehouse lists.
//
// ⚠️ snake_case ROWS. `GET /api/payrolls` sends the database row with the
// employee embedded: `net_salary`, `period_start`, `payment_date`,
// `employee: { first_name, last_name }`. The card this replaces read
// `employeeName` / `period` / `amount`, none of which exist — so even once the
// rows arrived, every card would have been blank.
// ============================================

import { memo, useMemo, useState } from 'react'

import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { useDateFormat } from '../../../hooks/use-date-format'
import { cn } from '../../../lib/utils'

export interface PayrollRow {
  id: string
  employee_id?: string | null
  employee?: { first_name?: string | null; last_name?: string | null } | null
  period_start?: string | null
  period_end?: string | null
  payment_date?: string | null
  net_salary?: number | string | null
  currency?: string | null
  status?: string | null
  notes?: string | null
}

const STATUS_TONE: Record<string, string> = {
  paid: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  approved: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
  draft: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
  cancelled: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
}

export function payrollEmployeeName(row: PayrollRow): string {
  return [row.employee?.first_name, row.employee?.last_name].filter(Boolean).join(' ').trim()
}

export const PayrollListTable = memo(function PayrollListTable({
  t,
  payrolls,
  onView,
}: {
  t: (key: string, fallback?: string) => string
  payrolls: PayrollRow[]
  onView?: ((employeeId: string) => void) | undefined
}) {
  const [search, setSearch] = useState('')
  const { date: fmtDay } = useDateFormat()

  const rows = useMemo(
    () =>
      payrolls.filter((row) =>
        matchesSearch(search, [payrollEmployeeName(row), row.notes ?? '', row.status ?? '']),
      ),
    [payrolls, search],
  )

  const columns = useMemo<TableColumn<PayrollRow>[]>(
    () => [
      {
        id: 'employee',
        labelKey: 'team.employeeName',
        labelFallback: 'نام کارمند',
        locked: true,
        sortValue: (row) => payrollEmployeeName(row),
        render: (row) => (
          <span className="font-medium text-[hsl(var(--fg-primary))]">
            {payrollEmployeeName(row) || '—'}
          </span>
        ),
      },
      {
        id: 'paymentDate',
        labelKey: 'hr.paymentDate',
        labelFallback: 'تاریخ پرداخت',
        // The PAYMENT date, falling back to the period — never silently
        // showing the period as if it were the payment.
        sortValue: (row) => row.payment_date ?? row.period_start ?? '',
        render: (row) =>
          row.payment_date ? (
            <span className="tabular-nums">{fmtDay(row.payment_date) || '—'}</span>
          ) : (
            <span className="tabular-nums text-[hsl(var(--fg-tertiary))]">
              {fmtDay(row.period_start) || '—'}
            </span>
          ),
      },
      {
        id: 'amount',
        labelKey: 'team.salary',
        labelFallback: 'مبلغ',
        align: 'end',
        sortValue: (row) => Number(row.net_salary) || 0,
        render: (row) => (
          <span className="font-medium tabular-nums">
            {(Number(row.net_salary) || 0).toLocaleString('fa-AF')} {row.currency || 'AFN'}
          </span>
        ),
      },
      {
        id: 'notes',
        labelKey: 'hr.paymentNotes',
        labelFallback: 'توضیحات',
        showFrom: 'md',
        sortValue: (row) => row.notes ?? '',
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">{row.notes || '—'}</span>
        ),
      },
      {
        id: 'status',
        labelKey: 'team.status',
        labelFallback: 'وضعیت',
        sortValue: (row) => row.status ?? '',
        render: (row) => (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_TONE[row.status ?? ''] ?? STATUS_TONE.draft,
            )}
          >
            {t(`hr.payroll_${row.status ?? 'draft'}`, row.status ?? '—')}
          </span>
        ),
      },
    ],
    [fmtDay, t],
  )

  return (
    <DataTable
      tableId="payroll-list"
      t={t}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      {...(onView
        ? {
            onRowClick: (row: PayrollRow) => {
              if (row.employee_id) onView(row.employee_id)
            },
          }
        : {})}
      searchValue={search}
      onSearchChange={setSearch}
      minWidthClass="min-w-[420px]"
      emptyState={
        <EmptyState
          icon="invoice"
          title={t('team.noPayroll', 'هیچ سابقه حقوقی وجود ندارد')}
          description={t(
            'team.noPayrollHint',
            'پرداخت حقوق از صفحه‌ی هر کارمند ثبت می‌شود و همین‌جا دیده خواهد شد.',
          )}
        />
      }
    />
  )
})

PayrollListTable.displayName = 'PayrollListTable'
