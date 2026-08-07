'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useMemo, useCallback } from 'react'
import {
  SalesFollowupView,
  type FollowUpStatus,
  type FollowUp,
  type FollowUpCreateValues,
} from '../sales-followup-view'
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
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const {
    data: followupsResponse,
    isLoading,
    refetch,
  } = useSalesFollowups(
    statusFilter === 'all' ? { page, limit: 20 } : { status: statusFilter, page, limit: 20 },
  )

  const { data: customersData } = useCustomers()

  const { data: employeesData } = useEmployees()

  const { mutateAsync: createFollowup } = useCreateFollowup()

  const { mutateAsync: updateFollowup } = useUpdateFollowup()

  const { mutateAsync: deleteFollowup } = useDeleteFollowup()

  const followups: FollowUp[] = useMemo(
    () =>
      (followupsResponse?.data ?? []).map((f: ApiFollowUp) => ({
        id: f.id,
        customer: {
          id: f.customer_id,
          name: f.customer_name,
          email: f.customer_email,
          phone: f.customer_phone,
        },
        assignedTo: {
          id: f.assigned_to_id,
          name: f.assigned_to_name,
        },
        type: f.type,
        status: f.status,
        nextActionDate: f.next_action_date,
        notes: f.notes,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        reminder: f.reminder,
      })),
    [followupsResponse],
  )
  const total = followupsResponse?.total ?? 0

  // Real `Customer` from @hisabche/validation uses `fullName`; the view expects
  // a `name`. Map explicitly, no casts.
  const customers = useMemo(
    () =>
      (customersData?.customers ?? []).map((c) => ({
        id: c.id ?? '',
        name: c.fullName,
        email: c.email || undefined,
        phone: c.phone || undefined,
      })),
    [customersData],
  )

  const employees = useMemo(() => employeesData?.employees ?? [], [employeesData])

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

  const handleUpdate = async (id: string, values: Partial<FollowUp>) => {
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

  const handleFilter = () => {
    // Filter handled by API params
    refetch()
  }

  return (
    <SalesFollowupView
      t={t}
      followups={followups}
      customers={customers}
      employees={employees}
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
