import React, { memo, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useThemeStore, useAuthStore, useBackupStore } from '@hisabche/store'
import { changeLanguage, isRTL } from '@hisabche/i18n'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', primaryFg: '#ffffff', border: '#e2e8f0', muted: '#f1f5f9', success: '#16a34a', successBg: '#dcfce7', destructive: '#dc2626', destructiveBg: '#fee2e2' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', primaryFg: '#060d1f', border: '#1e2d45', muted: '#1e2d45', success: '#4ade80', successBg: '#14532d', destructive: '#f87171', destructiveBg: '#450a0a' },
}

// ─── Extracted Components ─────────────────────────────────
const SettingsSection = memo(function SettingsSection({ tk, title, children }: { tk: any; title: string; children: React.ReactNode }) {
  return (
    <View style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]}>
      <Text style={[s.sectionTitle, { color: tk.foreground }]} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  )
})

const SettingsRow = memo(function SettingsRow({ tk, label, desc, dir, children }: { tk: any; label: string; desc?: string; dir: any; children?: React.ReactNode }) {
  return (
    <View style={[s.settingRow, { flexDirection: dir, borderTopColor: tk.border }]}>
      <View style={s.fill}>
        <Text style={[s.settingLabel, { color: tk.foreground }]}>{label}</Text>
        {desc ? <Text style={[s.settingDesc, { color: tk.mutedFg }]}>{desc}</Text> : null}
      </View>
      {children}
    </View>
  )
})

const DangerButton = memo(function DangerButton({ tk, label, onPress }: { tk: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.logoutBtn, { backgroundColor: tk.destructiveBg, borderColor: tk.destructive }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[s.logoutText, { color: tk.destructive }]}>{label}</Text>
    </TouchableOpacity>
  )
})

// ─── SettingsScreen ───────────────────────────────────────
export default function SettingsScreen() {
  const { t, i18n } = useTranslation()
  const { isDark, toggle } = useThemeStore()
  const { user, logout } = useAuthStore()
  const { autoBackupEnabled, setAutoBackup } = useBackupStore()

  const tk = useMemo(() => isDark ? tokens.dark : tokens.light, [isDark])
  const rtl = isRTL()
  const dir = useMemo(() => rtl ? 'row-reverse' as const : 'row' as const, [rtl])

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('auth.logout'),
      t('auth.logoutConfirm', { defaultValue: 'آیا مطمئن هستید؟' }),
      [
        { text: t('action.cancel'), style: 'cancel' },
        { text: t('auth.logout'), style: 'destructive', onPress: logout },
      ],
    )
  }, [t, logout])

  const securityItems = useMemo(() => [
    t('settings.securityItems.storedLocally'),
    t('settings.securityItems.offlineMode'),
    t('settings.securityItems.autoBackup24h'),
    t('settings.securityItems.syncEncrypted'),
    t('settings.securityItems.softDelete30d'),
  ], [t])

  return (
    <View style={s.fill}>
      <ScrollView style={s.fill} contentContainerStyle={s.content}>
        {user && (
          <View style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]}>
            <View style={[s.row, { flexDirection: dir }]}>
              <View style={[s.avatar, { backgroundColor: tk.primary }]}>
                <Text style={[s.avatarText, { color: tk.primaryFg }]}>{(user.businessName ?? user.email)?.[0]?.toUpperCase() ?? 'H'}</Text>
              </View>
              <View style={s.fill}>
                <Text style={[s.cardTitle, { color: tk.foreground }]}>{user.businessName ?? user.email}</Text>
                <Text style={[s.cardDesc, { color: tk.mutedFg }]}>{user.email}</Text>
              </View>
            </View>
          </View>
        )}

        <SettingsSection tk={tk} title={t('settings.theme')}>
          <SettingsRow tk={tk} label={isDark ? t('settings.dark') : t('settings.light')} dir={dir}>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: tk.border, true: tk.primary + '88' }}
              thumbColor={isDark ? tk.primary : '#f4f3f4'}
              accessibilityRole="switch"
              accessibilityLabel={t('settings.theme')}
              accessibilityState={{ checked: isDark }}
            />
          </SettingsRow>
          <SettingsRow tk={tk} label={t('settings.language')} desc={i18n.language === 'fa-AF' ? 'دری' : 'فارسی'} dir={dir}>
            <View style={[s.langRow, { flexDirection: dir }]}>
              {(['fa-AF', 'fa-IR'] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[s.langBtn, { borderColor: tk.border }, i18n.language === lang && { backgroundColor: tk.primary, borderColor: tk.primary }]}
                  onPress={() => changeLanguage(lang as any)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={lang === 'fa-AF' ? 'دری' : 'فارسی'}
                  accessibilityState={{ selected: i18n.language === lang }}
                >
                  <Text style={[s.langBtnText, { color: i18n.language === lang ? tk.primaryFg : tk.mutedFg }]}>{lang === 'fa-AF' ? 'دری' : 'فارسی'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection tk={tk} title={t('settings.backup')}>
          <SettingsRow tk={tk} label={t('settings.autoBackup')} dir={dir}>
            <Switch
              value={autoBackupEnabled}
              onValueChange={setAutoBackup}
              trackColor={{ false: tk.border, true: tk.primary + '88' }}
              thumbColor={autoBackupEnabled ? tk.primary : '#f4f3f4'}
              accessibilityRole="switch"
              accessibilityLabel={t('settings.autoBackup')}
              accessibilityState={{ checked: autoBackupEnabled }}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection tk={tk} title={t('settings.security')}>
          {securityItems.map((item, i) => (
            <View key={i} style={[s.safetyRow, { borderTopColor: tk.border }]}>
              <Text style={[s.safetyText, { color: tk.mutedFg }]}>✅ {item}</Text>
            </View>
          ))}
        </SettingsSection>

        <DangerButton tk={tk} label={`🚪 ${t('auth.signOut')}`} onPress={handleLogout} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  row: { alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 13 },
  settingRow: { paddingVertical: 12, borderTopWidth: 1, alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  settingLabel: { fontSize: 14, fontWeight: '500' },
  settingDesc: { fontSize: 12, marginTop: 2 },
  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: { borderRadius: 8, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 12 },
  langBtnText: { fontSize: 13, fontWeight: '600' },
  safetyRow: { paddingVertical: 8, borderTopWidth: 1 },
  safetyText: { fontSize: 13 },
  logoutBtn: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: 'center', marginTop: 4 },
  logoutText: { fontSize: 15, fontWeight: '600' },
})