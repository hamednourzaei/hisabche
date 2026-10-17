// ============================================
// Hisabche Motion Design Studio — Reel 51
// Commercial Short Film (30.0s)
//
// Core Scenario:
// «وانت باربری دم در منتظره؛ اما کارتن‌ها تو انبار نیست!»
//
// Creative Architecture:
// - Persona: wholesaler (بنکدار و عمده‌فروش قطعات، ابزار و کالا)
// - Opening Archetype: immediate-consequence (توقف بارگیری پای سوله)
// - Art Direction: swiss-editorial (High-contrast dark Swiss editorial typography)
// - Layout Topology: asymmetrical-swiss-grid (65/35 golden ratio hierarchy)
// - Viral Template: vox-documentary-collage (خانواده خلاق شماره ۴: مستند کلاژ و پرونده‌خوانی)
// - 5 Selected Purposeful Operators:
//   1. Baseline Curtain Rise
//   2. Animated Highlighter Sweep
//   3. Odometer Slot Machine Roll
//   4. Isometric UI Layer Explosion
//   5. Iris Reveal Mask
// - Duration: Exactly 30.0 seconds (3.5 + 5.0 + 4.5 + 9.0 + 4.5 + 3.5 = 30.0s)
// ============================================

import type { Reel } from '../engine/types'
import { sequence, total } from './shared'

const reel = (
  id: string,
  title: string,
  parts: Parameters<typeof sequence>[0],
  theme?: Reel['theme'],
  storyMatrix?: Reel['storyMatrix'],
): Reel => {
  const scenes = sequence(parts)
  return { id, title, duration: total(scenes), scenes, theme, storyMatrix }
}

export const reel51 = reel(
  '51',
  'وانت باربری دم در منتظره؛ اما کارتن‌ها تو انبار نیست!',
  [
    // Scene 01 (0.0–3.5s, dur: 3.5): Hook — Immediate Consequence: Freight Crisis at the Loading Bay
    {
      dur: 3.5,
      spec: {
        kind: 'hook',
        openingArchetype: 'immediate-consequence',
        consequence: {
          alertBanner: 'توقف بارگیری | مغایرت موجودی قفسه',
          stoppedAction: 'وانت باربری دم در دوبله پارک کرده: ۶۰ کارتن کجاست؟',
          lossMetric: 'موجودی قفسه: فقط ۲۰ کارتن!',
        },
        lines: ['وانت دم در منتظره؛', 'اما کارتن‌ها [r:تو انبار نیست!]'],
      },
      vo: 'وانت دم در منتظره، اما کارتن‌ها تو انبار نیست!',
    },

    // Scene 02 (3.5–8.5s, dur: 5.0): Vox Documentary Collage — The Phantom Inventory Case
    {
      dur: 5.0,
      spec: {
        kind: 'vox-documentary',
        title: 'پرونده ویژه: موجودی موهوم در انبار',
        headline: 'فروش کاغذی بدون کسر درجا = آبروریزی جلو خریدار',
        documentNumber: 'گزارش مغایرت کاردکس · سوله مرکزی',
        badgeText: 'مستند انبارداری',
        clippingTitle: 'سند شماره ۱: کسر ۴۰ کارتن هنگام بارگیری',
        clippingText:
          'فاکتور فروش صادر شده اما چون به کاردکس انبار وصل نبوده، بار قبلاً فروخته شده بود!',
        dark: true,
      },
      vo: 'فاکتور صادر کردی، اما قفسه خالیه؛ چون دیروز دستی فروختی و ثبت نشد!',
    },

    // Scene 03 (8.5–13.0s, dur: 4.5): Split-Screen Horizon — The Structural Gap (Paper vs Real-Time)
    {
      dur: 4.5,
      spec: {
        kind: 'split',
        title: 'ریشه بحران: [r:شکاف دفتر تا قفسه] در برابر [c:همگامی لحظه‌ای]',
        dividerLabel: 'در برابر',
        left: {
          title: 'روش سنتی و فاکتور کاغذی',
          subtitle: 'انبارداری جزیره‌ای',
          points: ['فروش جنسی که قبلاً خارج شده', 'مغایرت مداوم دفاتر با کف سوله'],
          tone: 'red',
        },
        right: {
          title: 'کاردکس متصل حسابچه',
          subtitle: 'اتصال بلادرنگ',
          points: ['کسر خودکار موجودی با صدور فاکتور', 'قفل هوشمند کالا در تمام شعب'],
          tone: 'cyan',
        },
      },
      vo: 'تا وقتی فاکتور به انبار وصل نیست، داری جنس موهوم می‌فروشی!',
    },

    // Scene 04 (13.0–22.0s, dur: 9.0): Live Product Proof — Atomic Invoice Confirmation & Real-Time Stock Lock
    {
      dur: 9.0,
      spec: {
        kind: 'warehouse-movement-demo',
        title: 'اتصال بلادرنگ: [c:۱ فاکتور = کسر آنی کاردکس]',
        transitAt: 2.0,
        arriveAt: 5.0,
      },
      vo: 'با حسابچه، تایید فاکتور یعنی کسر آنی از انبار، قفل موجودی و صفر شدن خطا.',
    },

    // Scene 05 (22.0–26.5s, dur: 4.5): Versus Scale — Emotional Resolution & Market Credibility
    {
      dur: 4.5,
      spec: {
        kind: 'versus',
        title: 'اعتبار در بازار: [r:بدقولی و کسری بار] در برابر [c:تحویل بی‌نقص]',
        left: {
          label: 'بدون کنترل لحظه‌ای کاردکس',
          value: 'شرمندگی جلو مشتری + معطلی باربری',
          tone: 'red',
        },
        right: {
          label: 'با انبارداری هوشمند حسابچه',
          value: 'بارگیری فوری + موجودی ۱۰۰٪ شفاف',
          tone: 'green',
        },
        verdict: 'دیگه شرمنده مشتری عمده نمی‌شی',
      },
      vo: 'دیگه شرمنده مشتری نمی‌شی؛ انبارت همیشه با حسابت جوره.',
    },

    // Scene 06 (26.5–30.0s, dur: 3.5): Brand & High-Converting CTA
    {
      dur: 3.5,
      spec: {
        kind: 'cta',
        tagline: 'کنترل انبار و دخل بدون ۱ ریال مغایرت',
        boxes: [
          {
            lead: 'برای قفل خودکار موجودی و پایان مغایرت بارگیری',
            action: 'شروع رایگان در:',
            word: 'hisabche.com',
            tone: 'cyan',
          },
          {
            lead: 'نرم‌افزار یکپارچه حسابداری، انبار و ERP بازار',
            action: 'همین حالا جستجو کن:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 1.8,
      },
      vo: 'حسابچه رو رایگان تست کن در: hisabche.com',
    },
  ],
  'swiss-editorial',
  {
    targetCustomer: 'wholesaler',
    customerPain: 'کسری موجودی فیزیکی سوله انبار پای بارگیری وانت',
    oldWorkflow: 'فروش کاغذی و صدور فاکتور بدون اتصال به کاردکس',
    friction: 'موجود نشان دادن کالاهایی که قبلاً فروخته شده یا در انبار نیست',
    hisabcheAction: 'قفل اتوماتیک موجودی و کسر بلادرنگ کاردکس با تایید فاکتور',
    automatedResult: 'صفر شدن مغایرت انبار و همزمانی لحظه‌ای دفاتر با موجودی قفسه',
    businessOutcome: 'تحویل به‌موقع بار و حفظ اعتبار تجاری در بازار',
    emotionalPayoff: 'پایان آبروریزی جلو راننده باربری و خریدار عمده',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Odometer Slot Machine Roll',
      'Isometric UI Layer Explosion',
      'Iris Reveal Mask',
    ],
  },
)
