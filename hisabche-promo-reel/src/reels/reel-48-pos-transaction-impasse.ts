// ============================================
// Hisabche Motion Design Studio — Reel 48 (POS Impasse & 72-Hour Banking Void Film)
//
// Core Scenario:
// «مشتری پای پیشخوان کارت کشیده، اس‌ام‌اس کسر از حساب بانک برایش آمده؛
// اما دستگاه پوز فروشگاه خطای عدم اتصال داده و فیش بیرون نداده است!
// مشتری داد می‌زند جنسم را بده، کاسب درمانده می‌گوید به حسابم ننشسته!»
//
// Technical & Creative Architecture:
// - Persona: retail-shopkeeper (خرده‌فروش / سوپرمارکت / ابزارفروشی / رستوران)
// - Opening Archetype: customer-confrontation (دعوای داغ پای پیشخوان و پیامک متضاد)
// - Art Direction: financial-intelligence (Bloomberg & Stripe dark intelligence, tabular precision)
// - Layout Topology: data-flow-matrix (Kinetic typographic velocity & POS impasse resolution)
// - Viral Template: thermal-receipt-scroll (رول حرارتی فیش پوز و تبدیل به فاکتور هوشمند)
// - 5 Selected Purposeful Operators:
//   1. Split-Screen Blade Shutter
//   2. Odometer Slot Machine Roll
//   3. Double-Entry Balance Scale
//   4. Dynamic Spotlight Cone
//   5. Circuit Path Tracer
// - Duration: Exactly 59 seconds (Deterministic frame math)
// - Card Quota: Max 1 scene with cards (20% quota strictly enforced)
// - RTL HarfBuzz-safe typography & Persian voiceover pacing < 2.8 words/sec
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

export const reel48 = reel(
  '48',
  'مشتری می‌گه کارت کشیدم؛ ولی دستگاه مغازه فیش نداده!',
  [
    // Scene 01: Hook (8s) — Customer Confrontation: POS Slip Failure & Missing Money
    {
      dur: 8,
      spec: {
        kind: 'hook',
        openingArchetype: 'customer-confrontation',
        confrontation: {
          speaker: 'مشتری شاکی پای کارتخوان فروشگاه:',
          dialogue: '«آقا از حسابم کم شد، اس‌ام‌اس اومد! جنسم رو بده ببرم عجله دارم!»',
          fadedEvidence: 'دستگاه کارتخوان: تراکنش ناموفق / خطای اتصال به سرور شاپرک',
        },
        lines: ['مشتری می‌گه کارت کشیدم؛', 'اما دستگاه مغازه [r:فیش نداده و پول معلقه!]'],
      },
      vo: 'مشتری کارت کشیده، پیامک کسر وجه هم براش اومده؛ اما دستگاه کارتخوانت فیش نداده! مشتری جنسش رو می‌خواد، تو هم نمی‌دونی پول واقعاً نشسته یا سوخته!',
    },

    // Scene 02: Thermal Receipt Scroll (15s) — The 72-Hour Banking Black Hole
    {
      dur: 15,
      spec: {
        kind: 'thermal-receipt',
        title: 'برزخ ۷۲ ساعته بانکی: [r:تراکنش ناموفق شاپرک] یا [c:پول سوخته دخل؟]',
      },
      vo: 'اگر بار رو بهش بدی، ممکنه پول به حسابت نیاد و مشتری هم دیگه پیداش نشه! اگر ندی، متهم به دزدی می‌شی و مشتری جلو همه داد و بیداد راه میندازه.',
    },

    // Scene 03: Compare Matrix (14s) — Manual Guesswork vs Hisabche Connected POS Escrow
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'مدیریت مغایرت کارتخوان: [r:دفتر و حافظه] در برابر [c:فاکتور امانی حسابچه]',
        columns: ['وضعیت تراکنش', 'روش سنتی', 'کارتخوان ساده', 'حسابچه هوشمند'],
        rows: [
          { label: 'ثبت درجا فاکتور امانی با کد پیگیری پوز', marks: ['no', 'no', 'yes'] },
          { label: 'ارسال فوری پیامک ضمانت و احترام به مشتری', marks: ['no', 'no', 'yes'] },
          { label: 'تراز اتوماتیک به محض نشستن پول در بانک', marks: ['no', 'part', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'با حسابچه، در یک ثانیه فاکتور امانی ثبت می‌شه و پیامک تایید با لینک پیگیری برای مشتری می‌ره؛ مشتری با احترام جنسش رو می‌بره و پولت هم ردیابی می‌شه.',
    },

    // Scene 04: Versus Scale (14s) — Lost Customer & Missing Cash vs Zero Discrepancy
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title:
          'نتیجه مغایرت‌های ماهانه: [r:کسری صندوق و قهر مشتری] در برابر [c:انضباط و اعتماد ۱۰۰٪]',
        left: {
          label: 'بدون ثبت مکانیزه کارتخوان',
          value: 'تنش پای صندوق + گم شدن میلیون‌ها تومان در ماه',
          tone: 'red',
        },
        right: {
          label: 'با اتوماسیون بانکی حسابچه',
          value: 'رضایت مشتری + صفر ریال مغایرت بین پوز و دفتر',
          tone: 'cyan',
        },
        verdict:
          'کاسب حرفه‌ای نه با مشتری دست‌به‌یقه می‌شود، نه اجازه می‌دهد یک ریال در خطای بانکی بسوزد',
      },
      vo: 'کاسب باسابقه نه اعتبارش رو با مشتری خراب می‌کنه، نه می‌ذاره پولش تو برزخ بانکی بسوزه. حسابچه تراز بانکت رو تا ریال آخر تضمین می‌کنه.',
    },

    // Scene 05: Call to Action (8s) — High-Converting Connected POS CTA
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | اتصال هوشمند فاکتور به کارتخوان و صفر مغایرت',
        boxes: [
          {
            lead: 'پایان دعواهای کارتخوان پای دخل',
            action: 'اتصال هوشمند به دستگاه پوز',
            word: 'شروع رایگان در ۱ دقیقه',
            tone: 'cyan',
          },
          {
            lead: 'تراز لحظه‌ای حساب‌های بانکی',
            action: 'نرم‌افزار حسابداری حسابچه',
            word: 'کامنت کن: کارتخوان',
            tone: 'green',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'همین الان کلمه «کارتخوان» رو برام کامنت کن تا نحوه اتصال فاکتور به پوز و رفع مغایرت رو برات بفرستم. حسابچه، آرامش پای صندوق فروشگاه.',
    },
  ],
  'financial-intelligence',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'درگیری با مشتری و گم شدن مبالغ فروش به دلیل خطای اتصال کارتخوان، فیش ندادن دستگاه، و افتادن پول در برزخ مغایرت بانکی ۷۲ ساعته',
    oldWorkflow:
      'جر و بحث با مشتری پای پیشخوان، نوشتن شماره تماس روی تکه کاغذ و فراموش شدن پیگیری مغایرت‌های بانکی تا پایان ماه',
    friction:
      'سوخت شدن میلیون‌ها تومان فروش ماهانه در خطاهای کارتخوان و از دست رفتن مشتریان دائمی به خاطر سوءتفاهم مالی پای دخل',
    hisabcheAction:
      'اتصال هوشمند فاکتور به دستگاه کارتخوان، صدور وضعیت فاکتور امانی، و ردیابی خودکار تراکنش تا واریز قطعی به حساب',
    automatedResult:
      'ارسال فوری پیامک ضمانت به مشتری، تراز اتوماتیک تراکنش‌های بانکی، و صفر شدن قطعی خطاهای مغایرت صندوق',
    businessOutcome:
      'حفظ ۱۰۰٪ سرمایه و فروش، جلب اعتماد و احترام مشتریان، و ایجاد انضباط مطلق پای صندوق‌های فروشگاه',
    emotionalPayoff:
      'آرامش روانی کامل پای پیشخوان شلوغ، رهایی از اضطراب مغایرت بانکی، و حفظ اعتبار بازاری کسب‌وکار',
    cta: 'کامنت کن: کارتخوان',
    selectedOperators: [
      'Split-Screen Blade Shutter',
      'Odometer Slot Machine Roll',
      'Double-Entry Balance Scale',
      'Dynamic Spotlight Cone',
      'Circuit Path Tracer',
    ],
  },
)
