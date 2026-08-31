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
  useMigrations,
  useSaveMapping,
  useScanMigration,
  type DryRunSummary,
  type Finding,
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
}

/** Mirrors the server's own ceiling, so an oversized file is refused before it
 *  is read into memory rather than after a round trip. */
const MAX_BYTES = 8 * 1024 * 1024

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

  const history = useMigrations()
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
  }, [])

  const handlePickFile = useCallback(
    (file: File) => {
      setActionError(null)

      if (file.size > MAX_BYTES) {
        setActionError(t('migration.error_file_too_large', 'فایل بزرگ‌تر از حد مجاز است.'))
        return
      }

      const sourceType = /\.tsv$/i.test(file.name) ? 'tsv' : 'csv'

      // Decoded as UTF-8 here, in the browser. A file saved in a legacy
      // Windows code page arrives as mojibake and the user sees it in the
      // sample table — which is the honest outcome, and better than the server
      // guessing an encoding and importing names nobody can read.
      const reader = new FileReader()
      reader.onerror = () =>
        setActionError(t('migration.error_file_unreadable', 'فایل خوانده نشد.'))
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        setContent(text)
        setFileName(file.name)
        setDryRunResult(null)
        setFindings([])

        scan.mutate(
          { entity, sourceType, filename: file.name, content: text },
          {
            onSuccess: setJob,
            onError: (error) => {
              setJob(null)
              setActionError(messageOf(error))
            },
          },
        )
      }
      reader.readAsText(file, 'utf-8')
    },
    [entity, scan, t],
  )

  const handleEntityChange = useCallback(
    (next: MigrationEntity) => {
      // Changing what is being imported invalidates the mapping and the dry
      // run, so the wizard starts again rather than carrying a customer
      // mapping onto a product file.
      reset()
      setEntity(next)
    },
    [reset],
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
