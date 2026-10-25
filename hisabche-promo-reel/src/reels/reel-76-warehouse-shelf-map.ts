// ============================================
// Reel 76: Warehouse Shelf Map - 3-Second Bin Locating
// Motion Template: infinite-spatial-board
// Funnel Stage: Operational Speed | Audience: Warehouse Managers, Distribution Centers
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'سیستم قفسه‌بندی و کدینگ انبار',
        lines: ['مشتری پای صندوق منتظره،', 'ولی [r:مکان کالا مشخص نیست]!'],
        cards: [
          { icon: 'boxes', title: 'موجودی سیستمی', sub: '۲۰ عدد در انبار', tone: 'cyan' },
          { icon: 'offline', title: 'محل قرارگیری', sub: 'فقط در ذهن انباردار!', tone: 'red' },
        ],
      },
      vo: 'سیستم می‌گه کالا تو انباره، ولی انباردار ۲۰ دقیقه است تو راهروها می‌گرده و پیداش نمی‌کنه!',
    },
    {
      dur: 8,
      spec: {
        kind: 'infinite-spatial',
        title: 'نقشه دوبعدی قفسه‌بندی و مکان‌یابی هوشمند کالا در انبار',
      },
      vo: 'در حسابچه، هر قفسه کد استاندارد داره: راهرو، ردیف و طبقه. با یک نگاه جای دقیق بار را می‌دانی.',
    },
    {
      dur: 7,
      spec: {
        kind: 'stagger',
        title: 'مکان‌یابی [c:سه ثانیه‌ای کالا] با بارکد',
        header: ['کد قفسه: B-04-2', 'انبار مرکزی'],
        rows: [
          { icon: 'boxes', text: 'راهروی B - بخش مواد تجاری' },
          { icon: 'barcode', text: 'قفسه شماره ۰۴ - طبقه دوم' },
          { icon: 'package', text: 'ظرفیت باقیمانده: ۱۸ کارتن' },
          { icon: 'check', text: 'ثبت خروج آنی با اسکنر' },
        ],
        interval: 0.8,
        tone: 'green',
      },
      vo: 'بارکد کالا رو اسکن کن؛ قفسه ثبت می‌شه و هر کس وارد انبار بشه فوراً کالا رو پیدا می‌کنه.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel76: Reel = {
  id: '76',
  title: 'قفسه‌بندی و کدینگ انبار: راهرو و طبقه را از کد بخوان!',
  duration: total(scenes),
  scenes,
  theme: 'cyber-emerald',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'سردرگمی کارگران در انبار بزرگ و اتلاف وقت پشت تلفن برای آدرس یک کارتن',
    oldWorkflow: 'کالاها بدون نظم در گوشه انبار چیده می‌شوند و فقط شاگرد قدیمی جایشان را می‌داند',
    friction: 'اگر شاگرد قدیمی نباشد، تحویل سفارش متوقف می‌شود و مشتری معترض می‌رود',
    hisabcheAction: 'نقشه بصری قفسه‌ها، کدگذاری استاندارد (راهرو-قفسه-طبقه) و چاپ برچسب بارکد',
    automatedResult: 'یافتن هر کالا در زیر ۳ ثانیه حتی توسط کارگر تازه‌وارد بدون نیاز به پرسش',
    businessOutcome: 'سرعت تحویل سفارشات ۵ برابر و انبارگردانی بدون خطای مکان‌یابی',
    emotionalPayoff: 'انضباط اروپایی و آرامش کامل در قلب انبار شلوغ',
    cta: 'نقشه قفسه در hisabche.com',
    selectedOperators: ['SpatialWhipPan', 'BarcodeLensZoom', 'DualBoxCtaHold'],
  },
}
