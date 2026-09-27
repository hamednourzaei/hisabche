// packages/ui/src/components/ui/human-resources/containers/employee-detail-container.tsx
'use client'

import { EmployeeLeavePanel } from '../employee-leave-panel'
import { useTranslations } from 'next-intl'
import {
  useEmployee,
  useUpdateEmployee,
  usePayrolls,
  useCreatePayroll,
  useRecordHistory,
} from '@hisabche/api'
import { EmployeeDetailView } from '../employee-detail-view'
import { EmployeeBranchesPanel, type EmployeeBranch } from '../employee-branches-panel'
import { RecordHistoryPanel } from '../../activity/record-history-panel'
import { useLocalePush } from '../../../../hooks/use-locale-push'

export function EmployeeDetailContainer({ id }: { id: string }) {
  const t = useTranslations()
  const push = useLocalePush()
  const { data: employee, isLoading } = useEmployee(id)
  const { data: payrolls, isLoading: isLoadingPayrolls } = usePayrolls(id)
  const { data: recordHistory, isLoading: historyLoading } = useRecordHistory('employee', id)
  const updateEmployee = useUpdateEmployee()
  const createPayroll = useCreatePayroll()

  const safeT = (key: string, fallback?: string) => {
    const result = t(key)
    return result !== key ? result : (fallback ?? key)
  }

  const handleUpdate = async (values: Record<string, unknown>) => {
    await updateEmployee.mutateAsync({ id, ...values })
  }

  const handleAddPayment = async (values: {
    amount: number
    date: string
    notes?: string
    currency?: string
  }) => {
    // ✅ FIX: ورودی تاریخ فقط «2026-08-01» می‌دهد، اما schema سمت سرور
    // (isoDateSchema = z.string().datetime()) تاریخ-زمانِ کامل ISO می‌خواهد؛
    // برای همین درخواست با خطای ۴۰۰ رد می‌شد:
    // body/periodStart must match format "date-time"
    const parsed = new Date(values.date)
    const isoDate = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()

    await createPayroll.mutateAsync({
      employeeId: id,
      periodStart: isoDate,
      periodEnd: isoDate,
      baseSalary: values.amount,
      bonuses: 0,
      deductions: 0,
      overtimeHours: 0,
      overtimeRate: 0,
      taxAmount: 0,
      netSalary: values.amount,
      currency: values.currency || employee?.salary_currency || 'AFN',
      ...(values.notes ? { notes: values.notes } : {}),
      status: 'paid',
      paymentDate: isoDate,
    })
  }

  return (
    <EmployeeDetailView
      t={safeT}
      employee={employee}
      isLoading={isLoading}
      payrolls={payrolls ?? []}
      isLoadingPayrolls={isLoadingPayrolls}
      onUpdate={handleUpdate}
      onAddPayment={handleAddPayment}
      onBack={() => push('/team-and-payroll')} // G1: canonical people route
      extraSlot={
        <div className="mt-6 space-y-4">
          {/* Request #99 — days off: how many, why, from when to when. */}
          <EmployeeLeavePanel t={safeT} employeeId={id} />
          {/* H5 — read back from `employee_branch_assignments`, which G2's form
              has been writing to with nothing able to read it. */}
          <EmployeeBranchesPanel
            t={safeT}
            branches={
              ((employee as { branches?: EmployeeBranch[] } | undefined)?.branches ??
                []) as EmployeeBranch[]
            }
            onOpenBranch={() => push('/team-and-payroll?tab=branches')}
          />
          {/* H6 — the audit trail for this employee record. */}
          <RecordHistoryPanel
            t={safeT}
            isLoading={historyLoading}
            entries={(recordHistory ?? []).map((entry) => ({
              id: entry.id,
              action: entry.action,
              createdAt: entry.created_at,
              userId: entry.user_id ?? null,
            }))}
          />
        </div>
      }
    />
  )
}
