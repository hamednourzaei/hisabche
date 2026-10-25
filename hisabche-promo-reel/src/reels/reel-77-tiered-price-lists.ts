// ============================================
// Reel 77: Tiered Price Lists - Confidential Pricing Shield
// Motion Template: tactile-train-scroll
// Funnel Stage: Margin Protection | Audience: Wholesalers, Retailers, Multi-Tier Distributors
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'مدیریت قیمت‌های چندگانه و تخفیف',
        lines: ['مشتری مچ مغازه رو گرفت:', '«چرا به اون [r:ارزون‌تر دادی]؟»'],
        cards: [
          { icon: 'user', title: 'مشتری همکار', sub: 'قیمت پخش و عمده', tone: 'cyan' },
          { icon: 'users', title: 'مشتری گذری', sub: 'قیمت مصرف‌کننده', tone: 'purple' },
        ],
      },
      vo: 'صندوقدار قیمت همکار رو جلوی مشتری عادی لو داد؛ چطور قیمت‌های چندگانه را بدون اشتباه مدیریت کنیم؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'tactile-train',
      },
      vo: 'در حسابچه چند فهرست قیمت می‌سازی؛ با انتخاب نام مشتری، قیمت اختصاصی او خودکار روی فاکتور می‌نشیند.',
    },
    {
      dur: 7,
      spec: {
        kind: 'versus',
        title: 'اعمال دستی قیمت در برابر [c:فهرست هوشمند حسابچه]',
        left: { label: 'خطای انسانی صندوق', value: 'فاش شدن قیمت همکار', tone: 'red' },
        right: { label: 'فهرست سطح‌بندی‌شده', value: 'قیمت‌گذاری خودکار و محرمانه', tone: 'cyan' },
        verdict: 'تیرینگ دقیق قیمت برای مشتری همکار، عمده، خرده و نمایندگی',
      },
      vo: 'نه صندوقدار درگیر چانه‌زنی می‌شه، نه مشتری عادی متوجه حاشیه سود همکاری.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel77: Reel = {
  id: '77',
  title: 'فهرست قیمت و تخفیف گروهی: برای همکار چند، برای مشتری گذری چند؟',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'اشتباه فروشنده پای فاکتور، لو رفتن تخفیف همکار پیش مشتری عادی و زیان قیمت',
    oldWorkflow: 'حفظ کردن تخفیف‌ها در ذهن یا یادداشت روی کاغذهای پراکنده پای پیشخوان',
    friction: 'صندوقدار به مشتری عادی قیمت همکار داد یا به همکار قدیمی تخفیف نداد و شاکی شد',
    hisabcheAction: 'چندین لیست قیمت (همکار، عمده، خرده، طلایی) و اعمال خودکار بر اساس پرونده',
    automatedResult: 'انتخاب مشتری = لود آنی نرخ مخصوص او بدون امکان دستکاری یا مشاهده سایرین',
    businessOutcome: 'حفظ اسرار تجاری تخفیف‌ها، افزایش رضایت شرکا و حاشیه سود سالم',
    emotionalPayoff: 'پرستیژ شرکتی و اعتبار بالا نزد تمام مشتریان بازار',
    cta: 'لیست قیمت در hisabche.com',
    selectedOperators: ['TactilePaperSlide', 'HighlighterStrike', 'DualBoxCtaHold'],
  },
}
