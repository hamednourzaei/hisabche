'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { createAdminSupabaseClient } from '@/lib/supabase-client'
import { useRouter, usePathname } from 'next/navigation'

export function LoginClient() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const supabase = createAdminSupabaseClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      // Navigate to dashboard in the same locale
      const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'
      router.replace(`/${localePrefix}/dashboard`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('app.error'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const supabase = createAdminSupabaseClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'
        router.replace(`/${localePrefix}/dashboard`)
      }
    })
  }, [router, pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface-base))] p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">{t('adminPanel.access')}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              className="mb-4 text-sm text-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.08)] border border-[hsl(var(--color-destructive)/0.2)] p-3 rounded-xl flex items-start gap-2"
              role="alert"
            >
              <span className="shrink-0 mt-px opacity-60">⚠</span>
              <span>{error}</span>
            </div>
          )}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const emailInput = form.elements.namedItem('email') as HTMLInputElement
              const passwordInput = form.elements.namedItem('password') as HTMLInputElement
              void handleSignIn(emailInput.value, passwordInput.value)
            }}
          >
            <Input
              name="email"
              type="email"
              required
              dir="ltr"
              label={t('auth.email')}
              disabled={isLoading}
            />
            <Input
              name="password"
              type="password"
              required
              dir="ltr"
              label={t('auth.password')}
              disabled={isLoading}
            />
            <Button type="submit" fullWidth loading={isLoading}>
              {t('auth.signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
