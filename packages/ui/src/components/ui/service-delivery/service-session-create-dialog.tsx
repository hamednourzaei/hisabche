'use client'

// ============================================
// «جلسه‌ی جدید» — scheduling a service for a customer.
//
// ⚠️ A SESSION IS BORN `scheduled`. «delivered» is reached only through the
// deliver dialog, because a delivery IS a settlement (credit consumed, invoice
// linked, or a reason for a free service). The API refuses any other status on
// create (`SESSION_MUST_START_SCHEDULED`), and this form offers none.
//
// ⚠️ NO SETTLEMENT IS CHOSEN HERE. A booking is not a payment: the session is
// stored with `undecided`, and the deliver dialog — the moment someone sees the
// customer and the money — is the only place that picks a method. This form
// used to preselect «اعتبار بسته», which recorded a settlement nobody made.
//
// ⚠️ THE DURATION IS THE DOMAIN'S. The end time shown is derived by the local
// `endTimeFor`, and the legality of the pair is then asked of
// `calculateSessionDurationMinutes` — the one session rule the server and the
// device both use. This form keeps no second rule.
//
// ⚠️ `offeringType` IS MISSING ON DEVICE ROWS (the sync pull deliberately does
// not carry `offering_type`). When no service can be found but products exist,
// the picker says so instead of looking like «this business has no services».
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { apiErrorFields, useCreateServiceDeliverySession } from '@hisabche/api'
import { calculateSessionDurationMinutes } from '@hisabche/validation'
import { toIsoDay } from '@hisabche/formatting'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { JalaliDatePicker } from '../jalali-datepicker'
import { NumberField } from '../capability/capability-kit'
import { SegmentedControl } from '../segmented-control'
import { CustomerMultiPicker, type CustomerOption } from '../crm/customer-multi-picker'
import type { SelectFieldOption } from '../select-field'
import { Labeled, SelectInput, TimeInput } from './service-delivery-fields'
import { endTimeFor } from './service-delivery-model'
import { serviceDeliveryErrorCode, serviceDeliveryErrorKey } from './service-delivery-errors'

export interface ServiceSessionCreateDialogProps {
  open: boolean
  onClose: () => void
  customerOptions: readonly SelectFieldOption[]
  serviceOptions?: readonly SelectFieldOption[] | undefined
  practitionerOptions: readonly SelectFieldOption[]
  employeeOptions?: readonly SelectFieldOption[] | undefined
  branchOptions: readonly SelectFieldOption[]
  /** salon-01: chairs / rooms; empty = the business tracks none and no field shows. */
  resourceOptions?: readonly SelectFieldOption[] | undefined
  hasBranches: boolean
  /**
   * What the picker must SAY when it is empty — from the container, because it
   * is the container that knows whether the read failed (`isError`) or the
   * business simply has nothing. Empty and unread are two different answers.
   */
  customerHint?: string | undefined
  serviceHint?: string | undefined
  practitionerHint?: string | undefined
  /** Fixed when the dialog is opened from one customer's page. */
  presetCustomerId?: string | undefined
}

interface FieldErrors {
  customerId?: string | undefined
  employeeId?: string | undefined
  sessionType?: string | undefined
  sessionDate?: string | undefined
  startTime?: string | undefined
  durationMinutes?: string | undefined
}

/** The field a refusal belongs to. Placement only — the sentence is ours. */
const FIELD_BY_CODE: Record<string, keyof FieldErrors> = {
  CUSTOMER_ID_REQUIRED: 'customerId',
  EMPLOYEE_ID_REQUIRED: 'employeeId',
  SESSION_TYPE_REQUIRED: 'sessionType',
  SESSION_TYPE_TOO_LONG: 'sessionType',
  SERVICE_OR_TITLE_REQUIRED: 'sessionType',
  SERVICE_OFFERING_ID_REQUIRED: 'sessionType',
  EMPLOYEE_SESSION_HAS_CUSTOMER: 'employeeId',
  CUSTOMER_SESSION_HAS_EMPLOYEE: 'customerId',
  SESSION_DATE_REQUIRED: 'sessionDate',
  SESSION_TIMES_REQUIRED: 'startTime',
  SESSION_END_BEFORE_START: 'durationMinutes',
  INVALID_SESSION_TIME_FORMAT: 'startTime',
  PRACTITIONER_ABSENT_ON_SESSION_DATE: 'startTime',
  PRACTITIONER_ON_LEAVE_ON_SESSION_DATE: 'startTime',
  ATTENDANCE_RECORD_DATE_MISMATCH: 'startTime',
  INVALID_SERVICE_DELIVERY_PAYLOAD: 'sessionDate',
  SERVICE_RESOURCE_BUSY: 'startTime',
}

const DEFAULT_DURATION = 30

export function ServiceSessionCreateDialog({ open, ...props }: ServiceSessionCreateDialogProps) {
  // ⚠️ THE BODY IS MOUNTED ONLY WHILE THE DIALOG IS OPEN. A fresh form per
  // opening is a MOUNT, not a reset inside an effect: a half-filled session
  // from last time is how the wrong customer gets the wrong service, and a
  // setState-in-effect is a second render for something React can do once.
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : props.onClose())}>
      <DialogContent data-service-session-create className="max-h-[90vh] overflow-y-auto">
        {open ? <CreateBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateBody({
  onClose,
  customerOptions,
  serviceOptions: _serviceOptions,
  practitionerOptions,
  employeeOptions,
  branchOptions,
  resourceOptions = [],
  hasBranches,
  customerHint,
  serviceHint: _serviceHint,
  practitionerHint,
  presetCustomerId,
}: Omit<ServiceSessionCreateDialogProps, 'open'>) {
  const t = useTranslations()
  const tr = (key: string, fallback: string): string => {
    try {
      const value = t(key as never)
      return value === key ? fallback : value
    } catch {
      return fallback
    }
  }

  const create = useCreateServiceDeliverySession()

  const [subjectType, setSubjectType] = useState<'customer' | 'employee'>('customer')
  const presetOpt = customerOptions.find((o) => o.value === presetCustomerId)
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerOption[]>(() =>
    presetCustomerId && presetOpt
      ? [{ id: presetCustomerId, name: String(presetOpt.label), phone: presetOpt.keywords ?? '' }]
      : [],
  )
  const [employeeId, setEmployeeId] = useState('')
  const [sessionType, setSessionType] = useState('')
  const [practitionerId, setPractitionerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [sessionDate, setSessionDate] = useState(() => toIsoDay(new Date()))
  const [startTime, setStartTime] = useState('09:00')
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION)
  const [clientNotes, setClientNotes] = useState('')

  const [errors, setErrors] = useState<FieldErrors>({})
  const [refusalField, setRefusalField] = useState<keyof FieldErrors | null>(null)
  const [refusalKey, setRefusalKey] = useState<string | null>(null)

  // The end time the person will see, derived once, from the shared helper.
  const endTime = endTimeFor(startTime, durationMinutes)

  const endTimeProblem = (() => {
    if (!endTime) return tr('serviceDelivery.create.invalidDuration', 'مدت یا ساعت شروع معتبر نیست')
    try {
      return calculateSessionDurationMinutes(startTime, endTime) === durationMinutes
        ? null
        : tr('serviceDelivery.create.invalidDuration', 'مدت یا ساعت شروع معتبر نیست')
    } catch {
      return tr('serviceDelivery.create.endBeforeStart', 'پایان جلسه باید بعد از شروع آن باشد')
    }
  })()

  const invalid = (field: keyof FieldErrors): string | undefined =>
    errors[field] ?? (refusalField === field && refusalKey ? tr(refusalKey, refusalKey) : undefined)

  const submit = () => {
    const next: FieldErrors = {}
    if (subjectType === 'customer') {
      if (selectedCustomers.length === 0) {
        next.customerId = tr('serviceDelivery.create.customerRequired', 'مشتری را انتخاب کنید')
      }
    } else {
      if (!employeeId) {
        next.employeeId = tr('serviceDelivery.create.employeeRequired', 'کارمند را انتخاب کنید')
      }
    }
    if (!sessionType.trim()) {
      next.sessionType = tr(
        'serviceDelivery.create.sessionTypeRequired',
        'نام خدمت یا موضوع جلسه را بنویسید',
      )
    } else if (sessionType.trim().length > 120) {
      next.sessionType = tr(
        'serviceDelivery.create.sessionTypeTooLong',
        'عنوان جلسه نمی‌تواند بیش از ۱۲۰ نویسه باشد',
      )
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      next.sessionDate = tr('serviceDelivery.create.dateRequired', 'تاریخ را انتخاب کنید')
    }
    if (!/^\d{1,2}:\d{2}$/.test(startTime)) {
      next.startTime = tr('serviceDelivery.create.timeRequired', 'ساعت شروع را وارد کنید')
    }
    if (endTimeProblem) next.durationMinutes = endTimeProblem

    setErrors(next)
    if (Object.keys(next).length > 0 || !endTime) return

    setRefusalField(null)
    setRefusalKey(null)

    create.mutate(
      {
        subjectType,
        ...(subjectType === 'customer'
          ? {
              customerId: selectedCustomers[0]?.id ?? null,
              customerIds: selectedCustomers.map((c) => c.id),
            }
          : {
              employeeId: employeeId || null,
            }),
        sessionType: sessionType.trim(),
        serviceOfferingId: null,
        sessionDate,
        startTime,
        endTime,
        practitionerId: practitionerId || null,
        branchId: branchId || null,
        ...(resourceId ? { resourceId } : {}),
        clientNotes: clientNotes.trim() || null,
      },
      {
        onSuccess: () => onClose(),
        onError: (error) => {
          const code = serviceDeliveryErrorCode(error)
          const key = serviceDeliveryErrorKey(code)
          // Placement from the server's own field list when it names one;
          // the SENTENCE is always the code-keyed one from our closed list.
          const named = apiErrorFields(error)[0]?.field as keyof FieldErrors | undefined
          const field =
            named && named in FIELD_BY_CODE ? named : code ? FIELD_BY_CODE[code] : undefined
          setRefusalField(field ?? null)
          setRefusalKey(key)
        },
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tr('serviceDelivery.create.title', 'جلسه‌ی جدید')}</DialogTitle>
        <DialogDescription>
          {tr(
            'serviceDelivery.create.help',
            'جلسه با وضعیت «زمان‌بندی‌شده» ساخته می‌شود. تسویه‌ی واقعی هنگام تحویل انتخاب می‌شود.',
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* THE THREE GROUPS SAY WHAT IS A FIELD AND WHAT IS AN OPTION. A form
            that mixes «who is this for», the clock and what happens at
            settlement into one scroll is what made the dialog feel like it had
            nowhere to choose from. */}
        <fieldset className="space-y-2.5">
          <legend className="w-full border-b border-[hsl(var(--border-default))] pb-1.5 text-[11px] font-semibold tracking-wide text-[hsl(var(--fg-tertiary))]">
            {tr('serviceDelivery.create.stepSubject', 'مخاطب جلسه')}
          </legend>
          <div className="space-y-3">
            <SegmentedControl
              branch
              label={tr('serviceDelivery.create.stepSubject', 'مخاطب جلسه')}
              value={subjectType}
              onChange={(v) => {
                setSubjectType(v as 'customer' | 'employee')
                setErrors((prev) => ({ ...prev, customerId: undefined, employeeId: undefined }))
              }}
              options={[
                { value: 'customer', label: tr('serviceDelivery.fields.subjectCustomer', 'مشتری') },
                { value: 'employee', label: tr('serviceDelivery.fields.subjectEmployee', 'پرسنل') },
              ]}
            />

            {subjectType === 'customer' ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
                  {tr('serviceDelivery.fields.customer', 'مشتریان')}
                </label>
                <CustomerMultiPicker
                  value={selectedCustomers}
                  onChange={(nextCustomers) => {
                    setSelectedCustomers(nextCustomers)
                    if (nextCustomers.length > 0) {
                      setErrors((prev) => ({ ...prev, customerId: undefined }))
                    }
                  }}
                  placeholder={tr(
                    'serviceDelivery.fields.pickCustomer',
                    'یک یا چند مشتری انتخاب کنید',
                  )}
                />
                {invalid('customerId') ? (
                  <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                    {invalid('customerId')}
                  </p>
                ) : customerHint ? (
                  <p className="text-xs text-[hsl(var(--fg-tertiary))]">{customerHint}</p>
                ) : null}
              </div>
            ) : (
              <SelectInput
                label={tr('serviceDelivery.fields.employee', 'کارمند')}
                name="employeeId"
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeOptions ?? practitionerOptions}
                error={invalid('employeeId')}
                searchable
                searchPlaceholder={tr('serviceDelivery.fields.search', 'جست‌وجو…')}
                noResultsText={tr('serviceDelivery.fields.noResults', 'چیزی پیدا نشد')}
                placeholder={tr('serviceDelivery.fields.pickEmployee', 'یک کارمند انتخاب کنید')}
              />
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="w-full border-b border-[hsl(var(--border-default))] pb-1.5 text-[11px] font-semibold tracking-wide text-[hsl(var(--fg-tertiary))]">
            {tr('serviceDelivery.fields.serviceOrTitle', 'خدمت / عنوان جلسه')}
          </legend>
          <Labeled
            label={tr('serviceDelivery.fields.serviceOrTitle', 'خدمت / عنوان جلسه')}
            hint={tr(
              'serviceDelivery.fields.serviceOrTitleHint',
              'نام خدمت یا موضوع جلسه را وارد کنید.',
            )}
            error={invalid('sessionType')}
          >
            <input
              type="text"
              name="sessionType"
              value={sessionType}
              onChange={(e) => {
                setSessionType(e.target.value)
                if (e.target.value.trim()) {
                  setErrors((prev) => ({ ...prev, sessionType: undefined }))
                }
              }}
              maxLength={120}
              placeholder={tr(
                'serviceDelivery.fields.serviceOrTitlePlaceholder',
                'مثلاً: مشاوره، آموزش، کوتاهی مو، تعمیر، معاینه...',
              )}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
            />
          </Labeled>
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="text-[11px] font-semibold tracking-wide text-[hsl(var(--fg-tertiary))]">
            {tr('serviceDelivery.create.stepWhen', 'زمان')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled
              label={tr('serviceDelivery.fields.date', 'تاریخ')}
              error={invalid('sessionDate')}
            >
              <JalaliDatePicker
                value={sessionDate}
                onChange={setSessionDate}
                className="w-full"
                data-field="sessionDate"
              />
            </Labeled>
            <TimeInput
              label={tr('serviceDelivery.fields.startTime', 'ساعت شروع')}
              name="startTime"
              value={startTime}
              onChange={setStartTime}
              error={invalid('startTime')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <NumberField
                label={tr('serviceDelivery.fields.duration', 'مدت (دقیقه)')}
                value={durationMinutes}
                onChange={setDurationMinutes}
                min={5}
                max={1440}
              />
              {invalid('durationMinutes') ? (
                <span role="alert" className="block text-xs text-[hsl(var(--color-destructive))]">
                  {invalid('durationMinutes')}
                </span>
              ) : null}
            </div>
            <Labeled
              label={tr('serviceDelivery.fields.endTime', 'ساعت پایان')}
              hint={tr('serviceDelivery.create.endDerived', 'از مدت حساب می‌شود')}
            >
              <p
                dir="ltr"
                data-session-end-time={endTime ?? 'invalid'}
                className="h-10 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-3 pt-2.5 text-sm tabular-nums"
              >
                {endTime ?? tr('serviceDelivery.create.endUnknown', '—')}
              </p>
            </Labeled>
          </div>
        </fieldset>

        {/* Everything that can be left alone. On a phone these are a tall
            scroll away; hiding them behind «بیشتر» makes the two decisions
            that actually have to be made the ones on screen. */}
        <details className="group rounded-xl border border-[hsl(var(--border-default))]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-[hsl(var(--fg-secondary))] transition-colors hover:text-[hsl(var(--fg-primary))]">
            <span>{tr('serviceDelivery.create.moreSummary', 'بیشتر — مجری، شعبه، یادداشت')}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="space-y-3 border-t border-[hsl(var(--border-default))] px-3 pb-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput
                label={tr('serviceDelivery.fields.practitioner', 'مجری')}
                name="practitionerId"
                value={practitionerId}
                onChange={setPractitionerId}
                options={practitionerOptions}
                placeholder={tr('serviceDelivery.fields.none', 'بدون مجری')}
                searchable
                {...(practitionerHint ? { hint: practitionerHint } : {})}
              />
              {resourceOptions.length > 0 ? (
                <SelectInput
                  label={tr('serviceDelivery.fields.resource', 'صندلی / اتاق')}
                  name="resourceId"
                  value={resourceId}
                  onChange={setResourceId}
                  options={resourceOptions}
                  placeholder={tr('serviceDelivery.fields.noResource', 'بدون صندلی/اتاق مشخص')}
                />
              ) : null}
              {hasBranches ? (
                <SelectInput
                  label={tr('serviceDelivery.fields.branch', 'شعبه')}
                  name="branchId"
                  value={branchId}
                  onChange={setBranchId}
                  options={branchOptions}
                  placeholder={tr('serviceDelivery.fields.noBranch', 'بدون شعبه')}
                />
              ) : null}
            </div>

            <Labeled label={tr('serviceDelivery.fields.clientNotes', 'یادداشت برای مشتری')}>
              <textarea
                name="clientNotes"
                value={clientNotes}
                onChange={(event) => setClientNotes(event.target.value)}
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
              />
            </Labeled>
          </div>
        </details>

        {refusalKey && !refusalField ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {tr(refusalKey, refusalKey)}
          </p>
        ) : null}

        {refusalField && refusalKey ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {tr(refusalKey, refusalKey)}
          </p>
        ) : null}
      </div>

      <DialogFooter className="flex items-center justify-end gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            {tr('serviceDelivery.actions.close', 'بستن')}
          </Button>
          <Button onClick={submit} disabled={create.isPending || Boolean(endTimeProblem)}>
            {create.isPending
              ? tr('serviceDelivery.actions.saving', 'در حال ذخیره…')
              : tr('serviceDelivery.actions.create', 'ساختن جلسه')}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
