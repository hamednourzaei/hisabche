// ============================================
// Hisabche Motion Design Studio — Reel 49 (Creative Family #13: Premium Motion Graphics)
//
// Core Scenario:
// «بنکدار و عمده‌فروش بازار ۵۰۰ میلیون بار را نسیه فروخته است؛
// سر موعد تسویه، پول با سود اسمی نقد می‌شود؛ اما فردا صبح در کارخانه
// می‌بیند قیمت بار ۳۰۰ میلیون بالا رفته و نیمی از سرمایه واقعی‌اش پودر شده است!»
//
// Technical & Creative Architecture:
// - Persona: wholesaler (عمده‌فروش / بنکدار آهن، ابزار، قطعات، یا مواد غذایی)
// - Opening Archetype: uncomfortable-discovery (سراب سود اسمی در برابر کسری ارزش جایگزینی)
// - Art Direction: cinematic-obsidian (Spatial Dark Product Film, specular rim glints)
// - Layout Topology: full-bleed-kinetic (Oversized Persian typography, vector masks, speed ramps)
// - Viral Template: premium-motion-graphics (خانواده خلاق شماره ۱۳: موشن گرافیک پریمیوم و تایپوگرافی کینتیک)
// - 5 Selected Purposeful Operators:
//   1. Kinetic Typographic Mask
//   2. Spatial Depth Rig
//   3. Replacement Cost Scanner
//   4. Split-Screen Blade Shutter
//   5. Double-Entry Balance Scale
// - Duration: Exactly 59 seconds (Deterministic frame math: 8 + 15 + 14 + 14 + 8 = 59s)
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

export const reel49 = reel(
  '49',
  'بار ۵۰۰ میلیونی رو نسیه دادی؛ ولی پای تسویه، نصف سرمایه‌ت پودر شد!',
  [
    // Scene 01: Hook (8s) — Uncomfortable Discovery: The Nominal Profit Mirage
    {
      dur: 8,
      spec: {
        kind: 'hook',
        openingArchetype: 'uncomfortable-discovery',
        discovery: {
          surfaceMetric: {
            label: 'طلب وصول‌شده نسیه',
            value: '۵۰۰٬۰۰۰٬۰۰۰ تومان',
          },
          hiddenReality: {
            label: 'قیمت خرید همان بار امروز صبح در کارخانه',
            value: '۸۰۰٬۰۰۰٬۰۰۰ تومان!',
          },
          discrepancyNote: 'عدم پایش بهای جایگزینی کالا = ذوب شدن ۳۰۰ میلیون از اصل سرمایه',
        },
        lines: ['بار ۵۰۰ میلیونی رو نسیه دادی؛', 'اما پای تسویه [r:نصف سرمایه‌ت پودر شد!]'],
      },
      vo: 'طلب نسیه‌ات بعد از چهار ماه وصول شد و خوشحالی که سود کردی؛ اما فردا صبح در کارخانه می‌بینی قیمت همان بار ۳۰۰ میلیون گران‌تر شده و اصل سرمایه‌ات آب رفته است!',
    },

    // Scene 02: Premium Motion Graphics (15s) — Replacement Cost Shock & Kinetic Spatial Typography
    {
      dur: 15,
      spec: {
        kind: 'premium-motion',
        kicker: 'معماری کنترل تورم حسابچه',
        title: 'پایش ارزش روز انبار در برابر تورم بازار',
        subtitle: 'فروش اعتباری بدون محاسبه ارزش جایگزینی، ورشکستگی خاموش کسب‌وکار است.',
        statLabel: 'طلب وصولی نسیه مشتری',
        statValue: '۵۰۰٬۰۰۰٬۰۰۰ تومان',
        contrastLabel: 'هزینه خرید مجدد همان بار امروز!',
        contrastValue: '۸۰۰٬۰۰۰٬۰۰۰ تومان',
        badge: 'تراز ارزش روز کالا (Replacement Cost Engine + FIFO)',
      },
      vo: 'در بازار تورمی، سود روی کاغذ بزرگ‌ترین فریب است! اگر طلب نسیه را بر اساس ارزش جایگزینی انبار ردیابی نکنی، هر فاکتور فروش یعنی یک قدم نزدیک‌تر شدن به نابودی سرمایه.',
    },

    // Scene 03: Compare Matrix (14s) — Manual Ledger vs Hisabche Inflation-Proof Receivables
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'مدیریت فروش اعتباری: [r:دفتر سنتی بازار] در برابر [c:پایش هوشمند حسابچه]',
        columns: ['شاخص مدیریت نسیه', 'دفتر نسیه سنتی', 'اکسل بازاری', 'حسابچه هوشمند'],
        rows: [
          {
            label: 'محاسبه ارزش جایگزینی لحظه‌ای کالا (Replacement Cost)',
            marks: ['no', 'no', 'yes'],
          },
          { label: 'پیوست شرط تعدیل تورمی و توافق اعتباری شفاف', marks: ['no', 'no', 'yes'] },
          { label: 'هشدار لایه‌ای FIFO قبل از ذوب شدن سود سرمایه', marks: ['no', 'part', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'حسابچه بهای تمام‌شده جایگزینی رو لحظه‌به‌لحظه محاسبه می‌کنه و بهت می‌گه هر روز تاخیر مشتری در تسویه، چقدر از اصل انبارت رو کم می‌کنه.',
    },

    // Scene 04: Versus Scale (14s) — Melting Capital vs Guaranteed Purchasing Power
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title: 'فرجام فروش نسیه در تورم: [r:آب رفتن انبار] در برابر [c:حفظ ۱۰۰٪ قدرت خرید]',
        left: {
          label: 'بدون پایش ارزش جایگزینی',
          value: 'توهم سود ۵۰ میلیونی + ۳۰۰ میلیون کسری خرید بار',
          tone: 'red',
        },
        right: {
          label: 'با زره مالیاتی و اعتباری حسابچه',
          value: 'حفظ کامل توان جایگزینی بار + سود نقدی واقعی',
          tone: 'cyan',
        },
        verdict: 'کاسب باسابقه ارزش واقعی بار را می‌فروشد، نه اینکه سرمایه‌اش را به آتش بکشد',
      },
      vo: 'کاسب کارکشته روی کاغذ سود نمی‌کنه، بلکه انبار و سرمایه‌اش رو هر سال بزرگ‌تر می‌کنه. با حسابچه، ارزش دارایی‌ات در طوفان تورم مثل سنگ حفظ می‌شه.',
    },

    // Scene 05: Call to Action (8s) — High-Converting Credit Protection CTA
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | نرم‌افزار حسابداری ضد تورم و مدیریت هوشمند نسیه',
        boxes: [
          {
            lead: 'حفظ ۱۰۰٪ ارزش انبار در برابر تورم',
            action: 'پایش هوشمند مطالبات اعتباری',
            word: 'شروع رایگان در ۱ دقیقه',
            tone: 'cyan',
          },
          {
            lead: 'پایان ذوب شدن خاموش سرمایه',
            action: 'نرم‌افزار حسابداری حسابچه',
            word: 'کامنت کن: نسیه',
            tone: 'green',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'همین الان کلمه «نسیه» رو برام کامنت کن تا ویدیوی نحوه پایش ارزش جایگزینی و حفظ سرمایه در فروش اعتباری رو برات بفرستم. حسابچه، نگهبان دارایی تو.',
    },
  ],
  'cinematic-obsidian',
  {
    targetCustomer: 'wholesaler',
    customerPain:
      'فروش نسیه با سود اسمی در شرایط تورم بازار و ذوب شدن ۳۰۰ میلیون از اصل سرمایه در زمان تسویه فاکتورها',
    oldWorkflow:
      'ثبت قیمت ریالی ثابت در دفتر نسیه سنتی و فراموش شدن اختلاف بهای جایگزینی کالا در بازار تا زمان خرید بار جدید',
    friction:
      'ناتوانی در خرید مجدد همان حجم کالا از کارخانه و آب رفتن تدریجی انبار به دلیل فروش نسیه بدون تعدیل ارزش روز',
    hisabcheAction:
      'محاسبه لحظه‌ای بهای جایگزینی کالا، پیوست شرط تعدیل نرخ در فاکتورهای اعتباری و هشدار هوشمند آب رفتن سود',
    automatedResult:
      'حفظ ۱۰۰٪ توان خرید انبار، شفاف‌سازی سود نقدی واقعی و صفر شدن خسارت ناشی از تورم در فروش اعتباری',
    businessOutcome:
      'رشد پایدار کسب‌وکار، جلوگیری از ورشکستگی خاموش و افزایش اعتماد و شفافیت بین بنکدار و خریداران عمده',
    emotionalPayoff:
      'آرامش خاطر از بقای سرمایه، تسلط کامل بر گردش مالی و خواب راحت بدون اضطراب افزایش قیمت کارخانه‌ها',
    cta: 'کامنت کن: نسیه',
    selectedOperators: [
      'Kinetic Typographic Mask',
      'Spatial Depth Rig',
      'Replacement Cost Scanner',
      'Split-Screen Blade Shutter',
      'Double-Entry Balance Scale',
    ],
  },
)
