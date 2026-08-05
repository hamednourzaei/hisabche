// ============================================
// Login — validated with the shared Zod schema (@hisabche/validation).
// ============================================

import React, { useCallback, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { loginSchema } from '@hisabche/validation'

import { Button, Card, Input } from '@/components/ui/primitives'
import { useAuthStore } from './auth.store'

interface FieldErrors {
  email?: string
  password?: string
}

export function LoginPage() {
  const { t } = useTranslation('desktop')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      clearError()

      const parsed = loginSchema.safeParse({ email: email.trim(), password })
      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors
        setFieldErrors({
          ...(flat.email ? { email: t('auth.invalidEmail') } : {}),
          ...(flat.password ? { password: t('auth.invalidPassword') } : {}),
        })
        return
      }

      setFieldErrors({})
      await login(parsed.data).catch(() => undefined)
    },
    [clearError, email, login, password, t]
  )

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="flex h-full items-center justify-center bg-[hsl(var(--surface-base))] p-8">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]">
            <span className="text-xl font-bold">ح</span>
          </div>
          <h1 className="text-lg font-bold">{t('auth.title')}</h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('auth.tagline')}</p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-xs text-[hsl(var(--fg-secondary))]">
            {t('auth.email')}
            <Input
              type="email"
              autoComplete="email"
              value={email}
              invalid={Boolean(fieldErrors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[hsl(var(--fg-secondary))]">
            {t('auth.password')}
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={Boolean(fieldErrors.password)}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {(fieldErrors.email || fieldErrors.password || error) && (
            <p className="text-xs text-[hsl(var(--color-destructive))]">
              {fieldErrors.email ?? fieldErrors.password ?? error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="mt-2">
            {isLoading ? t('common.loading') : t('auth.submit')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
