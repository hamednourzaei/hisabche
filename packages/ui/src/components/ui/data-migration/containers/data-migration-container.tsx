'use client'

// ============================================
// packages/ui/src/components/ui/data-migration/containers/data-migration-container.tsx
//
// ---------------------------------------------------------------------------
// THE FILE LIVES IN THIS COMPONENT AND NOWHERE ELSE
//
// Not in the query cache, not in localStorage, not on the server's disk. A
// customer export is a list of names and phone numbers, and the only place it
// needs to exist is the tab the person is looking at. When they navigate away
// the wizard resets — which is the correct behaviour, not a limitation: a
// half-approved import that survives a page change is a commit waiting to
// happen without its own evidence on screen.
//
// The server holds a digest of the file, so re-sending it at the dry-run and
// commit steps proves it is the same file that was scanned.
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useCancelMigration,
  useCommitMigration,
  useDryRun,
  useInspectImport,
  useMigrations,
  useSaveMapping,
  useScanMigration,
  type DryRunSummary,
  type Finding,
  type ImportInspection,
  type ImportTable,
  type MigrationEntity,
  type MigrationJob,
} from '@hisabche/api'

import { DataMigrationView } from '../data-migration-view'

/** The mappable fields, in the order the wizard shows them. Mirrors
 *  `ENTITY_FIELDS` on the server; required fields come first so the one that
 *  cannot be skipped is the one the eye lands on. */
const TARGET_FIELDS: Record<MigrationEntity, string[]> = {
  customer: [
    'fullName',
    'phone',
    'email',
    'address',
    'notes',
    'openingBalance',
    'type',
    'externalId',
  ],
  product: [
    'name',
    'sku',
    'barcode',
    'category',
    'unit',
    'quantity',
    'buyPrice',
    'sellPrice',
    'wholesalePrice',
    'minStockLevel',
    'externalId',
  ],
  invoice: [
    'invoiceNumber',
    'date',
    'type',
    'customerName',
    'customerPhone',
    'itemName',
    'sku',
    'barcode',
    'quantity',
    'unitPrice',
    'lineTotal',
    'total',
    'paidAmount',
    'currency',
    'notes',
  ],
}

/** Mirrors the server's own ceiling, so an oversized file is refused before it
 *  is read into memory rather than after a round trip. */
const MAX_BYTES = 8 * 1024 * 1024
// A workbook travels as base64 (4/3 its size) inside the same request limit.
const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024

/** Refusals the reader gives by code; each has its own sentence. */
const FILE_ERRORS = [
  'MIGRATION_XLSX_OLD_FORMAT',
  'MIGRATION_XLSX_NOT_A_WORKBOOK',
  'MIGRATION_XLSX_ENCRYPTED',
  'MIGRATION_XLSX_TOO_LARGE',
  'MIGRATION_XLSX_NO_SHEET',
] as const

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // In slices: spreading a whole file into one call overflows the stack.
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return btoa(binary)
}

function messageOf(error: unknown): string | null {
  const response = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
  return response ?? (error as Error)?.message ?? null
}

export const DataMigrationContainer = memo(function DataMigrationContainer() {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const [entity, setEntity] = useState<MigrationEntity>('customer')
  const [job, setJob] = useState<MigrationJob | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunSummary | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  /** What the server made of the chosen file, kept so the kind can be corrected. */
  const [seen, setSeen] = useState<ImportInspection | null>(null)
  /** Which sheet of a workbook is being imported now; null for a text file. */
  const [sheetName, setSheetName] = useState<string | null>(null)

  const history = useMigrations()
  const inspect = useInspectImport()
  const scan = useScanMigration()
  const saveMapping = useSaveMapping()
  const dryRun = useDryRun()
  const commit = useCommitMigration()
  const cancel = useCancelMigration()

  const reset = useCallback(() => {
    setJob(null)
    setContent(null)
    setFileName(null)
    setDryRunResult(null)
    setFindings([])
    setActionError(null)
    setSeen(null)
    setSheetName(null)
  }, [])

  /** Scan the held file as one kind. The kind comes from detection or from the person. */
  const scanAs = useCallback(
    (kind: MigrationEntity, inspection: ImportTable, filename: string) => {
      setEntity(kind)
      setDryRunResult(null)
      setFindings([])
      scan.mutate(
        { entity: kind, sourceType: inspection.sourceType, filename, content: inspection.content },
        {
          onSuccess: setJob,
          onError: (error) => {
            setJob(null)
            const message = messageOf(error) ?? ''
            // The database has not been told about invoice imports yet.
            setActionError(
              message.includes('MIGRATION_INVOICE_SCHEMA_REQUIRED')
                ? t('migration.error_MIGRATION_INVOICE_SCHEMA_REQUIRED', message)
                : message || null,
            )
          },
        },
      )
    },
    [scan, t],
  )

  const handlePickFile = useCallback(
    (file: File) => {
      reset()

      const isWorkbook = /\.xlsx$/i.test(file.name)
      if (file.size > (isWorkbook ? MAX_WORKBOOK_BYTES : MAX_BYTES)) {
        setActionError(t('migration.error_file_too_large', 'فایل بزرگ‌تر از حد مجاز است.'))
        return
      }

      const reader = new FileReader()
      reader.onerror = () =>
        setActionError(t('migration.error_file_unreadable', 'فایل خوانده نشد.'))
      reader.onload = () => {
        const payload =
          reader.result instanceof ArrayBuffer
            ? { filename: file.name, contentBase64: toBase64(reader.result) }
            : {
                filename: file.name,
                content: typeof reader.result === 'string' ? reader.result : '',
              }

        // The server says what the file holds; nobody is asked to say it first.
        inspect.mutate(payload, {
          onSuccess: (inspection) => {
            setSeen(inspection)
            setContent(inspection.content)
            setFileName(file.name)
            setSheetName(inspection.sheets[0]?.name ?? null)

            const kind = inspection.detection.entity
            // Not sure: nothing is scanned on a guess. The screen says so, and
            // the person chooses.
            if (kind === null) return
            scanAs(kind, inspection, file.name)
          },
          onError: (error) => {
            const message = messageOf(error) ?? ''
            const known = FILE_ERRORS.find((code) => message.includes(code))
            setActionError(known ? t(`migration.error_${known}`, message) : message || null)
          },
        })
      }
      if (isWorkbook) reader.readAsArrayBuffer(file)
      else reader.readAsText(file, 'utf-8')
    },
    [inspect, reset, scanAs, t],
  )

  /** The table in hand: the chosen sheet of a workbook, or the file itself. */
  const table: ImportTable | null = seen
    ? (seen.sheets.find((sheet) => sheet.name === sheetName) ?? seen)
    : null

  // Correcting the kind re-reads the SAME table as the other kind.
  const handleEntityChange = useCallback(
    (next: MigrationEntity) => {
      setActionError(null)
      setJob(null)
      if (table && fileName) scanAs(next, table, fileName)
      else setEntity(next)
    },
    [fileName, scanAs, table],
  )

  // Another sheet of the same workbook: its own kind, its own import. The
  // file is not uploaded again.
  const handleSheetChange = useCallback(
    (name: string) => {
      const sheet = seen?.sheets.find((candidate) => candidate.name === name)
      if (!sheet || !fileName) return
      setActionError(null)
      setJob(null)
      setDryRunResult(null)
      setFindings([])
      setSheetName(name)
      setContent(sheet.content)
      if (sheet.detection.entity !== null) scanAs(sheet.detection.entity, sheet, fileName)
    },
    [fileName, scanAs, seen],
  )
  const handleMappingChange = useCallback(
    (field: string, column: number | null) => {
      if (!job) return
      setActionError(null)

      const next: Record<string, number> = { ...job.mapping }
      if (column === null) delete next[field]
      else next[field] = column

      // A dry run computed against the OLD mapping must not stay on screen
      // while the new one is saved — a stale preview is what an approval would
      // be read from.
      setDryRunResult(null)
      setFindings([])

      saveMapping.mutate(
        { id: job.id, mapping: next },
        { onSuccess: setJob, onError: (error) => setActionError(messageOf(error)) },
      )
    },
    [job, saveMapping],
  )

  const handleDryRun = useCallback(() => {
    if (!job || content === null) return
    setActionError(null)

    dryRun.mutate(
      { id: job.id, content },
      {
        onSuccess: (result) => {
          setJob(result.job)
          setDryRunResult(result.dryRun)
          setFindings(result.findings)
        },
        onError: (error) => setActionError(messageOf(error)),
      },
    )
  }, [job, content, dryRun])

  const handleCommit = useCallback(() => {
    if (!job || content === null) return
    setActionError(null)

    commit.mutate(
      { id: job.id, content },
      {
        onSuccess: (result) => {
          setJob(result)
          // The file has done its work. Dropped from memory the moment the
          // rows exist, so the tab is not holding a customer list for the rest
          // of the session.
          setContent(null)
        },
        onError: (error) => setActionError(messageOf(error)),
      },
    )
  }, [job, content, commit])

  const handleCancel = useCallback(() => {
    if (!job) return
    setActionError(null)
    cancel.mutate(job.id, {
      onSuccess: () => reset(),
      onError: (error) => setActionError(messageOf(error)),
    })
  }, [job, cancel, reset])

  const handleRefresh = useCallback(() => {
    setActionError(null)
    history.refetch()
  }, [history])

  const isBusy =
    scan.isPending ||
    inspect.isPending ||
    saveMapping.isPending ||
    dryRun.isPending ||
    commit.isPending ||
    cancel.isPending

  const targetFields = useMemo(() => TARGET_FIELDS[entity], [entity])

  return (
    <DataMigrationView
      t={t}
      history={history.data ?? []}
      job={job}
      entity={entity}
      targetFields={targetFields}
      isLoading={history.isLoading}
      isBusy={isBusy}
      error={history.error ? (history.error as Error).message : null}
      actionError={actionError}
      fileName={fileName}
      detection={
        seen && table
          ? {
              entity: table.detection.entity,
              confidence: table.detection.confidence,
              skippedRows: table.skippedRows,
              ignoredSheets: seen.sheet?.ignored ?? [],
            }
          : null
      }
      sheets={(seen?.sheets ?? []).map((sheet) => ({
        name: sheet.name,
        entity: sheet.detection.entity,
        rowCount: sheet.rowCount,
      }))}
      activeSheet={sheetName}
      onSheetChange={handleSheetChange}
      dryRun={dryRunResult}
      findings={findings}
      onPickFile={handlePickFile}
      onEntityChange={handleEntityChange}
      onMappingChange={handleMappingChange}
      onDryRun={handleDryRun}
      onCommit={handleCommit}
      onCancel={handleCancel}
      onReset={reset}
      onRefresh={handleRefresh}
    />
  )
})

DataMigrationContainer.displayName = 'DataMigrationContainer'
