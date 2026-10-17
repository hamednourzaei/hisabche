// ============================================
// Hisabche Motion Design Studio — Reel 50
// Master Composite Commercial Film (30.0s)
//
// Core Scenario:
// «پولت کجا می‌ره؟ فروش داشتی… ولی سودت کجاست؟»
// یک فیلم تبلیغاتی تجاری ۳۰ ثانیه‌ای سینمایی و روان‌شناختی،
// تلفیق بهترین تمپلیت‌ها و مکانیزم‌های حرکتی استودیو حسابچه:
// Hook قلاب ذهنی (Quiet Dread) -> Thermal Receipt نشت پنهان نسیه و پوز ->
// Minimal Vector اوج کنجکاوی و مکث فلسفی -> Cinematic 3D Product ۴ ستون هوشمند ->
// Versus حس آرامش و کنترل -> Master CTA
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

export const reel50 = reel(
  '50',
  'پولت کجا می‌ره؟ فروش داشتی… ولی سودت کجاست؟',
  [
    // Scene 01 (0–4s, dur: 4): The Hook / قلاب ذهنی (Quiet Dread)
    {
      dur: 4,
      spec: {
        kind: 'hook',
        openingArchetype: 'quiet-dread',
        lines: ['فروش داشتی…', 'ولی سودت کجاست؟'],
        quietDread: {
          isolatedFact: 'دخل نقدی امشب پای بستن کرکره: فروش روزانه بالا',
          unsettlingDetail: 'هزینه‌های پنهان، نسیه سوخته و کسر انبار: سود نامعلوم؟',
        },
      },
      vo: 'اگه آخر روز پول توی دخلت هست، از کجا مطمئنی واقعاً سود کردی؟',
    },

    // Scene 02 (4–9s, dur: 5): The Hidden Problem / آشکار شدن مشکل (Thermal Receipt)
    {
      dur: 5,
      spec: {
        kind: 'thermal-receipt',
        title: 'نسیه؟ موجودی؟ سود واقعی؟',
      },
      vo: 'یه مشتری نسیه برده، یه جنس کم شده… و حساب‌ها هنوز با هم جور نیستن.',
    },

    // Scene 03 (9–13s, dur: 4): The Curiosity Gap / اوج کنجکاوی (Minimal Vector Philosophy)
    {
      dur: 4,
      spec: {
        kind: 'minimal-vector',
        title: 'اگه همه‌چیز یکجا بود چی؟',
      },
      vo: 'حالا تصور کن برای فهمیدن وضعیت کسب‌وکارت، مجبور نباشی همه‌چیز رو از اول حساب کنی.',
    },

    // Scene 04 (13–22s, dur: 9): Product Reveal / ورود ۴ ستون حسابچه (Cinematic 3D Product)
    {
      dur: 9,
      spec: {
        kind: 'cinematic-product',
        title: 'کنترل کامل دخل، انبار و مشتری',
        subtitle: '۴ ستون هوشمند حسابچه در یک پلتفرم یکپارچه',
        floatingBadge: 'سیستم یکپارچه حسابچه',
        layers: [
          {
            title: '۱. فروش و فاکتورها',
            desc: 'صدور فاکتور سریع در چند ثانیه و ثبت خودکار سند مالی',
            icon: 'receipt',
            tone: 'cyan',
          },
          {
            title: '۲. موجودی و انبار',
            desc: 'کاردکس کالا، بهای تمام‌شده و اعلام هوشمند کسر موجودی',
            icon: 'box',
            tone: 'purple',
          },
          {
            title: '۳. حساب مشتریان',
            desc: 'گردش حساب، هشدار سقف نسیه و ارسال خودکار صورتحساب',
            icon: 'users',
            tone: 'cyan',
          },
          {
            title: '۴. گزارش‌های کسب‌وکار',
            desc: 'سود خالص واقعی روزانه و ماهانه بدون کوچک‌ترین ابهام',
            icon: 'barChart',
            tone: 'green',
          },
        ],
      },
      vo: 'با حسابچه، فروش، موجودی کالا، حساب مشتری‌ها و گزارش‌های کسب‌وکارت رو یکجا مدیریت کن؛ حتی وقتی می‌خوای با نظم بیشتری کار کنی و وقتت رو برای رشد کسب‌وکارت بذاری.',
    },

    // Scene 05 (22–27s, dur: 5): Emotional Resolution / حس کنترل و آرامش (Stacked Versus)
    {
      dur: 5,
      spec: {
        kind: 'versus',
        title: 'کنترل بیشتر. سردرگمی کمتر.',
        left: {
          label: 'بدون حسابچه (سردرگمی)',
          value: 'دویدن مداوم دنبال فاکتورهای گم‌شده و نسیه سوخته',
          tone: 'red',
        },
        right: {
          label: 'با حسابچه (تسلط کامل)',
          value: 'گزارش لحظه‌ای سود قطعی و کنترل کسب‌وکار روی موبایل',
          tone: 'green',
        },
        verdict: 'به‌جای حدس زدن دخل و نسیه، با دید روشن تصمیم بگیر',
      },
      vo: 'به‌جای اینکه تمام روز دنبال حساب‌وکتاب بدوی، با دید روشن‌تری برای کسب‌وکارت تصمیم بگیر.',
    },

    // Scene 06 (27–30s, dur: 3): CTA / برند و دعوت به اقدام (High-Impact Brand Closing)
    {
      dur: 3,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | hisabche.com',
        boxes: [
          {
            lead: 'برای مشاهده دموی زنده و ۴ ستون هوشمند',
            action: 'کلیک یا لمس دکمه:',
            word: 'حسابچه رو ببین',
            tone: 'cyan',
          },
          {
            lead: 'برای شروع رایگان و تست فوری سیستم مالی',
            action: 'ورود به وبسایت:',
            word: 'hisabche.com',
            tone: 'purple',
          },
        ],
        switchAt: 1.5,
      },
      vo: 'حسابچه؛ کسب‌وکارت رو حساب‌شده مدیریت کن.',
    },
  ],
  'procedural-spatial',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'شمارش دخل در پایان روز با احساس کاذب سود، در حالی که نسیه‌های ثبت‌نشده و کسر انبار سرمایه را پنهان کرده‌اند',
    oldWorkflow:
      'یادداشت دستی نسیه روی کاغذ، شمارش چشمی انبار، و جمع زدن فیش‌های پوز با ماشین‌حساب مکانیکی',
    friction: 'عدم تطابق دخل نقدی با سود واقعی، چک‌های فراموش‌شده و کسر نامعلوم موجودی اجناس مغازه',
    hisabcheAction:
      'اتصال خودکار دخل، انبار، حساب مشتریان نسیه و تراز سود در یک بستر ابری با اپلیکیشن آفلاین',
    automatedResult:
      'صدور فاکتور در لحظه، محاسبه خودکار بهای تمام‌شده و ارسال پیامک وضعیت مانده به مشتری',
    businessOutcome:
      'آگاهی لحظه‌ای و ۱۰۰٪ دقیق از سود خالص واقعی پایان هر روز کاری بدون کوچک‌ترین مغایرت',
    emotionalPayoff:
      'پایان دادن به سردرگمی شبانه، بستن با آرامش کرکره مغازه و تمرکز بر توسعه و فروش بیشتر',
    cta: 'حسابچه رو ببین — hisabche.com',
    selectedOperators: [
      'Spatial Depth Rig',
      'Double-Entry Balance Scale',
      'Dynamic Spotlight Cone',
      'Split-Screen Blade Shutter',
      'Circuit Path Tracer',
    ],
  },
)
