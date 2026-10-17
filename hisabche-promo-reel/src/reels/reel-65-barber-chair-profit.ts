// ============================================
// Reel #65 — «سه صندلی پر؛ اما شب فقط یک عدد می‌بینی»
//
// Prompt library: hp-018 (end-of-shift reconciliation technique) adapted to a
// salon with three stations. Persona: service shopkeeper (آرایشگر).
// Feature: every service lands on its own chair in real time, the consumables
// of that chair are subtracted from it, and at the night close the owner sees
// the real profit of EACH chair — one of which has been losing money all along.
//
// Visual laws (Hard Rules 13-19):
// 1. One composed canvas from frame 0 — the chairs are already standing; motion
//    arrives INTO the stage, never out of an empty void (Rule 18).
// 2. On-stage text is functional only: «فروش»، «سود»، «دفتر»، «ماشین‌حساب»,
//    «محصولات»، chair digits. Never the spoken sentence (Rule 14).
// 3. No divider lines, no split zones — one unified 9:16 plane (Rule 16).
// 4. Every label that appears stays until the scene ends (Rule 18).
// 5. Every sounded word carries an action this actor reads (Rule 13).
// ============================================

import type { Reel } from '../engine/types'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

export const reel65: Reel = {
  id: '65',
  title: 'سه صندلی پر؛ اما شب فقط یک عدد می‌بینی',
  duration: 26.0,
  theme: 'obsidian-cinematic',
  storyMatrix: {
    targetCustomer: 'services',
    customerPain:
      'در سالن شلوغ، هر صندلی تمام روز کار می‌کند؛ اما شب که کتاب بسته می‌شود، فقط یک عدد کل فروش دیده می‌شود و سهم محصولات مصرفی هر صندلی معلوم نیست.',
    oldWorkflow:
      'دفتر دستی برای نام مشتری و خدمت، ماشین‌حساب برای جمع شب، و حافظه آرایشگر برای اینکه کدام صندلی واقعاً سود داشته است.',
    friction:
      'درآمد روزانه دیده می‌شود اما سودِ هر صندلی نه؛ یک صندلی می‌تواند کل شب ضرر بدهد و در جمع گم شود.',
    hisabcheAction:
      'ثبت هر خدمت روی صندلی خودش در همان لحظه، کسر جداگانه محصولات مصرفی همان صندلی، و بستن شیفت با سود واقعی هر ایستگاه.',
    automatedResult:
      'درآمد ۹٬۶۰۰٬۰۰۰ منهای مصرفی ۴٬۱۳۰٬۰۰۰ = سود ۵٬۴۷۰٬۰۰۰ که بین سه صندلی جدا دیده می‌شود.',
    businessOutcome:
      'قیمت‌گذاری درست خدمات و محصولات هر صندلی، و پایان شب با سود واقعی به‌جای حدس.',
    emotionalPayoff:
      'آرامش آرایشگری که می‌داند کدام صندلی می‌ارزد نگه داشته شود و کدام باید اصلاح شود.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'StationWallMeters',
      'HandwrittenRowStamp',
      'LiveChairAttribution',
      'ConsumableDeductRow',
      'NightCloseProfitSplit',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 3.5,
      vo: 'سه صندلی همیشه پر؛ اما شب که حساب می‌کنی، فقط یک عدد می‌بینی.',
      spec: {
        kind: 'word-sync',
        actor: 'r65-chair-wall',
        title: 'سه ایستگاه شلوغ، یک عدد مبهم در شب',
      },
      sentence: {
        text: 'سه صندلی همیشه پر؛ اما شب که حساب می‌کنی، فقط یک عدد می‌بینی.',
        intent: 'هوک کشف ناخوشایند: فروش روزانه هست، سودِ هر صندلی نیست',
        ...provisional,
        words: [
          {
            word: 'سه',
            start: 0.15,
            end: 0.42,
            emphasis: true,
            action: 'chairs-reveal',
            sound: 'cardThock',
          },
          { word: 'صندلی', start: 0.42, end: 0.68 },
          { word: 'همیشه', start: 0.68, end: 0.96 },
          {
            word: 'پر؛',
            start: 0.96,
            end: 1.24,
            emphasis: true,
            action: 'chairs-fill',
            sound: 'pop',
          },
          {
            word: 'اما',
            start: 1.36,
            end: 1.58,
            action: 'day-total-in',
            sound: 'whoosh',
          },
          { word: 'شب', start: 1.58, end: 1.8 },
          { word: 'که', start: 1.8, end: 1.96 },
          {
            word: 'حساب',
            start: 1.96,
            end: 2.24,
            action: 'ledger-open',
            sound: 'paperRustle',
          },
          { word: 'می‌کنی،', start: 2.24, end: 2.52 },
          { word: 'فقط', start: 2.62, end: 2.82, emphasis: true },
          { word: 'یک', start: 2.82, end: 2.96 },
          {
            word: 'عدد',
            start: 2.96,
            end: 3.18,
            emphasis: true,
            action: 'single-number',
            sound: 'tick',
          },
          {
            word: 'می‌بینی.',
            start: 3.18,
            end: 3.45,
            emphasis: true,
            action: 'unknown-total',
            sound: 'alert',
          },
        ],
        sentenceEnding: { at: 2.95, action: 'total-freeze' },
      },
    },
    {
      start: 3.5,
      end: 8.5,
      vo: 'دفتر می‌نویسد: مهدی، خدمات اصلی. ماشین‌حساب جمع می‌زند. سهم محصولات مصرفی کجاست؟',
      spec: {
        kind: 'word-sync',
        actor: 'r65-paper-drawer',
        title: 'دفتر و ماشین‌حساب؛ جای خالی سهم مصرفی',
      },
      sentence: {
        text: 'دفتر می‌نویسد: مهدی، خدمات اصلی. ماشین‌حساب جمع می‌زند. سهم محصولات مصرفی کجاست؟',
        intent: 'کالبدشکافی روش دستی: نام مشتری ثبت می‌شود، هزینه مصرفی جا می‌ماند',
        ...provisional,
        words: [
          {
            word: 'دفتر',
            start: 0.15,
            end: 0.45,
            emphasis: true,
            action: 'notebook-enter',
            sound: 'paperRustle',
          },
          {
            word: 'می‌نویسد:',
            start: 0.45,
            end: 0.82,
            action: 'handwrite-row',
            sound: 'typewriterClick',
          },
          { word: 'مهدی،', start: 0.9, end: 1.25 },
          {
            word: 'خدمات',
            start: 1.25,
            end: 1.55,
            emphasis: true,
            action: 'service-tag',
            sound: 'pop',
          },
          { word: 'اصلی.', start: 1.55, end: 1.85 },
          {
            word: 'ماشین‌حساب',
            start: 1.98,
            end: 2.35,
            emphasis: true,
            action: 'calculator-in',
            sound: 'cardThock',
          },
          { word: 'جمع', start: 2.35, end: 2.6 },
          {
            word: 'می‌زند.',
            start: 2.6,
            end: 2.9,
            emphasis: true,
            action: 'sum-total',
            sound: 'tick',
          },
          {
            word: 'سهم',
            start: 3.1,
            end: 3.35,
            action: 'consumables-gap',
            sound: 'whoosh',
          },
          {
            word: 'محصولات',
            start: 3.35,
            end: 3.72,
            emphasis: true,
            action: 'gap-slot-open',
            sound: 'pop',
          },
          { word: 'مصرفی', start: 3.72, end: 4.05 },
          {
            word: 'کجاست؟',
            start: 4.15,
            end: 4.55,
            emphasis: true,
            action: 'missing-gap',
            sound: 'alert',
          },
        ],
        sentenceEnding: { at: 4.1, action: 'gap-hold' },
      },
    },
    {
      start: 8.5,
      end: 15.0,
      vo: 'در حسابچه، هر خدمت همان لحظه روی صندلی خودش می‌نشیند؛ محصول مصرفی جدا کم می‌شود.',
      spec: {
        kind: 'word-sync',
        actor: 'r65-live-chairs',
        title: 'ثبت زنده هر خدمت روی صندلی خودش',
      },
      sentence: {
        text: 'در حسابچه، هر خدمت همان لحظه روی صندلی خودش می‌نشیند؛ محصول مصرفی جدا کم می‌شود.',
        intent: 'موتور محصول: انتساب خدمت به ایستگاه و کسر مصرفی در همان لحظه',
        ...provisional,
        words: [
          { word: 'در', start: 0.15, end: 0.32 },
          {
            word: 'حسابچه،',
            start: 0.32,
            end: 0.7,
            emphasis: true,
            action: 'brand-chip-in',
            sound: 'chime',
          },
          {
            word: 'هر',
            start: 0.82,
            end: 1.02,
            action: 'chairs-live',
            sound: 'cardThock',
          },
          {
            word: 'خدمت',
            start: 1.02,
            end: 1.38,
            emphasis: true,
            action: 'service-tick',
            sound: 'tick',
          },
          { word: 'همان', start: 1.5, end: 1.78 },
          {
            word: 'لحظه',
            start: 1.78,
            end: 2.1,
            emphasis: true,
            action: 'instant-post',
            sound: 'cash',
          },
          { word: 'روی', start: 2.22, end: 2.45 },
          { word: 'صندلی', start: 2.45, end: 2.78 },
          {
            word: 'خودش',
            start: 2.78,
            end: 3.1,
            emphasis: true,
            action: 'chair-attribution',
            sound: 'cardEnter',
          },
          { word: 'می‌نشیند؛', start: 3.1, end: 3.48 },
          {
            word: 'محصول',
            start: 3.62,
            end: 3.95,
            action: 'consumable-subtract',
            sound: 'whoosh',
          },
          {
            word: 'مصرفی',
            start: 3.95,
            end: 4.3,
            emphasis: true,
            action: 'consumable-row',
            sound: 'pop',
          },
          {
            word: 'جدا',
            start: 4.3,
            end: 4.55,
            action: 'separate-row',
            sound: 'cardEnter',
          },
          {
            word: 'کم',
            start: 4.7,
            end: 4.95,
            action: 'cost-deduct',
            sound: 'tick',
          },
          {
            word: 'می‌شود.',
            start: 4.95,
            end: 5.35,
            emphasis: true,
            action: 'cost-deduct',
            sound: 'impact',
          },
        ],
        sentenceEnding: { at: 5.2, action: 'deduct-hold' },
      },
    },
    {
      start: 15.0,
      end: 21.5,
      vo: 'شب که کتاب را می‌بندی، سود هر صندلی را جدا می‌بینی؛ یکیشان قرمز است.',
      spec: {
        kind: 'word-sync',
        actor: 'r65-chair-profit',
        title: 'بستن شیفت: سود واقعی هر صندلی',
      },
      sentence: {
        text: 'شب که کتاب را می‌بندی، سود هر صندلی را جدا می‌بینی؛ یکیشان قرمز است.',
        intent: 'نقطه اوج: سود واقعی هر ایستگاه و کشف صندلی زیان‌ده',
        ...provisional,
        words: [
          {
            word: 'شب',
            start: 0.15,
            end: 0.42,
            emphasis: true,
            action: 'night-close',
            sound: 'whoosh',
          },
          { word: 'که', start: 0.42, end: 0.6 },
          { word: 'کتاب', start: 0.6, end: 0.92 },
          { word: 'را', start: 0.92, end: 1.08 },
          {
            word: 'می‌بندی،',
            start: 1.08,
            end: 1.45,
            emphasis: true,
            action: 'book-close',
            sound: 'paperRustle',
          },
          {
            word: 'سود',
            start: 1.62,
            end: 1.92,
            emphasis: true,
            action: 'profit-per-chair',
            sound: 'dataFlow',
          },
          { word: 'هر', start: 1.92, end: 2.12 },
          { word: 'صندلی', start: 2.12, end: 2.48 },
          { word: 'را', start: 2.48, end: 2.64 },
          {
            word: 'جدا',
            start: 2.64,
            end: 2.9,
            action: 'chair-values-split',
            sound: 'pop',
          },
          { word: 'می‌بینی؛', start: 2.9, end: 3.28 },
          {
            word: 'یکیشان',
            start: 3.4,
            end: 3.75,
            emphasis: true,
            action: 'chair-two-negative',
            sound: 'alert',
          },
          {
            word: 'قرمز',
            start: 3.75,
            end: 4.05,
            emphasis: true,
            action: 'red-flash',
            sound: 'impact',
          },
          {
            word: 'است.',
            start: 4.05,
            end: 4.45,
            emphasis: true,
            action: 'total-profit-reveal',
            sound: 'financialMilestone',
          },
        ],
        sentenceEnding: { at: 4.05, action: 'profit-hold' },
      },
    },
    {
      start: 21.5,
      end: 26.0,
      vo: 'سودِ هر صندلی را ببین؛ شروع رایگان در حسابچه.',
      spec: {
        kind: 'word-sync',
        actor: 'r65-cta-salon',
        title: 'دعوت به اقدام: سود هر ایستگاه',
      },
      sentence: {
        text: 'سودِ هر صندلی را ببین؛ شروع رایگان در حسابچه.',
        intent: 'دعوت به اقدام: سود واقعی هر صندلی از همین امروز',
        ...provisional,
        words: [
          {
            word: 'سودِ',
            start: 0.2,
            end: 0.52,
            emphasis: true,
            action: 'cta-enter',
            sound: 'ctaResolution',
          },
          { word: 'هر', start: 0.52, end: 0.72 },
          {
            word: 'صندلی',
            start: 0.72,
            end: 1.08,
            emphasis: true,
            action: 'chair-echo',
            sound: 'chime',
          },
          { word: 'را', start: 1.08, end: 1.24 },
          {
            word: 'ببین؛',
            start: 1.24,
            end: 1.66,
            emphasis: true,
            action: 'cta-pulse',
            sound: 'successResolution',
          },
          { word: 'شروع', start: 1.8, end: 2.12 },
          {
            word: 'رایگان',
            start: 2.12,
            end: 2.52,
            emphasis: true,
            action: 'cta-button-pulse',
            sound: 'cash',
          },
          { word: 'در', start: 2.66, end: 2.84 },
          {
            word: 'حسابچه.',
            start: 2.84,
            end: 3.3,
            emphasis: true,
            action: 'brand-echo',
            sound: 'chime',
          },
        ],
        sentenceEnding: { at: 3.2, action: 'cta-hold' },
      },
    },
  ],
}
