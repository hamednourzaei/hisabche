// ============================================
// Reel #54 — Word-Synchronized, Sentence-Driven Motion Graphics
//
// "ساعت ۱۲ ظهر چکت برگشت می‌خوره!"
//
// Every meaningful spoken word triggers a visual reaction:
// 1. Hook (0-3.5s): Word «۱۲» counts down clock to 12:00, «چکت» reveals 600M Sayadi cheque, «می‌خوره!» slams red REJECT stamp at 2.2s (1.3s hold at 100% opacity!).
// 2. Concern (3.5-8.5s): Top headline fills upper zone, «فروشت» sparkles, «اما» shatters, «۴۳۰ میلیون» traps capital with animated drain arrow, dust aging holds for 1.4s!
// 3. Problem (8.5-15s): Prominent top header, 3 debtor cards enter sequentially («نسیه‌ها», «یادش هست», «چقدر بدهکاره!»), holding with full brightness for 1.5s+!
// 4. Solution (15-21.5s): Brand header anchored from t=0, «پیامکی» fires SMS, «راس‌گیری» settles maturity, «نقد» clears 600M cheque with gold pass stamp holding for 1.8s+!
// 5. CTA (21.5-26s): «ثبت و وصول کن» lands conversion cards with verified hisabche domain.
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-54-alignment.json'

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

export const reel54: Reel = {
  id: '54',
  title: 'سناریوی کلمه‌به‌کلمه: ساعت ۱۲ ظهر چکت برگشت می‌خوره!',
  duration: 26.0,
  theme: 'financial-intelligence',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'سررسید چک سنگین در بانک با موجودی ناکافی به دلیل طلب‌های معوق و نسیه‌های ثبت‌نشده',
    oldWorkflow:
      'حساب‌وکتاب کاغذی در دفتر نسیه بدون راس‌گیری و پیگیری دیرهنگام تسویه با تماس‌های تلفنی بی‌نتیجه',
    friction: 'قفل شدن ۴۳۰ میلیون تومان سرمایه در دست بدهکاران بازار و خطر برگشت چک ۶۰۰ میلیونی',
    hisabcheAction: 'یادآور خودکار پیامکی مطالبات و ماژول راس‌گیری پیشرفته فاکتورها و اسناد تجاری',
    automatedResult:
      'وصول سریع طلب‌های معوق پیش از سررسید، پر شدن آنی حساب بانکی و پاس شدن مطمئن چک',
    businessOutcome:
      'حفظ اعتبار تجاری در بازار، وصول ۴۳۰ میلیون تومان مطالبات راکد و صفر شدن هزینه دیرکرد',
    emotionalPayoff: 'آرامش، اطمینان خاطر در معاملات بازار و تسلط کامل بر تاریخ سررسید اسناد',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'word-synchronized-choreography',
      'tactile-leaks',
      'unified-dashboard-lock',
    ],
  },
  scenes: [
    // ── Scene 1: Hook (0.0s – 3.5s) — «ساعت ۱۲ ظهر چکت برگشت می‌خوره!»
    {
      start: 0.0,
      end: 3.5,
      vo: 'ساعت ۱۲ ظهر چکت برگشت می‌خوره!',
      spec: {
        kind: 'word-sync',
        actor: 'cheque-countdown',
        title: 'هشدار سررسید چک صیادی',
      },
      sentence: {
        text: 'ساعت ۱۲ ظهر چکت برگشت می‌خوره!',
        intent: 'هوک اضطراری / زنگ خطر بازار',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          { word: 'ساعت', start: 0.2, end: 0.55, sound: 'tick' },
          {
            word: '۱۲',
            start: 0.6,
            end: 1.05,
            emphasis: true,
            action: 'clock-countdown',
            sound: 'clockTickRapid',
          },
          { word: 'ظهر', start: 1.1, end: 1.35, sound: 'tick' },
          {
            word: 'چکت',
            start: 1.4,
            end: 1.85,
            emphasis: true,
            action: 'cheque-reveal',
            sound: 'titleHit',
          },
          { word: 'برگشت', start: 1.9, end: 2.15, emphasis: true, sound: 'alert' },
          {
            word: 'می‌خوره!',
            start: 2.2,
            end: 2.6,
            emphasis: true,
            action: 'stamp-reject',
            sound: 'impact',
          },
        ]),
        sentenceEnding: { at: 2.3, action: 'freeze-alarm', sound: 'alert' },
      },
    },

    // ── Scene 2: Escalation (3.5s – 8.5s) — «فروشت عالی بوده؛ اما ۴۳۰ میلیون از سرمایه‌ت دست مشتری‌ها خاک می‌خوره!»
    {
      start: 3.5,
      end: 8.5,
      vo: 'فروشت عالی بوده؛ اما ۴۳۰ میلیون از سرمایه‌ت دست مشتری‌ها خاک می‌خوره!',
      spec: {
        kind: 'word-sync',
        actor: 'capital-trap',
        title: 'قفل نقدینگی در نسیه‌های بازار',
      },
      sentence: {
        text: 'فروشت عالی بوده؛ اما ۴۳۰ میلیون از سرمایه‌ت دست مشتری‌ها خاک می‌خوره!',
        intent: 'تشدید تضاد فروش و نقدینگی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          {
            word: 'فروشت',
            start: 0.2,
            end: 0.6,
            emphasis: true,
            action: 'sales-sparkle',
            sound: 'whoosh',
          },
          { word: 'عالی', start: 0.65, end: 0.95 },
          { word: 'بوده؛', start: 1.0, end: 1.25 },
          {
            word: 'اما',
            start: 1.3,
            end: 1.65,
            emphasis: true,
            action: 'crack-alert',
            sound: 'alert',
          },
          {
            word: '۴۳۰',
            start: 1.7,
            end: 2.05,
            emphasis: true,
            action: 'trapped-counter',
            sound: 'impact',
          },
          { word: 'میلیون', start: 2.1, end: 2.4, emphasis: true },
          { word: 'از', start: 2.45, end: 2.6 },
          { word: 'سرمایه‌ت', start: 2.65, end: 3.0, emphasis: true },
          { word: 'دست', start: 3.05, end: 3.25 },
          {
            word: 'مشتری‌ها',
            start: 3.3,
            end: 3.7,
            emphasis: true,
            action: 'ledger-aging',
            sound: 'paperRustle',
          },
          { word: 'خاک', start: 3.75, end: 3.95, emphasis: true },
          {
            word: 'می‌خوره!',
            start: 4.0,
            end: 4.45,
            emphasis: true,
            action: 'spiderweb-trap',
            sound: 'impact',
          },
        ]),
        sentenceEnding: { at: 4.5, action: 'void-trap', sound: 'tick' },
      },
    },

    // ── Scene 3: Problem Leak Breakdown (8.5s – 15.0s) — «نه سررسید نسیه‌ها مشخصه، نه کسی یادش هست چقدر بدهکاره!»
    {
      start: 8.5,
      end: 15.0,
      vo: 'نه سررسید نسیه‌ها مشخصه، نه کسی یادش هست چقدر بدهکاره!',
      spec: {
        kind: 'word-sync',
        actor: 'overdue-cards',
        title: 'کارت‌های بدهی سررسید گذشته',
      },
      sentence: {
        text: 'نه سررسید نسیه‌ها مشخصه، نه کسی یادش هست چقدر بدهکاره!',
        intent: 'نمایش بی‌نظمی دفاتر و فراموشی بدهی‌ها',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          { word: 'نه', start: 0.2, end: 0.45 },
          { word: 'سررسید', start: 0.5, end: 0.95, emphasis: true, sound: 'cardEnter' },
          {
            word: 'نسیه‌ها',
            start: 1.0,
            end: 1.55,
            emphasis: true,
            action: 'card-iron-bazaar',
            sound: 'paperRustle',
          },
          { word: 'مشخصه،', start: 1.6, end: 2.15, emphasis: true, sound: 'alert' },
          { word: 'نه', start: 2.2, end: 2.45 },
          { word: 'کسی', start: 2.5, end: 2.8 },
          {
            word: 'یادش',
            start: 2.85,
            end: 3.3,
            emphasis: true,
            action: 'card-alborz',
            sound: 'cardEnter',
          },
          { word: 'هست', start: 3.35, end: 3.7 },
          { word: 'چقدر', start: 3.75, end: 4.15 },
          {
            word: 'بدهکاره!',
            start: 4.2,
            end: 4.8,
            emphasis: true,
            action: 'card-sabalan',
            sound: 'impact',
          },
        ]),
        sentenceEnding: { at: 4.9, action: 'aging-stack-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 4: Hisabche Resolution (15.0s – 21.5s) — «حسابچه با یادآور پیامکی خودکار و راس‌گیری دقیق، طلب‌هات رو نقد می‌کنه.»
    {
      start: 15.0,
      end: 21.5,
      vo: 'حسابچه با یادآور پیامکی خودکار و راس‌گیری دقیق، طلب‌هات رو نقد می‌کنه.',
      spec: {
        kind: 'word-sync',
        actor: 'sms-settlement',
        title: 'راس‌گیری و یادآور پیامکی خودکار حسابچه',
      },
      sentence: {
        text: 'حسابچه با یادآور پیامکی خودکار و راس‌گیری دقیق، طلب‌هات رو نقد می‌کنه.',
        intent: 'ارائه راهکار هوشمند و تسویه آنی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(3, [
          {
            word: 'حسابچه',
            start: 0.2,
            end: 0.8,
            emphasis: true,
            action: 'brand-anchor',
            sound: 'cinematicReveal',
          },
          { word: 'با', start: 0.85, end: 1.05 },
          { word: 'یادآور', start: 1.1, end: 1.45, emphasis: true, sound: 'chime' },
          {
            word: 'پیامکی',
            start: 1.5,
            end: 1.95,
            emphasis: true,
            action: 'sms-dispatch',
            sound: 'sync',
          },
          { word: 'خودکار', start: 2.0, end: 2.35 },
          { word: 'و', start: 2.4, end: 2.55 },
          {
            word: 'راس‌گیری',
            start: 2.6,
            end: 3.15,
            emphasis: true,
            action: 'maturity-calc',
            sound: 'precisionSequence',
          },
          { word: 'دقیق،', start: 3.2, end: 3.55, sound: 'tick' },
          {
            word: 'طلب‌هات',
            start: 3.6,
            end: 4.0,
            emphasis: true,
            action: 'cards-settle-green',
            sound: 'cash',
          },
          { word: 'رو', start: 4.05, end: 4.2 },
          {
            word: 'نقد',
            start: 4.25,
            end: 4.65,
            emphasis: true,
            action: 'cheque-cleared-gold',
            sound: 'financialMilestone',
          },
          { word: 'می‌کنه.', start: 4.7, end: 5.2, emphasis: true, sound: 'successResolution' },
        ]),
        sentenceEnding: { at: 5.0, action: 'cheque-cleared-lock', sound: 'success' },
      },
    },

    // ── Scene 5: Final CTA (21.5s – 26.0s) — «همین حالا نسیه‌هات رو در حسابچه ثبت و وصول کن.»
    {
      start: 21.5,
      end: 26.0,
      vo: 'همین حالا نسیه‌هات رو در حسابچه ثبت و وصول کن.',
      spec: {
        kind: 'word-sync',
        actor: 'cta-conversion-54',
        title: 'شروع رایگان وصول مطالبات در حسابچه',
      },
      sentence: {
        text: 'همین حالا نسیه‌هات رو در حسابچه ثبت و وصول کن.',
        intent: 'دعوت به اقدام قطعی و شروع بدون ریسک',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          { word: 'همین', start: 0.2, end: 0.45 },
          { word: 'حالا', start: 0.5, end: 0.8, emphasis: true, sound: 'cardEnter' },
          {
            word: 'نسیه‌هات',
            start: 0.85,
            end: 1.35,
            emphasis: true,
            action: 'receivables-tag',
            sound: 'whoosh',
          },
          { word: 'رو', start: 1.4, end: 1.55 },
          { word: 'در', start: 1.6, end: 1.75 },
          {
            word: 'حسابچه',
            start: 1.8,
            end: 2.35,
            emphasis: true,
            action: 'brand-glow',
            sound: 'titleHit',
          },
          { word: 'ثبت', start: 2.4, end: 2.7, emphasis: true },
          { word: 'و', start: 2.75, end: 2.9 },
          { word: 'وصول', start: 2.95, end: 3.35, emphasis: true, sound: 'cash' },
          {
            word: 'کن.',
            start: 3.4,
            end: 3.95,
            emphasis: true,
            action: 'cta-button-pulse',
            sound: 'ctaResolution',
          },
        ]),
        sentenceEnding: { at: 4.0, action: 'cta-glow', sound: 'chime' },
      },
    },
  ],
}
