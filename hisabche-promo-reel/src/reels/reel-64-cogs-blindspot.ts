// ============================================
// Reel #64 — «کوری بهای تمام‌شده کارگاه»
//
// A workshop producer sells 100 chairs a month, production hits a record,
// but the till is empty at month-end. He priced his chairs intuitively at 600k,
// overlooking glue, sand-paper, hardware, and timber offcuts.
//
// Hisabche's BOM (Bill of Materials) aggregates raw materials, components,
// and labor into the true unit cost (650k) and sets a profitable sales price
// (850k with 200k locked margin).
//
// Template: prompt library hp-007 (technique only, workshop persona).
// Layout Topology: single-focal-stage (Hard Rule 14 compliant).
// Text Budget: <= 6 words per on-stage label (Hard Rule 14 compliant).
// ============================================

import type { Reel } from '../engine/types'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

export const reel64: Reel = {
  id: '64',
  title: 'کوری بهای تمام‌شده کارگاه',
  duration: 27.0,
  theme: 'swiss-editorial',
  storyMatrix: {
    targetCustomer: 'workshop-producer',
    customerPain:
      'فروش و تولید بالاست اما در پایان ماه دخل خالی است چون قیمت بر اساس حدس تعیین شده',
    oldWorkflow: 'محاسبه دستی و تخمینی قیمت فروش بدون دیدن ضایعات و قطعات خرد',
    friction: 'فروش زیر بهای تمام‌شده و ذوب شدن سرمایه کارگاه',
    hisabcheAction:
      'فرمول ساخت (BOM) حسابچه بهای چوب، اتصالات، دستمزد و ضایعات را خودکار تجمیع می‌کند',
    automatedResult: 'بهای تمام‌شده ۶۵۰ هزار تومان → قیمت فروش مطمئن ۸۵۰ هزار با ۲۰۰ هزار سود خالص',
    businessOutcome: 'تولیدکننده سود قطعی هر قطعه کار را قبل از ساخت می‌داند',
    emotionalPayoff: 'پایان ترس از خالی ماندن دخل کارگاه در آخر ماه',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: ['CogsWaterfallDeconstruct', 'BomMaterialAccumulator', 'MarginLockBadge'],
  },
  scenes: [
    {
      start: 0.0,
      end: 3.8,
      vo: 'تولیدت رکورد زد؛ ولی چرا حسابت آخر ماه خالیه؟',
      spec: { kind: 'word-sync', actor: 'r64-hook', title: 'تیراژ بالای کارگاه' },
      sentence: {
        text: 'تولیدت رکورد زد؛ ولی چرا حسابت آخر ماه خالیه؟',
        intent: 'شوک اولیه: تولید بالا ولی دخل خالی',
        ...provisional,
        words: [
          {
            word: 'تولیدت',
            start: 0.2,
            end: 0.65,
            emphasis: true,
            action: 'record-stamp',
            sound: 'impact',
          },
          { word: 'رکورد', start: 0.68, end: 1.1 },
          { word: 'زد؛', start: 1.13, end: 1.45 },
          { word: 'ولی', start: 1.55, end: 1.8 },
          { word: 'چرا', start: 1.83, end: 2.1 },
          {
            word: 'حسابت',
            start: 2.13,
            end: 2.55,
            emphasis: true,
            action: 'empty-wallet',
            sound: 'cardEnter',
          },
          { word: 'آخر', start: 2.58, end: 2.85 },
          { word: 'ماه', start: 2.88, end: 3.15 },
          { word: 'خالیه؟', start: 3.18, end: 3.65 },
        ],
        sentenceEnding: { at: 3.65, action: 'hold-empty' },
      },
    },
    {
      start: 3.8,
      end: 9.2,
      vo: 'چون قیمت فروش رو حسی بستی، نه با بهای تمام‌شده.',
      spec: { kind: 'word-sync', actor: 'r64-guess-leak', title: 'قیمت‌گذاری حسی' },
      sentence: {
        text: 'چون قیمت فروش رو حسی بستی، نه با بهای تمام‌شده.',
        intent: 'ریشه مشکل: قیمت‌گذاری حسی بدون احتساب هزینه واقعی',
        ...provisional,
        words: [
          { word: 'چون', start: 0.2, end: 0.5 },
          {
            word: 'قیمت',
            start: 0.53,
            end: 0.9,
            emphasis: true,
            action: 'guess-tag',
            sound: 'paperRustle',
          },
          { word: 'فروش', start: 0.93, end: 1.3 },
          { word: 'رو', start: 1.33, end: 1.5 },
          { word: 'حسی', start: 1.53, end: 1.95, emphasis: true },
          { word: 'بستی،', start: 1.98, end: 2.45 },
          { word: 'نه', start: 2.55, end: 2.8 },
          { word: 'با', start: 2.83, end: 3.0 },
          {
            word: 'بهای',
            start: 3.03,
            end: 3.4,
            emphasis: true,
            action: 'tag-fracture',
            sound: 'whoosh',
          },
          { word: 'تمام‌شده.', start: 3.43, end: 4.3 },
        ],
        sentenceEnding: { at: 4.3, action: 'hold-fracture' },
      },
    },
    {
      start: 9.2,
      end: 15.6,
      vo: 'چسب، یراق و ضایعات رو ندیدی؛ کارگاه با ضرر می‌فروخت!',
      spec: { kind: 'word-sync', actor: 'r64-cogs-breakdown', title: 'شکست بهای تمام‌شده' },
      sentence: {
        text: 'چسب، یراق و ضایعات رو ندیدی؛ کارگاه با ضرر می‌فروخت!',
        intent: 'نمایش اقلام نادیده‌گرفته‌شده و زیان ناپیدا',
        ...provisional,
        words: [
          {
            word: 'چسب،',
            start: 0.25,
            end: 0.7,
            emphasis: true,
            action: 'glue-scrap-pill',
            sound: 'cardEnter',
          },
          { word: 'یراق', start: 0.73, end: 1.15 },
          { word: 'و', start: 1.18, end: 1.3 },
          { word: 'ضایعات', start: 1.33, end: 1.9, emphasis: true },
          { word: 'رو', start: 1.93, end: 2.1 },
          { word: 'ندیدی؛', start: 2.13, end: 2.65 },
          { word: 'کارگاه', start: 2.75, end: 3.2 },
          { word: 'با', start: 3.23, end: 3.4 },
          {
            word: 'ضرر',
            start: 3.43,
            end: 3.9,
            emphasis: true,
            action: 'loss-strike',
            sound: 'alert',
          },
          { word: 'می‌فروخت!', start: 3.93, end: 4.8 },
        ],
        sentenceEnding: { at: 4.8, action: 'hold-loss' },
      },
    },
    {
      start: 15.6,
      end: 22.0,
      vo: 'تو فرمول ساخت حسابچه، بهای هر قطعه دقیق محاسبه میشه.',
      spec: { kind: 'word-sync', actor: 'r64-bom-solution', title: 'فرمول ساخت حسابچه' },
      sentence: {
        text: 'تو فرمول ساخت حسابچه، بهای هر قطعه دقیق محاسبه میشه.',
        intent: 'موتور راهکار: محاسبه خودکار BOM و تثبیت سود',
        ...provisional,
        words: [
          { word: 'تو', start: 0.2, end: 0.4 },
          {
            word: 'فرمول',
            start: 0.43,
            end: 0.85,
            emphasis: true,
            action: 'bom-assembly',
            sound: 'sync',
          },
          { word: 'ساخت', start: 0.88, end: 1.25 },
          { word: 'حسابچه،', start: 1.28, end: 1.8 },
          { word: 'بهای', start: 1.85, end: 2.2 },
          { word: 'هر', start: 2.23, end: 2.45 },
          { word: 'قطعه', start: 2.48, end: 2.9 },
          {
            word: 'دقیق',
            start: 2.93,
            end: 3.35,
            emphasis: true,
            action: 'margin-confirm',
            sound: 'success',
          },
          { word: 'محاسبه', start: 3.38, end: 4.0 },
          { word: 'میشه.', start: 4.03, end: 4.6 },
        ],
        sentenceEnding: { at: 4.6, action: 'hold-solution' },
      },
    },
    {
      start: 22.0,
      end: 27.0,
      vo: 'سود واقعی کارگاهت رو حساب کن؛ شروع رایگان در حسابچه.',
      spec: { kind: 'word-sync', actor: 'r64-cta', title: 'دعوت به اقدام کارگاه' },
      sentence: {
        text: 'سود واقعی کارگاهت رو حساب کن؛ شروع رایگان در حسابچه.',
        intent: 'دعوت به اقدام روشن و ماندگار',
        ...provisional,
        words: [
          {
            word: 'سود',
            start: 0.2,
            end: 0.5,
            emphasis: true,
            action: 'cta-card',
            sound: 'cardEnter',
          },
          { word: 'واقعی', start: 0.53, end: 1.0 },
          { word: 'کارگاهت', start: 1.03, end: 1.6 },
          { word: 'رو', start: 1.63, end: 1.8 },
          { word: 'حساب', start: 1.83, end: 2.2 },
          { word: 'کن؛', start: 2.23, end: 2.6 },
          {
            word: 'شروع',
            start: 2.7,
            end: 3.1,
            action: 'cta-pulse',
            sound: 'chime',
          },
          { word: 'رایگان', start: 3.13, end: 3.65, emphasis: true },
          { word: 'در', start: 3.68, end: 3.85 },
          { word: 'حسابچه.', start: 3.88, end: 4.4 },
        ],
        sentenceEnding: { at: 4.4, action: 'hold-cta' },
      },
    },
  ],
}
