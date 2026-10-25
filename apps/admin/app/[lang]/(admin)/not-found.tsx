'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, EmptyState } from '@/components/ui'
import { localeOf } from '@/components/admin-shell/admin-nav'

/**
 * Not-found boundary for the console. It is a client component because
 * `not-found.tsx` receives no route params — the language comes from the
 * pathname, so the way back keeps the operator's locale.
 */
export default function AdminNotFound() {
  const t = useTranslations()
  const pathname = usePathname()
  const locale = localeOf(pathname)

  return (
    <div className="space-y-6">
      <EmptyState
        icon="search"
        title={t('admin.notFound.title')}
        description={t('admin.notFound.description')}
      />
      <div className="text-center">
        <Button asChild className="min-h-[44px]">
          <Link href={`/${locale}/dashboard`}>{t('admin.notFound.home')}</Link>
        </Button>
      </div>
    </div>
  )
}
