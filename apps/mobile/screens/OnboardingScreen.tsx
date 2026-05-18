import React, { memo, useMemo, useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useOnboardingStore, useThemeStore } from '@hisabche/store'
import { changeLanguage } from '@hisabche/i18n'

type BusinessType = 'retail' | 'wholesale' | 'restaurant' | 'service' | 'other'
type StoreSize = 'small' | 'medium' | 'large'
type Step = 0 | 1 | 2 | 3

const tokens = {
  light: { background: '#ffffff', card: '#ffffff', cardBorder: '#e2e8f0', foreground: '#060d1f', mutedFg: '#64748b', muted: '#f1f5f9', primary: '#00b97a', primaryFg: '#ffffff', border: '#e2e8f0', success: '#16a34a', successBg: '#dcfce7' },
  dark: { background: '#060d1f', card: '#0c1628', cardBorder: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', muted: '#1e2d45', primary: '#2dd4a0', primaryFg: '#060d1f', border: '#1e2d45', success: '#4ade80', successBg: '#14532d' },
}

const BUSINESS_TYPES = [
  { id: 'retail' as BusinessType, emoji: '🏪', labelFa: 'خرده‌فروشی' },
  { id: 'wholesale' as BusinessType, emoji: '🏢', labelFa: 'عمده‌فروشی' },
  { id: 'restaurant' as BusinessType, emoji: '🍽️', labelFa: 'رستورانت' },
  { id: 'service' as BusinessType, emoji: '🔧', labelFa: 'خدماتی' },
  { id: 'other' as BusinessType, emoji: '📦', labelFa: 'سایر' },
] as const

const STORE_SIZES = [
  { id: 'small' as StoreSize, emoji: '🏪', labelFa: 'دکان کوچک', desc: '۱–۲ کارمند' },
  { id: 'medium' as StoreSize, emoji: '🏬', labelFa: 'فروشگاه متوسط', desc: '۳–۱۰ کارمند' },
  { id: 'large' as StoreSize, emoji: '🏗️', labelFa: 'تجارت بزرگ', desc: '۱۰+ کارمند' },
] as const

// ─── Step Components ──────────────────────────────────────
const WelcomeStep = memo(function WelcomeStep({ tk, onNext }: { tk: any; onNext: () => void }) {
  return (
    <View style={s.stepContent}>
      <View style={[s.welcomeIcon, { backgroundColor: tk.primary + '15' }]}>
        <Text style={s.welcomeEmoji}>🧮</Text>
      </View>
      <Text style={[s.welcomeTitle, { color: tk.foreground }]}>به حساب‌چه خوش آمدید!</Text>
      <Text style={[s.welcomeSub, { color: tk.mutedFg }]}>بیایید در چند قدم کوتاه، حساب‌چه را برای شما آماده کنیم.</Text>
      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: tk.primary }]} onPress={onNext} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="شروع کنید">
        <Text style={[s.primaryBtnText, { color: tk.primaryFg }]}>شروع کنید</Text>
      </TouchableOpacity>
    </View>
  )
})

const BusinessTypeStep = memo(function BusinessTypeStep({ tk, selected, onSelect }: { tk: any; selected: BusinessType | null; onSelect: (id: BusinessType) => void }) {
  return (
    <View style={s.stepContent}>
      <Text style={[s.stepTitle, { color: tk.foreground }]}>نوع کسب‌وکار شما چیست؟</Text>
      <View style={s.grid}>
        {BUSINESS_TYPES.map((bt) => (
          <TouchableOpacity
            key={bt.id}
            style={[s.optionCard, { borderColor: selected === bt.id ? tk.primary : tk.border, backgroundColor: selected === bt.id ? tk.primary + '10' : tk.card }]}
            onPress={() => onSelect(bt.id)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === bt.id }}
            accessibilityLabel={bt.labelFa}
          >
            <Text style={s.optionEmoji}>{bt.emoji}</Text>
            <Text style={[s.optionLabel, { color: tk.foreground }]}>{bt.labelFa}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
})

const StoreSizeStep = memo(function StoreSizeStep({ tk, selected, onSelect }: { tk: any; selected: StoreSize | null; onSelect: (id: StoreSize) => void }) {
  return (
    <View style={s.stepContent}>
      <Text style={[s.stepTitle, { color: tk.foreground }]}>اندازه تجارت شما چقدر است؟</Text>
      {STORE_SIZES.map((sz) => (
        <TouchableOpacity
          key={sz.id}
          style={[s.sizeCard, { borderColor: selected === sz.id ? tk.primary : tk.border, backgroundColor: selected === sz.id ? tk.primary + '10' : tk.card }]}
          onPress={() => onSelect(sz.id)}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === sz.id }}
          accessibilityLabel={sz.labelFa}
        >
          <Text style={s.sizeEmoji}>{sz.emoji}</Text>
          <View style={s.flex1}>
            <Text style={[s.sizeLabel, { color: tk.foreground }]}>{sz.labelFa}</Text>
            <Text style={[s.sizeDesc, { color: tk.mutedFg }]}>{sz.desc}</Text>
          </View>
          {selected === sz.id && <Text style={[s.checkmark, { color: tk.primary }]}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>
  )
})

const SummaryStep = memo(function SummaryStep({ tk, businessType, storeSize, onComplete }: { tk: any; businessType: BusinessType | null; storeSize: StoreSize | null; onComplete: () => void }) {
  const btLabel = useMemo(() => BUSINESS_TYPES.find(b => b.id === businessType)?.labelFa || '-', [businessType])
  const szLabel = useMemo(() => STORE_SIZES.find(s => s.id === storeSize)?.labelFa || '-', [storeSize])

  return (
    <View style={s.stepContent}>
      <View style={[s.checkCircle, { backgroundColor: tk.successBg }]}>
        <Text style={[s.checkIcon, { color: tk.success }]}>✓</Text>
      </View>
      <Text style={[s.stepTitle, { color: tk.foreground }]}>آماده‌اید!</Text>
      <Text style={[s.welcomeSub, { color: tk.mutedFg }]}>حساب‌چه برای شما آماده است. بیایید اولین فاکتور را ثبت کنیم.</Text>
      <View style={[s.summaryBox, { backgroundColor: tk.card, borderColor: tk.border }]}>
        <View style={s.summaryRow}>
          <Text style={[s.summaryKey, { color: tk.mutedFg }]}>نوع کسب‌وکار:</Text>
          <Text style={[s.summaryVal, { color: tk.foreground }]}>{btLabel}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.summaryKey, { color: tk.mutedFg }]}>اندازه:</Text>
          <Text style={[s.summaryVal, { color: tk.foreground }]}>{szLabel}</Text>
        </View>
      </View>
      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: tk.primary }]} onPress={onComplete} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="ورود به حساب‌چه">
        <Text style={[s.primaryBtnText, { color: tk.primaryFg }]}>ورود به حساب‌چه</Text>
      </TouchableOpacity>
    </View>
  )
})

// ─── OnboardingScreen ─────────────────────────────────────
interface Props { onComplete?: () => void }

export default function OnboardingScreen({ onComplete }: Props) {
  const { t, i18n } = useTranslation()
  const { isDark } = useThemeStore()
  const { step, businessType, storeSize, setStep, setBusinessType, setStoreSize, completeOnboarding } = useOnboardingStore()

  const tk = isDark ? tokens.dark : tokens.light

  const handleComplete = useCallback(() => {
    completeOnboarding()
    onComplete?.()
  }, [completeOnboarding, onComplete])

  const handleNext = useCallback(() => setStep((step + 1) as Step), [step, setStep])
  const handleBack = useCallback(() => setStep((step - 1) as Step), [step, setStep])

  const isNextDisabled = step === 1 ? !businessType : step === 2 ? !storeSize : false

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: tk.background }]}>
      <View style={[s.progressBar, { backgroundColor: tk.muted }]}>
        <View style={[s.progressFill, { backgroundColor: tk.primary, width: `${((step + 1) / 4) * 100}%` }]} />
      </View>

      <View style={[s.header, { borderBottomColor: tk.border }]}>
        <View style={s.headerLeft}>
          <View style={[s.logoBox, { backgroundColor: tk.primary }]}>
            <Text style={[s.logoGlyph, { color: tk.primaryFg }]}>ح</Text>
          </View>
          <Text style={[s.headerTitle, { color: tk.foreground }]}>{t('app.name')}</Text>
        </View>
        <TouchableOpacity onPress={() => changeLanguage(i18n.language === 'fa-AF' ? 'fa-IR' : 'fa-AF' as any)} accessibilityRole="button" accessibilityLabel={t('settings.changeLanguage')}>
          <Text style={[s.langBtn, { color: tk.mutedFg }]}>{i18n.language === 'fa-AF' ? 'فا' : 'IR'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {step === 0 && <WelcomeStep tk={tk} onNext={handleNext} />}
        {step === 1 && <BusinessTypeStep tk={tk} selected={businessType} onSelect={setBusinessType} />}
        {step === 2 && <StoreSizeStep tk={tk} selected={storeSize} onSelect={setStoreSize} />}
        {step === 3 && <SummaryStep tk={tk} businessType={businessType} storeSize={storeSize} onComplete={handleComplete} />}
      </ScrollView>

      {step > 0 && step < 3 && (
        <View style={[s.bottomNav, { borderTopColor: tk.border }]}>
          <TouchableOpacity onPress={handleBack} style={[s.secondaryBtn, { borderColor: tk.border }]} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="برگشت">
            <Text style={[s.secondaryBtnText, { color: tk.foreground }]}>برگشت</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} style={[s.primaryBtnSmall, { backgroundColor: tk.primary }, isNextDisabled && { opacity: 0.5 }]} disabled={isNextDisabled} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="بعدی">
            <Text style={[s.primaryBtnTextSmall, { color: tk.primaryFg }]}>بعدی</Text>
          </TouchableOpacity>
        </View>
      )}

      {step < 3 && (
        <TouchableOpacity onPress={handleComplete} style={s.skipBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="رد کردن">
          <Text style={[s.skipText, { color: tk.mutedFg }]}>رد کردن — بعداً تنظیم می‌کنم</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  progressBar: { height: 4, width: '100%' },
  progressFill: { height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  logoGlyph: { fontSize: 14, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  langBtn: { fontSize: 13, fontWeight: '600' },
  scroll: { flexGrow: 1, padding: 24 },
  stepContent: { flex: 1, alignItems: 'center', paddingTop: 40 },
  welcomeIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  welcomeEmoji: { fontSize: 40 },
  welcomeTitle: { fontSize: 26, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  welcomeSub: { fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 },
  stepTitle: { fontSize: 22, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  optionCard: { width: '44%', aspectRatio: 1.2, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 8 },
  optionEmoji: { fontSize: 32 },
  optionLabel: { fontSize: 13, fontWeight: '600' },
  sizeCard: { flexDirection: 'row', alignItems: 'center', width: '100%', padding: 16, borderRadius: 14, borderWidth: 2, gap: 12, marginBottom: 12 },
  sizeEmoji: { fontSize: 28 },
  sizeLabel: { fontSize: 15, fontWeight: '600' },
  sizeDesc: { fontSize: 12, marginTop: 2 },
  checkmark: { fontSize: 22, fontWeight: '700' },
  checkCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  checkIcon: { fontSize: 36, fontWeight: '700' },
  summaryBox: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 16, gap: 10, marginTop: 20, marginBottom: 32 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryKey: { fontSize: 13 },
  summaryVal: { fontSize: 13, fontWeight: '600' },
  primaryBtn: { width: '100%', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  primaryBtnSmall: { flex: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnTextSmall: { fontSize: 15, fontWeight: '600' },
  secondaryBtn: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },
  bottomNav: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1 },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipText: { fontSize: 13 },
})