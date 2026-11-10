'use client'

// ============================================
// «جلسات خدمت» — the tab's logic: data, names, permissions and the dialogs.
//
// ⚠️ NO NEW ROUTE AND NO NEW LIST ENDPOINT. It mounts into the customers hub
// (`?tab=sessions`) and reads the existing `GET /service-delivery/sessions`,
// which answers every session of the workspace. Filtering happens here, on the
// rows the screen holds, and the summary is counted over the UNFILTERED rows so
// a count never describes «the page that is showing».
//
// ⚠️ NAMES COME FROM THE EXISTING LIST HOOKS. The session row carries ids only;
// a name that cannot be read (a row beyond the first 100, a failed read) is
// `null` and the cell says «نام خوانده نشد». No name is invented and none is
// copied into this screen's state as a second source.
//
// ⚠️ THE SYNC COLUMN ANSWERS ONLY ON A HOST WITH AN OUTBOX. `useEntitySyncStates`
// returns `available: false` in the browser; every row then says «نامعلوم»,
// because a green tick there would promise something nobody checked.
//
// ⚠️ PERMISSIONS: the SERVER checks `invoice.read` on the list and
// `invoice.create` on create/deliver/cancel. The screen follows the same
// capabilities. Hiding a button is never the control — the routes still refuse.
// Cancel additionally follows the DEVICE rule (`invoice.delete`); the backend
// route's use of `invoice.create` is reported as a mismatch, not papered over.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  asList,
  useBranches,
  useCustomers,
  useServiceResources,
  useEmployees,
  useEntitySyncStates,
  useMoveServiceSessionStatus,
  useMyCapabilities,
  useProducts,
  useServiceDeliverySessions,
} from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

import { ErrorNote, Loading } from '../../capability/capability-kit'
import { NoAccessNotice } from '../../no-access-notice'
import { OfflineGate } from '../../offline-gate'
import type { SelectFieldOption } from '../../select-field'
import { useLocalePush } from '../../../../hooks/use-locale-push'
import { useToast } from '../../toast-provider'
import { ServiceDeliveryView } from '../service-delivery-view'
import { summarizeSessions, syncStateOf, type ServiceSessionRow } from '../service-delivery-model'
import { ServiceSessionCreateDialog } from '../service-session-create-dialog'
import { ServiceSessionDeliverDialog } from '../service-session-deliver-dialog'
import { ServiceSessionCancelDialog } from '../service-session-cancel-dialog'
import { ServiceSessionDetails } from '../service-session-details'

interface EmployeeRow {
  id?: string | null | undefined
  first_name?: string | null | undefined
  last_name?: string | null | undefined
}

export function ServiceDeliveryContainer() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const push = useLocalePush()
  const capabilities = useMyCapabilities()

  // Hooks before every return: the guard below is a rendering decision, not a
  // reason to call hooks conditionally.
  if (capabilities.isLoading) {
    return <Loading label={t('serviceDelivery.loading', 'در حال بارگذاری…')} />
  }
  if (capabilities.isError) {
    return (
      <ErrorNote
        message={t(
          'serviceDelivery.permissionsUnread',
          'دسترسی‌های این حساب خوانده نشد؛ بدون آن این بخش باز نمی‌شود.',
        )}
        onRetry={() => void capabilities.refetch()}
        retryLabel={t('serviceDelivery.actions.retry', 'تلاش دوباره')}
      />
    )
  }
  if (capabilities.can('invoice.read') !== true) {
    return <NoAccessNotice onHome={() => push('/dashboard')} />
  }

  return (
    <OfflineGate feature="operations.service_delivery">
      <ServiceDeliveryContent />
    </OfflineGate>
  )
}

function ServiceDeliveryContent() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const push = useLocalePush()
  const capabilities = useMyCapabilities()

  const sessions = useServiceDeliverySessions()
  // The list endpoints cap at 100 rows. A session naming an id beyond that is
  // still listed — its NAME is unknown, which is what the cell says.
  const customers = useCustomers({ page: 1, limit: 100, sortDirection: 'desc' })
  // salon-01: the chairs / rooms a session can hold (none = no field).
  const resources = useServiceResources()
  const products = useProducts({ limit: 100 })
  const employees = useEmployees({ page: 1, limit: 100 })
  const branches = useBranches()
  const sync = useEntitySyncStates('service_delivery_sessions')
  const moveStatus = useMoveServiceSessionStatus()
  const toast = useToast()
  const [movingId, setMovingId] = useState<string | null>(null)
  const onMoveStatus = (row: ServiceSessionRow, to: 'in_progress' | 'no_show') => {
    setMovingId(row.id)
    moveStatus.mutate(
      { id: row.id, to },
      {
        onError: (error) =>
          toast.error(
            t('serviceDelivery.moveFailed', 'وضعیت جلسه عوض نشد'),
            apiErrorMessage(error, t('serviceDelivery.moveFailed', 'وضعیت جلسه عوض نشد')),
          ),
        onSettled: () => setMovingId(null),
      },
    )
  }

  const mayWrite = capabilities.can('invoice.create') === true
  const mayCancel = capabilities.can('invoice.delete') === true
  const mayReadEmployees = capabilities.can('employee.read') === true

  const customerList = useMemo(() => customers.data?.customers ?? [], [customers.data])
  const productList = useMemo(() => products.data?.products ?? [], [products.data])
  const employeeRows = useMemo(
    () => asList<EmployeeRow>((employees.data as { employees?: unknown } | null)?.employees),
    [employees.data],
  )
  const branchList = useMemo(() => branches.data ?? [], [branches.data])

  const customerById = useMemo(() => {
    const map = new Map<string, string>()
    for (const customer of customerList) {
      if (customer.id) map.set(customer.id, customer.fullName)
    }
    return map
  }, [customerList])

  const productById = useMemo(() => {
    const map = new Map<string, { name: string; offeringType: string | undefined }>()
    for (const product of productList) {
      if (!product.id) continue
      map.set(product.id, {
        name: product.name,
        offeringType: product.offeringType,
      })
    }
    return map
  }, [productList])

  const practitionerById = useMemo(() => {
    const map = new Map<string, string>()
    for (const employee of employeeRows) {
      if (!employee.id) continue
      const name = [employee.first_name, employee.last_name]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' ')
        .trim()
      if (name) map.set(employee.id, name)
    }
    return map
  }, [employeeRows])

  const branchById = useMemo(() => {
    const map = new Map<string, string>()
    for (const branch of branchList) {
      if (branch.id) map.set(branch.id, branch.name)
    }
    return map
  }, [branchList])

  const rows: ServiceSessionRow[] = useMemo(
    () =>
      (sessions.data ?? []).map((session) => {
        const state = syncStateOf(sync.entries, session.id, sync.available)
        return {
          ...session,
          customerName: customerById.get(session.customerId) ?? null,
          serviceName: productById.get(session.serviceOfferingId)?.name ?? null,
          practitionerName: session.practitionerId
            ? (practitionerById.get(session.practitionerId) ?? null)
            : null,
          branchName: session.branchId ? (branchById.get(session.branchId) ?? null) : null,
          sync: state.state,
          syncCode: state.code,
        }
      }),
    [
      sessions.data,
      sync.entries,
      sync.available,
      customerById,
      productById,
      practitionerById,
      branchById,
    ],
  )

  const summary = useMemo(() => summarizeSessions(rows), [rows])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const today = toIsoDay(new Date())
  // One card that can actually be acted on — «what is today», not a device
  // queue. The table itself answers the rest.
  const todayCount = useMemo(
    () => rows.filter((row) => row.sessionDate === today).length,
    [rows, today],
  )
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (dateFilter === 'today' && row.sessionDate !== today) return false
      if (dateFilter === 'upcoming' && row.sessionDate <= today) return false
      if (dateFilter === 'past' && row.sessionDate >= today) return false
      if (!needle) return true
      return [row.customerName, row.serviceName, row.practitionerName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, search, statusFilter, dateFilter, today])

  const [createOpen, setCreateOpen] = useState(false)
  const [deliverRow, setDeliverRow] = useState<ServiceSessionRow | null>(null)
  const [cancelRow, setCancelRow] = useState<ServiceSessionRow | null>(null)
  const [detailRow, setDetailRow] = useState<ServiceSessionRow | null>(null)

  const hasBranches = branchList.length > 0

  const customerOptions: SelectFieldOption[] = customerList
    .filter((customer): customer is typeof customer & { id: string } => Boolean(customer.id))
    .map((customer) => ({
      value: customer.id,
      label: customer.fullName,
      keywords: customer.phone ?? undefined,
    }))

  const serviceOptions: SelectFieldOption[] = productList
    .filter(
      (product): product is typeof product & { id: string } =>
        Boolean(product.id) && product.offeringType === 'service',
    )
    .map((product) => ({ value: product.id, label: product.name }))

  const practitionerOptions: SelectFieldOption[] = mayReadEmployees
    ? employeeRows
        .filter((employee): employee is EmployeeRow & { id: string } => Boolean(employee.id))
        .map((employee) => ({
          value: employee.id,
          label:
            practitionerById.get(employee.id) ??
            t('serviceDelivery.unknown.employee', 'نام خوانده نشد'),
        }))
    : []

  // V54 5.4: what a service may use up — goods, never a service or a package.
  // A device row without `offeringType` is offered (it is a product row).
  const materialOptions: SelectFieldOption[] = productList
    .filter(
      (product): product is typeof product & { id: string } =>
        Boolean(product.id) &&
        product.offeringType !== 'service' &&
        product.offeringType !== 'package',
    )
    .map((product) => ({ value: product.id, label: product.name }))

  const branchOptions: SelectFieldOption[] = branchList.map((branch) => ({
    value: branch.id,
    label: branch.name,
  }))

  const customerHint = customers.isError
    ? t('serviceDelivery.create.customersUnread', 'فهرست مشتریان خوانده نشد')
    : customerOptions.length === 0
      ? t(
          'serviceDelivery.create.howToCustomer',
          'هنوز مشتری‌ای ثبت نشده است؛ از صفحه‌ی «مشتریان» یک مشتری بسازید.',
        )
      : undefined

  const serviceHint = products.isError
    ? t('serviceDelivery.create.servicesUnread', 'فهرست کالاها و خدمات خوانده نشد')
    : serviceOptions.length === 0 && productList.length > 0
      ? t(
          'serviceDelivery.create.offeringTypeOffline',
          'نوع خدمت/کالا روی این دستگاه ذخیره نشده است؛ برای انتخاب خدمت آنلاین شوید.',
        )
      : serviceOptions.length === 0
        ? t(
            'serviceDelivery.create.howToService',
            'هنوز خدمتی تعریف نشده است؛ از «موجودی ← کالاها» یک کالا با نوع «خدمت» بسازید.',
          )
        : undefined

  const practitionerHint = mayReadEmployees
    ? employees.isError
      ? t('serviceDelivery.create.employeesUnread', 'فهرست کارمندان خوانده نشد')
      : practitionerOptions.length === 0
        ? t('serviceDelivery.create.noEmployees', 'هنوز کارمندی ثبت نشده است')
        : undefined
    : t(
        'serviceDelivery.create.noEmployeeAccess',
        'برای دیدن فهرست کارمندان دسترسی ندارید؛ مجری را خالی بگذارید.',
      )

  const packageNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of productList) {
      if (product.id) map.set(product.id, product.name)
    }
    return map
  }, [productList])

  return (
    <>
      <ServiceDeliveryView
        t={t}
        rows={filtered}
        summary={summary}
        today={todayCount}
        isLoading={sessions.isLoading}
        error={
          sessions.isError
            ? t('serviceDelivery.loadFailed', 'فهرست جلسه‌ها خوانده نشد؛ این «خالی» نیست.')
            : null
        }
        onRetry={() => void sessions.refetch()}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        hasBranches={hasBranches}
        mayWrite={mayWrite}
        mayCancel={mayCancel}
        onCreate={() => setCreateOpen(true)}
        onDeliver={(row) => setDeliverRow(row)}
        onCancel={(row) => setCancelRow(row)}
        onOpen={(row) => setDetailRow(row)}
        onMoveStatus={onMoveStatus}
        movingId={movingId}
        {...(sync.available ? { onOpenSyncCentre: () => push('/data-and-sync') } : {})}
      />

      <ServiceSessionCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customerOptions={customerOptions}
        serviceOptions={serviceOptions}
        practitionerOptions={practitionerOptions}
        branchOptions={branchOptions}
        resourceOptions={(resources.data?.resources ?? [])
          .filter((r) => r.isActive)
          .map((r) => ({ value: r.id, label: r.name }))}
        hasBranches={hasBranches}
        customerHint={customerHint}
        serviceHint={serviceHint}
        practitionerHint={practitionerHint}
      />

      <ServiceSessionDeliverDialog
        open={deliverRow !== null}
        onClose={() => setDeliverRow(null)}
        session={deliverRow}
        packageNameById={packageNameById}
        syncAvailable={sync.available}
        onOpenInvoices={() => push('/invoices')}
        onReload={() => void sessions.refetch()}
        materialOptions={materialOptions}
      />

      <ServiceSessionCancelDialog
        open={cancelRow !== null}
        onClose={() => setCancelRow(null)}
        session={cancelRow}
      />

      <ServiceSessionDetails
        open={detailRow !== null}
        onClose={() => setDetailRow(null)}
        session={detailRow}
        hasBranches={hasBranches}
        onOpenInvoice={(invoiceId) => push(`/invoices/${invoiceId}`)}
        maySuspendPackage={capabilities.can('payment.cancel') === true}
        mayTakeDeposit={mayWrite}
        {...(sync.available ? { onOpenSyncCentre: () => push('/data-and-sync') } : {})}
      />
    </>
  )
}
