// ============================================
// Hisabche Motion Design Studio — Reel 47 (Tactile Train-Scroll Flagship Film)
// Continuous Vertical Paper & Whiteboard Train Canvas with Macro Zoom-Out
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

export const reel47 = reel(
  '47',
  'حسابداری دقیق کسب‌وکار با حسابچه (نوار قطاری عمودی و کلاژ کاغذی)',
  [
    {
      dur: 59,
      spec: {
        kind: 'tactile-train',
        title: 'حسابداری دقیق کسب‌وکار با Hisabche',
      },
      vo: 'حسابداری دقیق کسب‌وکار با حسابچه، صفر ریال خطا و مغایرت بدون نیاز به دفتر کاغذی و اکسل‌های پیچیده. یه اصل مهم: دقیق بدون امروز پول و جنست کجاست! فقط یک فاکتور بزن، بقیه‌ش با حسابچه. راه‌اندازی در ۳ دقیقه، لینک شروع رایگان رو برات می‌فرستم، فالو کن و همین الان کامنت کن: حسابچه.',
    },
  ],
  'swiss-editorial',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'سردرگمی در مدیریت فاکتور، انبار و نسیه در دفاتر کاغذی و اکسل‌های پیچیده',
    oldWorkflow: 'نوشتن دستی در دفتر نسیه و اکسل‌های جزیره‌ای بدون تراز',
    friction: 'فراموش شدن مبالغ نسیه و مغایرت مداوم بین صندوق و انبار',
    hisabcheAction: 'اتوماسیون کامل صدور فاکتور، کسر از کاردکس و ثبت سند دوطرفه در ۳ ثانیه',
    automatedResult: 'شفافیت ۱۰۰٪ دارایی و سود خالص بدون نیاز به آموزش حسابداری',
    businessOutcome: 'صفر شدن مغایرت‌ها و رشد واقعی کسب‌وکار',
    emotionalPayoff: 'آرامش خاطر، انضباط مالی و خواب راحت شبانه',
    cta: 'کامنت کن: حسابچه',
    selectedOperators: [
      'Vertical Train Canvas',
      'Dashed Bezier Connectors',
      'Tactile Paper Collage',
      'Hand-Drawn Highlighter Loop',
      'Fast-Spinning Analog Clock',
    ],
  },
)
