// ============================================
// More — account, language, currency, biometrics, sync, sign out.
// ============================================

import React, { useCallback } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Badge, Button, MobileCard, Text, useTheme } from '@hisabche/mobile-ui'
import type { CurrencyCode } from '@hisabche/store'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { setMobileLanguage, supportedLanguages, type SupportedLanguage } from '../../../shared/i18n'
import { useAuthStore, useCurrentUser } from '../../auth/auth.store'
import { useBiometrics } from '../../auth/hooks/use-biometrics'
import { usePendingCount } from '../../offline/use-outbox'
import { usePreferencesStore } from '../preferences.store'

const CURRENCIES: readonly CurrencyCode[] = ['AFN', 'USD', 'PKR', 'IRR'] as const

export function SettingsScreen() {
  const { t, i18n } = useTranslation('mobile')
  const { spacing } = useTheme()
  const router = useRouter()

  const user = useCurrentUser()
  const logout = useAuthStore((s) => s.logout)
  const pending = usePendingCount()

  const currency = usePreferencesStore((s) => s.currency)
  const setCurrency = usePreferencesStore((s) => s.setCurrency)
  const biometricEnabled = usePreferencesStore((s) => s.biometricEnabled)
  const setBiometricEnabled = usePreferencesStore((s) => s.setBiometricEnabled)

  const biometrics = useBiometrics()

  // Turning it on requires passing the prompt once, so the user proves
  // the device can actually unlock before we rely on it.
  const onToggleBiometrics = useCallback(async () => {
    if (biometricEnabled) {
      setBiometricEnabled(false)
      return
    }
    const ok = await biometrics.authenticate(t('auth.biometricPrompt'))
    if (ok) setBiometricEnabled(true)
  }, [biometricEnabled, biometrics, setBiometricEnabled, t])

  const onSelectLanguage = useCallback(async (lang: SupportedLanguage) => {
    const needsReload = await setMobileLanguage(lang)
    if (needsReload) Alert.alert(t('common.loading'))
  }, [t])

  return (
    <AppScreen>
      <ScreenHeader title={t('more.title')} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <MobileCard>
          <Text variant="label" tone="secondary">
            {t('more.account')}
          </Text>
          <View style={{ height: spacing.sm }} />
          <Text variant="heading">{user?.fullName ?? '—'}</Text>
          <Text variant="caption" tone="secondary">
            {user?.email ?? '—'}
          </Text>
          {user?.businessName ? (
            <View style={{ marginTop: spacing.sm }}>
              <Badge label={user.businessName} tone="primary" />
            </View>
          ) : null}
        </MobileCard>

        <MobileCard onPress={() => router.push('/accounting')}>
          <Text variant="bodyStrong">{t('more.accounting')}</Text>
        </MobileCard>

        <MobileCard onPress={() => router.push('/sync')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {t('more.sync')}
            </Text>
            {pending > 0 ? <Badge label={String(pending)} tone="warning" /> : null}
          </View>
        </MobileCard>

        <MobileCard>
          <Text variant="label" tone="secondary">
            {t('more.language')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {supportedLanguages.map((lang) => (
              <Button
                key={lang.code}
                label={lang.nativeName}
                size="sm"
                variant={i18n.language === lang.code ? 'primary' : 'ghost'}
                onPress={() => void onSelectLanguage(lang.code)}
              />
            ))}
          </View>
        </MobileCard>

        <MobileCard>
          <Text variant="label" tone="secondary">
            {t('common.currency')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {CURRENCIES.map((code) => (
              <Button
                key={code}
                label={code}
                size="sm"
                variant={currency === code ? 'primary' : 'ghost'}
                onPress={() => setCurrency(code)}
              />
            ))}
          </View>
        </MobileCard>

        {biometrics.isAvailable ? (
          <MobileCard>
            <Text variant="label" tone="secondary">
              {t('more.security')}
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <Button
                label={t('auth.biometricEnable')}
                size="sm"
                variant={biometricEnabled ? 'primary' : 'ghost'}
                onPress={() => void onToggleBiometrics()}
              />
            </View>
          </MobileCard>
        ) : null}

        <Button
          label={t('common.logout')}
          variant="destructive"
          fullWidth
          onPress={() => void logout()}
        />
      </ScrollView>
    </AppScreen>
  )
}
