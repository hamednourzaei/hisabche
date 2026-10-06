'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Edit2, Globe, FileText, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@hisabche/api'
import Link from 'next/link'

export function CmsPagesClient() {
  const t = useTranslations()
  const router = useRouter()

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['cms-pages'],
    queryFn: async () => {
      const res = await apiClient.get('/api/cms/pages')
      return res.data
    },
  })

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('cms.pages.title')}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{t('cms.pages.subtitle')}</p>
        </div>
        <Link
          href="/cms/pages/new"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--color-primary-hover))]"
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {t('cms.pages.create')}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border-default))] py-20 text-center">
          <Globe className="mb-4 size-10 text-[hsl(var(--fg-tertiary))]" />
          <h3 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('cms.pages.empty')}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-[hsl(var(--fg-secondary))]">
            {t('cms.pages.emptyDesc')}
          </p>
          <Link
            href="/cms/pages/new"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--color-primary-hover))]"
          >
            {t('cms.pages.create')}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">
                  {t('common.title')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">
                  {t('cms.pages.url')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">
                  {t('cms.pages.locale')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-[hsl(var(--fg-secondary))]">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border-default))]">
              {pages.map((page: any) => (
                <tr
                  key={page.id}
                  className="transition-colors hover:bg-[hsl(var(--surface-muted))]"
                >
                  <td className="px-4 py-4">
                    <div className="font-medium text-[hsl(var(--fg-primary))]">{page.title}</div>
                    <div className="text-xs text-[hsl(var(--fg-tertiary))]">{page.theme} theme</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--surface-muted))] px-2 py-1 font-mono text-xs text-[hsl(var(--fg-secondary))]">
                      /{page.locale}/{page.slug}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {page.status === 'published' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--color-success)/0.12)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-success))]">
                        <CheckCircle2 className="size-3.5" />
                        {t('common.published')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--color-warning)/0.12)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-warning))]">
                        <FileText className="size-3.5" />
                        {t('common.draft')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-[hsl(var(--fg-secondary))] uppercase">
                    {page.locale}
                  </td>
                  <td className="px-4 py-4 text-end">
                    <Link
                      href={`/cms/pages/${page.id}`}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-[hsl(var(--fg-secondary))] transition-colors hover:bg-[hsl(var(--border-default))] hover:text-[hsl(var(--fg-primary))]"
                    >
                      <Edit2 className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
