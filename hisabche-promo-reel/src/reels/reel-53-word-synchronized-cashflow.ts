// ============================================
// Reel #53 — Word-Synchronized, Sentence-Driven Motion Graphics
//
// "فروشت زیاده، اما آخر ماه نمی‌دونی پولت کجا رفته!"
//
// Every meaningful spoken word triggers a visual reaction:
// 1. Hook (0-3s): Word «فروشت» slams 300M, «زیاده» counts up, «…» freezes.
// 2. Concern (3-8s): Word «اما» cracks chart, «پولت» drains to 2M, «کجا رفته» reveals question.
// 3. Problem (8-14.5s): Each card enters at its exact spoken word («انبار», «طلب مشتری‌ها», «خرج‌ها»).
// 4. Solution (14.5-21s): «حسابچه» reveals brand, «همه‌چیز» pulls cards, «یکجا» locks into dashboard.
// 5. CTA (21-26s): «شفاف کن» lands SaaS conversion cards with verified hisabche domain.
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-53-alignment.json'

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

export const reel53: Reel = {
  id: '53',
  title: 'سناریوی کلمه‌به‌کلمه: فروشت زیاده؛ اما آخر ماه پولت کجاست؟',
  duration: 26.0,
  theme: 'cinematic-obsidian',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'فروش روزانه بالا اما موجودی صفر حساب در سررسید چک‌ها و هزینه‌ها',
    oldWorkflow: 'فروش نسیه سنتی و اعتماد به حافظه و دفتری که هزینه‌ها را ثبت نمی‌کند',
    friction: 'قفل‌شدن ۲۳۰ میلیون تومان در دست مشتریان و ۵۰ میلیون خواب کالا در انبار',
    hisabcheAction: 'داشبورد یکپارچه نظارت لحظه‌ای بر حساب بانکی، انبار و مطالبات با یادآور پیامکی',
    automatedResult: 'تسویه به موقع طلب‌ها، پیشگیری از کسری نقدینگی و شفافیت کامل دخل',
    businessOutcome: 'جلوگیری از زیان ۲۹۸ میلیون تومانی ناشی از نسیه و خریدهای اشتباه انبار',
    emotionalPayoff: 'آرامش خاطر، کنترل کامل دخل و تسلط بر جریان نقدینگی',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'word-synchronized-choreography',
      'tactile-leaks',
      'unified-dashboard-lock',
    ],
  },
  scenes: [
    // ── Scene 1: Hook (0.0s – 3.0s) — «فروشت زیاده…»
    {
      start: 0.0,
      end: 3.0,
      vo: 'فروشت زیاده…',
      spec: {
        kind: 'word-sync',
        actor: 'hook-sales',
        title: 'ثبت فروش ماه جاری',
      },
      sentence: {
        text: 'فروشت زیاده…',
        intent: 'هوک / ضربه نخستین',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          {
            word: 'فروشت',
            start: 0.2,
            end: 0.9,
            emphasis: true,
            action: 'sales-slam',
            sound: 'titleHit',
          },
          {
            word: 'زیاده…',
            start: 0.95,
            end: 2.3,
            emphasis: true,
            action: 'count-surge',
            sound: 'whoosh',
          },
        ]),
        sentenceEnding: { at: 2.4, action: 'freeze-hold', sound: 'tick' },
      },
    },

    // ── Scene 2: Escalation (3.0s – 8.0s) — «اما آخر ماه نمی‌دونی پولت کجا رفته!»
    {
      start: 3.0,
      end: 8.0,
      vo: 'اما آخر ماه نمی‌دونی پولت کجا رفته!',
      spec: {
        kind: 'word-sync',
        actor: 'broken-chart',
        title: 'بحران نقدینگی پنهان',
      },
      sentence: {
        text: 'اما آخر ماه نمی‌دونی پولت کجا رفته!',
        intent: 'تشدید نگرانی و کشف تناقض',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          {
            word: 'اما',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'chart-crack',
            sound: 'alert',
          },
          { word: 'آخر', start: 0.75, end: 1.15 },
          { word: 'ماه', start: 1.2, end: 1.55 },
          { word: 'نمی‌دونی', start: 1.6, end: 2.15, emphasis: true },
          {
            word: 'پولت',
            start: 2.2,
            end: 2.75,
            emphasis: true,
            action: 'money-collapse',
            sound: 'impact',
          },
          { word: 'کجا', start: 2.8, end: 3.3, emphasis: true },
          {
            word: 'رفته!',
            start: 3.35,
            end: 4.4,
            emphasis: true,
            action: 'question-reveal',
            sound: 'alert',
          },
        ]),
        sentenceEnding: { at: 4.5, action: 'void-state', sound: 'tick' },
      },
    },

    // ── Scene 3: Problem Leak Breakdown (8.0s – 14.5s) — «انبار، طلب مشتری‌ها، خرج‌ها…»
    {
      start: 8.0,
      end: 14.5,
      vo: 'انبار، طلب مشتری‌ها، خرج‌ها…',
      spec: {
        kind: 'word-sync',
        actor: 'leak-cards',
        title: 'محل قفل‌شدن پول‌های پنهان',
      },
      sentence: {
        text: 'انبار، طلب مشتری‌ها، خرج‌ها…',
        intent: 'آشکارسازی دقیق محل نشست پول',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          {
            word: 'انبار،',
            start: 0.3,
            end: 1.8,
            emphasis: true,
            action: 'inventory-drop',
            sound: 'paperRustle',
          },
          { word: 'طلب', start: 1.9, end: 2.4 },
          {
            word: 'مشتری‌ها،',
            start: 2.45,
            end: 3.6,
            emphasis: true,
            action: 'debt-stack',
            sound: 'cardEnter',
          },
          {
            word: 'خرج‌ها…',
            start: 3.8,
            end: 5.8,
            emphasis: true,
            action: 'expense-slide',
            sound: 'receiptPrint',
          },
        ]),
        sentenceEnding: { at: 6.0, action: 'hold-leaks', sound: 'softTransition' },
      },
    },

    // ── Scene 4: Hisabche Resolution (14.5s – 21.0s) — «حسابچه کمک می‌کنه همه‌چیز رو یکجا ببینی.»
    {
      start: 14.5,
      end: 21.0,
      vo: 'حسابچه کمک می‌کنه همه‌چیز رو یکجا ببینی.',
      spec: {
        kind: 'word-sync',
        actor: 'unified-dashboard',
        title: 'سامانه یکپارچه ابری حسابچه',
      },
      sentence: {
        text: 'حسابچه کمک می‌کنه همه‌چیز رو یکجا ببینی.',
        intent: 'معرفی راهکار و آرامش خاطر',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(3, [
          {
            word: 'حسابچه',
            start: 0.3,
            end: 1.3,
            emphasis: true,
            action: 'brand-reveal',
            sound: 'cinematicReveal',
          },
          { word: 'کمک', start: 1.35, end: 1.75 },
          { word: 'می‌کنه', start: 1.8, end: 2.3, sound: 'chime' },
          {
            word: 'همه‌چیز',
            start: 2.4,
            end: 3.0,
            emphasis: true,
            action: 'converge-start',
            sound: 'sync',
          },
          { word: 'رو', start: 3.05, end: 3.4 },
          {
            word: 'یکجا',
            start: 3.5,
            end: 4.6,
            emphasis: true,
            action: 'dashboard-lock',
            sound: 'financialMilestone',
          },
          { word: 'ببینی.', start: 4.65, end: 5.8, emphasis: true, sound: 'successResolution' },
        ]),
        sentenceEnding: { at: 6.0, action: 'clarity-lock', sound: 'success' },
      },
    },

    // ── Scene 5: Final CTA (21.0s – 26.0s) — «همین حالا دخل و حسابت رو در حسابچه شفاف کن.»
    {
      start: 21.0,
      end: 26.0,
      vo: 'همین حالا دخل و حسابت رو در حسابچه شفاف کن.',
      spec: {
        kind: 'word-sync',
        actor: 'cta-finish',
        title: 'شروع رایگان حسابچه',
      },
      sentence: {
        text: 'همین حالا دخل و حسابت رو در حسابچه شفاف کن.',
        intent: 'دعوت مستقیم به اقدام و جستجو',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          { word: 'همین', start: 0.2, end: 0.6 },
          { word: 'حالا', start: 0.65, end: 1.1, emphasis: true, sound: 'cardEnter' },
          { word: 'دخل', start: 1.15, end: 1.55 },
          { word: 'و', start: 1.55, end: 1.7 },
          { word: 'حسابت', start: 1.75, end: 2.15 },
          { word: 'رو', start: 2.15, end: 2.35 },
          { word: 'در', start: 2.35, end: 2.55 },
          { word: 'حسابچه', start: 2.6, end: 3.2, emphasis: true, sound: 'titleHit' },
          { word: 'شفاف', start: 3.25, end: 3.8, emphasis: true },
          { word: 'کن.', start: 3.85, end: 4.6, emphasis: true, sound: 'ctaResolution' },
        ]),
        sentenceEnding: { at: 4.7, action: 'cta-glow', sound: 'chime' },
      },
    },
  ],
}
