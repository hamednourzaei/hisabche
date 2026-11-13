'use client'
// ============================================
// «چارت سازمانی» — who reports to whom, and each employee's file
// (documents, appraisals). V61 B.2.17. Team hub › team › `?view=orgChart`.
//
// ⚠️ The server scopes the chart: owner, admin and manager see everyone;
// anyone else sees themself and the people under them. The screen shows what
// it is given and adds nothing.
// ⚠️ A cycle (A reports to B reports to A) is refused by the server AND by a
// database trigger; the screen shows the refusal, it does not pre-judge.
// ⚠️ An appraisal is append-only (database trigger): there is no edit button.
// ============================================
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useAddEmployeeDocument,
  useCreateAppraisal,
  useEmployeeAppraisals,
  useEmployeeDocuments,
  useOrgChart,
  useSetReportsTo,
  type EmployeeAppraisal,
  type EmployeeDocument,
  type OrgChartEntry,
} from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { useToast } from '../toast-provider'
import { LabeledSelect } from '../business-packs/pack-shared'
import { QueryState, erpCard, fieldLabel, refusalText, useTableLabel } from './erp-shared'

export const ORG_CHART_ERROR_CODES = [
  'ORG_CYCLE_DETECTED',
  'ORG_MANAGER_NOT_FOUND',
  'EMPLOYEE_DOCUMENT_URL_HTTPS',
] as const

const NO_MANAGER = '__none__'

/** Indentation per level under the top (logical padding: right in RTL). */
const DEPTH_INDENT = ['', 'ps-5', 'ps-10', 'ps-14', 'ps-20'] as const

export function fullName(row: Pick<OrgChartEntry, 'first_name' | 'last_name'>): string {
  return [row.first_name, row.last_name].filter(Boolean).join(' ')
}

/** How many levels below the top each person sits (0 = reports to no one shown here). */
export function orgDepths(rows: readonly OrgChartEntry[]): Map<string, number> {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const depths = new Map<string, number>()
  for (const row of rows) {
    let depth = 0
    let cursor = row.reports_to
    const seen = new Set<string>([row.id])
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor)
      depth += 1
      cursor = byId.get(cursor)?.reports_to ?? null
    }
    depths.set(row.id, depth)
  }
  return depths
}

export function OrgChartSection() {
  const t = useTranslations('erpCore.orgChart')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const toast = useToast()
  const chart = useOrgChart()
  const setReportsTo = useSetReportsTo()
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const rows = chart.data ?? []
  const depths = orgDepths(rows)
  const options = [
    { value: NO_MANAGER, label: tr('noManager') },
    ...rows.map((r) => ({ value: r.id, label: fullName(r) })),
  ]
  const needle = search.trim().toLowerCase()
  const visible = rows.filter((r) =>
    needle ? `${fullName(r)} ${r.position ?? ''}`.toLowerCase().includes(needle) : true,
  )
  const open = rows.find((r) => r.id === openId) ?? null

  const columns: TableColumn<OrgChartEntry>[] = [
    {
      id: 'name',
      labelKey: 'erpCore.orgChart.columns.name',
      labelFallback: 'نام',
      locked: true,
      render: (r) => (
        <span className={DEPTH_INDENT[Math.min(depths.get(r.id) ?? 0, DEPTH_INDENT.length - 1)]}>
          {fullName(r)}
        </span>
      ),
      sortValue: (r) => fullName(r),
    },
    {
      id: 'position',
      labelKey: 'erpCore.orgChart.columns.position',
      labelFallback: 'سمت',
      render: (r) => r.position ?? '—',
    },
    {
      id: 'reportsTo',
      labelKey: 'erpCore.orgChart.columns.reportsTo',
      labelFallback: 'گزارش به',
      render: (r) => (
        <LabeledSelect
          name={`reports_to.${r.id}`}
          aria-label={tr('columns.reportsTo')}
          value={r.reports_to ?? NO_MANAGER}
          disabled={setReportsTo.isPending}
          onChange={(value) =>
            setReportsTo.mutate(
              { employeeId: r.id, reportsTo: value === NO_MANAGER ? null : value },
              {
                onSuccess: () => toast.success(tr('saved')),
                onError: (e) => toast.error(refusalText(e, ORG_CHART_ERROR_CODES, tr)),
              },
            )
          }
          options={options.filter((o) => o.value !== r.id)}
        />
      ),
    },
    {
      id: 'actions',
      labelKey: 'erpCore.orgChart.columns.actions',
      labelFallback: 'پرونده',
      locked: true,
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
          {tr('openFile')}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <QueryState
        isLoading={chart.isLoading}
        isError={chart.isError}
        onRetry={() => void chart.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="team-org-chart"
          t={label}
          rows={visible}
          columns={columns}
          rowKey={(r) => r.id}
          searchValue={search}
          onSearchChange={setSearch}
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>
      {open ? <EmployeeFile employee={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function EmployeeFile({ employee, onClose }: { employee: OrgChartEntry; onClose: () => void }) {
  const t = useTranslations('erpCore.orgChart')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const toast = useToast()
  const { date } = useDateFormat()
  const documents = useEmployeeDocuments(employee.id)
  const appraisals = useEmployeeAppraisals(employee.id)
  const addDocument = useAddEmployeeDocument()
  const createAppraisal = useCreateAppraisal()

  const [docTitle, setDocTitle] = useState('')
  const [docKind, setDocKind] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [period, setPeriod] = useState('')
  const [criterion, setCriterion] = useState('')
  const [observation, setObservation] = useState('')
  const [notes, setNotes] = useState('')

  const documentColumns: TableColumn<EmployeeDocument>[] = [
    {
      id: 'title',
      labelKey: 'erpCore.orgChart.columns.document',
      labelFallback: 'مدرک',
      locked: true,
      render: (d) => (
        <a
          href={d.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[hsl(var(--color-primary))] underline"
        >
          {d.title}
        </a>
      ),
    },
    {
      id: 'kind',
      labelKey: 'erpCore.orgChart.columns.kind',
      labelFallback: 'نوع',
      render: (d) => d.kind,
    },
    {
      id: 'created',
      labelKey: 'erpCore.orgChart.columns.created',
      labelFallback: 'تاریخ',
      render: (d) => date(d.created_at),
    },
  ]

  const appraisalColumns: TableColumn<EmployeeAppraisal>[] = [
    {
      id: 'period',
      labelKey: 'erpCore.orgChart.columns.period',
      labelFallback: 'دوره',
      locked: true,
      render: (a) => a.period,
    },
    {
      id: 'criteria',
      labelKey: 'erpCore.orgChart.columns.criteria',
      labelFallback: 'ارزیابی',
      render: (a) => (
        <ul className="space-y-1">
          {(Array.isArray(a.criteria) ? a.criteria : []).map((c, i) => (
            <li key={i}>
              <span className="font-medium">{c.label}</span>
              {c.observation ? `: ${c.observation}` : ''}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'notes',
      labelKey: 'erpCore.orgChart.columns.notes',
      labelFallback: 'یادداشت',
      render: (a) => a.notes ?? '—',
    },
    {
      id: 'created',
      labelKey: 'erpCore.orgChart.columns.created',
      labelFallback: 'تاریخ',
      render: (a) => date(a.created_at),
    },
  ]

  const errorText = (e: unknown) => refusalText(e, ORG_CHART_ERROR_CODES, tr)

  const submitDocument = () => {
    if (!docTitle.trim() || !docUrl.trim().startsWith('https://')) {
      toast.error(tr('errors.documentIncomplete'))
      return
    }
    addDocument.mutate(
      {
        employeeId: employee.id,
        title: docTitle.trim(),
        kind: docKind.trim() || 'document',
        file_url: docUrl.trim(),
      },
      {
        onSuccess: () => {
          setDocTitle('')
          setDocKind('')
          setDocUrl('')
          toast.success(tr('documentSaved'))
        },
        onError: (e) => toast.error(errorText(e)),
      },
    )
  }

  const submitAppraisal = () => {
    if (period.trim().length < 2 || !criterion.trim()) {
      toast.error(tr('errors.appraisalIncomplete'))
      return
    }
    createAppraisal.mutate(
      {
        employeeId: employee.id,
        period: period.trim(),
        criteria: [{ label: criterion.trim(), observation: observation.trim() }],
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => {
          setCriterion('')
          setObservation('')
          setNotes('')
          toast.success(tr('appraisalSaved'))
        },
        onError: (e) => toast.error(errorText(e)),
      },
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {tr('fileTitle')} — {fullName(employee)}
        </h3>
        <Button size="sm" variant="outline" onClick={onClose}>
          {tr('close')}
        </Button>
      </div>

      <h4 className="text-sm font-medium">{tr('documents')}</h4>
      <div className={erpCard}>
        <label className={fieldLabel}>
          {tr('form.documentTitle')}
          <Input name="title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
        </label>
        <label className={fieldLabel}>
          {tr('form.documentKind')}
          <Input name="kind" value={docKind} onChange={(e) => setDocKind(e.target.value)} />
        </label>
        <label className={fieldLabel}>
          {tr('form.documentUrl')}
          <Input
            name="file_url"
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
          />
        </label>
        <div className="sm:col-span-3">
          <Button size="sm" disabled={addDocument.isPending} onClick={submitDocument}>
            {tr('form.saveDocument')}
          </Button>
        </div>
      </div>
      <QueryState
        isLoading={documents.isLoading}
        isError={documents.isError}
        onRetry={() => void documents.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="team-employee-documents"
          t={label}
          rows={documents.data ?? []}
          columns={documentColumns}
          rowKey={(d) => d.id}
          paginate={false}
          emptyState={<EmptyState title={tr('noDocuments')} />}
        />
      </QueryState>

      <h4 className="text-sm font-medium">{tr('appraisals')}</h4>
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{tr('appraisalHint')}</p>
      <div className={erpCard}>
        <label className={fieldLabel}>
          {tr('form.period')}
          <Input name="period" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>
        <label className={fieldLabel}>
          {tr('form.criterion')}
          <Input
            name="criteria.0.label"
            value={criterion}
            onChange={(e) => setCriterion(e.target.value)}
          />
        </label>
        <label className={fieldLabel}>
          {tr('form.observation')}
          <Input
            name="criteria.0.observation"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
          />
        </label>
        <label className={`${fieldLabel} sm:col-span-2`}>
          {tr('form.notes')}
          <Input name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="flex items-end">
          <Button size="sm" disabled={createAppraisal.isPending} onClick={submitAppraisal}>
            {tr('form.saveAppraisal')}
          </Button>
        </div>
      </div>
      <QueryState
        isLoading={appraisals.isLoading}
        isError={appraisals.isError}
        onRetry={() => void appraisals.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="team-employee-appraisals"
          t={label}
          rows={appraisals.data ?? []}
          columns={appraisalColumns}
          rowKey={(a) => a.id}
          paginate={false}
          emptyState={<EmptyState title={tr('noAppraisals')} />}
        />
      </QueryState>
    </section>
  )
}
