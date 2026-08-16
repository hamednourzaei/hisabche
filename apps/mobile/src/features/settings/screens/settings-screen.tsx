// ============================================
// Settings — account, language, currency, biometrics, sync, sign out.
//
// Reached from More, the same place the web sidebar files it under «سیستم».
// Navigation itself is not this screen's job; MoreScreen renders that.
// ============================================

import React, { useCallback } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Badge, Button, MobileCard, Text, useTheme } from '@hisabche/mobile-ui'
import type { CurrencyCode } from '@hisabche/store'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { setMobileLanguage, supportedLanguages, type SupportedLanguage } from '../../../shared/i18n'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { useAuthStore, useCurrentUser } from '../../auth/auth.store'
import { useBiometrics } from '../../auth/hooks/use-biometrics'
import { usePendingCount } from '../../offline/use-outbox'
import { usePreferencesStore } from '../preferences.store'

const CURRENCIES: readonly CurrencyCode[] = ['AFN', 'USD', 'PKR', 'IRR'] as const

export function SettingsScreen() {
  const { t, i18n } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { spacing, colors } = useTheme()
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

  const onSelectLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      const needsReload = await setMobileLanguage(lang)
      if (needsReload) Alert.alert(t('common.loading'))
    },
    [t],
  )

  return (
    <AppScreen>
      <NavScreenHeader id="settings" />

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

        {/* Sync keeps its shortcut here because the pending-outbox count is the
            one thing a user checks *from* settings. Every other destination now
            lives in More, which renders the shared navigation contract. */}
        <MobileCard testID="open-sync" onPress={() => router.push('/sync-center')}>
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
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
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
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
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

        {/* Safety — mirrors web's SettingsPage SafetySection: the same four
            reassurance checks, each with a check icon, in a 2×2 grid. */}
        <MobileCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text variant="heading">{tCommon('settings.safety', 'امنیت داده‌ها')}</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            {['safety1', 'safety2', 'safety3', 'safety4'].map((key) => (
              <View
                key={key}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  minWidth: 140,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                  padding: spacing.sm,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text variant="caption" style={{ flex: 1 }}>
                  {tCommon(`settings.${key}`, '')}
                </Text>
              </View>
            ))}
          </View>
        </MobileCard>

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
