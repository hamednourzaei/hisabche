'use client'

// ============================================
// «خواندن سند» — read a photographed receipt or bill into a draft (#16).
//
// Three steps, and the middle one is a person:
//   1. pick a picture → the server reads it and returns a DRAFT. Nothing is
//      written.
//   2. the person checks every field against the paper and corrects it. Each
//      field shows how sure the reading was.
//   3. «ثبت فاکتور خرید» records ONE purchase invoice with the figures on the
//      screen — the person's, not the model's.
//
// ⚠️ THE TOTAL HAS ITS CURRENCY, chosen here. A currency printed on the paper
// is offered as the starting choice and said to be a reading.
// ⚠️ THE DATE IS PICKED, NOT PARSED. The paper may be in any calendar; what was
// printed is shown beside the picker, and the person sets the day.
// ⚠️ THE SUPPLIER IS CHOSEN from the business's own suppliers. The name on the
// paper only starts the search — a bill is never recorded against a guess.
// ⚠️ The picture is not kept, here or on the server.
// ============================================

import { useState, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import { CURRENCY_CODES } from '@hisabche/validation'
import {
  apiErrorMessage,
  useConfirmDocument,
  useReadDocument,
  useSupplierSearch,
  type DocumentReading,
  type ReadConfidence,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SelectField } from '../select-field'

export const READABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** The server's limit for a picture, checked here so the refusal is not a round trip. */
export const READABLE_MAX_BYTES = 4 * 1024 * 1024

/** Refusals with a translation. Anything else gets the general message. */
export const INGEST_ERROR_CODES = [
  'INGEST_NO_PROVIDER',
  'INGEST_UNSUPPORTED_TYPE',
  'INGEST_TOO_LARGE',
  'INGEST_UNREADABLE',
  'INGEST_TOTAL_TOO_SMALL',
  'AI_QUOTA_EXCEEDED',
  'AI_PROVIDER_BUSY',
  'AI_PROVIDER_ERROR',
] as const

const CONFIDENCES = ['high', 'medium', 'low'] as const
const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--fg-secondary))]'
const faint = 'text-xs text-[hsl(var(--fg-tertiary))]'
const danger = 'text-sm text-[hsl(var(--color-destructive))]'

/** The picture as base64, without the `data:` prefix. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

export function DocumentReadTool({ topupContact }: { topupContact?: string | undefined }) {
  const t = useTranslations('aiRead')
  const read = useReadDocument()
  const [reading, setReading] = useState<{ result: DocumentReading; requestId: string } | null>(
    null,
  )
  const [problem, setProblem] = useState<string | null>(null)

  const errorText = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = INGEST_ERROR_CODES.find((known) => raw.includes(known))
    if (code === 'AI_QUOTA_EXCEEDED')
      return `${t('errors.AI_QUOTA_EXCEEDED')} ${topupContact ?? ''}`
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // The same file can be picked again after a refusal.
    event.target.value = ''
    if (!file) return
    setReading(null)
    read.reset()
    if (!(READABLE_TYPES as readonly string[]).includes(file.type)) {
      setProblem(t('errors.INGEST_UNSUPPORTED_TYPE'))
      return
    }
    if (file.size > READABLE_MAX_BYTES) {
      setProblem(t('errors.INGEST_TOO_LARGE'))
      return
    }
    setProblem(null)
    try {
      const data = await toBase64(file)
      read.mutate(
        { contentType: file.type, data },
        { onSuccess: (result) => setReading({ result, requestId: crypto.randomUUID() }) },
      )
    } catch {
      setProblem(t('errors.general'))
    }
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('intro')}</p>

      <label className="block space-y-1">
        <span className={label}>{t('pick')}</span>
        <input
          type="file"
          name="document"
          accept={READABLE_TYPES.join(',')}
          disabled={read.isPending}
          onChange={pick}
          className="block w-full text-sm text-[hsl(var(--fg-primary))]"
        />
        <span className={faint}>{t('pickHint')}</span>
      </label>

      {read.isPending ? (
        <p role="status" className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('reading')}
        </p>
      ) : null}
      {problem || read.error ? (
        <p role="alert" className={danger}>
          {problem ?? errorText(read.error)}
        </p>
      ) : null}

      {reading && !read.isPending ? (
        <ReviewForm
          key={reading.requestId}
          reading={reading.result}
          requestId={reading.requestId}
          errorText={errorText}
          onAnother={() => setReading(null)}
        />
      ) : null}

      <p className={faint}>{t('note')}</p>
    </div>
  )
}

function ReviewForm({
  reading,
  requestId,
  errorText,
  onAnother,
}: {
  reading: DocumentReading
  requestId: string
  errorText: (error: unknown) => string
  onAnother: () => void
}) {
  const t = useTranslations('aiRead')
  const tCurrency = useTranslations('currency')
  const locale = useIntlLocale()
  const push = useLocalePush()
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const confirm = useConfirmDocument()
  const { fields } = reading.draft

  const [total, setTotal] = useState(String(fields.totalMinor.value / 100))
  const [currency, setCurrency] = useState<string>(reading.currency ?? primaryCurrency)
  const [issuedOn, setIssuedOn] = useState(() => toIsoDay(new Date()))
  const [documentNumber, setDocumentNumber] = useState(fields.documentNumber?.value ?? '')
  const [description, setDescription] = useState(
    fields.documentNumber?.value
      ? t('defaultDescriptionNumbered', { number: fields.documentNumber.value })
      : t('defaultDescription'),
  )
  const [supplierSearch, setSupplierSearch] = useState(fields.supplierName?.value ?? '')
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(null)
  const suppliers = useSupplierSearch(supplierSearch)

  const amount = Number(total)
  const amountOk = total.trim() !== '' && Number.isFinite(amount) && amount > 0
  const ready = amountOk && supplier !== null && issuedOn !== '' && description.trim() !== ''

  const badge = (confidence: ReadConfidence | undefined) => {
    const level = CONFIDENCES.find((known) => known === confidence)
    if (!level) return <span className={faint}>{t('notRead')}</span>
    return (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-medium',
          level === 'high'
            ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
            : level === 'medium'
              ? 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]'
              : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
        )}
      >
        {t(`confidence.${level}`)}
      </span>
    )
  }

  if (confirm.data) {
    const invoiceId = confirm.data.invoiceId
    return (
      <section className="space-y-3 border-t border-[hsl(var(--border-default))] pt-4">
        <p role="status" className="text-sm font-medium text-[hsl(var(--color-success))]">
          {t('recorded')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => push(`/invoices/${invoiceId}`)}>
            {t('openInvoice')}
          </Button>
          <Button size="sm" variant="outline" onClick={onAnother}>
            {t('another')}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 border-t border-[hsl(var(--border-default))] pt-4">
      <div>
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('reviewTitle')}</h2>
        <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{t('reviewHint')}</p>
      </div>

      {fields.totalMinor.confidence === 'low' ? (
        <p role="alert" className={danger}>
          {t('lowTotal')}
        </p>
      ) : null}
      {reading.draft.kind === 'unknown' ? (
        <p className="text-sm text-[hsl(var(--fg-primary))]">{t('unknownKind')}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className={label}>
            {t('total')} {badge(fields.totalMinor.confidence)}
          </span>
          <input
            name="total"
            inputMode="decimal"
            dir="ltr"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            className={cn(field, 'tabular-nums')}
          />
          {fields.totalMinor.raw ? (
            <span className={faint}>{t('printedAs', { text: fields.totalMinor.raw })}</span>
          ) : null}
        </label>

        <div className="space-y-1">
          <span className={label}>{t('currency')}</span>
          <SelectField
            name="currency"
            data-field="currency"
            aria-label={t('currency')}
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_CODES.map((code) => ({
              value: code,
              label: `${tCurrency(code.toLowerCase())} (${code})`,
            }))}
            className={field}
          />
          <span className={faint}>
            {reading.currency
              ? t('currencyRead', { currency: reading.currency })
              : t('currencyNotRead')}
          </span>
        </div>

        <div className="space-y-1" data-field="issuedOn">
          <span className={label}>
            {t('issuedOn')} {badge(fields.issuedOn?.confidence)}
          </span>
          <JalaliDatePicker value={issuedOn} onChange={setIssuedOn} />
          <span className={faint}>
            {fields.issuedOn ? t('printedAs', { text: fields.issuedOn.value }) : t('dateNotRead')}
          </span>
        </div>

        <label className="space-y-1">
          <span className={label}>
            {t('documentNumber')} {badge(fields.documentNumber?.confidence)}
          </span>
          <input
            name="documentNumber"
            dir="auto"
            maxLength={80}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            className={field}
          />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className={label}>{t('description')}</span>
          <input
            name="description"
            dir="auto"
            maxLength={120}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="space-y-2" data-field="supplierId">
        <span className={label}>
          {t('supplier')} {badge(fields.supplierName?.confidence)}
        </span>
        {fields.supplierName ? (
          <span className={cn('block', faint)}>
            {t('printedAs', { text: fields.supplierName.value })}
          </span>
        ) : null}
        {supplier ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-[hsl(var(--fg-primary))]">{supplier.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setSupplier(null)}>
              {t('changeSupplier')}
            </Button>
          </div>
        ) : (
          <>
            <input
              value={supplierSearch}
              onChange={(event) => setSupplierSearch(event.target.value)}
              placeholder={t('searchSupplier')}
              aria-label={t('searchSupplier')}
              className={field}
            />
            {supplierSearch.trim().length < 2 ? (
              <p className={faint}>{t('searchSupplierHint')}</p>
            ) : suppliers.isError ? (
              <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                {t('searchFailed')}
              </p>
            ) : suppliers.isFetching ? (
              <p className={faint}>{t('searching')}</p>
            ) : (suppliers.data ?? []).length === 0 ? (
              <p className={faint}>{t('noSupplierFound')}</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {(suppliers.data ?? []).map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setSupplier(option)}
                      className="min-h-11 w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
                    >
                      {option.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {fields.taxMinor ? (
        <p className={faint}>
          {t('taxRead', { amount: formatNumber(fields.taxMinor.value / 100, locale, 2) })}
        </p>
      ) : null}

      {fields.unrecognisedLines.length > 0 ? (
        <div className="space-y-1">
          <p className={label}>{t('unrecognised')}</p>
          <ul className="space-y-0.5 text-xs text-[hsl(var(--fg-secondary))]">
            {fields.unrecognisedLines.map((line, index) => (
              <li key={`${index}-${line}`} dir="auto">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirm.error ? (
        <p role="alert" className={danger}>
          {errorText(confirm.error)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!ready || confirm.isPending}
          onClick={() =>
            supplier &&
            confirm.mutate({
              requestId,
              supplierId: supplier.id,
              currency,
              issuedOn,
              total: amount,
              description: description.trim(),
              documentNumber: documentNumber.trim() || null,
            })
          }
        >
          {amountOk
            ? t('record', { amount: formatNumber(amount, locale, 2), currency })
            : t('recordPlain')}
        </Button>
        <Button variant="ghost" onClick={onAnother}>
          {t('discard')}
        </Button>
      </div>
      {!supplier ? <p className={faint}>{t('needSupplier')}</p> : null}
    </section>
  )
}
