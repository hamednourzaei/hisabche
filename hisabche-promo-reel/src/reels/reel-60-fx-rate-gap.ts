// ============================================
// Reel #60 — «فاکتور هزار دالری دیروز؛ امروز چند افغانی می‌ارزه؟»
//
// An importer sells 1,000 USD at 70 and is paid at 74. The books say 70,000,
// the till holds 74,000, and the 4,000 between them is recorded nowhere —
// because the spreadsheet's rate cell was overwritten. Hisabche keeps the
// invoice's rate and books the difference to exchange gain and loss.
//
// Product truth (checked): an invoice in another currency needs a rate and
// freezes it; a payment is valued at the day's rate; the difference posts to
// the `fx_gain_loss` account («سود و زیان تسعیر ارز»).
//
// Word timings are the cadence model's (no audio yet): provisional, confidence null.
// ============================================

import type { Reel } from '../engine/types'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

export const reel60: Reel = {
  id: '60',
  title: 'دالر بالا رفت؛ ۴٬۰۰۰ افغانی کجا رفت؟',
  duration: 26.0,
  theme: 'midnight-gold',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'فاکتور ارزی به یک نرخ صادر می‌شود و به نرخ دیگری پرداخت می‌شود؛ اختلاف در هیچ دفتری نیست',
    oldWorkflow: 'ستون نرخ در اکسل که هر روز با نرخ تازه بازنویسی می‌شود',
    friction: '۴٬۰۰۰ افغانی اختلاف روی یک فاکتور هزار دالری که نه سود ثبت می‌شود نه زیان',
    hisabcheAction:
      'نرخ همان روز روی فاکتور ارزی منجمد می‌شود و پرداخت به نرخ روز پرداخت ارزش‌گذاری می‌شود',
    automatedResult: 'سند خودکار: صندوق ۷۴٬۰۰۰ بدهکار، طلب ۷۰٬۰۰۰ و سود تسعیر ۴٬۰۰۰ بستانکار',
    businessOutcome: 'سود و زیان واقعی نوسان ارز، جدا از سود فروش کالا',
    emotionalPayoff: 'دیگر نوسان دالر حساب را به هم نمی‌ریزد',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: ['RateFreezeOnInvoice', 'DayRatePayment', 'FxGainLossPosting'],
  },
  scenes: [
    {
      start: 0.0,
      end: 4.8,
      vo: 'فاکتور هزار دالری دیروز؛ امروز چند افغانی می‌ارزه؟',
      spec: { kind: 'word-sync', actor: 'r60-rate-hook', title: 'فاکتور دیروز، نرخ امروز' },
      sentence: {
        text: 'فاکتور هزار دالری دیروز؛ امروز چند افغانی می‌ارزه؟',
        intent: 'کشف ناراحت‌کننده: یک فاکتور، دو نرخ',
        ...provisional,
        words: [
          {
            word: 'فاکتور',
            start: 0.2,
            end: 0.6,
            emphasis: true,
            action: 'invoice-enter',
            sound: 'cardEnter',
          },
          { word: 'هزار', start: 0.65, end: 0.95, emphasis: true },
          { word: 'دالری', start: 1.0, end: 1.4 },
          { word: 'دیروز؛', start: 1.45, end: 1.9 },
          {
            word: 'امروز',
            start: 2.2,
            end: 2.6,
            emphasis: true,
            action: 'rate-climb',
            sound: 'clockTickRapid',
          },
          { word: 'چند', start: 2.65, end: 2.9 },
          {
            word: 'افغانی',
            start: 2.95,
            end: 3.4,
            emphasis: true,
            action: 'question-hold',
            sound: 'titleHit',
          },
          { word: 'می‌ارزه؟', start: 3.45, end: 3.9 },
        ],
        sentenceEnding: { at: 3.3, action: 'question-hold' },
      },
    },
    {
      start: 4.8,
      end: 10.0,
      vo: 'دفترت می‌گه هفتاد هزار؛ صندوقت هفتاد و چهار هزار!',
      spec: { kind: 'word-sync', actor: 'r60-mismatch', title: 'دو عدد برای یک فاکتور' },
      sentence: {
        text: 'دفترت می‌گه هفتاد هزار؛ صندوقت هفتاد و چهار هزار!',
        intent: 'تشدید تنش: مغایرت دفتر و صندوق',
        ...provisional,
        words: [
          {
            word: 'دفترت',
            start: 0.3,
            end: 0.75,
            emphasis: true,
            action: 'book-card',
            sound: 'cardEnter',
          },
          { word: 'می‌گه', start: 0.8, end: 1.05 },
          { word: 'هفتاد', start: 1.1, end: 1.45, emphasis: true },
          { word: 'هزار؛', start: 1.5, end: 1.8 },
          {
            word: 'صندوقت',
            start: 1.85,
            end: 2.35,
            emphasis: true,
            action: 'till-card',
            sound: 'cash',
          },
          { word: 'هفتاد', start: 2.4, end: 2.7 },
          { word: 'و', start: 2.72, end: 2.8 },
          {
            word: 'چهار',
            start: 2.85,
            end: 3.15,
            emphasis: true,
            action: 'diff-alert',
            sound: 'impact',
          },
          { word: 'هزار!', start: 3.2, end: 3.6, emphasis: true },
        ],
        sentenceEnding: { at: 3.6, action: 'diff-hold' },
      },
    },
    {
      start: 10.0,
      end: 15.8,
      vo: 'تو اکسل نرخ رو عوض می‌کنی؛ نرخ فاکتور پاک می‌شه و اختلاف گم.',
      spec: { kind: 'word-sync', actor: 'r60-overwritten-rate', title: 'نرخ بازنویسی‌شده' },
      sentence: {
        text: 'تو اکسل نرخ رو عوض می‌کنی؛ نرخ فاکتور پاک می‌شه و اختلاف گم.',
        intent: 'ریشه‌ی مشکل: ستون نرخی که هر روز بازنویسی می‌شود',
        ...provisional,
        words: [
          { word: 'تو', start: 0.2, end: 0.3 },
          {
            word: 'اکسل',
            start: 0.35,
            end: 0.75,
            emphasis: true,
            action: 'sheet-enter',
            sound: 'typewriterClick',
          },
          { word: 'نرخ', start: 0.8, end: 1.05 },
          { word: 'رو', start: 1.08, end: 1.2 },
          { word: 'عوض', start: 1.25, end: 1.55 },
          {
            word: 'می‌کنی؛',
            start: 1.6,
            end: 2.0,
            emphasis: true,
            action: 'overwrite',
            sound: 'markerScribble',
          },
          { word: 'نرخ', start: 2.2, end: 2.45 },
          { word: 'فاکتور', start: 2.5, end: 2.9 },
          { word: 'پاک', start: 2.95, end: 3.2, emphasis: true },
          { word: 'می‌شه', start: 3.22, end: 3.45 },
          { word: 'و', start: 3.5, end: 3.58 },
          {
            word: 'اختلاف',
            start: 3.6,
            end: 4.0,
            emphasis: true,
            action: 'diff-lost',
            sound: 'paperRustle',
          },
          { word: 'گم.', start: 4.05, end: 4.35, emphasis: true },
        ],
        sentenceEnding: { at: 4.0, action: 'lost-hold' },
      },
    },
    {
      start: 15.8,
      end: 21.6,
      vo: 'حسابچه نرخ فاکتور رو نگه می‌داره و چهار هزار رو سود تسعیر ثبت می‌کنه.',
      spec: { kind: 'word-sync', actor: 'r60-fx-lock', title: 'نرخ قفل، اختلاف ثبت' },
      sentence: {
        text: 'حسابچه نرخ فاکتور رو نگه می‌داره و چهار هزار رو سود تسعیر ثبت می‌کنه.',
        intent: 'سازوکار محصول: نرخ منجمد و سند خودکار سود تسعیر',
        ...provisional,
        words: [
          {
            word: 'حسابچه',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'brand-anchor',
            sound: 'cinematicReveal',
          },
          { word: 'نرخ', start: 0.8, end: 1.05 },
          { word: 'فاکتور', start: 1.1, end: 1.45 },
          { word: 'رو', start: 1.48, end: 1.6 },
          {
            word: 'نگه',
            start: 1.65,
            end: 1.9,
            emphasis: true,
            action: 'rate-lock',
            sound: 'precisionSequence',
          },
          { word: 'می‌داره', start: 1.95, end: 2.35 },
          { word: 'و', start: 2.4, end: 2.48 },
          {
            word: 'چهار',
            start: 2.55,
            end: 2.85,
            emphasis: true,
            action: 'journal-post',
            sound: 'dataFlow',
          },
          { word: 'هزار', start: 2.9, end: 3.2 },
          { word: 'رو', start: 3.22, end: 3.35 },
          {
            word: 'سود',
            start: 3.4,
            end: 3.65,
            emphasis: true,
            action: 'fx-gain',
            sound: 'financialMilestone',
          },
          { word: 'تسعیر', start: 3.7, end: 4.1, emphasis: true },
          { word: 'ثبت', start: 4.15, end: 4.4 },
          { word: 'می‌کنه.', start: 4.45, end: 4.85 },
        ],
        sentenceEnding: { at: 4.2, action: 'journal-hold' },
      },
    },
    {
      start: 21.6,
      end: 26.0,
      vo: 'حسابت به ارز خودت؛ شروع رایگان در حسابچه.',
      spec: { kind: 'word-sync', actor: 'r60-cta', title: 'حسابت، به ارز خودت' },
      sentence: {
        text: 'حسابت به ارز خودت؛ شروع رایگان در حسابچه.',
        intent: 'دعوت به اقدام',
        ...provisional,
        words: [
          {
            word: 'حسابت',
            start: 0.25,
            end: 0.7,
            emphasis: true,
            sound: 'cardEnter',
            action: 'cta-card',
          },
          { word: 'به', start: 0.72, end: 0.85 },
          { word: 'ارز', start: 0.9, end: 1.2, emphasis: true },
          { word: 'خودت؛', start: 1.25, end: 1.7 },
          { word: 'شروع', start: 2.0, end: 2.35 },
          {
            word: 'رایگان',
            start: 2.4,
            end: 2.85,
            emphasis: true,
            action: 'cta-pulse',
            sound: 'ctaResolution',
          },
          { word: 'در', start: 2.9, end: 3.0 },
          { word: 'حسابچه.', start: 3.05, end: 3.6, emphasis: true },
        ],
        sentenceEnding: { at: 2.4, action: 'cta-glow' },
      },
    },
  ],
}
