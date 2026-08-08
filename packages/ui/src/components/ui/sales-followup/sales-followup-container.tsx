'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import {
  SalesFollowupView,
  type FollowUp as ViewFollowUp,
  type FollowUpCreateValues,
} from './sales-followup-view'
import {
  useSalesFollowups,
  useCreateFollowup,
  useUpdateFollowup,
  useDeleteFollowup,
  useCustomers,
  useEmployees,
  type FollowUp as ApiFollowUp,
  type CreateFollowUpInput,
  type UpdateFollowUpInput,
} from '@hisabche/api'

export function SalesFollowupContainer() {
  const t = useTranslations()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<ApiFollowUp['status'] | 'all'>('all')
  const [page, setPage] = useState(1)

  const {
    data: followupsResponse,
    isLoading,
    refetch,
  } = useSalesFollowups({
    ...(statusFilter === 'all' ? {} : { status: statusFilter }),
    page,
    limit: 20,
  })

  const { data: customersData } = useCustomers()

  const { data: employeesData } = useEmployees()

  const { mutateAsync: createFollowup } = useCreateFollowup()

  const { mutateAsync: updateFollowup } = useUpdateFollowup()

  const { mutateAsync: deleteFollowup } = useDeleteFollowup()

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const followups = followupsResponse?.data ?? []

  // Transform API rows (snake_case, names denormalized) into the view's
  // normalized shape. The source of truth for the data contract is the
  // @hisabche/api FollowUp type returned by the API.
  const viewFollowups = followups.map(
    (
      f,
    ): {
      id: string
      customer: { id: string; name: string }
      assignedTo: { id: string; name: string }
      type: ApiFollowUp['type']
      status: ApiFollowUp['status']
      nextActionDate: string
      notes: string
      createdAt: string
      updatedAt: string
      reminder?: boolean
    } => ({
      id: f.id,
      customer: { id: f.customer_id, name: f.customer_name },
      assignedTo: { id: f.assigned_to_id, name: f.assigned_to_name },
      type: f.type,
      status: f.status,
      nextActionDate: f.next_action_date,
      notes: f.notes,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      ...(f.reminder !== undefined ? { reminder: f.reminder } : {}),
    }),
  )

  // Create input contract comes from @hisabche/api. The view's create payload
  // is built via the view's known field names; map them explicitly.
  const handleCreate = async (values: FollowUpCreateValues) => {
    const payload: CreateFollowUpInput = {
      customer_id: values.customerId,
      assigned_to_id: values.assignedTo,
      type: values.type,
      status: values.status,
      next_action_date: values.nextActionDate,
      notes: values.notes,
      reminder: values.reminder,
    }
    await createFollowup(payload)
    refetch()
  }

  const handleUpdate = async (id: string, values: Partial<ViewFollowUp>) => {
    const payload: UpdateFollowUpInput = {
      ...(values.type !== undefined ? { type: values.type } : {}),
      ...(values.status !== undefined ? { status: values.status } : {}),
      ...(values.nextActionDate !== undefined ? { next_action_date: values.nextActionDate } : {}),
      ...(values.notes !== undefined ? { notes: values.notes } : {}),
      ...(values.reminder !== undefined ? { reminder: values.reminder } : {}),
      ...(values.customer?.id !== undefined ? { customer_id: values.customer.id } : {}),
      ...(values.assignedTo?.id !== undefined ? { assigned_to_id: values.assignedTo.id } : {}),
    }
    await updateFollowup({ id, ...payload })
    refetch()
  }

  const handleDelete = async (id: string) => {
    await deleteFollowup(id)
    refetch()
  }

  const handleFilter = (filter: {
    customerId?: string
    employeeId?: string
    type?: ApiFollowUp['type'] | 'all'
  }) => {
    // Filter handled by API params
    refetch()
  }

  return (
    <SalesFollowupView
      t={safeT}
      followups={viewFollowups}
      customers={(customersData?.customers ?? []).map((c) => ({
        id: c.id ?? '',
        name: c.fullName,
        email: c.email || undefined,
        phone: c.phone || undefined,
      }))}
      employees={employeesData?.employees ?? []}
      isLoading={isLoading}
      statusFilter={statusFilter}
      onStatusChange={setStatusFilter}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onView={(id) => router.push(`/sales-followup/${id}`)}
      onFilter={handleFilter}
    />
  )
}
