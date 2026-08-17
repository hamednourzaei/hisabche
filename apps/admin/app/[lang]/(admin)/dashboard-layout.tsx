'use client'

import type { ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { ElementType } from 'react'
import { useState, memo } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LayoutDashboard } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui'
import { DashboardHeader } from '@/components/ui'

const ADMIN_NAV_ITEMS: { id: string; icon: ElementType; label: string; path: string }[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard as unknown as ElementType,
    label: 'nav.dashboard',
    path: '/dashboard',
  },
]

const AdminDashboardLayout = memo(function AdminDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const [isDark, setIsDark] = useState(false)

  const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'

  const handleNavigate = (_id: string, path: string) => {
    router.push(`/${localePrefix}${path}`)
  }
  const handleLogout = () => {
    router.replace(`/${localePrefix}/login`)
  }
  const handleToggleTheme = () => setIsDark((d) => !d)
  const handleToggleLang = () => {
    const newLocale = localePrefix === 'fa' ? 'en' : 'fa'
    const segments = pathname.split('/').filter(Boolean)
    segments[0] = newLocale
    router.push(`/${segments.join('/')}`)
  }
  const handleNavigateLogin = () => router.replace(`/${localePrefix}/login`)

  return (
    <div
      className={cn(
        'flex min-h-screen',
        'bg-[hsl(var(--surface-base))]',
        'text-[hsl(var(--fg-primary))]',
      )}
    >
      <DashboardSidebar
        primaryItems={ADMIN_NAV_ITEMS}
        moreGroups={[]}
        moreIcon={LayoutDashboard as unknown as ElementType}
        activeNav={pathname}
        onNavigate={handleNavigate}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          appName={t('app.name')}
          lastSyncedAt={null}
          isOnline={true}
          isSyncing={false}
          pendingCount={0}
          currentLang={localePrefix}
          isDark={isDark}
          signInLabel={t('auth.signIn')}
          signOutLabel={t('auth.signOut')}
          onToggleTheme={handleToggleTheme}
          onToggleLang={handleToggleLang}
          onLogout={handleLogout}
          onNavigateLogin={handleNavigateLogin}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
})

AdminDashboardLayout.displayName = 'AdminDashboardLayout'
export default AdminDashboardLayout
