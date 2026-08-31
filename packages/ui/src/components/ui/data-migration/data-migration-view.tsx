'use client'

// ============================================
// packages/ui/src/components/ui/data-migration/data-migration-view.tsx
//
// Bringing an existing business into Hisabche.
//
// ---------------------------------------------------------------------------
// THE WIZARD IS ONE PAGE, NOT SIX
//
// Each step appears below the last as it completes, so the user can always see
// what they chose two steps ago. A migration is a decision made on evidence —
// hiding the discovery counts behind a "back" button while asking someone to
// approve a commit is how a wrong import gets approved.
//
// ---------------------------------------------------------------------------
// NOTHING HERE INVENTS A NUMBER
//
// Every count on screen comes from the server: the discovery counts from the
// parse, the findings from validation, the create/update figures from the dry
// run, the reconciliation from the ledger after the commit. There is no
// progress animation, because the work is synchronous and a spinner that
// implies otherwise would be the fake progress the directive forbids.
// ============================================

import { memo, useMemo, useRef, useState } from 'react'
import type { DryRunSummary, Finding, MigrationEntity, MigrationJob } from '@hisabche/api'

import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Loading,
  Money,
  Panel,
  SelectField,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Tone,
} from '../capability/capability-kit'
import { EmptyState } from '../empty-state'

export interface DataMigrationViewProps {
  t: (key: string, fallback?: string) => string
  history: MigrationJob[]
  job: MigrationJob | null
  targetFields: string[]
  isLoading: boolean
  isBusy: boolean
  error: string | null
  actionError: string | null
  fileName: string | null
  dryRun: DryRunSummary | null
  findings: Finding[]
  onPickFile: (file: File) => void
  onEntityChange: (entity: MigrationEntity) => void
  entity: MigrationEntity
  onMappingChange: (field: string, column: number | null) => void
  onDryRun: () => void
  onCommit: () => void
  onCancel: () => void
  onReset: () => void
  onRefresh: () => void
}

const STATUS_TONE: Record<string, Tone> = {
  completed: 'good',
  completed_with_warnings: 'warn',
  failed: 'bad',
  cancelled: 'neutral',
  ready: 'info',
  importing: 'info',
}

const SEVERITY_TONE: Record<string, Tone> = {
  fatal: 'bad',
  warning: 'warn',
  info: 'neutral',
}

/** Findings shown at once. The rest are counted, never silently dropped. */
const FINDINGS_SHOWN = 50

export const DataMigrationView = memo(function DataMigrationView({
  t,
  history,
  job,
  targetFields,
  isLoading,
  isBusy,
  error,
  actionError,
  fileName,
  dryRun,
  findings,
  onPickFile,
  onEntityChange,
  entity,
  onMappingChange,
  onDryRun,
  onCommit,
  onCancel,
  onReset,
  onRefresh,
}: DataMigrationViewProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmed, setConfirmed] = useState(false)

  const discovery = job?.discovery ?? null

  const columnOptions = useMemo(
    () => [
      { value: '__none', label: t('migration.column_none', 'وارد نشود') },
      ...(discovery?.headers ?? []).map((header, index) => ({
        value: String(index),
        label: header || t('migration.column_unnamed', 'ستون بی‌نام'),
      })),
    ],
    [discovery, t],
  )

  const fatalCount = findings.filter((finding) => finding.severity === 'fatal').length
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length
  const infoCount = findings.filter((finding) => finding.severity === 'info').length

  const committed =
    job?.status === 'completed' ||
    job?.status === 'completed_with_warnings' ||
    job?.status === 'failed' ||
    job?.status === 'cancelled'

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('migration.title', 'انتقال داده')}
        description={t(
          'migration.subtitle',
          'کسب‌وکاری که دارید را وارد حسابچه کنید — با پیش‌نمایش پیش از ثبت.',
        )}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      {/* ─── Step 1 — what, and from where ──────────────────────────────── */}

      <Panel title={t('migration.step_source', '۱ — منبع داده')}>
        <div className="space-y-4">
          <SelectField
            label={t('migration.entity', 'چه چیزی وارد می‌شود؟')}
            value={entity}
            onChange={(value) => onEntityChange(value as MigrationEntity)}
            disabled={Boolean(job)}
            options={[
              { value: 'customer', label: t('migration.entity_customer', 'مشتریان') },
              { value: 'product', label: t('migration.entity_product', 'کالاها') },
            ]}
          />

          <div className="space-y-2">
            <p className="text-sm text-[hsl(var(--fg-tertiary))]">
              {t(
                'migration.format_hint',
                'فایل CSV یا TSV با کدگذاری UTF-8. فایل اکسل را از خود اکسل با «ذخیره به‌صورت CSV» بگیرید.',
              )}
            </p>

            {/* The native input is never shown: it cannot be styled, and its
                own button carries an untranslatable OS label. The project's
                own Button opens it. */}
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onPickFile(file)
                // Cleared so choosing the SAME file twice fires again — after
                // the user edits it in a spreadsheet and retries.
                event.target.value = ''
              }}
            />

            <div className="flex flex-wrap items-center gap-3">
              <ActionButton onClick={() => fileInput.current?.click()} disabled={isBusy}>
                {t('migration.choose_file', 'انتخاب فایل')}
              </ActionButton>

              {fileName ? (
                <span className="text-sm text-[hsl(var(--fg-secondary))]" dir="auto">
                  {fileName}
                </span>
              ) : null}

              {job ? (
                <ActionButton variant="quiet" onClick={onReset} disabled={isBusy}>
                  {t('migration.start_over', 'شروع دوباره')}
                </ActionButton>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      {isBusy && !job ? <Loading label={t('migration.scanning', 'در حال خواندن فایل…')} /> : null}

      {/* ─── Step 2 — what was found ────────────────────────────────────── */}

      {discovery ? (
        <Panel title={t('migration.step_discovery', '۲ — آنچه پیدا شد')}>
          <StatGrid>
            <Stat label={t('migration.rows_found', 'سطر')} value={String(discovery.rowCount)} />
            <Stat
              label={t('migration.columns_found', 'ستون')}
              value={String(discovery.headers.length)}
            />
            <Stat
              label={t('migration.detected_source', 'منبع احتمالی')}
              value={t(
                `migration.source_${discovery.source.system}`,
                discovery.source.system === 'generic_spreadsheet'
                  ? 'صفحه‌گسترده عمومی'
                  : discovery.source.system,
              )}
              hint={t(
                `migration.confidence_${discovery.source.confidence}`,
                discovery.source.confidence,
              )}
            />
          </StatGrid>

          {discovery.raggedRows.length > 0 ? (
            <p className="mt-3 text-sm text-[hsl(var(--fg-tertiary))]">
              {t(
                'migration.ragged_rows',
                'تعدادی سطر با ستون‌های ناهماهنگ پیدا شد؛ در فهرست یافته‌ها فهرست شده‌اند.',
              )}{' '}
              <Badge tone="warn">{discovery.raggedRows.length}</Badge>
            </p>
          ) : null}

          {discovery.sample.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {discovery.headers.map((header, index) => (
                      <TableHead key={`${header}-${index}`}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discovery.sample.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} dir="auto">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {/* ─── Step 3 — mapping ───────────────────────────────────────────── */}

      {discovery && !committed ? (
        <Panel title={t('migration.step_mapping', '۳ — تطبیق ستون‌ها')}>
          <p className="mb-4 text-sm text-[hsl(var(--fg-tertiary))]">
            {t(
              'migration.mapping_hint',
              'حدس‌های مطمئن از پیش اعمال شده‌اند. حدس‌های نامطمئن خالی مانده‌اند تا خودتان تصمیم بگیرید.',
            )}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {targetFields.map((field) => (
              <SelectField
                key={field}
                label={t(`migration.field_${field}`, field)}
                value={job?.mapping[field] === undefined ? '__none' : String(job.mapping[field])}
                onChange={(value) =>
                  onMappingChange(field, value === '__none' ? null : Number(value))
                }
                options={columnOptions}
                disabled={isBusy}
              />
            ))}
          </div>

          {discovery.suggestions.some((suggestion) => suggestion.status === 'unsupported') ? (
            <p className="mt-4 text-sm text-[hsl(var(--fg-tertiary))]">
              {t('migration.unsupported_columns', 'ستون‌هایی که جایی برای رفتن ندارند:')}{' '}
              <span dir="auto">
                {discovery.suggestions
                  .filter((suggestion) => suggestion.status === 'unsupported')
                  .map((suggestion) => suggestion.sourceHeader)
                  .join('، ')}
              </span>
            </p>
          ) : null}

          <div className="mt-5">
            <ActionButton onClick={onDryRun} disabled={isBusy}>
              {t('migration.run_preview', 'بررسی و پیش‌نمایش')}
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {/* ─── Step 4 — findings ──────────────────────────────────────────── */}

      {findings.length > 0 ? (
        <Panel title={t('migration.step_findings', '۴ — یافته‌ها')}>
          <StatGrid>
            <Stat label={t('migration.fatal', 'خطای بازدارنده')} value={String(fatalCount)} />
            <Stat label={t('migration.warning', 'هشدار')} value={String(warningCount)} />
            <Stat label={t('migration.info', 'اصلاح خودکار')} value={String(infoCount)} />
          </StatGrid>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('migration.row', 'سطر')}</TableHead>
                  <TableHead>{t('migration.column', 'ستون')}</TableHead>
                  <TableHead>{t('migration.issue', 'موضوع')}</TableHead>
                  <TableHead>{t('common.status', 'وضعیت')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.slice(0, FINDINGS_SHOWN).map((finding, index) => (
                  <TableRow key={`${finding.row}-${finding.code}-${index}`}>
                    <TableCell dir="ltr" className="tabular-nums">
                      {finding.row === 0 ? '—' : finding.row}
                    </TableCell>
                    <TableCell dir="auto">{finding.column ?? '—'}</TableCell>
                    <TableCell>
                      {t(`migration.finding_${finding.code}`, finding.code)}
                      {finding.detail ? (
                        <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]" dir="auto">
                          {finding.detail}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {/* `exactOptionalPropertyTypes` is on, so an explicit
                          undefined is not the same as an absent prop. */}
                      <Badge tone={SEVERITY_TONE[finding.severity] ?? 'neutral'}>
                        {t(`migration.severity_${finding.severity}`, finding.severity)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {findings.length > FINDINGS_SHOWN ? (
            <p className="mt-3 text-sm text-[hsl(var(--fg-tertiary))]">
              {t('migration.findings_truncated', 'یافته‌های بیشتری هست که اینجا نمایش داده نشده:')}{' '}
              <Badge tone="neutral">{findings.length - FINDINGS_SHOWN}</Badge>
            </p>
          ) : null}
        </Panel>
      ) : null}

      {/* ─── Step 5 — the dry run, and the approval ─────────────────────── */}

      {dryRun && !committed ? (
        <Panel title={t('migration.step_dry_run', '۵ — پیش‌نمایش و تأیید')}>
          <StatGrid>
            <Stat label={t('migration.to_create', 'ساخته می‌شود')} value={`+${dryRun.toCreate}`} />
            <Stat
              label={t('migration.to_update', 'به‌روز می‌شود')}
              value={String(dryRun.toUpdate)}
            />
            <Stat label={t('migration.to_skip', 'رد می‌شود')} value={String(dryRun.toSkip)} />
            <Stat
              label={t('migration.needs_review', 'نیاز به بازبینی')}
              value={String(dryRun.needsReview)}
            />
          </StatGrid>

          {Object.entries(dryRun.financialImpactMinor).filter(([, value]) => value !== 0).length >
          0 ? (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('migration.financial_impact', 'اثر مالی')}</TableHead>
                    <TableHead>{t('migration.total', 'جمع')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(dryRun.financialImpactMinor)
                    .filter(([, value]) => value !== 0)
                    .map(([field, value]) => (
                      <TableRow key={field}>
                        <TableCell>{t(`migration.field_${field}`, field)}</TableCell>
                        <TableCell>
                          <Money minor={value} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {/* The claim comes from the server's own response, not from this
              component's optimism. */}
          <p className="mt-4 text-sm text-[hsl(var(--fg-secondary))]">
            <Badge tone="good">
              {t('migration.nothing_changed', 'هنوز چیزی در داده‌های شما تغییر نکرده است')}
            </Badge>
          </p>

          {dryRun.needsReview > 0 ? (
            <p className="mt-3 text-sm text-[hsl(var(--fg-tertiary))]">
              {t(
                'migration.review_hint',
                'برخی سطرها فقط با نام شناسایی می‌شوند. اگر مطمئن نیستید، ستون کد یا شماره تماس را هم تطبیق دهید.',
              )}
            </p>
          ) : null}

          <label className="mt-5 flex items-start gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>
              {t(
                'migration.confirm_label',
                'اعداد بالا را دیدم و می‌خواهم این داده‌ها در حسابچه ثبت شوند.',
              )}
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton
              onClick={onCommit}
              disabled={isBusy || !confirmed || dryRun.toCreate + dryRun.toUpdate === 0}
            >
              {t('migration.commit', 'ثبت نهایی')}
            </ActionButton>
            <ActionButton variant="quiet" onClick={onCancel} disabled={isBusy}>
              {t('migration.cancel', 'انصراف')}
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {/* ─── Step 6 — what actually happened ────────────────────────────── */}

      {job && committed ? (
        <Panel title={t('migration.step_report', '۶ — گزارش')}>
          <StatGrid>
            <Stat label={t('migration.created', 'ساخته شد')} value={String(job.rowsCreated)} />
            <Stat label={t('migration.updated', 'به‌روز شد')} value={String(job.rowsUpdated)} />
            <Stat label={t('migration.skipped', 'رد شد')} value={String(job.rowsSkipped)} />
            <Stat label={t('migration.scanned', 'خوانده شد')} value={String(job.rowsScanned)} />
          </StatGrid>

          {job.reconciliation ? (
            <div className="mt-4">
              <p className="mb-2 text-sm text-[hsl(var(--fg-secondary))]">
                <Badge tone={job.reconciliation.matched ? 'good' : 'warn'}>
                  {job.reconciliation.matched
                    ? t('migration.reconciled', 'مغایرت‌گیری: بدون اختلاف')
                    : t('migration.reconcile_mismatch', 'مغایرت‌گیری: اختلاف دارد')}
                </Badge>
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('migration.measure', 'سنجه')}</TableHead>
                    <TableHead>{t('migration.expected', 'انتظار')}</TableHead>
                    <TableHead>{t('migration.actual', 'واقعی')}</TableHead>
                    <TableHead>{t('migration.difference', 'اختلاف')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.reconciliation.lines.map((line) => (
                    <TableRow key={line.measure}>
                      <TableCell>{t(`migration.measure_${line.measure}`, line.measure)}</TableCell>
                      <TableCell dir="ltr" className="tabular-nums">
                        {line.sourceValue}
                      </TableCell>
                      <TableCell dir="ltr" className="tabular-nums">
                        {line.hisabcheValue}
                      </TableCell>
                      <TableCell dir="ltr" className="tabular-nums">
                        {line.differenceValue}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {job.errorCode ? <ErrorNote message={job.errorCode} /> : null}

          <div className="mt-5">
            <ActionButton variant="quiet" onClick={onReset}>
              {t('migration.new_import', 'انتقال تازه')}
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {/* ─── History ────────────────────────────────────────────────────── */}

      <Panel title={t('migration.history', 'تاریخچه انتقال‌ها')}>
        {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

        {!isLoading && history.length === 0 ? (
          <EmptyState
            title={t('migration.empty_title', 'هنوز انتقالی انجام نشده')}
            description={t(
              'migration.empty_hint',
              'داده‌های کسب‌وکار فعلی‌تان را وارد کنید تا از صفر شروع نکنید.',
            )}
          />
        ) : null}

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('migration.file', 'فایل')}</TableHead>
                  <TableHead>{t('migration.entity', 'نوع')}</TableHead>
                  <TableHead>{t('migration.created', 'ساخته شد')}</TableHead>
                  <TableHead>{t('migration.updated', 'به‌روز شد')}</TableHead>
                  <TableHead>{t('common.status', 'وضعیت')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell dir="auto">{row.originalFilename}</TableCell>
                    <TableCell>{t(`migration.entity_${row.entity}`, row.entity)}</TableCell>
                    <TableCell dir="ltr" className="tabular-nums">
                      {row.rowsCreated}
                    </TableCell>
                    <TableCell dir="ltr" className="tabular-nums">
                      {row.rowsUpdated}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                        {t(`migration.status_${row.status}`, row.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Panel>
    </CapabilityPage>
  )
})

DataMigrationView.displayName = 'DataMigrationView'
