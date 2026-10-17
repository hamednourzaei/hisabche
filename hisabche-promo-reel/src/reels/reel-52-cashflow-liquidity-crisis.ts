// ============================================
// Hisabche Motion Design Studio — Reel 52
// Commercial Short Film (30.0s)
//
// Core Scenario:
// «۳۰۰ میلیون فروختی؛ اما چرا موجودی بانکت فقط ۲ میلیونه؟»
//
// Creative Architecture:
// - Persona: retailer (کاسب، فروشگاه‌دار و تاجر پخش)
// - Opening Archetype: uncomfortable-discovery (کشف مغایرت تلخ: فروش بالا، بانک خالی)
// - Art Direction: swiss-editorial (High-contrast dark Swiss editorial typography)
// - Layout Topology: split-screen-horizon (افقی متقارن با تفکیک بالا و پایین)
// - Viral Template: split-screen-stopwatch (مسابقه دوگانه کورنومتر و زمان‌سنجی)
// - 5 Selected Purposeful Operators:
//   1. HighlighterSweep
//   2. OdometerRoll
//   3. IsometricLayerExplosion
//   4. BaselineCurtainRise
//   5. IrisReveal
// - Duration: Exactly 30.0 seconds (2.0 + 5.0 + 5.0 + 9.0 + 5.5 + 3.5 = 30.0s)
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

export const reel52 = reel(
  '52',
  '۳۰۰ میلیون فروختی؛ اما چرا موجودی بانکت فقط ۲ میلیونه؟',
  [
    // Scene 01 (0.0–2.0s, dur: 2.0): Hook — Uncomfortable Discovery (Sales High, Bank Zero)
    {
      dur: 2.0,
      spec: {
        kind: 'hook',
        openingArchetype: 'uncomfortable-discovery',
        discovery: {
          surfaceMetric: {
            label: 'فروش ثبت‌شده ماه جاری در فاکتورها',
            value: '۳۰۰٬۰۰۰٬۰۰۰ تومان',
          },
          hiddenReality: {
            label: 'موجودی واقعی و نقد حساب بانکی',
            value: 'فقط ۲٬۰۰۰٬۰۰۰ تومان!',
          },
          discrepancyNote: 'فروش بالا داری، ولی بانکت خالیه! پولت کجاست؟',
        },
        lines: ['۳۰۰ میلیون تومن فروختی؛', 'اما موجودی بانکت [r:فقط ۲ میلیونه!]'],
      },
      vo: '۳۰۰ میلیون فروختی، اما بانکت خالیه!',
    },

    // Scene 02 (2.0–7.0s, dur: 5.0): Viral Template — Split-Screen Stopwatch Race
    {
      dur: 5.0,
      spec: {
        kind: 'split-stopwatch',
        topTitle: 'سررسید پرداخت به تامین‌کننده',
        topSub: '⏳ موعد فردا: ۱۲۰ میلیون تومان',
        topBody: 'موجودی حساب بانکی: فقط ۲ میلیون تومان! بحران نقدینگی و عدم توان پرداخت',
        topFooter: 'موجودی حساب برای پرداخت کافی نیست...',
        bottomTitle: 'پایش هوشمند نقدینگی و طلب‌ها',
        bottomSub: 'ردیابی خودکار در ۳ ثانیه',
        bottomBody: '۲۳۰ میلیون تومان پولت در دست مشتریان بازار به عنوان نسیه قفل شده!',
        bottomFooter: 'ریشه ناترازی کشف شد: مطالبات معوق بازار',
        finishAt: 3.0,
      },
      vo: 'فردا موعد چکه، ولی پولت دست مشتری‌ها تو بازار قفله!',
    },

    // Scene 03 (7.0–12.0s, dur: 5.0): Split-Screen Horizon — Market Credit Disconnect
    {
      dur: 5.0,
      spec: {
        kind: 'split',
        title: 'ریشه بحران: [r:نسیه بی‌حساب] در برابر [c:کنترل لحظه‌ای مطالبات]',
        dividerLabel: 'در برابر',
        left: {
          title: 'فروش سنتی و بدون پیگیری',
          subtitle: '۲۳۰ میلیون تومان پول بلوکه',
          points: ['فروش نسیه بدون سقف اعتبار', 'بی‌خبری از سررسید طلب مشتریان'],
          tone: 'red',
        },
        right: {
          title: 'سیستم مطالبات حسابچه',
          subtitle: 'شفافیت کامل بدهکاران',
          points: ['هشدار خودکار تاخیر تسویه مشتری', 'پیش‌بینی دقیق نقدینگی دخل و بانک'],
          tone: 'cyan',
        },
      },
      vo: 'وقتی طلب‌هات معلوم نباشه، با ۲۰۰ میلیون نسیه دخلت می‌خوابه!',
    },

    // Scene 04 (12.0–21.0s, dur: 9.0): Live Product Proof — Customer Debt Report & Live Ledger
    {
      dur: 9.0,
      spec: {
        kind: 'ledger',
        title: 'گزارش مطالبات بازار و بدهکاران حسابچه',
        name: 'پایش لحظه‌ای حساب‌های دریافتی بازار',
        lines: [
          { label: 'حاج رضا — پخش لوازم (۴۵ روز تاخیر)', amount: '۸۵٬۰۰۰٬۰۰۰ تومان' },
          { label: 'بازرگانی پارس (۳۰ روز تاخیر تسویه)', amount: '۹۵٬۰۰۰٬۰۰۰ تومان' },
          { label: 'فروشگاه امید — خرید اعتباری', amount: '۵۰٬۰۰۰٬۰۰۰ تومان' },
        ],
        balanceFrom: 230000000,
        balanceTo: 0,
        unit: 'تومان',
        footer: 'با ارسال پیامک یادآوری و ردیابی خودکار، ۲۳۰ میلیون طلب بازار زنده شد!',
      },
      vo: 'حسابچه نشون می‌ده پولت کجاست و با پیگیری خودکار، طلب‌هات رو نقد می‌کنه.',
    },

    // Scene 05 (21.0–26.5s, dur: 5.5): Versus Scale — Cash Flow Balance & Peace of Mind
    {
      dur: 5.5,
      spec: {
        kind: 'versus',
        title: 'تعادل مالی: [r:کابوس بی‌پولی] در برابر [c:جریان نقدی پایدار]',
        left: {
          label: 'فروش کور و نسیه کنترل‌نشده',
          value: 'فروش بالا ولی حساب بانکی خالی',
          tone: 'red',
        },
        right: {
          label: 'جریان نقدینگی شفاف حسابچه',
          value: 'وصول به‌موقع و آرامش خاطر در بازار',
          tone: 'green',
        },
        verdict: 'تعادل نقدینگی و آرامش کامل در دخل و حساب',
      },
      vo: 'دیگه کاسب سردرگم نیستی؛ دخلت همیشه پر و حسابت جوره.',
    },

    // Scene 06 (26.5–30.0s, dur: 3.5): Brand & High-Converting CTA
    {
      dur: 3.5,
      spec: {
        kind: 'cta',
        tagline: 'مدیریت طلب‌ها و کنترل دخل با حسابچه',
        boxes: [
          {
            lead: 'برای پایان دادن به قفل شدن پولت در دست مشتریان',
            action: 'شروع رایگان در:',
            word: 'hisabche.com',
            tone: 'cyan',
          },
          {
            lead: 'نرم‌افزار حسابداری، انبار و مطالبات یکپارچه بازار',
            action: 'همین حالا سرچ کن:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 1.8,
      },
      vo: 'حسابچه رو رایگان تست کن در: hisabche.com',
    },
  ],
  'kinetic-manifesto',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'فروش بالای ۳۰۰ میلیونی اما موجودی خالی حساب بانکی در موعد پرداخت بدهی',
    oldWorkflow: 'فروش نسیه سنتی بدون سقف اعتبار و بدون ثبت سررسید تسویه مشتریان',
    friction: 'قفل شدن ۲۳۰ میلیون تومان نقدینگی در بازار و ناتوانی در پرداخت بدهی تامین‌کننده',
    hisabcheAction: 'گزارش لحظه‌ای بدهکاران بازار و ارسال خودکار پیامک یادآوری تسویه',
    automatedResult: 'وصول سریع مطالبات معوق، پیش‌بینی نقدینگی و برقراری تراز مالی',
    businessOutcome: 'تامین به‌موقع وجوه چک‌ها، نقدینگی پایدار و حفظ اعتبار در بازار',
    emotionalPayoff: 'پایان استرس بی‌پولی آخر ماه و اطمینان از سود واقعی کسب‌وکار',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'HighlighterSweep',
      'OdometerRoll',
      'IsometricLayerExplosion',
      'BaselineCurtainRise',
      'IrisReveal',
    ],
  },
)
