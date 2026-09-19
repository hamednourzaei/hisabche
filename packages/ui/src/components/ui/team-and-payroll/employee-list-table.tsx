'use client'

// ============================================
// Request #98 (ه) — «بجای اینکه اسامی کارمندها را در کارت نشان بدهی، مثل صفحه‌ی
// انبار در جدول نشان بده».
//
// Same DataTable as the warehouse list, so sorting, column visibility, search
// and the mobile behaviour are identical on both pages rather than two
// hand-rolled layouts drifting apart (G2).
//
// ⚠️ THE ROWS ARE snake_case ON PURPOSE. `GET /api/employees` sends the database
// row through untouched (`first_name`, `hire_date`, `employee_code`). The old
// card typed them as `firstName`/`hireDate`, so every card showed a blank name
// and the branch form's «مدیر شعبه» dropdown listed «undefined undefined» —
// which is exactly what the owner reported.
// ============================================

import { memo, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { useDateFormat } from '../../../hooks/use-date-format'
import { cn } from '../../../lib/utils'

/** The shape `GET /api/employees` actually returns. */
export interface EmployeeRow {
  id: string
  employee_code?: string | null
  first_name?: string | null
  last_name?: string | null
  position?: string | null
  phone?: string | null
  email?: string | null
  department?: { name: string } | null
  branch?: { name: string } | null
  hire_date?: string | null
  salary?: number | null
  salary_currency?: string | null
  status?: string | null
}

export function employeeName(row: EmployeeRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return name || row.employee_code || ''
}

const STATUS_TONE: Record<string, string> = {
  active: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  inactive: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
  on_leave: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  terminated: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
}

export const EmployeeListTable = memo(function EmployeeListTable({
  t,
  employees,
  onView,
  onDelete,
  onAdd,
  /** «هیچ کارمندی بدون شعبه» — the empty state points at branches first. */
  canAdd,
}: {
  t: (key: string, fallback?: string) => string
  employees: EmployeeRow[]
  onView?: ((id: string) => void) | undefined
  onDelete?: ((id: string) => Promise<void> | void) | undefined
  onAdd: () => void
  canAdd: boolean
}) {
  const [search, setSearch] = useState('')
  const { date: fmtDay } = useDateFormat()

  const rows = useMemo(
    () =>
      employees.filter((row) =>
        matchesSearch(search, [
          employeeName(row),
          row.employee_code ?? '',
          row.position ?? '',
          row.phone ?? '',
        ]),
      ),
    [employees, search],
  )

  const columns = useMemo<TableColumn<EmployeeRow>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'team.employeeName',
        labelFallback: 'نام کارمند',
        locked: true,
        sortValue: (row) => employeeName(row),
        render: (row) => (
          <span className="font-medium text-[hsl(var(--fg-primary))]">{employeeName(row)}</span>
        ),
      },
      {
        id: 'code',
        labelKey: 'team.employeeCode',
        labelFallback: 'کد',
        showFrom: 'md',
        sortValue: (row) => row.employee_code ?? '',
        render: (row) => (
          <span className="font-mono text-xs text-[hsl(var(--fg-tertiary))]">
            {row.employee_code || '—'}
          </span>
        ),
      },
      {
        id: 'position',
        labelKey: 'team.position',
        labelFallback: 'سمت',
        sortValue: (row) => row.position ?? '',
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">{row.position || '—'}</span>
        ),
      },
      {
        id: 'branch',
        labelKey: 'team.branch',
        labelFallback: 'شعبه',
        showFrom: 'md',
        sortValue: (row) => row.branch?.name ?? row.department?.name ?? '',
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {row.branch?.name || row.department?.name || '—'}
          </span>
        ),
      },
      {
        id: 'phone',
        labelKey: 'team.phone',
        labelFallback: 'شماره تماس',
        showFrom: 'lg',
        sortValue: (row) => row.phone ?? '',
        render: (row) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">{row.phone || '—'}</span>
        ),
      },
      {
        id: 'hireDate',
        labelKey: 'team.hireDate',
        labelFallback: 'تاریخ استخدام',
        showFrom: 'lg',
        sortValue: (row) => row.hire_date ?? '',
        // A missing or malformed date returns «—» rather than throwing
        // «RangeError: Invalid time value» and taking the page down.
        render: (row) => <span className="tabular-nums">{fmtDay(row.hire_date) || '—'}</span>,
      },
      {
        id: 'salary',
        labelKey: 'team.salary',
        labelFallback: 'حقوق',
        align: 'end',
        sortValue: (row) => row.salary ?? 0,
        render: (row) => (
          <span className="tabular-nums font-medium">
            {typeof row.salary === 'number'
              ? `${row.salary.toLocaleString('fa-AF')} ${row.salary_currency || 'AFN'}`
              : '—'}
          </span>
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
              STATUS_TONE[row.status ?? ''] ?? STATUS_TONE.inactive,
            )}
          >
            {t(`hr.${row.status ?? 'inactive'}`, row.status ?? '—')}
          </span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'warehouse.actions',
        labelFallback: 'عملیات',
        align: 'end',
        locked: true,
        render: (row) =>
          onDelete ? (
            <button
              type="button"
              // The row click opens the employee; this deletes them.
              onClick={(e) => {
                e.stopPropagation()
                void onDelete(row.id)
              }}
              aria-label={t('team.deleteEmployee', 'حذف کارمند')}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--surface-muted))]"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('action.delete', 'حذف')}
            </button>
          ) : null,
      },
    ],
    [fmtDay, onDelete, t],
  )

  return (
    <DataTable
      tableId="employee-list"
      t={t}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      {...(onView ? { onRowClick: (row: EmployeeRow) => onView(row.id) } : {})}
      searchValue={search}
      onSearchChange={setSearch}
      minWidthClass="min-w-[420px]"
      emptyState={
        <EmptyState
          icon="customer"
          title={t('team.noEmployees', 'هیچ کارمندی ثبت نشده')}
          description={
            canAdd
              ? t('team.noEmployeesHint', 'با افزودن کارمندان جدید، شروع کنید')
              : t('team.branchFirstHint', 'اول یک شعبه ثبت کنید؛ هر کارمند باید شعبه داشته باشد.')
          }
          {...(canAdd
            ? { action: { label: t('team.addEmployee', 'افزودن کارمند'), onClick: onAdd } }
            : {})}
        />
      }
    />
  )
})

EmployeeListTable.displayName = 'EmployeeListTable'
