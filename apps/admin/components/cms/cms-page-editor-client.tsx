'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowRight, Save } from 'lucide-react'
import { apiClient, apiErrorMessage } from '@hisabche/api'

import {
  Button,
  Card,
  Input,
  SelectField,
  Skeleton,
  useLocalePush,
  useRouteLang,
} from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'

interface EditorProps {
  isNew: boolean
  pageId?: string
}

/** The fields this form edits, and what `GET /api/cms/pages/:id` returns for them. */
interface CmsPageDetail {
  id: string
  title: string
  slug: string
  locale: string
}

interface CmsPageInput {
  title: string
  slug: string
  locale: string
}

/** The locales `pageInputSchema` accepts. */
const CMS_LOCALES = ['fa', 'af', 'en'] as const

export function CmsPageEditorClient({ isNew, pageId }: EditorProps) {
  const t = useTranslations()

  const page = useQuery<CmsPageDetail>({
    queryKey: ['cms-page', pageId],
    enabled: !isNew,
    queryFn: async () => {
      const res = await apiClient.get<CmsPageDetail>(`/api/cms/pages/${pageId}`)
      return res.data
    },
  })

  if (!isNew && page.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />
  }

  if (!isNew && page.isError) {
    return <ErrorState message={t('common.loadError')} onRetry={() => void page.refetch()} />
  }

  return (
    <PageForm
      key={page.data?.id ?? 'new'}
      isNew={isNew}
      pageId={pageId}
      initial={page.data ?? null}
    />
  )
}

function PageForm({
  isNew,
  pageId,
  initial,
}: {
  isNew: boolean
  pageId?: string
  initial: CmsPageDetail | null
}) {
  const t = useTranslations()
  const push = useLocalePush()
  const lang = useRouteLang()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [locale, setLocale] = useState<string>(initial?.locale ?? 'fa')

  const save = useMutation({
    mutationFn: async (input: CmsPageInput) => {
      if (isNew) {
        await apiClient.post('/api/cms/pages', input)
      } else {
        await apiClient.put(`/api/cms/pages/${pageId}`, input)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cms-pages'] })
      push('/cms/pages')
    },
  })

  const canSave = title.trim().length > 0 && slug.trim().length > 0 && !save.isPending

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={lang ? `/${lang}/cms/pages` : '/cms/pages'} aria-label={t('common.back')}>
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          {isNew ? t('cms.pages.newTitle') : (initial?.title ?? t('common.edit'))}
        </h1>
      </div>

      <Card className="space-y-4 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">{t('common.title')}</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">{t('cms.pages.slug')}</span>
          <Input
            dir="ltr"
            className="font-mono"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">{t('cms.pages.locale')}</span>
          <SelectField
            value={locale}
            onChange={setLocale}
            options={CMS_LOCALES.map((value) => ({
              value,
              label: t(`admin.cms.locales.${value}`),
            }))}
            aria-label={t('cms.pages.locale')}
          />
        </div>

        {save.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {apiErrorMessage(save.error, t('common.saveError'))}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            onClick={() => save.mutate({ title: title.trim(), slug: slug.trim(), locale })}
            disabled={!canSave}
          >
            <Save className="me-2 size-4" aria-hidden="true" />
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
