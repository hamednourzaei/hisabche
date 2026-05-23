"use client"

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent } from '@hisabche/ui'
import { useAuthStore, useThemeStore } from '@hisabche/store'
import { changeLanguage, type SupportedLanguage } from '@hisabche/i18n'
import { Languages, Sun, Moon } from 'lucide-react'

export function LoginScreen() {
  const { t, i18n } = useTranslation()
  const { login, isLoading } = useAuthStore()
  const { isDark, toggle } = useThemeStore()

  const toggleLang = useCallback(() => {
    const next: SupportedLanguage = i18n.language === 'fa-AF' ? 'fa-IR' : 'fa-AF'
    changeLanguage(next)
  }, [i18n.language])

  return (
    <div className="hisab-root flex items-center justify-center p-4">
      <Card className="glass-card w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--hisab-primary)] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">ح</span>
            </div>
            <h1 className="text-3xl font-bold mb-1">{t('app.name')}</h1>
            <p className="text-[var(--hisab-muted-fg)] text-sm">{t('app.tagline')}</p>
          </div>

          <Button variant="default" size="lg" className="w-full" disabled={isLoading}
            onClick={() => login({ email: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? '', password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '' })}>
            {isLoading ? t('app.loading') : t('auth.signIn')}
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLang} icon={<Languages className="size-4" />}>
              {i18n.language === 'fa-AF' ? 'فارسی' : 'دری'}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggle} icon={isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}>
              {isDark ? t('settings.light') : t('settings.dark')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}