'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { UploadCloud, Image as ImageIcon, FileText } from 'lucide-react'

export function CmsMediaClient() {
  const t = useTranslations()

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('cms.media.title')}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{t('cms.media.subtitle')}</p>
        </div>
        <button className="inline-flex h-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--color-primary-hover))]">
          <UploadCloud className="mr-2 size-4" />
          {t('cms.media.upload')}
        </button>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border-default))] py-20 text-center">
        <ImageIcon className="mb-4 size-10 text-[hsl(var(--fg-tertiary))]" />
        <h3 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
          {t('cms.media.empty')}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-[hsl(var(--fg-secondary))]">
          Upload central images here. The CMS handles WebP conversion and responsive variants
          automatically.
        </p>
      </div>
    </div>
  )
}
