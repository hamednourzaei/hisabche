'use client'

// ============================================
// The salon parts of the service core (QA document §8, 10 Nov 2026):
//
//   SalonSetupSection  — chairs / rooms / beds, and each service's duration,
//                        department, resource kind, warehouse and recipe
//                        (what one delivery uses; delivery deducts it when
//                        the person lists no materials).
//   CommissionSection  — a rate per provider and what the delivered sessions
//                        of a period earned them. A session from a package
//                        has no single price: counted, not valued — never 0.
//
// A barber shop needs neither and can hide both with the page customizer.
// ============================================

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useBookResource,
  useCommissionRates,
  useCommissionReport,
  useCreateServiceResource,
  useMyCapabilities,
  useMyCommissionReport,
  useReleaseResourceBooking,
  useResourceBookings,
  useResourceSlots,
  useSaveServiceCatalog,
  useServiceCatalog,
  useServiceResources,
  useSetCommissionRate,
  useUpdateServiceResource,
  type ServiceResource,
} from '@hisabche/api'
import { RESOURCE_KINDS, type CommissionLine, type ResourceKind } from '@hisabche/validation'
import { toIsoDay } from '@hisabche/formatting'

import { Button } from '../button'
import { Input } from '../input'
import { DataTable, type TableColumn } from '../data-table'
import { SegmentedControl } from '../segmented-control'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'
import { refusalText } from '../../../lib/refusal-text'
import {
  labelOf,
  NotReady,
  packCard,
  useDepartmentOptions,
  useEmployeeOptions,
  useMoneyText,
  usePackT,
  useProductOptions,
  useWarehouseOptions,
  LabeledSelect,
} from './pack-shared'

const SETUP_ERRORS = [
  'SERVICE_CATALOG_NOT_A_SERVICE',
  'SERVICE_CONSUMABLE_DUPLICATE',
  'SERVICE_CONSUMABLE_IS_A_SERVICE',
  'SERVICE_CONSUMABLE_NOT_FOUND',
  'SERVICE_CONSUMABLE_WAREHOUSE_REQUIRED',
  'RESOURCE_DEPARTMENT_NOT_FOUND',
  'SALON_NOT_READY',
]

function ResourcesCard() {
  const t = usePackT()
  const toast = useToast()
  const resources = useServiceResources()
  const create = useCreateServiceResource()
  const update = useUpdateServiceResource()
  const bookings = useResourceBookings()
  const book = useBookResource()
  const releaseBooking = useReleaseResourceBooking()
  const departments = useDepartmentOptions()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ResourceKind>('chair')
  const [departmentId, setDepartmentId] = useState('')
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const [slotStart, setSlotStart] = useState('')
  const [slotEnd, setSlotEnd] = useState('')
  const slots = useResourceSlots(selectedResourceId || resources.data?.resources[0]?.id)

  if (resources.data && !resources.data.ready) return <NotReady t={t} migration="salon-01" />

  const add = () => {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), kind, ...(departmentId ? { departmentId } : {}) },
      {
        onSuccess: () => {
          setName('')
          toast.success(t('salon.resourceAdded', 'اضافه شد'))
        },
        onError: (e) =>
          toast.error(refusalText(e, t, 'salon', SETUP_ERRORS, t('salon.failed', 'انجام نشد'))),
      },
    )
  }

  const columns: TableColumn<ServiceResource>[] = [
    {
      id: 'name',
      labelKey: 'salon.resourceName',
      labelFallback: 'نام',
      locked: true,
      render: (r) => r.name,
    },
    {
      id: 'kind',
      labelKey: 'salon.kind',
      labelFallback: 'نوع',
      render: (r) => t(`salon.kinds.${r.kind}`, r.kind),
    },
    {
      id: 'department',
      labelKey: 'salon.department',
      labelFallback: 'بخش',
      showFrom: 'md',
      render: (r) => labelOf(departments, r.departmentId),
    },
    {
      id: 'active',
      labelKey: 'salon.active',
      labelFallback: 'فعال',
      locked: true,
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => update.mutate({ id: r.id, isActive: !r.isActive })}
        >
          {r.isActive ? t('salon.retire', 'کنار گذاشتن') : t('salon.reactivate', 'فعال کردن')}
        </Button>
      ),
    },
  ]

  return (
    <section className={packCard}>
      <h3 className="text-sm font-semibold">
        {t('salon.resources', 'صندلی‌ها، اتاق‌ها و تخت‌ها')}
      </h3>
      <p className="mb-3 text-xs text-[hsl(var(--fg-secondary))]">
        {t('salon.resourcesHint', 'دو نوبت هم‌زمان هیچ‌وقت یک صندلی یا اتاق را نمی‌گیرند.')}
      </p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Input
          className="flex-1"
          name="name"
          value={name}
          placeholder={t('salon.resourcePlaceholder', 'مثلاً صندلی ۱ یا اتاق پوست')}
          onChange={(e) => setName(e.target.value)}
        />
        <LabeledSelect
          name="kind"
          value={kind}
          onChange={(v) => setKind(v as ResourceKind)}
          options={RESOURCE_KINDS.map((value) => ({
            value,
            label: t(`salon.kinds.${value}`, value),
          }))}
        />
        {departments.length > 0 ? (
          <LabeledSelect
            name="departmentId"
            value={departmentId}
            placeholder={t('salon.department', 'بخش')}
            onChange={setDepartmentId}
            options={departments}
          />
        ) : null}
        <Button size="sm" onClick={add} disabled={!name.trim() || create.isPending}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('salon.add', 'افزودن')}
        </Button>
      </div>
      <DataTable
        tableId="service-resources"
        t={t}
        rows={resources.data?.resources ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        paginate={false}
      />

      <div className="mt-4 space-y-2 border-t border-[hsl(var(--border-default))] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[hsl(var(--fg-primary))]">
            {t('salon.resourceBookings', 'رزرو منابع و ظرفیت')}
          </span>
          {slots.data?.utilization ? (
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('salon.utilization', 'بهره‌وری')}:{' '}
              {slots.data.utilization.ratio === null
                ? '—'
                : `${Math.round(slots.data.utilization.ratio * 100)}%`}{' '}
              ({slots.data.freeSlots.length} {t('salon.freeSlots', 'بازه آزاد')})
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LabeledSelect
            name="bookingResourceId"
            value={selectedResourceId}
            placeholder={t('salon.resource', 'منبع')}
            onChange={setSelectedResourceId}
            options={(resources.data?.resources ?? []).map((r) => ({ value: r.id, label: r.name }))}
          />
          <Input
            type="datetime-local"
            value={slotStart}
            onChange={(e) => setSlotStart(e.target.value)}
            className="w-44"
          />
          <Input
            type="datetime-local"
            value={slotEnd}
            onChange={(e) => setSlotEnd(e.target.value)}
            className="w-44"
          />
          <Button
            size="sm"
            disabled={!selectedResourceId || !slotStart || !slotEnd || book.isPending}
            onClick={() => {
              if (!selectedResourceId || !slotStart || !slotEnd) return
              book.mutate(
                {
                  resourceId: selectedResourceId,
                  startAt: new Date(slotStart).toISOString(),
                  endAt: new Date(slotEnd).toISOString(),
                  sourceType: 'session',
                },
                {
                  onSuccess: () => {
                    setSlotStart('')
                    setSlotEnd('')
                    toast.success(t('salon.bookingCreated', 'رزرو ثبت شد'))
                  },
                  onError: (e) =>
                    toast.error(
                      refusalText(e, t, 'salon', SETUP_ERRORS, t('salon.failed', 'انجام نشد')),
                    ),
                },
              )
            }}
          >
            {t('salon.bookSlot', 'ثبت رزرو')}
          </Button>
        </div>
        {(bookings.data?.bookings ?? []).length > 0 ? (
          <ul className="space-y-1 text-xs">
            {(bookings.data?.bookings ?? []).slice(0, 5).map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[hsl(var(--border-default))] px-2 py-1"
              >
                <span dir="ltr" className="tabular-nums">
                  {b.sourceType} · {b.status} · {b.startAt ?? '—'} → {b.endAt ?? '—'}
                </span>
                {b.status === 'active' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={releaseBooking.isPending}
                    onClick={() => releaseBooking.mutate(b.id)}
                  >
                    {t('salon.releaseSlot', 'آزادسازی')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

function CatalogCard() {
  const t = usePackT()
  const toast = useToast()
  const catalog = useServiceCatalog()
  const save = useSaveServiceCatalog()
  const services = useProductOptions('service')
  const goods = useProductOptions('goods')
  const departments = useDepartmentOptions()
  const warehouses = useWarehouseOptions()

  const [productId, setProductId] = useState('')
  const existing = catalog.data?.services.find((s) => s.productId === productId)
  const [form, setForm] = useState({
    duration: '',
    departmentId: '',
    resourceKind: '',
    warehouseId: '',
  })
  const [materials, setMaterials] = useState<
    Array<{ key: number; productId: string; quantity: string }>
  >([])

  const pick = (id: string) => {
    setProductId(id)
    const row = catalog.data?.services.find((s) => s.productId === id)
    setForm({
      duration: row ? String(row.durationMinutes) : '',
      departmentId: row?.departmentId ?? '',
      resourceKind: row?.resourceKind ?? '',
      warehouseId: row?.warehouseId ?? '',
    })
    setMaterials(
      (row?.consumables ?? []).map((c, i) => ({
        key: i + 1,
        productId: c.productId,
        quantity: String(c.quantity),
      })),
    )
  }

  if (catalog.data && !catalog.data.ready) return null

  const duration = typedNumber(form.duration)
  const submit = () => {
    if (!productId || duration === null) return
    save.mutate(
      {
        productId,
        durationMinutes: Math.round(duration),
        departmentId: form.departmentId || null,
        resourceKind: (form.resourceKind || null) as ResourceKind | null,
        warehouseId: form.warehouseId || null,
        consumables: materials
          .filter((m) => m.productId && (typedNumber(m.quantity) ?? 0) > 0)
          .map((m) => ({ productId: m.productId, quantity: typedNumber(m.quantity) ?? 0 })),
      },
      {
        onSuccess: () => toast.success(t('salon.catalogSaved', 'خدمت ذخیره شد')),
        onError: (e) =>
          toast.error(refusalText(e, t, 'salon', SETUP_ERRORS, t('salon.failed', 'انجام نشد'))),
      },
    )
  }

  return (
    <section className={packCard}>
      <h3 className="text-sm font-semibold">
        {t('salon.catalog', 'فهرست خدمات: مدت، بخش و مواد مصرفی')}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <LabeledSelect
          name="productId"
          label={t('salon.service', 'خدمت')}
          value={productId}
          onChange={pick}
          options={services}
        />
        <Input
          name="durationMinutes"
          inputMode="numeric"
          value={form.duration}
          placeholder={t('salon.duration', 'مدت (دقیقه)')}
          onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
        />
        <LabeledSelect
          name="departmentId"
          label={t('salon.department', 'بخش')}
          value={form.departmentId}
          onChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
          options={departments}
        />
        <LabeledSelect
          name="resourceKind"
          label={t('salon.needs', 'به چه نیاز دارد')}
          value={form.resourceKind}
          onChange={(v) => setForm((f) => ({ ...f, resourceKind: v }))}
          options={RESOURCE_KINDS.map((value) => ({
            value,
            label: t(`salon.kinds.${value}`, value),
          }))}
        />
        {materials.map((m, index) => (
          <div key={m.key} className="sm:col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <LabeledSelect
                name={`consumables.${index}.productId`}
                value={m.productId}
                placeholder={t('salon.material', 'ماده‌ی مصرفی')}
                onChange={(v) =>
                  setMaterials((all) =>
                    all.map((x) => (x.key === m.key ? { ...x, productId: v } : x)),
                  )
                }
                options={goods}
              />
            </div>
            <Input
              className="w-28"
              name={`consumables.${index}.quantity`}
              inputMode="decimal"
              value={m.quantity}
              placeholder={t('salon.perService', 'برای هر بار')}
              onChange={(e) =>
                setMaterials((all) =>
                  all.map((x) => (x.key === m.key ? { ...x, quantity: e.target.value } : x)),
                )
              }
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('salon.remove', 'حذف')}
              onClick={() => setMaterials((all) => all.filter((x) => x.key !== m.key))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
        {materials.length > 0 && warehouses.length > 0 ? (
          <LabeledSelect
            name="warehouseId"
            label={t('salon.materialsFrom', 'مواد از کدام انبار کم شود')}
            value={form.warehouseId}
            onChange={(v) => setForm((f) => ({ ...f, warehouseId: v }))}
            options={warehouses}
          />
        ) : null}
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!productId}
            onClick={() =>
              setMaterials((all) => [...all, { key: Date.now(), productId: '', quantity: '' }])
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('salon.addMaterial', 'ماده‌ی مصرفی')}
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!productId || duration === null || save.isPending}
          >
            {existing ? t('salon.update', 'ذخیره‌ی تغییرات') : t('salon.save', 'ذخیره')}
          </Button>
        </div>
        <p className="sm:col-span-2 text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'salon.catalogHint',
            'وقتی جلسه «انجام شد» ثبت شود و موادی دستی وارد نشود، همین مواد از انبار کم و بهایشان در دفتر ثبت می‌شود.',
          )}
        </p>
      </div>
    </section>
  )
}

export function SalonSetupSection() {
  return (
    <div className="space-y-4" data-guide="salon-setup">
      <ResourcesCard />
      <CatalogCard />
    </div>
  )
}

/** The first day of this month, the person's local day. */
function monthStart(): string {
  const now = new Date()
  return toIsoDay(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function CommissionSection() {
  const t = usePackT()
  const toast = useToast()
  const money = useMoneyText()
  const capabilities = useMyCapabilities()
  const mayWriteCommission = capabilities.can('payroll.write') !== false
  const mayReadTeam = capabilities.can('payroll.read') !== false
  const staff = useEmployeeOptions()
  const rates = useCommissionRates()
  const setRate = useSetCommissionRate()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(() => toIsoDay(new Date()))
  const [scope, setScope] = useState<'team' | 'my'>(() => (mayReadTeam ? 'team' : 'my'))
  const effectiveScope: 'team' | 'my' = mayReadTeam ? scope : 'my'
  const teamReport = useCommissionReport(from, to, {
    enabled: mayReadTeam && effectiveScope === 'team',
  })
  const myReport = useMyCommissionReport(from, to, {
    enabled: effectiveScope === 'my',
  })
  const report = effectiveScope === 'my' ? myReport : teamReport
  const [employeeId, setEmployeeId] = useState('')
  const [percent, setPercent] = useState('')

  const rateOf = useMemo(
    () => new Map((rates.data?.rates ?? []).map((r) => [r.employeeId, r.rateBp])),
    [rates.data],
  )

  if (rates.data && !rates.data.ready) return <NotReady t={t} migration="provider-commission-01" />

  const pct = typedNumber(percent)
  const saveRate = () => {
    if (!employeeId || pct === null || pct < 0 || pct > 100) return
    setRate.mutate(
      { employeeId, rateBp: Math.round(pct * 100) },
      {
        onSuccess: () => {
          setPercent('')
          toast.success(t('commission.saved', 'نرخ ذخیره شد'))
        },
        onError: (e) =>
          toast.error(
            refusalText(
              e,
              t,
              'commission',
              ['COMMISSION_NOT_READY'],
              t('commission.failed', 'انجام نشد'),
            ),
          ),
      },
    )
  }

  const columns: TableColumn<CommissionLine>[] = [
    {
      id: 'provider',
      labelKey: 'commission.provider',
      labelFallback: 'مجری',
      locked: true,
      render: (row) => labelOf(staff, row.practitionerId),
    },
    {
      id: 'sessions',
      labelKey: 'commission.sessions',
      labelFallback: 'جلسه',
      align: 'end',
      render: (row) => row.sessions,
    },
    {
      id: 'base',
      labelKey: 'commission.base',
      labelFallback: 'مبلغ خدمات',
      align: 'end',
      render: (row) => (row.currency ? money(row.baseMinor, row.currency) : '—'),
    },
    {
      id: 'rate',
      labelKey: 'commission.rate',
      labelFallback: 'نرخ',
      align: 'end',
      render: (row) =>
        row.rateBp === null ? t('commission.noRate', 'تعیین نشده') : `${row.rateBp / 100}%`,
    },
    {
      id: 'commission',
      labelKey: 'commission.amount',
      labelFallback: 'کمیسیون',
      align: 'end',
      render: (row) =>
        row.commissionMinor === null || !row.currency
          ? '—'
          : money(row.commissionMinor, row.currency),
    },
    {
      id: 'unknown',
      labelKey: 'commission.unknown',
      labelFallback: 'بدون مبلغ مشخص',
      showFrom: 'md',
      align: 'end',
      render: (row) => (row.unknownSessions > 0 ? row.unknownSessions : '—'),
    },
  ]

  return (
    <section className="space-y-4" data-guide="commission">
      {mayWriteCommission ? (
        <div className={`${packCard} flex flex-wrap items-end gap-2`}>
          <div className="min-w-48 flex-1">
            <LabeledSelect
              name="employeeId"
              label={t('commission.provider', 'مجری')}
              value={employeeId}
              onChange={(v) => {
                setEmployeeId(v)
                const bp = rateOf.get(v)
                setPercent(bp === undefined ? '' : String(bp / 100))
              }}
              options={staff}
            />
          </div>
          <Input
            className="w-28"
            name="rateBp"
            inputMode="decimal"
            value={percent}
            placeholder={t('commission.percent', 'درصد')}
            onChange={(e) => setPercent(e.target.value)}
          />
          <Button
            size="sm"
            onClick={saveRate}
            disabled={!employeeId || pct === null || setRate.isPending}
          >
            {t('commission.setRate', 'ثبت نرخ')}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {mayReadTeam ? (
          <SegmentedControl
            label={t('commission.scopeLabel', 'دامنه کمیسیون')}
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: 'team', label: t('commission.scopeTeam', 'تیم') },
              { value: 'my', label: t('commission.scopeMy', 'سهم من') },
            ]}
          />
        ) : (
          <span className="rounded-md bg-[hsl(var(--surface-muted))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--fg-secondary))]">
            {t('commission.scopeMy', 'سهم من')}
          </span>
        )}
        <span>{t('commission.from', 'از')}</span>
        <Input
          type="date"
          name="from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
        <span>{t('commission.to', 'تا')}</span>
        <Input
          type="date"
          name="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-40"
        />
      </div>
      {report.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {t('commission.loadFailed', 'گزارش کمیسیون خوانده نشد.')}
        </p>
      ) : (
        <DataTable
          tableId="commission"
          t={t}
          rows={report.data?.lines ?? []}
          columns={columns}
          rowKey={(row) => `${row.practitionerId}|${row.currency ?? ''}`}
          paginate={false}
          emptyState={
            <p className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
              {t('commission.empty', 'در این بازه جلسه‌ی انجام‌شده‌ای با مجری نیست.')}
            </p>
          }
        />
      )}
      <p className="text-xs text-[hsl(var(--fg-secondary))]">
        {t(
          'commission.hint',
          'مبلغ هر جلسه از فاکتورش خوانده می‌شود؛ جلسه‌ی رایگان صفر است و جلسه‌ای که از بسته کم شده مبلغ جداگانه ندارد و در «بدون مبلغ مشخص» شمرده می‌شود، صفر نمی‌شود.',
        )}
      </p>
    </section>
  )
}
