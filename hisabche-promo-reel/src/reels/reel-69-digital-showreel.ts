// ============================================
// Reel #69 — «۱۰۰٪ کسب‌وکارت رقم است؛ همه‌ش یک‌جا»
//
// Digital showreel II: a 20-second numeric résumé, complementary to Reel 68's
// kinetic-till showreel. The hook is never used in the titles of reels 01–68:
// at frame 0 the whole canvas is a dense grid of digits that freezes on one
// impact hit and resolves into a giant «۱۰۰٪».
// Product truth (owner brief): the app is for every trade, and the tour is
// numbers only — price lists per customer (چند نرخی), team shifts and
// attendance (تیم و حضورغیاب), offline selling (آفلاین مود), and the balanced
// double-entry book (دفتر حسابداری). No currency names anywhere; all values
// are pure faNumber digits.
//
// Hard Rules 13–19: one focal stage, ≤ 6 on-stage words, no dividers, every
// sounded word has an action read with cueAt, endings carry no sound,
// PROVISIONAL_CADENCE_MODEL_ACTIVE until a real voiceover is placed.
// ============================================

import type { Reel } from '../engine/types'
import type { WordCue } from '../engine/speech-model'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

function w(word: string, start: number, end: number, extra: Partial<WordCue> = {}): WordCue {
  return { word, start, end, ...extra }
}

export const reel69: Reel = {
  id: '69',
  title: '۱۰۰٪ کسب‌وکارت رقم است؛ همه‌ش یک‌جا',
  duration: 20.0,
  theme: 'procedural-spatial',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'اعداد مغازه در چهار جزیره‌ی جداست: قیمت‌های تکراری، شیفت پرسنل، فروش آفلاین و دفتر.',
    oldWorkflow:
      'هر جزیره عدد خودش را در دفتر یا اکسل جدا نگه می‌دارد و هیچ‌وقت کل یک‌جا دیده نمی‌شود.',
    friction: 'هر عددی که جدا زندگی می‌کند، احتمال خطا و واپس‌زدن پول را در مغازه بالا می‌برد.',
    hisabcheAction:
      'فهرست قیمت هر مشتری، شیفت و حضورغیاب پرسنل، فروش آفلاین در قطع اینترنت و دفتر دوبل، همه در یک دستگاه.',
    automatedResult: 'هر عدد وارد شد، در جای درستش می‌نشیند و با بقیه‌ی اعداد متعادل می‌ماند.',
    businessOutcome: 'یک‌جا دیدن کل اعداد کار برای هر رشته‌ی کسب‌وکاری.',
    emotionalPayoff: 'آرامش صاحب اعدادی که هیچ‌کدامش گم نمی‌شود.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'DigitFreezeHook',
      'PriceTierOdometer',
      'TeamShiftLedger',
      'OfflineSalesCounter',
      'ConvergedBalanceCta',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 4.0,
      vo: 'همه‌چیزِ کسب‌وکارت رقمه؛ حالا همش یک‌جاست.',
      spec: { kind: 'word-sync', actor: 'r69-digit-freeze', title: 'شوروم اعداد' },
      sentence: {
        text: 'همه‌چیزِ کسب‌وکارت رقمه؛ حالا همش یک‌جاست.',
        intent: 'قلاب میخکوب: دیوار اعداد فریز می‌شود و ۱۰۰٪ وسط می‌ماند',
        ...provisional,
        words: [
          w('همه‌چیزِ', 0.2, 0.62, { emphasis: true, action: 'digit-freeze', sound: 'impact' }),
          w('کسب‌وکارت', 0.65, 1.3),
          w('رقمه؛', 1.33, 1.88, { emphasis: true, action: 'digit-dim', sound: 'typewriterClick' }),
          w('حالا', 2.18, 2.48),
          w('همش', 2.51, 2.8, { emphasis: true, action: 'islands-gather', sound: 'dataFlow' }),
          w('یک‌جاست.', 2.83, 3.4, {
            emphasis: true,
            action: 'one-place-lock',
            sound: 'bigReveal',
          }),
        ],
        sentenceEnding: { at: 3.6, action: 'freeze-hold' },
      },
    },
    {
      start: 4.0,
      end: 8.0,
      vo: 'فهرست قیمت مشتری: هر کس، قیمت خودش.',
      spec: { kind: 'word-sync', actor: 'r69-price-tiers', title: 'چند نرخی' },
      sentence: {
        text: 'فهرست قیمت مشتری: هر کس، قیمت خودش.',
        intent: 'سازوکار: فهرست قیمت، قیمت خط فاکتور را خودش می‌گذارد',
        ...provisional,
        words: [
          w('فهرست', 0.2, 0.6, { emphasis: true, action: 'tier-fan', sound: 'cardEnter' }),
          w('قیمت', 0.63, 1.0),
          w('مشتری:', 1.03, 1.55, { emphasis: true, action: 'tier-tag-lit', sound: 'scan' }),
          w('هر', 1.95, 2.12),
          w('کس،', 2.15, 2.45),
          w('قیمت', 2.48, 2.85, { emphasis: true, action: 'tier-flip', sound: 'pop' }),
          w('خودش.', 2.88, 3.45, { emphasis: true, action: 'line-price-lock', sound: 'success' }),
        ],
        sentenceEnding: { at: 3.65, action: 'tier-hold' },
      },
    },
    {
      start: 8.0,
      end: 12.0,
      vo: 'تیم و حضورغیاب: شیفت هر نفر، خودش جمعه.',
      spec: { kind: 'word-sync', actor: 'r69-team-shift', title: 'شیفت پرسنل' },
      sentence: {
        text: 'تیم و حضورغیاب: شیفت هر نفر، خودش جمعه.',
        intent: 'سازوکار: ورود و خروج پرسنل به جمع شیفت هفتگی تبدیل می‌شود',
        ...provisional,
        words: [
          w('تیم', 0.2, 0.55, { emphasis: true, action: 'team-dots-in', sound: 'cardEnter' }),
          w('و', 0.58, 0.68),
          w('حضورغیاب:', 0.71, 1.35, { emphasis: true, action: 'clockin-stamp', sound: 'scan' }),
          w('شیفت', 1.75, 2.15),
          w('هر', 2.18, 2.35),
          w('نفر،', 2.38, 2.7, { emphasis: true, action: 'shift-rows-ready', sound: 'tick' }),
          w('خودش', 2.73, 3.05),
          w('جمعه.', 3.08, 3.55, { emphasis: true, action: 'hours-count', sound: 'pop' }),
        ],
        sentenceEnding: { at: 3.7, action: 'shift-hold' },
      },
    },
    {
      start: 12.0,
      end: 16.0,
      vo: 'اینترنت قطع؛ ثبت نمی‌ایسته. وصل شد؟ سینک!',
      spec: { kind: 'word-sync', actor: 'r69-offline-counter', title: 'آفلاین مود' },
      sentence: {
        text: 'اینترنت قطع؛ ثبت نمی‌ایسته. وصل شد؟ سینک!',
        intent: 'اثبات: شمارنده‌ی فروش در قطع اینترنت بالا می‌ماند و سپس سینک',
        ...provisional,
        words: [
          w('اینترنت', 0.15, 0.58, { emphasis: true, action: 'net-cut', sound: 'alert' }),
          w('قطع؛', 0.61, 0.95, { emphasis: true, action: 'counter-holds', sound: 'impact' }),
          w('ثبت', 1.18, 1.42),
          w('نمی‌ایسته.', 1.45, 1.98, {
            emphasis: true,
            action: 'counter-climb',
            sound: 'clockTickRapid',
          }),
          w('وصل', 2.1, 2.28),
          w('شد؟', 2.31, 2.46),
          w('سینک!', 2.5, 2.85, { emphasis: true, action: 'sync-sweep', sound: 'sync' }),
        ],
        sentenceEnding: { at: 2.95, action: 'offline-hold' },
      },
    },
    {
      start: 16.0,
      end: 20.0,
      vo: 'از پیشخوان تا کارگاه؛ همه‌ش حسابچه. شروع رایگان.',
      spec: { kind: 'word-sync', actor: 'r69-converged-cta', title: 'همه‌ش یک‌جا' },
      sentence: {
        text: 'از پیشخوان تا کارگاه؛ همه‌ش حسابچه. شروع رایگان.',
        intent: 'دعوت به اقدام برای هر رشته‌ی کسب‌وکاری',
        ...provisional,
        words: [
          w('از', 0.18, 0.32),
          w('پیشخوان', 0.35, 0.95, {
            emphasis: true,
            action: 'island-shop-merge',
            sound: 'cameraSwish',
          }),
          w('تا', 0.98, 1.08),
          w('کارگاه؛', 1.11, 1.68, {
            emphasis: true,
            action: 'island-workshop-merge',
            sound: 'whoosh',
          }),
          w('همه‌ش', 1.73, 2.0, { emphasis: true, action: 'islands-converge', sound: 'dataFlow' }),
          w('حسابچه.', 2.03, 2.6, { emphasis: true, action: 'brand-lock', sound: 'majorReveal' }),
          w('شروع', 2.9, 3.2, { emphasis: true, action: 'cta-button', sound: 'pop' }),
          w('رایگان.', 3.23, 3.6),
        ],
        sentenceEnding: { at: 3.75, action: 'cta-final-hold' },
      },
    },
  ],
}
