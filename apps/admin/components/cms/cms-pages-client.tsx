'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Edit2, Plus } from 'lucide-react'
import { apiClient } from '@hisabche/api'

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Skeleton,
  useRouteLang,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'

/**
 * The part of `GET /api/cms/pages` (`CmsPageRow`) this screen reads.
 * The endpoint answers with the rows themselves, newest first.
 */
interface CmsPageSummary {
  id: string
  locale: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'archived'
  theme: string
}

export function CmsPagesClient() {
  const t = useTranslations()
  const tableT = useAdminTableT()
  const lang = useRouteLang()
  const href = (path: string) => (lang ? `/${lang}${path}` : path)

  const {
    data: pages = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CmsPageSummary[]>({
    queryKey: ['cms-pages'],
    queryFn: async () => {
      const res = await apiClient.get<CmsPageSummary[]>('/api/cms/pages')
      return res.data
    },
  })

  const columns: TableColumn<CmsPageSummary>[] = [
    {
      id: 'title',
      labelKey: 'common.title',
      labelFallback: 'عنوان',
      locked: true,
      render: (page) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground">{page.title}</div>
          <div className="text-xs text-muted-foreground">
            {t('admin.cms.themeName', { theme: page.theme })}
          </div>
        </div>
      ),
      sortValue: (page) => page.title,
    },
    {
      id: 'url',
      labelKey: 'cms.pages.url',
      labelFallback: 'نشانی',
      render: (page) => (
        <span
          dir="ltr"
          className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
        >
          /{page.locale}/{page.slug}
        </span>
      ),
      sortValue: (page) => `${page.locale}/${page.slug}`,
    },
    {
      id: 'status',
      labelKey: 'common.status',
      labelFallback: 'وضعیت',
      render: (page) => (
        <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
          {page.status === 'published' ? t('common.published') : t('common.draft')}
        </Badge>
      ),
      sortValue: (page) => page.status,
    },
    {
      id: 'locale',
      labelKey: 'cms.pages.locale',
      labelFallback: 'زبان',
      showFrom: 'md',
      render: (page) => <span className="uppercase text-muted-foreground">{page.locale}</span>,
      sortValue: (page) => page.locale,
    },
    {
      id: 'actions',
      labelKey: 'common.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (page) => (
        <Button asChild variant="ghost" size="sm">
          <Link
            href={href(`/cms/pages/${page.id}`)}
            aria-label={t('admin.cms.editPage', { title: page.title })}
          >
            <Edit2 className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('cms.pages.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('cms.pages.subtitle')}</p>
        </div>
        <Button asChild>
          <Link href={href('/cms/pages/new')}>
            <Plus className="me-2 size-4" aria-hidden="true" />
            {t('cms.pages.create')}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={t('common.loadError')} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          tableId="admin-cms-pages"
          t={tableT}
          rows={pages}
          columns={columns}
          rowKey={(page) => page.id}
          minWidthClass="min-w-[760px]"
          caption={t('cms.pages.title')}
          emptyState={
            <EmptyState title={t('cms.pages.empty')} description={t('cms.pages.emptyDesc')} />
          }
        />
      )}
    </div>
  )
}
