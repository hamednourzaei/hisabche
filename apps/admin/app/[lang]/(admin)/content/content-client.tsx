'use client'

import { useTranslations } from 'next-intl'
import { HubTabs, useHubTab } from '@/components/ui'
import { BlogAdminClient } from '@/components/blog/blog-admin-client'

const CONTENT_TABS = ['blog'] as const
type ContentTab = (typeof CONTENT_TABS)[number]

export function ContentClient() {
  const t = useTranslations()
  const [tab, setTab] = useHubTab<ContentTab>(CONTENT_TABS)

  return (
    <div className="space-y-6">
      <HubTabs
        label={t('admin.hubs.content.title')}
        items={[{ id: 'blog', label: t('admin.hubs.content.blog') }]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'blog' && <BlogAdminClient />}
    </div>
  )
}
