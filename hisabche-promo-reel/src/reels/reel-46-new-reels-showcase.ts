// ============================================
// Hisabche Motion Design Studio — Reel 46 (/new-reels Showcase Film)
//
// Prompt:
// «کاسب سر شب می‌بیند دخل پر از پول است اما چون کالاها را با قیمت‌های خرید جدید و قدیم
// قاطی فروخته، نمی‌داند سود کرده یا سرمایه‌اش آب رفته است.»
//
// Technical & Creative Architecture:
// - Persona: retail-shopkeeper (کاسب / مغازه‌دار)
// - Opening Archetype: uncomfortable-discovery (کشف مغایرت تلخ پای دخل)
// - Art Direction: swiss-editorial (High-craft daylight editorial, zero neon, tabular precision)
// - Layout Topology: split-screen-horizon (Horizon split: cash drawer illusion vs replacement reality)
// - 5 Selected Purposeful Operators:
//   1. X-Ray Profit Scanner
//   2. Profit Waterfall Drain
//   3. Double-Entry Balance Scale
//   4. Odometer Slot Machine Roll
//   5. Split-Screen Blade Shutter
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

export const reel46 = reel(
  '46',
  'دخلت پر از تراول است؛ اما آیا واقعاً سود کردی یا سرمایه‌ات آب رفت؟',
  [
    // Scene 01: Hook (7s) — Uncomfortable Discovery at the cash drawer
    {
      dur: 7,
      spec: {
        kind: 'hook',
        openingArchetype: 'uncomfortable-discovery',
        discovery: {
          surfaceMetric: { label: 'دخل نقدی امشب پای بستن کرکره', value: '۸۵٬۰۰۰٬۰۰۰ تومان' },
          hiddenReality: { label: 'بهای خرید بار جدید فردا صبح', value: '۸۹٬۵۰۰٬۰۰۰ تومان!' },
          discrepancyNote: 'عدم احتساب بهای لایه‌ای جایگزینی FIFO؛ ۴٬۵۰۰٬۰۰۰ تومان زیان پنهان',
        },
        lines: ['دخلت پر از تراول است؛', 'اما آیا واقعاً سود کردی یا [r:سرمایه‌ات آب رفت؟]'],
      },
      vo: 'سر شب دخل پر از تراوله و فکر می‌کنی ترکوندی؛ اما فردا صبح که بخوای همون بار رو جایگزین کنی، می‌فهمی چهار و نیم میلیون ضرر کردی!',
    },

    // Scene 02: Profit Waterfall Demo (16s) — Deconstruction of Illusion vs Cost of Replacement
    {
      dur: 16,
      spec: {
        kind: 'profit-waterfall-demo',
        title: 'کالبدشکافی دخل: [r:توهم سود] در برابر [c:بهای تمام‌شده واقعی]',
        grossRevenue: 85000000,
        cogs: 72000000,
        expenses: 17500000,
      },
      vo: 'وقتی قیمت خرید کالاها تو تورم بالا رفته و با نرخ قدیم فروختی، پول توی دخل سود نیست؛ داره از گوشت و پوست سرمایه اصلی‌ات پرداخت می‌شه.',
    },

    // Scene 03: Compare Matrix (14s) — Mental Accounting vs Hisabche FIFO Costing Engine
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'محاسبه سود در تورم: [r:چرتکه و حافظه] در برابر [c:موتور FIFO حسابچه]',
        columns: ['روش قیمت‌گذاری', 'محاسبه ذهنی', 'نرم‌افزار ساده', 'حسابچه هوشمند'],
        rows: [
          { label: 'تفکیک بار قدیم و جدید (FIFO)', marks: ['no', 'no', 'yes'] },
          { label: 'هشدار فروش زیر بهای جایگزینی', marks: ['no', 'no', 'yes'] },
          { label: 'محاسبه لحظه‌ای حاشیه سود خالص', marks: ['no', 'part', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'چرتکه و حافظه به تورم بازار نمی‌رسن؛ حسابچه به روش لایه‌ای فایفو، سود هر فاکتور رو بر اساس نرخ خرید جدیدترین پارت بار محاسبه می‌کنه.',
    },

    // Scene 04: Versus Scale (14s) — Melting Capital vs True Business Growth
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title: 'آینده مغازه: [r:آب رفتن قفسه‌ها] در برابر [c:رشد واقعی سرمایه]',
        left: {
          label: 'فروش بدون کنترل بهای تمام‌شده',
          value: 'دخل شلوغ + خالی شدن سال به سال انبار',
          tone: 'red',
        },
        right: {
          label: 'با هوش مالی حسابچه',
          value: 'حفظ ارزش دارایی + سود شفاف و نقدی',
          tone: 'cyan',
        },
        verdict: 'کاسب باهوش به شلوغی دخل دل خوش نمی‌کند؛ به حاشیه سود خالص نگاه می‌کند',
      },
      vo: 'کاسبی فقط جنس فروختن نیست؛ حفظ ارزش ریال به ریال سرمایه‌ست. حسابچه نمی‌ذاره مالت رو ندانسته آتیش بزنی.',
    },

    // Scene 05: Call to Action (8s) — Active Commercial Conversion
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | محاسبه هوشمند بهای تمام‌شده و سود واقعی',
        boxes: [
          {
            lead: 'محاسبه سود واقعی دخل',
            action: 'محاسبه سود FIFO',
            word: 'شروع رایگان در ۱ دقیقه',
            tone: 'cyan',
          },
          {
            lead: 'بیمه سرمایه در برابر تورم',
            action: 'نرم‌افزار حسابچه',
            word: 'دانلود نسخه ویندوز و موبایل',
            tone: 'green',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'همین حالا حسابچه رو رایگان نصب کن و از فردا جلوی آب رفتن سرمایه‌ات رو بگیر. حسابچه، چشمان تیزبین کاسب ایرانی.',
    },
  ],
  'swiss-editorial',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'توهم سود به دلیل شلوغ بودن دخل، در حالی که سرمایه به خاطر تورم قیمت خرید کالای جایگزین آب می‌رود',
    oldWorkflow:
      'محاسبه چشمی و سرانگشتی سود با تفریق قیمت حدودی خرید از فروش بدون احتساب لایه‌های FIFO',
    friction:
      'تخلیه تدریجی قفسه‌های مغازه بعد از یک سال با وجود فروش مداوم، به دلیل قیمت‌گذاری زیر بهای جایگزینی',
    hisabcheAction:
      'اعمال سیستم بهای تمام‌شده لایه‌ای (FIFO) و هشدار خودکار حاشیه سود منفی هنگام صدور فاکتور',
    automatedResult:
      'نمودار آبشاری سود ناخالص و خالص، کاردکس ارزش ریالی موجودی و سود واقعی به ریال',
    businessOutcome:
      'توقف زیان ناشی از تورم، قیمت‌گذاری رقابتی و سودآور، و محافظت کامل از سرمایه اولیه فروشگاه',
    emotionalPayoff:
      'احساس تسلط عمیق بر دارایی، رفع اضطراب پایان ماه و اطمینان از رشد واقعی کسب‌وکار',
    cta: 'حسابچه | محاسبه دقیق سود خالص و بهای جایگزینی کالا',
    selectedOperators: [
      'X-Ray Profit Scanner',
      'Profit Waterfall Drain',
      'Double-Entry Balance Scale',
      'Odometer Slot Machine Roll',
      'Split-Screen Blade Shutter',
    ],
  },
)
