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
// Word timings are the cadence model's (no audio yet): provisional, confidence null.
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
    selectedOperators: ['SplitHorizon', 'CallWaveform', 'ShelfLocationRow'],
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
            end: 0.4,
            emphasis: true,
            action: 'call-ring',
            sound: 'cardEnter',
          },
          { word: 'دقیقه', start: 0.45, end: 0.85 },
          { word: 'پشت', start: 0.9, end: 1.1 },
          { word: 'تلفن', start: 1.15, end: 1.55, emphasis: true },
          {
            word: 'داد',
            start: 1.9,
            end: 2.15,
            emphasis: true,
            action: 'shout-wave',
            sound: 'impact',
          },
          { word: 'می‌زنی:', start: 2.2, end: 2.6 },
          { word: 'اون', start: 2.75, end: 2.95 },
          { word: 'کارتن', start: 3.0, end: 3.4, emphasis: true },
          {
            word: 'کجاست؟',
            start: 3.45,
            end: 3.95,
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
            start: 0.3,
            end: 0.75,
            emphasis: true,
            action: 'customer-hold',
            sound: 'clockTickRapid',
          },
          { word: 'پای', start: 0.8, end: 1.0 },
          { word: 'خط', start: 1.05, end: 1.3 },
          { word: 'معطله؛', start: 1.35, end: 1.9, emphasis: true },
          {
            word: 'انباردار',
            start: 2.4,
            end: 2.95,
            emphasis: true,
            action: 'aisle-search',
            sound: 'whoosh',
          },
          { word: 'بین', start: 3.0, end: 3.2 },
          { word: 'قفسه‌ها', start: 3.25, end: 3.75 },
          { word: 'می‌گرده.', start: 3.8, end: 4.3 },
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
            start: 0.3,
            end: 0.7,
            emphasis: true,
            action: 'memory-note',
            sound: 'paperRustle',
          },
          { word: 'قفسه', start: 0.75, end: 1.1 },
          { word: 'فقط', start: 1.15, end: 1.4 },
          { word: 'تو', start: 1.45, end: 1.55 },
          { word: 'ذهن', start: 1.6, end: 1.9, emphasis: true },
          { word: 'یک', start: 1.95, end: 2.1 },
          { word: 'نفره؛', start: 2.15, end: 2.5 },
          { word: 'اون', start: 2.6, end: 2.8 },
          {
            word: 'نباشه،',
            start: 2.85,
            end: 3.3,
            emphasis: true,
            action: 'absent-strike',
            sound: 'markerScribble',
          },
          {
            word: 'بار',
            start: 3.7,
            end: 3.95,
            emphasis: true,
            action: 'cargo-lost',
            sound: 'alert',
          },
          { word: 'گم.', start: 4.0, end: 4.35, emphasis: true },
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
            end: 0.7,
            emphasis: true,
            action: 'brand-rise',
            sound: 'cinematicReveal',
          },
          { word: 'روی', start: 0.75, end: 0.95 },
          { word: 'صفحه‌ی', start: 1.0, end: 1.35 },
          { word: 'کالا', start: 1.4, end: 1.7 },
          { word: 'می‌گه', start: 1.75, end: 1.95 },
          { word: 'کدوم', start: 2.0, end: 2.25 },
          {
            word: 'انبار',
            start: 2.3,
            end: 2.65,
            emphasis: true,
            action: 'warehouse-row',
            sound: 'cardEnter',
          },
          { word: 'و', start: 2.7, end: 2.78 },
          { word: 'کدوم', start: 2.82, end: 3.05 },
          {
            word: 'قفسه؛',
            start: 3.1,
            end: 3.55,
            emphasis: true,
            action: 'shelf-light',
            sound: 'scan',
          },
          { word: 'جابه‌جا', start: 3.9, end: 4.35 },
          { word: 'کردی،', start: 4.4, end: 4.75 },
          {
            word: 'همون‌جا',
            start: 4.85,
            end: 5.3,
            emphasis: true,
            action: 'shelf-move',
            sound: 'precisionSequence',
          },
          { word: 'عوضش', start: 5.35, end: 5.75 },
          { word: 'کن.', start: 5.8, end: 6.1 },
        ],
        sentenceEnding: { at: 6.1, action: 'page-hold' },
      },
    },
    {
      start: 22.6,
      end: 27.0,
      vo: 'بار رو بی‌تلفن پیدا کن؛ شروع رایگان در حسابچه.',
      spec: { kind: 'word-sync', actor: 'r61-cta', title: 'بار رو بی‌تلفن پیدا کن' },
      sentence: {
        text: 'بار رو بی‌تلفن پیدا کن؛ شروع رایگان در حسابچه.',
        intent: 'دعوت به اقدام',
        ...provisional,
        words: [
          {
            word: 'بار',
            start: 0.25,
            end: 0.5,
            emphasis: true,
            action: 'cta-card',
            sound: 'cardEnter',
          },
          { word: 'رو', start: 0.52, end: 0.65 },
          { word: 'بی‌تلفن', start: 0.7, end: 1.2, emphasis: true },
          { word: 'پیدا', start: 1.25, end: 1.5 },
          { word: 'کن؛', start: 1.55, end: 1.85 },
          { word: 'شروع', start: 2.0, end: 2.3 },
          {
            word: 'رایگان',
            start: 2.35,
            end: 2.8,
            emphasis: true,
            action: 'cta-pulse',
            sound: 'ctaResolution',
          },
          { word: 'در', start: 2.85, end: 2.95 },
          { word: 'حسابچه.', start: 3.0, end: 3.55, emphasis: true },
        ],
        sentenceEnding: { at: 2.4, action: 'cta-glow' },
      },
    },
  ],
}
