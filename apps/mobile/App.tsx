import React, { memo, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore, useThemeStore, useOnboardingStore, useSyncStore } from '@hisabche/store'
import { changeLanguage, isRTL } from '@hisabche/i18n'
import LoginScreen from './screens/LoginScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import QuickInvoiceScreen from './screens/QuickInvoiceScreen'
import InvoicesScreen from './screens/InvoicesScreen'
import InvoiceDetailScreen from './screens/InvoiceDetailScreen'
import ProductDetailScreen from './screens/ProductDetailScreen'
import GodamScreen from './screens/GodamScreen'
import BaqidariScreen from './screens/BaqidariScreen'
import SettingsScreen from './screens/SettingsScreen'
import SyncCenterScreen from './screens/SyncCenterScreen'
import FAB from './src/components/FAB'
import TrustBar from './src/components/TrustBar'

type Screen = 'dashboard' | 'godam' | 'faktoor' | 'baqidari' | 'settings' | 'invoiceDetail' | 'productDetail'

const color = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', primary: '#00b97a', primaryFg: '#ffffff', border: '#e2e8f0', headerBg: '#ffffff', navBg: '#ffffff', muted: '#f1f5f9', success: '#16a34a', successBg: '#dcfce7' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', primaryFg: '#060d1f', border: '#1e2d45', headerBg: '#0c1628', navBg: '#0c1628', muted: '#1e2d45', success: '#4ade80', successBg: '#14532d' },
}

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 }
const motion = { fast: { toValue: 0.94, useNativeDriver: true }, spring: { toValue: 1, friction: 3, useNativeDriver: true } }

const NAV_ITEMS: { id: Exclude<Screen, 'invoiceDetail' | 'productDetail'>; emoji: string; labelKey: string }[] = [
  { id: 'dashboard', emoji: '⊞', labelKey: 'nav.dashboard' },
  { id: 'godam', emoji: '📦', labelKey: 'nav.godam' },
  { id: 'faktoor', emoji: '🧾', labelKey: 'nav.faktoor' },
  { id: 'baqidari', emoji: '📒', labelKey: 'nav.baqidari' },
  { id: 'settings', emoji: '⚙️', labelKey: 'nav.settings' },
]

const queryClient = new QueryClient()

const NavItem = memo(function NavItem({ item, active, onPress, tk, t }: { item: typeof NAV_ITEMS[0]; active: boolean; onPress: () => void; tk: any; t: any }) {
  const scale = useRef(new Animated.Value(1)).current
  const handlePressIn = () => Animated.spring(scale, { ...motion.fast }).start()
  const handlePressOut = () => Animated.spring(scale, { ...motion.spring }).start()
  return (
    <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1} style={[s.navItem, active && { backgroundColor: tk.primary + '22' }]} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t(item.labelKey)}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center', gap: 3 }}>
        <Text style={[s.navEmoji, { opacity: active ? 1 : 0.45 }]}>{item.emoji}</Text>
        <Text style={[s.navLabel, { color: active ? tk.primary : tk.mutedFg }, active && { fontWeight: '700' }]} numberOfLines={1}>{t(item.labelKey)}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
})

const GridCard = memo(function GridCard({ item, onPress, tk, t }: { item: typeof NAV_ITEMS[0]; onPress: () => void; tk: any; t: any }) {
  const scale = useRef(new Animated.Value(1)).current
  const handlePressIn = () => Animated.spring(scale, { ...motion.fast }).start()
  const handlePressOut = () => Animated.spring(scale, { ...motion.spring }).start()
  return (
    <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1} style={{ width: '48%', marginBottom: spacing.sm }} accessibilityRole="button" accessibilityLabel={t(item.labelKey)}>
      <Animated.View style={[s.gridCard, { backgroundColor: tk.card, borderColor: tk.cardBorder }, { transform: [{ scale }] }]}>
        <Text style={s.gridEmoji}>{item.emoji}</Text>
        <Text style={[s.gridLabel, { color: tk.foreground }]}>{t(item.labelKey)}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
})

function AppInner() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated, isLoading, user, logout } = useAuthStore()
  const { isDark, toggle } = useThemeStore()
  const { isCompleted: onboardingDone } = useOnboardingStore()
  const { isOnline, pendingCount, lastSyncedAt } = useSyncStore()

  const [screen, setScreen] = React.useState<Screen>('dashboard')
  const [detailInvoiceId, setDetailInvoiceId] = React.useState<string | null>(null)
  const [detailProductId, setDetailProductId] = React.useState<string | null>(null)
  const [showQuickInvoice, setShowQuickInvoice] = React.useState(false)
  const [showSyncCenter, setShowSyncCenter] = React.useState(false)

  const tk = useMemo(() => isDark ? color.dark : color.light, [isDark])
  const rtl = isRTL()
  const dir: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row'

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr'
      document.documentElement.className = isDark ? 'dark' : ''
    }
  }, [i18n.language, isDark, rtl])

  const toggleLanguage = useCallback(() => changeLanguage(i18n.language === 'fa-AF' ? 'fa-IR' : 'fa-AF'), [i18n.language])

  const handleNavigate = useCallback((id: string) => {
    if (id === 'faktoor' || id === 'godam' || id === 'baqidari' || id === 'settings') {
      setScreen(id as Screen)
      setDetailInvoiceId(null)
      setDetailProductId(null)
    } else {
      setScreen('dashboard')
    }
  }, [])

  useEffect(() => {
    // @ts-ignore
    global.navigation = {
      navigate: (screenName: string, params?: any) => {
        if (screenName === 'InvoiceDetail' && params?.id) {
          setDetailInvoiceId(params.id)
          setScreen('invoiceDetail')
        }
        if (screenName === 'ProductDetail' && params?.id) {
          setDetailProductId(params.id)
          setScreen('productDetail')
        }
      },
      goBack: () => {
        setScreen('faktoor')
        setDetailInvoiceId(null)
        setDetailProductId(null)
      },
    }
  }, [])

  if (isLoading) {
    return (
      <View style={[s.fill, s.center, { backgroundColor: tk.background }]}>
        <View style={[s.logoBox, { backgroundColor: tk.primary }]}><Text style={[s.logoGlyph, { color: tk.primaryFg }]}>ح</Text></View>
        <Text style={[s.brandName, { color: tk.primary, marginTop: spacing.md }]}>{t('app.name')}</Text>
      </View>
    )
  }

  if (showSyncCenter) return <SyncCenterScreen onBack={() => setShowSyncCenter(false)} />
  if (!onboardingDone) return <OnboardingScreen onComplete={() => {}} />
  if (showQuickInvoice) return <QuickInvoiceScreen onComplete={() => setShowQuickInvoice(false)} />
  if (!isAuthenticated) return <LoginScreen />

  if (screen === 'invoiceDetail' && detailInvoiceId) {
    return (
      <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
        <View style={[s.header, { backgroundColor: tk.headerBg, borderBottomColor: tk.border, flexDirection: dir }]}>
          <TouchableOpacity onPress={() => { setScreen('faktoor'); setDetailInvoiceId(null) }} style={s.iconBtn}>
            <Text style={[s.iconBtnText, { color: tk.primary, fontSize: 18 }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: tk.foreground }]}>جزئیات فاکتور</Text>
          <View style={{ width: 34 }} />
        </View>
        <InvoiceDetailScreen route={{ params: { id: detailInvoiceId } }} />
      </SafeAreaView>
    )
  }

  if (screen === 'productDetail' && detailProductId) {
    return (
      <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
        <View style={[s.header, { backgroundColor: tk.headerBg, borderBottomColor: tk.border, flexDirection: dir }]}>
          <TouchableOpacity onPress={() => { setScreen('godam'); setDetailProductId(null) }} style={s.iconBtn}>
            <Text style={[s.iconBtnText, { color: tk.primary, fontSize: 18 }]}>←</Text>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: tk.foreground }]}>جزئیات محصول</Text>
          <View style={{ width: 34 }} />
        </View>
        <ProductDetailScreen route={{ params: { id: detailProductId } }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[s.header, { backgroundColor: tk.headerBg, borderBottomColor: tk.border, flexDirection: dir }]}>
        <View style={[s.headerBrand, { flexDirection: dir }]}>
          <View style={[s.logoBoxSm, { backgroundColor: tk.primary }]}><Text style={[s.logoGlyphSm, { color: tk.primaryFg }]}>ح</Text></View>
          <Text style={[s.headerTitle, { color: tk.foreground }]}>{t('app.name')}</Text>
          <View style={[s.badge, { backgroundColor: tk.successBg }]}><Text style={[s.badgeText, { color: tk.success }]}>{user?.businessName ?? t('nav.dashboard')}</Text></View>
        </View>
        <View style={[s.headerActions, { flexDirection: dir }]}>
          <TouchableOpacity style={s.iconBtn} onPress={toggleLanguage} activeOpacity={0.7}>
            <Text style={[s.iconBtnText, { color: tk.mutedFg }]}>{i18n.language === 'fa-AF' ? 'fa-IR' : 'فا'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={toggle} activeOpacity={0.7}>
            <Text style={s.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.outlineBtnSm, { borderColor: tk.border }]} onPress={logout} activeOpacity={0.7}>
            <Text style={[s.outlineBtnText, { color: tk.mutedFg, fontSize: 12 }]}>{t('auth.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TrustBar isOnline={isOnline} pendingCount={pendingCount} lastSyncedAgo={lastSyncedAt ? 'لحظاتی پیش' : ''} onPress={() => setShowSyncCenter(true)} />

      <ScrollView style={s.fill} contentContainerStyle={s.content}>
        {screen === 'dashboard' && (
          <>
            <Text style={[s.pageTitle, { color: tk.foreground }]}>{t(`nav.${screen}`)}</Text>
            <View style={[s.card, { backgroundColor: tk.card, borderColor: tk.cardBorder }]}>
              <Text style={[s.cardTitle, { color: tk.foreground }]}>{t(`nav.${screen}`)}</Text>
              <Text style={[s.cardDesc, { color: tk.mutedFg }]}>{t('dashboard.ready', { defaultValue: 'همه چیز آماده است!' })}</Text>
              {user && (
                <View style={[s.userRow, { borderTopColor: tk.border, flexDirection: dir }]}>
                  <View style={[s.avatar, { backgroundColor: tk.primary }]}><Text style={[s.avatarText, { color: tk.primaryFg }]}>{(user.businessName ?? user.email)?.[0]?.toUpperCase() ?? 'H'}</Text></View>
                  <View style={s.fill}><Text style={[s.userName, { color: tk.foreground }]}>{user.businessName ?? user.email}</Text><Text style={[s.userEmail, { color: tk.mutedFg }]}>{user.email}</Text></View>
                </View>
              )}
            </View>
            <View style={s.grid}>
              {NAV_ITEMS.filter((n) => n.id !== 'settings').map((item) => (
                <GridCard key={item.id} item={item} onPress={() => handleNavigate(item.id)} tk={tk} t={t} />
              ))}
            </View>
          </>
        )}
        {screen === 'godam' && <GodamScreen />}
        {screen === 'faktoor' && <InvoicesScreen />}
        {screen === 'baqidari' && <BaqidariScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </ScrollView>

      {screen !== 'invoiceDetail' && screen !== 'productDetail' && (
        <View style={[s.bottomNav, { backgroundColor: tk.navBg, borderTopColor: tk.border }]}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.id} item={item} active={screen === item.id} onPress={() => handleNavigate(item.id)} tk={tk} t={t} />
          ))}
        </View>
      )}

      {screen !== 'invoiceDetail' && screen !== 'productDetail' && (
        <FAB primaryColor={tk.primary} actions={[
          { id: 'invoice', label: t('faktoor.newFaktoor'), emoji: '🧾', onPress: () => setShowQuickInvoice(true) },
          { id: 'customer', label: t('nav.customers'), emoji: '👤', onPress: () => handleNavigate('baqidari') },
          { id: 'product', label: t('godam.addProduct'), emoji: '📦', onPress: () => handleNavigate('godam') },
        ]} />
      )}
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  logoBox:     { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  logoGlyph:   { fontSize: 30, fontWeight: '700' },
  logoBoxSm:   { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoGlyphSm: { fontSize: 16, fontWeight: '700' },
  brandName:   { fontSize: 28, fontWeight: '700' },

  header:        { height: 60, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderBottomWidth: 1 },
  headerBrand:   { alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerTitle:   { fontSize: 17, fontWeight: '700' },
  headerActions: { alignItems: 'center', gap: 6 },
  iconBtn:       { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:   { fontSize: 14, fontWeight: '600' },
  badge:         { borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: spacing.sm },
  badgeText:     { fontSize: 11, fontWeight: '600' },
  outlineBtnSm:  { borderRadius: radius.sm, borderWidth: 1, paddingVertical: 5, paddingHorizontal: spacing.sm },
  outlineBtnText:{ fontSize: 13, fontWeight: '500' },

  content:   { padding: spacing.lg, paddingBottom: 220 },
  pageTitle: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  card:      { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardDesc:  { fontSize: 14 },
  userRow:   { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1 },
  avatar:    { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 16, fontWeight: '700' },
  userName:  { fontSize: 14, fontWeight: '600' },
  userEmail: { fontSize: 12 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  gridCard:  { aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  gridEmoji: { fontSize: 38 },
  gridLabel: { fontSize: 14, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },

  bottomNav: { flexDirection: 'row', borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? spacing.lg : 6 },
  navItem:   { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm, margin: 3, gap: 3 },
  navEmoji:  { fontSize: 20 },
  navLabel:  { fontSize: 10, fontWeight: '500' },
})