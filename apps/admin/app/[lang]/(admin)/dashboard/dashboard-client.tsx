'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useAdminStatus } from '@/hooks/use-admin-api'
import { usePathname, useRouter } from 'next/navigation'

export function DashboardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { loading: authLoading, error: authError } = useAdminSession()
  const { data: adminStatus, isLoading: statusLoading, error: statusError } = useAdminStatus()

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <span className="text-lg animate-spin">{t('app.loading')}</span>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4">
          {authError === 'NO_SESSION' ? t('auth.sessionExpired') : t('app.error')}
        </div>
        <button
          type="button"
          onClick={() => router.replace(`/${localePrefix}/login`)}
          className="underline text-red-700"
        >
          {t('common.back')}
        </button>
      </div>
    )
  }

  if (statusError) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4">
          {t('app.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('nav.dashboard')}</h1>
        <div className="text-sm text-muted-foreground">
          {adminStatus?.status === 'ok' ? '●' : '○'}{' '}
          {adminStatus?.status === 'ok' ? t('landing.trustOnline') : t('landing.offline')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('nav.dashboard')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{adminStatus?.status ?? '?'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminStatus?.version ?? '?'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timestamp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {adminStatus?.timestamp ? new Date(adminStatus.timestamp).toLocaleString() : '?'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">●</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
