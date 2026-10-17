// ============================================
// Reel #61 — «اون کارتن کجاست؟»
//
// A wholesaler shouts down the phone for ten minutes to find twenty cartons
// of oil; the customer waits; the only map of the shelves is in one worker's
// head, and he is off today. Hisabche's product page says which warehouse and
// which shelf, and the shelf is changed on the same page when the stock moves.
//
// Template: split horizon (prompt library hp-034, technique only, our story).
// Product truth (checked): product page → storage locations per warehouse and
// shelf; change the shelf there. No barcode-on-shelf, no worker routing.
//
// Word timings: phrase starts MEASURED on the ElevenLabs recording (audio/reel-61-vo.wav,
// placed per scene by scripts/place-voiceover.mjs); words inside a phrase spread by
// letter count — an anchored estimate, not forced alignment: provisional, confidence null.
// ============================================

import type { Reel } from '../engine/types'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

export const reel61: Reel = {
  id: '61',
  title: 'اون کارتن کجاست؟',
  duration: 27.0,
  theme: 'cyber-emerald',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'برای پیدا کردن یک بار در انبار باید زنگ زد و داد زد؛ مشتری پشت خط منتظر می‌ماند',
    oldWorkflow: 'آدرس قفسه‌ها فقط در ذهن یک انباردار',
    friction: 'انباردار نباشد، بار در انبار «گم» است',
    hisabcheAction: 'صفحه‌ی هر کالا انبار و قفسه‌ی آن را نشان می‌دهد و همان‌جا قفسه عوض می‌شود',
    automatedResult: 'روغن آشپزی ۱۶ لیتری: انبار مرکزی، قفسه B-04 → جابه‌جا به C-02',
    businessOutcome: 'بار بدون تماس و بدون معطلی مشتری پیدا می‌شود',
    emotionalPayoff: 'آدرس بار دیگر در ذهن یک نفر نیست',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: ['CallWaveformMorph', 'WarehouseRackScan', 'ShelfLocationInspector'],
  },
  scenes: [
    {
      start: 0.0,
      end: 4.8,
      vo: 'ده دقیقه پشت تلفن داد می‌زنی: اون کارتن کجاست؟',
      spec: { kind: 'word-sync', actor: 'r61-call-hook', title: 'اون کارتن کجاست؟' },
      sentence: {
        text: 'ده دقیقه پشت تلفن داد می‌زنی: اون کارتن کجاست؟',
        intent: 'شناخت فوری: تماس پرفریاد با انبار',
        ...provisional,
        words: [
          {
            word: 'ده',
            start: 0.2,
            end: 0.34,
            emphasis: true,
            action: 'call-ring',
            sound: 'cardEnter',
          },
          { word: 'دقیقه', start: 0.37, end: 0.76 },
          { word: 'پشت', start: 0.79, end: 1.01 },
          { word: 'تلفن', start: 1.04, end: 1.35, emphasis: true },
          {
            word: 'داد',
            start: 1.38,
            end: 1.6,
            emphasis: true,
            action: 'shout-wave',
            sound: 'impact',
          },
          { word: 'می‌زنی:', start: 1.63, end: 2.19 },
          { word: 'اون', start: 2.5, end: 2.74 },
          { word: 'کارتن', start: 2.77, end: 3.18, emphasis: true },
          {
            word: 'کجاست؟',
            start: 3.21,
            end: 3.71,
            emphasis: true,
            action: 'where-hit',
            sound: 'titleHit',
          },
        ],
        sentenceEnding: { at: 4.0, action: 'call-hold' },
      },
    },
    {
      start: 4.8,
      end: 10.2,
      vo: 'مشتری پای خط معطله؛ انباردار بین قفسه‌ها می‌گرده.',
      spec: { kind: 'word-sync', actor: 'r61-waiting', title: 'مشتری پای خط' },
      sentence: {
        text: 'مشتری پای خط معطله؛ انباردار بین قفسه‌ها می‌گرده.',
        intent: 'تشدید: زمانی که مشتری می‌سوزاند',
        ...provisional,
        words: [
          {
            word: 'مشتری',
            start: 0.2,
            end: 0.65,
            emphasis: true,
            action: 'customer-hold',
            sound: 'clockTickRapid',
          },
          { word: 'پای', start: 0.68, end: 0.93 },
          { word: 'خط', start: 0.96, end: 1.13 },
          { word: 'معطله؛', start: 1.16, end: 1.7, emphasis: true },
          {
            word: 'انباردار',
            start: 2.09,
            end: 2.65,
            emphasis: true,
            action: 'aisle-search',
            sound: 'whoosh',
          },
          { word: 'بین', start: 2.68, end: 2.87 },
          { word: 'قفسه‌ها', start: 2.9, end: 3.39 },
          { word: 'می‌گرده.', start: 3.42, end: 3.98 },
        ],
        sentenceEnding: { at: 4.4, action: 'search-hold' },
      },
    },
    {
      start: 10.2,
      end: 15.8,
      vo: 'آدرس قفسه فقط تو ذهن یک نفره؛ اون نباشه، بار گم.',
      spec: { kind: 'word-sync', actor: 'r61-one-head', title: 'آدرسی که در یک ذهن است' },
      sentence: {
        text: 'آدرس قفسه فقط تو ذهن یک نفره؛ اون نباشه، بار گم.',
        intent: 'ریشه: نقشه‌ی انبار فقط در ذهن یک نفر',
        ...provisional,
        words: [
          {
            word: 'آدرس',
            start: 0.2,
            end: 0.62,
            emphasis: true,
            action: 'memory-note',
            sound: 'paperRustle',
          },
          { word: 'قفسه', start: 0.65, end: 1.06 },
          { word: 'فقط', start: 1.09, end: 1.4 },
          { word: 'تو', start: 1.43, end: 1.62 },
          { word: 'ذهن', start: 1.65, end: 1.96, emphasis: true },
          { word: 'یک', start: 1.99, end: 2.18 },
          { word: 'نفره؛', start: 2.21, end: 2.74 },
          { word: 'اون', start: 3.07, end: 3.36 },
          {
            word: 'نباشه،',
            start: 3.39,
            end: 4.01,
            emphasis: true,
            action: 'absent-strike',
            sound: 'markerScribble',
          },
          {
            word: 'بار',
            start: 4.04,
            end: 4.33,
            emphasis: true,
            action: 'cargo-lost',
            sound: 'alert',
          },
          { word: 'گم.', start: 4.36, end: 4.65, emphasis: true },
        ],
        sentenceEnding: { at: 4.5, action: 'lost-hold' },
      },
    },
    {
      start: 15.8,
      end: 22.6,
      vo: 'حسابچه روی صفحه‌ی کالا می‌گه کدوم انبار و کدوم قفسه؛ جابه‌جا کردی، همون‌جا عوضش کن.',
      spec: { kind: 'word-sync', actor: 'r61-shelf-page', title: 'انبار و قفسه، روی صفحه‌ی کالا' },
      sentence: {
        text: 'حسابچه روی صفحه‌ی کالا می‌گه کدوم انبار و کدوم قفسه؛ جابه‌جا کردی، همون‌جا عوضش کن.',
        intent: 'سازوکار محصول: موقعیت انبار و قفسه روی صفحه‌ی کالا و تغییر آن',
        ...provisional,
        words: [
          {
            word: 'حسابچه',
            start: 0.2,
            end: 0.66,
            emphasis: true,
            action: 'brand-rise',
            sound: 'cinematicReveal',
          },
          { word: 'روی', start: 0.69, end: 0.91 },
          { word: 'صفحه‌ی', start: 0.94, end: 1.4 },
          { word: 'کالا', start: 1.43, end: 1.73 },
          { word: 'می‌گه', start: 1.76, end: 2.14 },
          { word: 'کدوم', start: 2.17, end: 2.47 },
          {
            word: 'انبار',
            start: 2.5,
            end: 2.88,
            emphasis: true,
            action: 'warehouse-row',
            sound: 'cardEnter',
          },
          { word: 'و', start: 2.91, end: 2.97 },
          { word: 'کدوم', start: 3, end: 3.29 },
          {
            word: 'قفسه؛',
            start: 3.32,
            end: 3.71,
            emphasis: true,
            action: 'shelf-light',
            sound: 'scan',
          },
          { word: 'جابه‌جا', start: 4.12, end: 4.69 },
          { word: 'کردی،', start: 4.72, end: 5.11 },
          {
            word: 'همون‌جا',
            start: 5.14,
            end: 5.71,
            emphasis: true,
            action: 'shelf-move',
            sound: 'precisionSequence',
          },
          { word: 'عوضش', start: 5.74, end: 6.04 },
          { word: 'کن.', start: 6.07, end: 6.3 },
        ],
        sentenceEnding: { at: 6.1, action: 'page-hold' },
      },
    },
    {
      start: 22.6,
      end: 27.0,
      vo: 'بار رو بی‌تلفن پیدا کن؛ شروع رایگان در حسابچه.',
      spec: { kind: 'word-sync', actor: 'r61-cta', title: 'مدیریت دقیق انبار و قفسه‌ها' },
      sentence: {
        text: 'بار رو بی‌تلفن پیدا کن؛ شروع رایگان در حسابچه.',
        intent: 'دعوت به اقدام',
        ...provisional,
        words: [
          {
            word: 'بار',
            start: 0.2,
            end: 0.43,
            emphasis: true,
            action: 'cta-card',
            sound: 'cardEnter',
          },
          { word: 'رو', start: 0.46, end: 0.6 },
          { word: 'بی‌تلفن', start: 0.63, end: 1.21, emphasis: true },
          { word: 'پیدا', start: 1.24, end: 1.56 },
          { word: 'کن؛', start: 1.59, end: 1.81 },
          { word: 'شروع', start: 2.19, end: 2.62 },
          {
            word: 'رایگان',
            start: 2.65,
            end: 3.32,
            emphasis: true,
            action: 'cta-pulse',
            sound: 'ctaResolution',
          },
          { word: 'در', start: 3.35, end: 3.55 },
          { word: 'حسابچه.', start: 3.58, end: 4.36, emphasis: true },
        ],
        sentenceEnding: { at: 2.4, action: 'cta-glow' },
      },
    },
  ],
}
