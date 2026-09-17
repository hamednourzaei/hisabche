'use client'

// ============================================
// CustomerProfilePanel — Customer 360 phase 3.
//
// Credit limit, payment terms, the supplier this customer also is, and the
// customer's documents. Everything comes from the Customer Profile Core
// (GET /customers/:id/profile, /documents); credit used is the server's
// receivable, never a browser total.
//
// Until the migration has been run the server answers `configured: false` /
// `available: false`, and this panel says so instead of offering a form that
// could not save.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, FileText, Link2, Trash2, Upload } from 'lucide-react'
import {
  fetchCustomerDocumentUrl,
  useCustomerDocuments,
  useCustomerProfile,
  useRemoveCustomerDocument,
  useSupplierSearch,
  useUpdateCustomerTerms,
  useUploadCustomerDocument,
} from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

const card =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'
const input =
  'min-h-10 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]'
const button =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--border-default))] px-4 text-sm font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] disabled:opacity-50'
const primary =
  'inline-flex min-h-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50'

export interface CustomerProfilePanelProps {
  customerId: string
  formatMoney: (value: number) => string
  className?: string | undefined
}

const errorCode = (err: unknown) => {
  const data = (err as { response?: { data?: { code?: string } } })?.response?.data
  return data?.code ?? ''
}

export function CustomerProfilePanel({
  customerId,
  formatMoney,
  className,
}: CustomerProfilePanelProps) {
  const t = useTranslations('customerProfile')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const profile = useCustomerProfile(customerId)
  const documents = useCustomerDocuments(customerId)
  const updateTerms = useUpdateCustomerTerms(customerId)
  const upload = useUploadCustomerDocument(customerId)
  const remove = useRemoveCustomerDocument(customerId)

  const [limit, setLimit] = useState('')
  const [terms, setTerms] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const suppliers = useSupplierSearch(search)

  const data = profile.data
  useEffect(() => {
    if (!data) return
    setLimit(data.creditLimit === null ? '' : String(data.creditLimit))
    setTerms(data.paymentTermsDays === null ? '' : String(data.paymentTermsDays))
  }, [data])

  const fail = (err: unknown) => {
    const code = errorCode(err)
    const known = [
      'CUSTOMER_PROFILE_MIGRATION_PENDING',
      'CUSTOMER_SUPPLIER_ALREADY_LINKED',
      'CUSTOMER_DOCUMENT_TYPE_NOT_ALLOWED',
      'CUSTOMER_DOCUMENT_TOO_LARGE',
    ]
    setMessage({
      tone: 'error',
      text: known.includes(code) ? t(`errors.${code}`) : t('errors.generic'),
    })
  }

  const saveTerms = () => {
    const creditLimit = limit.trim() === '' ? null : Number(limit)
    const paymentTermsDays = terms.trim() === '' ? null : Number(terms)
    if (
      (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) ||
      (paymentTermsDays !== null &&
        (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 3650))
    ) {
      setMessage({ tone: 'error', text: t('errors.invalidTerms') })
      return
    }
    updateTerms.mutate(
      { creditLimit, paymentTermsDays },
      { onSuccess: () => setMessage({ tone: 'ok', text: t('saved') }), onError: fail },
    )
  }

  const linkSupplier = (supplierId: string | null) =>
    updateTerms.mutate(
      { supplierId },
      {
        onSuccess: () => {
          setSearch('')
          setMessage({ tone: 'ok', text: t('saved') })
        },
        onError: fail,
      },
    )

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setMessage({ tone: 'error', text: t('errors.CUSTOMER_DOCUMENT_TOO_LARGE') })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      upload.mutate(
        {
          fileName: file.name,
          mimeType: file.type,
          contentBase64: result.slice(result.indexOf(',') + 1),
        },
        { onSuccess: () => setMessage({ tone: 'ok', text: t('uploaded') }), onError: fail },
      )
    }
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const openDocument = async (documentId: string) => {
    try {
      const url = await fetchCustomerDocumentUrl(customerId, documentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      fail(err)
    }
  }

  if (profile.isLoading) {
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
    )
  }
  if (profile.isError || !data) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-[hsl(var(--color-destructive))]"
      >
        {t('loadError')}
        <button type="button" onClick={() => void profile.refetch()} className={button}>
          {t('retry')}
        </button>
      </div>
    )
  }

  return (
    <section className={cn('space-y-4', className)}>
      {!data.configured && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-[hsl(var(--color-warning)/0.12)] p-3 text-sm text-[hsl(var(--fg-primary))]"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-warning))]"
            aria-hidden="true"
          />
          {t('notConfigured')}
        </p>
      )}

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            message.tone === 'error'
              ? 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]'
              : 'bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
          )}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Credit control ─────────────────────────────────── */}
        <div className={card}>
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('creditTitle')}
          </h3>
          {data.credit ? (
            <div className="mt-3 space-y-2">
              <div
                className="h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, data.credit.usedPercent)}
                aria-label={t('creditUsed')}
              >
                <div
                  className={cn(
                    'h-full rounded-full',
                    data.credit.overLimit
                      ? 'bg-[hsl(var(--color-destructive))]'
                      : data.credit.usedPercent >= 80
                        ? 'bg-[hsl(var(--color-warning))]'
                        : 'bg-[hsl(var(--color-success))]',
                  )}
                  style={{ width: `${Math.min(100, data.credit.usedPercent)}%` }}
                />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t('creditLimit')}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(data.credit.creditLimit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t('creditUsed')}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(data.credit.used)} ({formatNumber(data.credit.usedPercent, locale)}
                    %)
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t('creditAvailable')}</dt>
                  <dd
                    className={cn(
                      'font-medium tabular-nums',
                      data.credit.overLimit && 'text-[hsl(var(--color-destructive))]',
                    )}
                  >
                    {formatMoney(data.credit.available)}
                  </dd>
                </div>
              </dl>
              {data.credit.overLimit && (
                <p className="text-sm font-medium text-[hsl(var(--color-destructive))]">
                  {t('overLimit')}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">{t('noLimit')}</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
              <span>{t('creditLimitInput')}</span>
              <input
                id="customer-credit-limit"
                type="number"
                min={0}
                inputMode="decimal"
                dir="ltr"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                disabled={!data.configured}
                className={input}
              />
            </label>
            <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
              <span>{t('paymentTermsInput')}</span>
              <input
                id="customer-payment-terms"
                type="number"
                min={0}
                max={3650}
                inputMode="numeric"
                dir="ltr"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                disabled={!data.configured}
                className={input}
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">{t('emptyMeansNone')}</p>
          <button
            type="button"
            onClick={saveTerms}
            disabled={!data.configured || updateTerms.isPending}
            className={cn(primary, 'mt-3')}
          >
            {t('save')}
          </button>
        </div>

        {/* ── Same party as a supplier ───────────────────────── */}
        <div className={card}>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--fg-primary))]">
            <Link2 className="size-4" aria-hidden="true" />
            {t('supplierTitle')}
          </h3>
          {data.linkedSupplier ? (
            <div className="mt-3 space-y-3 text-sm">
              <p>
                {t('linkedTo')}: <span className="font-medium">{data.linkedSupplier.name}</span>
              </p>
              {data.combined && (
                <dl className="grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t('asCustomer')}</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney(data.combined.customerNet)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t('asSupplier')}</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney(data.combined.supplierPayable)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t('combinedNet')}</dt>
                    <dd className="font-bold tabular-nums">{formatMoney(data.combined.net)}</dd>
                  </div>
                </dl>
              )}
              {data.combined?.mixedCurrencies && (
                <p className="text-xs text-[hsl(var(--color-warning))]">{t('mixedCurrencies')}</p>
              )}
              <button
                type="button"
                onClick={() => linkSupplier(null)}
                disabled={updateTerms.isPending}
                className={button}
              >
                {t('unlink')}
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('supplierHint')}</p>
              <input
                id="customer-supplier-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchSupplier')}
                disabled={!data.configured}
                className={input}
              />
              {search.trim().length >= 2 && (
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-[hsl(var(--border-default))]">
                  {(suppliers.data ?? []).length === 0 ? (
                    <li className="px-3 py-2 text-sm text-[hsl(var(--fg-tertiary))]">
                      {suppliers.isLoading ? t('loading') : t('noSuppliers')}
                    </li>
                  ) : (
                    (suppliers.data ?? []).map((supplier) => (
                      <li key={supplier.id}>
                        <button
                          type="button"
                          onClick={() => linkSupplier(supplier.id)}
                          className="w-full px-3 py-2 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
                        >
                          {supplier.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Documents ─────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('documentsTitle')}
          </h3>
          <input
            id="customer-document-file"
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!documents.data?.available || upload.isPending}
            className={button}
          >
            <Upload className="size-4" aria-hidden="true" />
            {upload.isPending ? t('uploading') : t('upload')}
          </button>
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">{t('uploadHint')}</p>

        {documents.isLoading ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
        ) : documents.isError ? (
          <p role="alert" className="py-6 text-center text-sm text-[hsl(var(--color-destructive))]">
            {t('loadError')}
          </p>
        ) : !documents.data?.available ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('notConfigured')}
          </p>
        ) : documents.data.documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('noDocuments')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[hsl(var(--border-default)/0.6)]">
            {documents.data.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => void openDocument(doc.id)}
                  className="flex min-w-0 items-center gap-2 text-start hover:underline"
                >
                  <FileText
                    className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
                    aria-hidden="true"
                  />
                  <span className="truncate">{doc.fileName}</span>
                </button>
                <span className="flex shrink-0 items-center gap-3 text-xs text-[hsl(var(--fg-tertiary))]">
                  <span className="tabular-nums">
                    {formatNumber(Math.ceil(doc.sizeBytes / 1024), locale)} KB
                  </span>
                  <span>{date(doc.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('confirmRemove')))
                        remove.mutate(doc.id, { onError: fail })
                    }}
                    aria-label={t('remove')}
                    className="rounded-full p-1.5 text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--surface-muted))]"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
