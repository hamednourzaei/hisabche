// ============================================
// Login — brand hero, floating-label form, biometric unlock.
// Validation reuses the shared Zod schema (@hisabche/validation).
// ============================================

import React, { useCallback, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { loginSchema } from '@hisabche/validation'
import { Button, Input, MobileCard, Screen, Text, useTheme } from '@hisabche/mobile-ui'

import { usePreferencesStore } from '../../settings/preferences.store'
import { useAuthStore } from '../auth.store'
import { BrandHero } from '../components/brand-hero'
import { useBiometrics } from '../hooks/use-biometrics'

interface FieldErrors {
  email?: string | undefined
  password?: string | undefined
}

export function LoginScreen() {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const hydrate = useAuthStore((s) => s.hydrate)

  const biometrics = useBiometrics()
  const biometricEnabled = usePreferencesStore((s) => s.biometricEnabled)

  const onSubmit = useCallback(async () => {
    clearError()
    const parsed = loginSchema.safeParse({ email: email.trim(), password })

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      setFieldErrors({
        email: flat.email?.[0] ? t('auth.invalidEmail') : undefined,
        password: flat.password?.[0] ? t('auth.invalidPassword') : undefined,
      })
      return
    }

    setFieldErrors({})
    await login(parsed.data).catch(() => undefined)
  }, [clearError, email, password, login, t])

  // Unlocks a session that is still on the device — never a password substitute.
  const onBiometricUnlock = useCallback(async () => {
    const ok = await biometrics.authenticate(t('auth.biometricPrompt'))
    if (ok) await hydrate()
  }, [biometrics, hydrate, t])

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: spacing.xl,
            paddingTop: insets.top + spacing['3xl'],
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing['3xl'],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandHero />

          <MobileCard padding="xl" elevated="md" style={{ gap: spacing.lg }}>
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              password
              autoCapitalize="none"
              textContentType="password"
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />

            {error ? (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: 12,
                  backgroundColor: colors.destructiveSoft,
                }}
              >
                <Text variant="caption" tone="danger">
                  {error}
                </Text>
              </View>
            ) : null}

            <Button
              testID="login-submit"
              label={t('auth.submit')}
              onPress={onSubmit}
              loading={isLoading}
              fullWidth
              size="lg"
            />

            {biometrics.isAvailable && biometricEnabled ? (
              <Button
                label={t('auth.biometricUnlock')}
                variant="subtle"
                fullWidth
                onPress={() => void onBiometricUnlock()}
              />
            ) : null}
          </MobileCard>

          <Text variant="legal" tone="tertiary" style={{ textAlign: 'center' }}>
            {t('auth.legal')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
