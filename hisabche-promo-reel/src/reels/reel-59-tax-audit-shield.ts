// ============================================
// Reel #59 — Word-Synchronized Tax Audit & Moadian Shield
//
// «برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟»
//
// 100% Compliant with 12 Hard Rules:
// - Hard Rule 1: Zero blinking numbers, continuous numbers (۱۸۰ میلیون -> ۴۵ فاکتور -> ۰ ریال)
// - Hard Rule 2: Physical motion (springs, stamps, matrix grids, clip reveals)
// - Hard Rule 4: 9:16 safe vertical composition, optical center (Y: 45%-55%)
// - Hard Rule 5: Final CTA enters at t=0.3s with >= 3.8s readable hold!
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-59-alignment.json'

function getSceneWords(sceneIndex: number, defaultWords: WordCue[]): WordCue[] {
  const alignedScene = alignmentData.scenes[sceneIndex]
  if (!alignedScene || !Array.isArray(alignedScene.words)) return defaultWords
  return defaultWords.map((defWord) => {
    const alignedWord = alignedScene.words.find((aw) => aw.word === defWord.word)
    if (!alignedWord) return defWord
    return {
      ...defWord,
      start: alignedWord.start,
      end: alignedWord.end,
      confidence: alignedWord.confidence,
    }
  })
}

const lifecycleStatus = alignmentData.alignmentStatus as AlignmentLifecycleStatus
const isProvisional = alignmentData.isProvisional
const alignmentSource = alignmentData.alignmentSource as
  | 'cadence-model'
  | 'whisper-asr'
  | 'whisper-ctc'
  | 'manual-operator-review'
  | 'external-unverified'
  | 'diagnostic-audio-only'
  | 'forced-aligner'
  | undefined
const confidence = alignmentData.confidence

export const reel59: Reel = {
  id: '59',
  title: 'برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟',
  duration: 26.0,
  theme: 'financial-intelligence',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'دریافت برگ تشخیص مالیاتی سنگین و جریمه کتمان به دلیل رد دفاتر سنتی و مغایرت با مودیان',
    oldWorkflow: 'فاکتورهای کاغذی و اکسل فاقد شناسه یکتای مالیاتی و عدم ارسال به سامانه مودیان',
    friction: 'جریمه غیرقابل بخشودگی ماده ۱۹۲ و مالیات علی‌الرأس ۱۸۰ میلیون تومانی',
    hisabcheAction: 'ماژول سامانه مودیان حسابچه با صدور فاکتور الکترونیک و ارسال آنی با یک کلیک',
    automatedResult: 'تایید رسمی صورتحساب در کارپوشه امور مالیاتی و صفر شدن جرایم کتمان',
    businessOutcome: 'برخورداری از معافیت‌های قانونی و مصونیت کامل در ممیزی دارایی',
    emotionalPayoff: 'خواب آسوده و امنیت ۱۰۰٪ در برابر ممیزی‌های مالیاتی پایان سال',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'MoadianDirectConnector',
      'FiscalCodeGenerator',
      'TaxAuditShield',
      'ZeroPenaltyLedger',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 4.6,
      vo: 'برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟',
      spec: {
        kind: 'word-sync',
        actor: 'r59-tax-hook',
        title: 'برگ تشخیص مالیات و رد دفاتر',
      },
      sentence: {
        text: 'برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟',
        intent: 'هوک اضطراری ممیزی دارایی و جریمه کتمان درآمد',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          { word: 'برگ', start: 0.2, end: 0.55 },
          {
            word: 'تشخیص',
            start: 0.6,
            end: 1.05,
            emphasis: true,
            action: 'tax-notice-enter',
            sound: 'cardThock',
          },
          { word: 'مالیات', start: 1.1, end: 1.5, emphasis: true },
          {
            word: '۱۸۰',
            start: 1.55,
            end: 2.1,
            emphasis: true,
            action: 'penalty-odometer',
            sound: 'clockTickRapid',
          },
          { word: 'میلیونی', start: 2.15, end: 2.55 },
          { word: 'رسید؛', start: 2.6, end: 3.0 },
          { word: 'چرا', start: 3.1, end: 3.35 },
          {
            word: 'دفاتر',
            start: 3.4,
            end: 3.85,
            emphasis: true,
            action: 'ledger-inspect',
            sound: 'cameraSwish',
          },
          {
            word: 'رد',
            start: 3.9,
            end: 4.15,
            emphasis: true,
            action: 'reject-stamp',
            sound: 'cardThock',
          },
          { word: 'شد؟', start: 4.2, end: 4.5, emphasis: true },
        ]),
        sentenceEnding: { at: 3.4, action: 'tax-freeze', sound: 'softTransition' },
      },
    },
    {
      start: 4.6,
      end: 9.8,
      vo: 'چون فاکتورهای دستی با سامانه مودیان مغایرت داشت!',
      spec: {
        kind: 'word-sync',
        actor: 'r59-discrepancy-matrix',
        title: 'مغایرت فاکتورهای دستی با مودیان',
      },
      sentence: {
        text: 'چون فاکتورهای دستی با سامانه مودیان مغایرت داشت!',
        intent: 'تشدید تضاد بین گزارش کاغذی و سیستم دارایی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          { word: 'چون', start: 0.3, end: 0.6 },
          { word: 'فاکتورهای', start: 0.7, end: 1.25 },
          {
            word: 'دستی',
            start: 1.3,
            end: 1.75,
            emphasis: true,
            action: 'paper-diff',
            sound: 'cameraSwish',
          },
          { word: 'با', start: 1.8, end: 1.95 },
          { word: 'سامانه', start: 2.05, end: 2.5, emphasis: true },
          {
            word: 'مودیان',
            start: 2.55,
            end: 3.1,
            emphasis: true,
            action: 'moadian-portal',
            sound: 'cardThock',
          },
          {
            word: 'مغایرت',
            start: 3.2,
            end: 3.75,
            emphasis: true,
            action: 'discrepancy-alert',
            sound: 'clockTickRapid',
          },
          { word: 'داشت!', start: 3.85, end: 4.4, emphasis: true },
        ]),
        sentenceEnding: { at: 3.6, action: 'matrix-hold', sound: 'softTransition' },
      },
    },
    {
      start: 9.8,
      end: 15.6,
      vo: 'اکسل و نرم‌افزار قدیمی کد رهگیری مالیاتی تولید نمی‌کنه!',
      spec: {
        kind: 'word-sync',
        actor: 'r59-legacy-risk',
        title: 'نقص فنی اکسل و نرم‌افزار سنتی',
      },
      sentence: {
        text: 'اکسل و نرم‌افزار قدیمی کد رهگیری مالیاتی تولید نمی‌کنه!',
        intent: 'اثبات ناکارآمدی اکسل در الزامات قانونی جدید',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          {
            word: 'اکسل',
            start: 0.3,
            end: 0.8,
            emphasis: true,
            action: 'excel-vulnerable',
            sound: 'cameraSwish',
          },
          { word: 'و', start: 0.85, end: 0.95 },
          { word: 'نرم‌افزار', start: 1.05, end: 1.55 },
          { word: 'قدیمی', start: 1.6, end: 2.05 },
          { word: 'کد', start: 2.15, end: 2.45 },
          {
            word: 'رهگیری',
            start: 2.5,
            end: 3.05,
            emphasis: true,
            action: 'tax-id-missing',
            sound: 'cardThock',
          },
          { word: 'مالیاتی', start: 3.1, end: 3.65, emphasis: true },
          { word: 'تولید', start: 3.75, end: 4.15 },
          {
            word: 'نمی‌کنه!',
            start: 4.25,
            end: 4.9,
            emphasis: true,
            action: 'penalty-strike',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 4.2, action: 'strike-hold', sound: 'softTransition' },
      },
    },
    {
      start: 15.6,
      end: 21.6,
      vo: 'حسابچه با یک کلیک فاکتور رو به سامانه مودیان می‌فرسته!',
      spec: {
        kind: 'word-sync',
        actor: 'r59-moadian-shield',
        title: 'اتصال هوشمند حسابچه به سامانه مودیان',
      },
      sentence: {
        text: 'حسابچه با یک کلیک فاکتور رو به سامانه مودیان می‌فرسته!',
        intent: 'ارائه راهکار قطعی و قانونی حسابچه',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(3, [
          {
            word: 'حسابچه',
            start: 0.25,
            end: 0.85,
            emphasis: true,
            action: 'brand-anchor',
            sound: 'cinematicReveal',
          },
          { word: 'با', start: 0.95, end: 1.15 },
          { word: 'یک', start: 1.25, end: 1.5 },
          {
            word: 'کلیک',
            start: 1.6,
            end: 2.05,
            emphasis: true,
            action: 'one-click-transmit',
            sound: 'precisionSequence',
          },
          { word: 'فاکتور', start: 2.15, end: 2.6 },
          { word: 'رو', start: 2.7, end: 2.85 },
          { word: 'به', start: 2.95, end: 3.1 },
          { word: 'سامانه', start: 3.2, end: 3.65, emphasis: true },
          {
            word: 'مودیان',
            start: 3.7,
            end: 4.2,
            emphasis: true,
            action: 'moadian-shield',
            sound: 'precisionSequence',
          },
          {
            word: 'می‌فرسته!',
            start: 4.3,
            end: 4.9,
            emphasis: true,
            action: 'verified-stamp',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 4.1, action: 'verified-hold', sound: 'softTransition' },
      },
    },
    {
      start: 21.6,
      end: 26.0,
      vo: 'دفاترت رو تاییدیه دارایی کن؛ همین حالا در حسابچه.',
      spec: {
        kind: 'word-sync',
        actor: 'r59-cta-tax',
        title: 'تاییدیه قطعی دارایی در حسابچه',
      },
      sentence: {
        text: 'دفاترت رو تاییدیه دارایی کن؛ همین حالا در حسابچه.',
        intent: 'دعوت به اقدام و تاییدیه رسمی حساب‌ها در حسابچه',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          {
            word: 'دفاترت',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'tax-audit-pass',
            sound: 'cameraSwish',
          },
          { word: 'رو', start: 0.8, end: 0.95 },
          {
            word: 'تاییدیه',
            start: 1.05,
            end: 1.5,
            emphasis: true,
            action: 'moafiyat-badge',
            sound: 'cardThock',
          },
          { word: 'دارایی', start: 1.6, end: 2.05, emphasis: true },
          { word: 'کن؛', start: 2.1, end: 2.35 },
          { word: 'همین', start: 2.45, end: 2.7 },
          {
            word: 'حالا',
            start: 2.75,
            end: 3.1,
            emphasis: true,
            action: 'cta-button-pulse',
            sound: 'ctaResolution',
          },
          { word: 'در', start: 3.15, end: 3.3 },
          {
            word: 'حسابچه.',
            start: 3.35,
            end: 3.8,
            emphasis: true,
            action: 'brand-finish',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 2.4, action: 'cta-glow', sound: 'softTransition' },
      },
    },
  ],
}
