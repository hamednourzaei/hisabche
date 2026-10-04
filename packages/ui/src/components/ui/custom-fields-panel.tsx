'use client'

// ============================================
// «فیلدهای اختصاصی» — a business's own fields on this customer, supplier or
// product (#141–#143). Drop it on any page that shows one of them.
//
// Filling the fields in is for everyone who works with the record; deciding
// which fields exist is a manager's decision (the server enforces it — the
// form here is shown to all and a refusal is said in words).
//
// ⚠️ A formula field is read-only, and when it cannot be computed for this
// record it says WHY («یکی از فیلدها خالی است») — it is never shown as 0.
// ⚠️ A field is retired, never deleted: what was entered under it is kept.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useCustomFieldRecord,
  useDefineCustomField,
  useSaveCustomFieldValues,
  useSetCustomFieldActive,
  type CustomField,
  type CustomFieldEntity,
  type CustomFieldType,
  type CustomFieldValue,
} from '@hisabche/api'

import { cn } from '../../lib/utils'
import { useIntlLocale } from '../../hooks/use-intl-locale'
import { Button } from './button'
import { JalaliDatePicker } from './jalali-datepicker'
import { SelectField } from './select-field'

export const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'choice',
  'formula',
] as const
/** Refusals with a translation; `:key` suffixes are stripped before the lookup. */
export const CUSTOM_FIELD_ERROR_CODES = [
  'CUSTOM_FIELD_INVALID',
  'CUSTOM_FIELD_REQUIRED',
  'CUSTOM_FIELD_UNKNOWN',
  'CUSTOM_FIELD_KEY_TAKEN',
  'CUSTOM_FIELD_LIMIT_REACHED',
  'CUSTOM_FIELD_CHOICES_REQUIRED',
  'CUSTOM_FIELD_FORMULA_EMPTY',
  'CUSTOM_FIELD_FORMULA_UNKNOWN_FIELD',
  'CUSTOM_FIELD_FORMULA_UNKNOWN_OPERATOR',
  'CUSTOM_FIELD_FORMULA_UNBALANCED',
  'CUSTOM_FIELDS_MIGRATION_PENDING',
] as const
export const CUSTOM_FIELD_FORMULA_PROBLEMS = [
  'MISSING_VALUE',
  'DIVIDE_BY_ZERO',
  'NOT_A_NUMBER',
  'UNKNOWN_FIELD',
  'UNKNOWN_OPERATOR',
  'UNBALANCED',
  'EMPTY',
] as const

const input =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'

export function CustomFieldsPanel({
  entity,
  entityId,
  className,
}: {
  entity: CustomFieldEntity
  entityId: string
  className?: string | undefined
}) {
  const t = useTranslations('customFields')
  const locale = useIntlLocale()
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const record = useCustomFieldRecord(entity, entityId, open)
  const save = useSaveCustomFieldValues(entity, entityId)
  const retire = useSetCustomFieldActive(entity)
  // What the person has typed since the last save, on top of what is stored.
  // Derived, not copied in an effect: after a save the stored values change and
  // the edits are cleared, so the form shows exactly what the server kept.
  const [edits, setEdits] = useState<Record<string, CustomFieldValue>>({})
  const stored = record.data?.values
  const draft: Record<string, CustomFieldValue> = { ...(stored ?? {}), ...edits }

  const message = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403)
      return t('forbidden')
    const raw = apiErrorMessage(error, '')
    const code = CUSTOM_FIELD_ERROR_CODES.find((known) => raw.includes(known))
    if (!code) return t('errors.general')
    // «CUSTOM_FIELD_INVALID:visits» names the field; say its label.
    const key = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1).trim() : ''
    const named = record.data?.fields.find((field) => field.key === key)?.label
    return named ? `${t(`errors.${code}`)} (${named})` : t(`errors.${code}`)
  }

  const set = (key: string, value: CustomFieldValue) =>
    setEdits((current) => ({ ...current, [key]: value }))
  const dirty = !!stored && JSON.stringify(draft) !== JSON.stringify(stored)

  const control = (field: CustomField) => {
    const value = draft[field.key] ?? null
    switch (field.type) {
      case 'number':
        return (
          <input
            name={field.key}
            inputMode="decimal"
            dir="ltr"
            value={value === null ? '' : String(value)}
            onChange={(event) => {
              const text = event.target.value
              // Kept as typed until it is a number; empty is null, never 0.
              set(
                field.key,
                text.trim() === '' ? null : Number.isFinite(Number(text)) ? Number(text) : text,
              )
            }}
            className={cn(input, 'tabular-nums')}
          />
        )
      case 'boolean':
        return (
          <label className="flex h-10 items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
            <input
              type="checkbox"
              name={field.key}
              checked={value === true}
              onChange={(event) => set(field.key, event.target.checked)}
            />
            {value === true ? t('yes') : t('no')}
          </label>
        )
      case 'date':
        return (
          <div data-field={field.key}>
            <JalaliDatePicker
              value={typeof value === 'string' ? value : ''}
              onChange={(next) => set(field.key, next || null)}
              placeholder={t('empty')}
            />
          </div>
        )
      case 'choice':
        return (
          <SelectField
            name={field.key}
            data-field={field.key}
            aria-label={field.label}
            value={typeof value === 'string' ? value : ''}
            onChange={(next) => set(field.key, next || null)}
            placeholder={t('empty')}
            options={(field.choices ?? []).map((choice) => ({ value: choice, label: choice }))}
            className={input}
          />
        )
      case 'formula': {
        const result = record.data?.computed[field.key]
        return (
          <p className="flex h-10 items-center text-sm tabular-nums text-[hsl(var(--fg-primary))]">
            {result?.ok ? (
              formatNumber(result.value, locale, 2)
            ) : (
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                {result &&
                (CUSTOM_FIELD_FORMULA_PROBLEMS as readonly string[]).includes(result.code)
                  ? t(`formulaProblems.${result.code}`)
                  : t('formulaProblems.NOT_A_NUMBER')}
              </span>
            )}
          </p>
        )
      }
      default:
        return (
          <input
            name={field.key}
            value={typeof value === 'string' ? value : ''}
            maxLength={500}
            onChange={(event) =>
              set(field.key, event.target.value === '' ? null : event.target.value)
            }
            className={input}
          />
        )
    }
  }

  return (
    <section
      className={cn(
        'space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
          <SlidersHorizontal
            className="size-4 text-[hsl(var(--color-primary))]"
            aria-hidden="true"
          />
          {t('title')}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && record.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : null}
      {open && record.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {message(record.error)}
        </p>
      ) : null}

      {open && record.data ? (
        <>
          {record.data.fields.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t(`none.${entity}`)}</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {record.data.fields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <span className={label}>
                      {field.label}
                      {field.required ? ' *' : ''}
                      {field.type === 'formula' ? ` · ${t('computed')}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">{control(field)}</div>
                      {managing ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={retire.isPending && retire.variables?.id === field.id}
                          onClick={() => retire.mutate({ id: field.id, isActive: false })}
                        >
                          {t('retire')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate(draft, { onSuccess: () => setEdits({}) })}
                >
                  {t('save')}
                </Button>
                {save.isSuccess && !dirty ? (
                  <span className="text-xs text-[hsl(var(--color-success))]">{t('saved')}</span>
                ) : null}
              </div>
            </>
          )}
          {save.error || retire.error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {message(save.error ?? retire.error)}
            </p>
          ) : null}

          <div className="border-t border-[hsl(var(--border-default))] pt-3">
            <Button size="sm" variant="outline" onClick={() => setManaging((value) => !value)}>
              {managing ? t('doneManaging') : t('manage')}
            </Button>
            {managing ? (
              <DefineField
                entity={entity}
                numberKeys={record.data.fields
                  .filter((f) => f.type === 'number' || f.type === 'boolean')
                  .map((f) => f.key)}
                message={message}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

function DefineField({
  entity,
  numberKeys,
  message,
}: {
  entity: CustomFieldEntity
  numberKeys: string[]
  message: (error: unknown) => string
}) {
  const t = useTranslations('customFields')
  const define = useDefineCustomField(entity)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [choices, setChoices] = useState('')
  const [formula, setFormula] = useState('')
  const [required, setRequired] = useState(false)

  const keyValid = /^[a-z][a-z0-9_]{0,39}$/.test(key)

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('manageHint')}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className={label}>{t('fieldLabel')}</span>
          <input
            name="label"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            className={input}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>{t('fieldKey')}</span>
          <input
            name="key"
            dir="ltr"
            value={key}
            maxLength={40}
            onChange={(event) => setKey(event.target.value.toLowerCase())}
            placeholder="visits_per_month"
            className={input}
          />
        </label>
        <div className="space-y-1">
          <span className={label}>{t('fieldType')}</span>
          <SelectField
            name="type"
            data-field="type"
            aria-label={t('fieldType')}
            value={type}
            onChange={(next) => setType(next as CustomFieldType)}
            options={CUSTOM_FIELD_TYPES.map((option) => ({
              value: option,
              label: t(`types.${option}`),
            }))}
            className={input}
          />
        </div>
      </div>
      {key !== '' && !keyValid ? (
        <p className="text-xs text-[hsl(var(--color-destructive))]">{t('keyRule')}</p>
      ) : null}

      {type === 'choice' ? (
        <label className="block space-y-1">
          <span className={label}>{t('choices')}</span>
          <input
            name="choices"
            value={choices}
            onChange={(event) => setChoices(event.target.value)}
            className={input}
          />
        </label>
      ) : null}
      {type === 'formula' ? (
        <label className="block space-y-1">
          <span className={label}>{t('formula')}</span>
          <input
            name="formula"
            dir="ltr"
            value={formula}
            maxLength={300}
            onChange={(event) => setFormula(event.target.value)}
            className={cn(input, 'font-mono')}
          />
          <span className="block text-xs text-[hsl(var(--fg-tertiary))]" dir="auto">
            {numberKeys.length > 0
              ? `${t('formulaHint')} ${numberKeys.join(', ')}`
              : t('formulaNoNumbers')}
          </span>
        </label>
      ) : (
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
          <input
            type="checkbox"
            name="required"
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
          />
          {t('required')}
        </label>
      )}

      {define.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {message(define.error)}
        </p>
      ) : null}
      <Button
        size="sm"
        disabled={define.isPending || !keyValid || name.trim() === ''}
        onClick={() =>
          define.mutate(
            {
              key,
              label: name,
              type,
              choices:
                type === 'choice'
                  ? choices
                      .split(/[,،\n]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  : null,
              formula: type === 'formula' ? formula : null,
              required: type === 'formula' ? false : required,
            },
            {
              onSuccess: () => {
                setKey('')
                setName('')
                setChoices('')
                setFormula('')
                setRequired(false)
              },
            },
          )
        }
      >
        {t('addField')}
      </Button>
    </div>
  )
}
