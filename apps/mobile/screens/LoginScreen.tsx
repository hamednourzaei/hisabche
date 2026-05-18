import React, { memo, useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useAuthStore, useThemeStore } from '@hisabche/store'
import { changeLanguage, isRTL } from '@hisabche/i18n'

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', muted: '#f1f5f9', primary: '#00b97a', primaryFg: '#ffffff', border: '#e2e8f0', input: '#e2e8f0', destructive: '#dc2626', destructiveBg: '#fee2e2' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', muted: '#1e2d45', primary: '#2dd4a0', primaryFg: '#060d1f', border: '#1e2d45', input: '#1e2d45', destructive: '#f87171', destructiveBg: '#450a0a' },
}

// ─── Extracted Components ─────────────────────────────────
const TopBar = memo(function TopBar({ tk, rtl, t, i18n, isDark, toggleLanguage, toggleTheme }: any) {
  return (
    <View style={[s.topBar, { borderBottomColor: tk.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      <View style={[s.brand, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View style={[s.logoBox, { backgroundColor: tk.primary }]}><Text style={[s.logoGlyph, { color: tk.primaryFg }]}>ح</Text></View>
        <Text style={[s.brandName, { color: tk.foreground }]}>{t('app.name')}</Text>
      </View>
      <View style={[s.topActions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={s.iconBtn} onPress={toggleLanguage} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('settings.changeLanguage')}>
          <Text style={[s.iconBtnText, { color: tk.mutedFg }]}>{i18n.language === 'fa-AF' ? 'fa-IR' : 'فا'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={toggleTheme} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('settings.toggleTheme')}>
          <Text style={s.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})

const FieldError = memo(function FieldError({ tk, message }: { tk: any; message?: string | undefined }) {
  if (!message) return null
  return <Text style={[s.fieldError, { color: tk.destructive }]}>{message}</Text>
})

interface Props {
  onLoginSuccess?: () => void
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const { t, i18n } = useTranslation()
  const { login, isLoading, error } = useAuthStore()
  const { isDark, toggle } = useThemeStore()

  const tk = isDark ? tokens.dark : tokens.light
  const rtl = isRTL()
  const dir: 'rtl' | 'ltr' = rtl ? 'rtl' : 'ltr'

  const passwordRef = useRef<TextInput>(null)
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const validate = useCallback((): boolean => {
    const errs: typeof fieldErrors = {}
    if (!email.trim()) errs.email = t('error.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t('error.invalid_email')
    if (!password) errs.password = t('error.required')
    else if (password.length < 8) errs.password = t('auth.passwordMinLength', { defaultValue: 'Min 8 characters' })
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }, [email, password, t])

  const handleLogin = useCallback(async () => {
    if (!validate()) return
    try {
      await login({ email: email.trim(), password })
      onLoginSuccess?.()
    } catch { /* error handled by store */ }
  }, [email, password, login, onLoginSuccess, validate])

  const handleDemo = useCallback(async () => {
    try {
      await login({ email: 'demo@hisabche.com', password: 'Demo1234' })
      onLoginSuccess?.()
    } catch { /* error handled by store */ }
  }, [login, onLoginSuccess])

  const toggleLanguage = useCallback(() => {
    changeLanguage(i18n.language === 'fa-AF' ? 'fa-IR' : 'fa-AF')
  }, [i18n.language])

  const toggleTheme = useCallback(() => toggle(), [toggle])

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TopBar tk={tk} rtl={rtl} t={t} i18n={i18n} isDark={isDark} toggleLanguage={toggleLanguage} toggleTheme={toggleTheme} />

        <ScrollView style={s.fill} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[s.heading, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
            <Text style={[s.headingTitle, { color: tk.foreground }]}>{t('auth.welcomeBack', { defaultValue: t('auth.login') })}</Text>
            <Text style={[s.headingSubtitle, { color: tk.mutedFg }]}>{t('app.tagline')}</Text>
          </View>

          <View style={[s.tabBar, { backgroundColor: tk.muted }]}>
            {(['login', 'register'] as const).map((tb) => (
              <TouchableOpacity key={tb} style={[s.tabItem, tab === tb && { backgroundColor: tk.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]} onPress={() => setTab(tb)} activeOpacity={0.8} accessibilityRole="tab" accessibilityState={{ selected: tab === tb }}>
                <Text style={[s.tabText, { color: tab === tb ? tk.foreground : tk.mutedFg }]}>{tb === 'login' ? t('auth.login') : t('auth.register')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? (
            <View style={[s.errorBox, { backgroundColor: tk.destructiveBg, borderColor: tk.destructive }]} accessibilityRole="alert">
              <Text style={[s.errorBoxText, { color: tk.destructive }]}>⚠️ {error}</Text>
            </View>
          ) : null}

          <View style={s.form}>
            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: tk.foreground, textAlign: dir === 'rtl' ? 'right' : 'left' }]}>{t('auth.email')}</Text>
              <View style={[s.inputWrap, { borderColor: fieldErrors.email ? tk.destructive : tk.input, backgroundColor: tk.background }]}>
                <Text style={[s.inputIcon, { color: tk.mutedFg }]}>✉️</Text>
                <TextInput
                  style={[s.input, { color: tk.foreground, textAlign: dir === 'rtl' ? 'right' : 'left' }]}
                  value={email} onChangeText={setEmail}
                  placeholder="demo@hisabche.com" placeholderTextColor={tk.mutedFg}
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                  returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel={t('auth.email')}
                />
              </View>
              <FieldError tk={tk} message={fieldErrors.email} />
            </View>

            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: tk.foreground, textAlign: dir === 'rtl' ? 'right' : 'left' }]}>{t('auth.password')}</Text>
              <View style={[s.inputWrap, { borderColor: fieldErrors.password ? tk.destructive : tk.input, backgroundColor: tk.background }]}>
                <Text style={[s.inputIcon, { color: tk.mutedFg }]}>🔒</Text>
                <TextInput
                  ref={passwordRef}
                  style={[s.input, { color: tk.foreground, flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }]}
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={tk.mutedFg}
                  secureTextEntry={!showPassword} autoComplete="password"
                  textContentType="password" returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel={t('auth.password')}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}>
                  <Text style={[s.inputIcon, { color: tk.mutedFg }]}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              <FieldError tk={tk} message={fieldErrors.password} />
            </View>

            <TouchableOpacity style={{ alignSelf: rtl ? 'flex-start' : 'flex-end' }} activeOpacity={0.7} accessibilityRole="button">
              <Text style={[s.forgotText, { color: tk.primary }]}>{t('auth.forgotPassword', { defaultValue: 'Forgot password?' })}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: tk.primary }, isLoading && { opacity: 0.7 }]} onPress={handleLogin} disabled={isLoading} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={tab === 'login' ? t('auth.signIn') : t('auth.register')}>
              {isLoading ? <ActivityIndicator color={tk.primaryFg} /> : <Text style={[s.primaryBtnText, { color: tk.primaryFg }]}>{tab === 'login' ? t('auth.signIn') : t('auth.register')}</Text>}
            </TouchableOpacity>

            <View style={[s.dividerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[s.dividerLine, { backgroundColor: tk.border }]} />
              <Text style={[s.dividerText, { color: tk.mutedFg }]}>{t('auth.orContinueWith', { defaultValue: 'or' })}</Text>
              <View style={[s.dividerLine, { backgroundColor: tk.border }]} />
            </View>

            <TouchableOpacity style={[s.outlineBtn, { borderColor: tk.border }]} onPress={handleDemo} disabled={isLoading} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('auth.demoLogin', { defaultValue: 'Demo Login' })}>
              <Text style={[s.outlineBtnText, { color: tk.foreground }]}>🚀 {t('auth.demoLogin', { defaultValue: 'Demo Login' })}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.footer, { color: tk.mutedFg }]}>{t('auth.terms', { defaultValue: 'By continuing, you agree to our Terms of Service.' })}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoGlyph: { fontSize: 16, fontWeight: '700' },
  brandName: { fontSize: 17, fontWeight: '700' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 14, fontWeight: '600' },
  scrollContent: { padding: 24, gap: 20 },
  heading: { gap: 4 },
  headingTitle: { fontSize: 28, fontWeight: '700' },
  headingSubtitle: { fontSize: 14 },
  tabBar: { flexDirection: 'row', borderRadius: 10, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '500' },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12 },
  errorBoxText: { fontSize: 13, fontWeight: '500' },
  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, gap: 8 },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  fieldError: { fontSize: 12 },
  forgotText: { fontSize: 13, fontWeight: '500' },
  primaryBtn: { height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  outlineBtn: { height: 50, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontSize: 15, fontWeight: '500' },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 8 },
})