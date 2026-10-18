// ============================================
// Reel #67 — «همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؟»
//
// Hook never used in reels 01–66: a customer catches the shop selling the SAME
// sack at two prices. Pain: wholesale / retail / colleague prices live only in
// the owner's head; a new shop boy quotes a different number every time.
// Product truth (packages/validation/src/schemas/pricing.ts, price-list.service):
// a price list is a named set of product prices in one currency; a customer is
// put on one list and the invoice builder prices the line from it. A product
// that is not on the list keeps its own price.
//
// Hard Rules 13–17: one focal stage, ≤ 6 on-stage words, no dividers, every
// sounded word has an action read with cueAt, endings carry no sound,
// PROVISIONAL_CADENCE_MODEL_ACTIVE until a real voiceover is placed.
// ============================================

import type { Reel } from '../engine/types'
import type { WordCue } from '../engine/speech-model'

const provisional = {
  // Phrases measured on audio/part67.mp3 (silencedetect); word positions inside
  // a phrase are letter-weighted estimates — not forced alignment.
  alignmentStatus: 'AUDIO_DETECTED_NOT_WORD_ALIGNED' as const,
  isProvisional: true,
  confidence: null,
}

function w(word: string, start: number, end: number, extra: Partial<WordCue> = {}): WordCue {
  return { word, start, end, ...extra }
}

export const reel67: Reel = {
  id: '67',
  title: 'همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؟',
  duration: 48.0,
  theme: 'midnight-gold',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'یک کالا به دو مشتری با دو قیمت فروخته می‌شود و مشتری قدیمی پای پیشخوان مچ مغازه را می‌گیرد.',
    oldWorkflow: 'قیمت عمده، خرده و همکار فقط در ذهن صاحب مغازه است و شاگرد هر بار عددی می‌گوید.',
    friction: 'هر قیمت اشتباه یا از سود کم می‌کند یا اعتماد مشتری را می‌برد.',
    hisabcheAction:
      'فهرست قیمت: هر مشتری روی یک فهرست (عمده، خرده، همکار) است و فاکتور قیمت همان فهرست را خودش می‌گذارد.',
    automatedResult: 'هر کس پشت پیشخوان باشد، به هر مشتری همان قیمت همیشگی‌اش داده می‌شود.',
    businessOutcome: 'قیمت یکدست، حاشیه‌ی سود محفوظ و مشتری‌ای که دوباره برمی‌گردد.',
    emotionalPayoff: 'دیگر لازم نیست صاحب مغازه همه‌ی قیمت‌ها را حفظ باشد.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'TwinReceiptConfrontation',
      'FlickeringPriceTag',
      'SplitLossScale',
      'PriceListDeck',
      'AutoPricedInvoiceLine',
      'SingleTagCta',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 7.5,
      vo: 'همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؛ چرا به من گرون‌تر؟',
      spec: { kind: 'word-sync', actor: 'r67-twin-receipts', title: 'دو رسید، یک کالا' },
      sentence: {
        text: 'همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؛ چرا به من گرون‌تر؟',
        intent: 'هوک رویارویی مشتری: یک کالا، دو قیمت',
        ...provisional,
        words: [
          w('همین', 0.2, 0.5),
          w('برنج', 0.53, 0.83, { emphasis: true, action: 'sack-drop', sound: 'cardThock' }),
          w('رو', 0.86, 0.99),
          w('دیروز', 1.02, 1.41, {
            emphasis: true,
            action: 'receipt-yesterday',
            sound: 'receiptPrint',
          }),
          w('به', 1.44, 1.57),
          w('همسایه‌ات', 1.6, 2.31),
          w('ارزون‌تر', 2.34, 2.97, { emphasis: true, action: 'price-low-stamp', sound: 'pop' }),
          w('دادی؛', 3, 3.39),
          w('چرا', 3.89, 4.15),
          w('به', 4.18, 4.34),
          w('من', 4.37, 4.53, { emphasis: true, action: 'receipt-today', sound: 'cardEnter' }),
          w('گرون‌تر؟', 4.56, 5.3, { emphasis: true, action: 'price-gap-alert', sound: 'alert' }),
        ],
        sentenceEnding: { at: 5.6, action: 'twin-hold' },
      },
    },
    {
      start: 7.5,
      end: 15.5,
      vo: 'قیمت عمده و خرده فقط توی ذهن خودته؛ شاگرد تازه هر بار یه عدد میگه.',
      spec: { kind: 'word-sync', actor: 'r67-flicker-tag', title: 'قیمتی که در ذهن است' },
      sentence: {
        text: 'قیمت عمده و خرده فقط توی ذهن خودته؛ شاگرد تازه هر بار یه عدد میگه.',
        intent: 'ریشه: قیمت جایی نوشته نشده',
        ...provisional,
        words: [
          w('قیمت', 0.2, 0.66),
          w('عمده', 0.69, 1.14, { emphasis: true, action: 'tag-wholesale', sound: 'tick' }),
          w('و', 1.17, 1.27),
          w('خرده', 1.3, 1.75, { emphasis: true, action: 'tag-retail', sound: 'tick' }),
          w('فقط', 1.78, 2.12),
          w('توی', 2.15, 2.48),
          w('ذهن', 2.51, 2.85, {
            emphasis: true,
            action: 'tag-fade-head',
            sound: 'softTransition',
          }),
          w('خودته؛', 2.88, 3.58),
          w('شاگرد', 4.13, 4.63, { emphasis: true, action: 'boy-arrives', sound: 'cardEnter' }),
          w('تازه', 4.66, 5.05),
          w('هر', 5.08, 5.26),
          w('بار', 5.29, 5.57),
          w('یه', 5.6, 5.78),
          w('عدد', 5.81, 6.1, {
            emphasis: true,
            action: 'tag-spin-numbers',
            sound: 'clockTickRapid',
          }),
          w('میگه.', 6.13, 6.62),
        ],
        sentenceEnding: { at: 6.92, action: 'flicker-hold' },
      },
    },
    {
      start: 15.5,
      end: 23.0,
      vo: 'یه قیمت اشتباه؛ یا سودت رفته، یا مشتری‌ات.',
      spec: { kind: 'word-sync', actor: 'r67-loss-scale', title: 'سود یا مشتری' },
      sentence: {
        text: 'یه قیمت اشتباه؛ یا سودت رفته، یا مشتری‌ات.',
        intent: 'پیامد: هر دو کفه ضرر است',
        ...provisional,
        words: [
          w('یه', 0.2, 0.37),
          w('قیمت', 0.4, 0.77),
          w('اشتباه؛', 0.8, 1.46, { emphasis: true, action: 'scale-drop', sound: 'impact' }),
          w('یا', 1.84, 2.03),
          w('سودت', 2.06, 2.45, { emphasis: true, action: 'profit-pan-sink', sound: 'cash' }),
          w('رفته،', 2.48, 2.98),
          w('یا', 3.01, 3.19),
          w('مشتری‌ات.', 3.22, 4.15, {
            emphasis: true,
            action: 'customer-pan-leave',
            sound: 'whoosh',
          }),
        ],
        sentenceEnding: { at: 4.45, action: 'scale-hold' },
      },
    },
    {
      start: 23.0,
      end: 31.0,
      vo: 'توی حسابچه هر مشتری فهرست قیمت خودش رو داره: عمده، خرده، همکار.',
      spec: { kind: 'word-sync', actor: 'r67-price-list-deck', title: 'فهرست قیمت هر مشتری' },
      sentence: {
        text: 'توی حسابچه هر مشتری فهرست قیمت خودش رو داره: عمده، خرده، همکار.',
        intent: 'سازوکار محصول: فهرست قیمت روی مشتری',
        ...provisional,
        words: [
          w('توی', 0.2, 0.51),
          w('حسابچه', 0.54, 1.18, { emphasis: true, action: 'deck-rise', sound: 'insightReveal' }),
          w('هر', 1.21, 1.4),
          w('مشتری', 1.43, 1.96),
          w('فهرست', 1.99, 2.52, { emphasis: true, action: 'deck-spread', sound: 'cardEnter' }),
          w('قیمت', 2.55, 2.97),
          w('خودش', 3, 3.42),
          w('رو', 3.45, 3.64),
          w('داره:', 3.67, 4.2),
          w('عمده،', 4.78, 5.52, { emphasis: true, action: 'list-wholesale', sound: 'tick' }),
          w('خرده،', 5.55, 6.29, { emphasis: true, action: 'list-retail', sound: 'tick' }),
          w('همکار.', 6.32, 7.22, { emphasis: true, action: 'list-colleague', sound: 'pop' }),
        ],
        sentenceEnding: { at: 7.52, action: 'deck-hold' },
      },
    },
    {
      start: 31.0,
      end: 39.0,
      vo: 'اسم مشتری رو که بزنی؛ فاکتور خودش قیمت همون فهرست رو میذاره.',
      spec: { kind: 'word-sync', actor: 'r67-auto-priced-line', title: 'فاکتور با قیمت درست' },
      sentence: {
        text: 'اسم مشتری رو که بزنی؛ فاکتور خودش قیمت همون فهرست رو میذاره.',
        intent: 'نتیجه: قیمت درست بدون حافظه‌ی کسی',
        ...provisional,
        words: [
          w('اسم', 0.2, 0.48),
          w('مشتری', 0.51, 1.01, {
            emphasis: true,
            action: 'customer-pick',
            sound: 'typewriterClick',
          }),
          w('رو', 1.04, 1.22),
          w('که', 1.25, 1.42),
          w('بزنی؛', 1.45, 1.95),
          w('فاکتور', 2.1, 2.62, { emphasis: true, action: 'invoice-line-in', sound: 'cardEnter' }),
          w('خودش', 2.65, 2.98),
          w('قیمت', 3.01, 3.35, { emphasis: true, action: 'price-fill', sound: 'scan' }),
          w('همون', 3.38, 3.71),
          w('فهرست', 3.74, 4.17, { emphasis: true, action: 'list-badge', sound: 'pop' }),
          w('رو', 4.2, 4.35),
          w('میذاره.', 4.38, 4.99, { emphasis: true, action: 'line-locked', sound: 'success' }),
        ],
        sentenceEnding: { at: 5.29, action: 'line-hold' },
      },
    },
    {
      start: 39.0,
      end: 48.0,
      vo: 'قیمت‌هات رو یک بار بنویس؛ شروع رایگان در حسابچه.',
      spec: { kind: 'word-sync', actor: 'r67-cta-tag', title: 'شروع رایگان' },
      sentence: {
        text: 'قیمت‌هات رو یک بار بنویس؛ شروع رایگان در حسابچه.',
        intent: 'دعوت به اقدام',
        ...provisional,
        words: [
          w('قیمت‌هات', 0.2, 1.11, { emphasis: true, action: 'cta-tag-swing', sound: 'whoosh' }),
          w('رو', 1.14, 1.35),
          w('یک', 1.38, 1.58),
          w('بار', 1.61, 1.93),
          w('بنویس؛', 1.96, 2.64, {
            emphasis: true,
            action: 'cta-tag-written',
            sound: 'markerScribble',
          }),
          w('شروع', 3.08, 3.49, { emphasis: true, action: 'cta-button', sound: 'pop' }),
          w('رایگان', 3.52, 4.16),
          w('در', 4.19, 4.38),
          w('حسابچه.', 4.41, 5.15, { emphasis: true, action: 'cta-brand', sound: 'ctaResolution' }),
        ],
        sentenceEnding: { at: 5.45, action: 'cta-final-hold' },
      },
    },
  ],
}
