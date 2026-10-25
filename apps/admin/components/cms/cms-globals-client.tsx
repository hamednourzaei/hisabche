'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { apiClient } from '@hisabche/api'

import {
  Button,
  DataTable,
  EmptyState,
  Input,
  SelectField,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'

/** The locales the globals endpoint accepts (`z.enum(['fa','af','en'])`). */
const CMS_LOCALES = ['fa', 'af', 'en'] as const

interface CmsGlobalEntry {
  key: string
  value: unknown
}

export function CmsGlobalsClient() {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const tableT = useAdminTableT()
  const [locale, setLocale] = useState<string>('fa')
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')

  const {
    data: globals = {},
    isLoading,
    isError,
    refetch,
  } = useQuery<Record<string, unknown>>({
    queryKey: ['cms-globals', locale],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/api/public/cms/globals/${locale}`)
      return res.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      await apiClient.put(`/api/cms/globals/${locale}/${key}`, value)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-globals', locale] })
      setEditKey('')
      setEditValue('')
    },
  })

  const rows: CmsGlobalEntry[] = Object.entries(globals).map(([key, value]) => ({ key, value }))

  const columns: TableColumn<CmsGlobalEntry>[] = [
    {
      id: 'key',
      labelKey: 'admin.cms.keyLabel',
      labelFallback: 'کلید',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.key}
        </span>
      ),
      sortValue: (row) => row.key,
    },
    {
      id: 'content',
      labelKey: 'admin.cms.contentLabel',
      labelFallback: 'محتوا',
      render: (row) => (
        <span
          dir="ltr"
          className="block max-w-[520px] truncate font-mono text-xs text-muted-foreground"
        >
          {JSON.stringify(row.value)}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.cms.globalsTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('admin.cms.globalsSubtitle')}</p>
        </div>
        <SelectField
          value={locale}
          onChange={setLocale}
          options={CMS_LOCALES.map((value) => ({
            value,
            label: t(`admin.cms.locales.${value}`),
          }))}
          aria-label={t('cms.pages.locale')}
          className="h-10 w-44"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t('admin.cms.addOrUpdate')}</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={editKey}
            onChange={(e) => setEditKey(e.target.value)}
            placeholder={t('admin.cms.keyPlaceholder')}
            aria-label={t('admin.cms.keyLabel')}
            className="h-10 flex-1 font-mono"
            dir="ltr"
          />
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={t('admin.cms.contentPlaceholder')}
            aria-label={t('admin.cms.contentLabel')}
            className="h-10 flex-[2]"
          />
          <Button
            onClick={() => saveMutation.mutate({ key: editKey, value: { text: editValue } })}
            disabled={!editKey || !editValue || saveMutation.isPending}
          >
            <Save className="me-2 size-4" aria-hidden="true" />
            {t('admin.cms.saveAndPublish')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={t('common.loadError')} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          tableId="admin-cms-globals"
          t={tableT}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.key}
          minWidthClass="min-w-[560px]"
          caption={t('admin.cms.globalsTitle')}
          emptyState={
            <EmptyState
              title={t('admin.cms.emptyForLocale', {
                locale: t(`admin.cms.locales.${locale}`),
              })}
            />
          }
        />
      )}
    </div>
  )
}
