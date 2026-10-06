'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Save, ArrowRight, Settings, Layout, Eye, X } from 'lucide-react'
import { apiClient } from '@hisabche/api'
import Link from 'next/link'

interface EditorProps {
  isNew: boolean
  pageId?: string
}

export function CmsPageEditorClient({ isNew, pageId }: EditorProps) {
  const t = useTranslations()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'content' | 'settings'>('content')

  const { data: page, isLoading } = useQuery({
    queryKey: ['cms-page', pageId],
    queryFn: async () => {
      if (isNew) return { title: '', slug: '', locale: 'fa', sections: [] }
      const res = await apiClient.get(`/api/cms/pages/${pageId}`)
      return res.data
    },
    enabled: true,
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        const res = await apiClient.post('/api/cms/pages', data)
        return res.data
      } else {
        const res = await apiClient.put(`/api/cms/pages/${pageId}`, data)
        return res.data
      }
    },
    onSuccess: () => {
      router.push('/cms/pages')
    },
  })

  if (isLoading) {
    return <div className="p-8 text-center">{t('common.loading')}</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[hsl(var(--surface-muted))]">
      {/* HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/cms/pages"
            className="flex size-8 items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-muted))]"
          >
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {isNew ? t('cms.pages.newTitle') : page?.title || t('common.edit')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-[hsl(var(--surface-muted))] p-1">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === 'content'
                  ? 'bg-white text-[hsl(var(--fg-primary))] shadow-sm'
                  : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]'
              }`}
            >
              <Layout className="mr-2 size-4" />
              {t('cms.pages.contentTab')}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white text-[hsl(var(--fg-primary))] shadow-sm'
                  : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]'
              }`}
            >
              <Settings className="mr-2 size-4" />
              {t('cms.pages.settingsTab')}
            </button>
          </div>

          <div className="ml-4 h-6 w-px bg-[hsl(var(--border-default))]"></div>

          <button
            onClick={() => {}}
            className="ml-2 inline-flex h-9 items-center justify-center rounded-lg border border-[hsl(var(--border-default))] bg-white px-4 text-sm font-medium text-[hsl(var(--fg-primary))] transition-colors hover:bg-[hsl(var(--surface-muted))]"
          >
            <Eye className="mr-2 size-4" />
            {t('common.preview')}
          </button>

          <button
            onClick={() => saveMutation.mutate(page)}
            disabled={saveMutation.isPending}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--color-primary-hover))] disabled:opacity-50"
          >
            <Save className="mr-2 size-4" />
            {t('common.save')}
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: Editor */}
        <div className="w-[400px] shrink-0 border-r border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="p-6 space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--fg-tertiary))]">
                {t('cms.pages.pageSettings')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {t('common.title')}
                  </label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm"
                    placeholder="Page Title"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {t('cms.pages.slug')}
                  </label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm font-mono"
                    placeholder="e.g. about-us"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {t('cms.pages.locale')}
                  </label>
                  <select className="h-10 w-full rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm">
                    <option value="fa">فارسی (ایران)</option>
                    <option value="af">دری (افغانستان)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--fg-tertiary))]">
                  {t('cms.pages.sections')}
                </h2>
                <button className="text-[hsl(var(--color-primary))] text-sm font-medium hover:underline">
                  + Add Section
                </button>
              </div>

              {/* Empty state for sections */}
              <div className="rounded-xl border border-dashed border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-8 text-center">
                <p className="text-sm text-[hsl(var(--fg-secondary))]">No sections added yet.</p>
                <button className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-white border border-[hsl(var(--border-default))] px-4 text-sm font-medium text-[hsl(var(--fg-primary))] transition-colors hover:bg-[hsl(var(--surface-muted))]">
                  + Add First Section
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Live Preview Canvas */}
        <div className="flex-1 bg-[hsl(var(--surface-muted))] p-8 overflow-y-auto flex justify-center">
          <div className="w-full max-w-[1200px] min-h-[800px] rounded-2xl bg-white shadow-sm border border-[hsl(var(--border-default))] flex flex-col items-center justify-center text-[hsl(var(--fg-tertiary))]">
            <Layout className="size-16 mb-4 opacity-20" />
            <p>Live Preview Canvas</p>
            <p className="text-sm mt-2 max-w-sm text-center">
              The Next.js app will render the actual components here based on the JSON
              configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
