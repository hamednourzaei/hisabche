// ============================================
// Hisabche Motion Design Studio — Reels 36 to 40
//
// 5 High-Conversion Cinematic Films Generated via /new-reels
// Tailored strictly to Real Iranian / Persian Community & Business Needs:
//
// Reel 36: «سر برج چک داری؛ اما دقیقاً چقدر نقدینگی در دست داری؟» (financial-intelligence)
// Reel 37: «یک روز کاری کامل: از باز کردن کرکره تا بستن صندوق شب با ساعت زنده» (kinetic-manifesto)
// Reel 38: «در تورم امروز، آیا واقعاً سود می‌کنی یا داری مالت را ارزان می‌فروشی؟» (financial-intelligence)
// Reel 39: «چند شعبه و انبار داری؛ اما آیا واقعاً از همه جا خبر داری؟» (procedural-spatial)
// Reel 40: «اگر وسط شلوغی بازار اینترنت قطع شود، صندوق تو متوقف می‌شود؟» (obsidian-cinematic)
//
// Adheres strictly to:
// - Real community/business pain points (Cheque due dates, Inflation FIFO, Night cashout, Multi-branch, Offline POS)
// - Features the live Analog Clock with Progressive Arc in Reel 37
// - Problem-first narrative arc with intense purchase excitement & desire
// - Max 1 card scene per 5-scene reel (Strict 20% Card Quota)
// - Rotating layout topologies across reels
// - HarfBuzz-safe RTL typography
// - Frame-deterministic math and exactly 59s duration per reel
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

// ─────────────────────────────────────────────────────────────────────────────
// REEL 36: «سر برج چک داری؛ اما دقیقاً چقدر نقدینگی در دست داری؟» (59s)
// Persona: Wholesaler / Distributor / Merchant
// Theme: financial-intelligence
// Pain: Cheque bounce fear, due date scheduling chaos, unknown real cash reserves
// ─────────────────────────────────────────────────────────────────────────────

export const reel36 = reel(
  '36',
  'سر برج چک داری؛ اما دقیقاً چقدر نقدینگی در دست داری؟',
  [
    // Scene 01: Hook (7s) — Due date anxiety vs real liquidity
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'ریسک واقعی بازار',
        lines: ['سر برج چک داری؛', 'اما [r:دقیقاً چقدر نقدینگی] در دست داری؟'],
        cards: [
          {
            icon: 'calendar',
            title: 'سررسید چک‌های خرید',
            sub: 'موعد نزدیک، موجودی نامشخص',
            tone: 'red',
          },
          {
            icon: 'bank',
            title: 'چک‌های دریافتی مشتریان',
            sub: 'آیا سر وقت پاس می‌شوند؟',
            tone: 'cyan',
          },
        ],
      },
      vo: 'سر برج نزدیکه، چند فقره چک پرداختنی داری و روی چک‌های مشتریان حساب باز کردی؛ اما آیا دقیقاً می‌دونی سر موعد چقدر نقدینگی داری یا اعتبارت به خطر می‌افته؟',
    },
    // Scene 02: Dual Perspective Workflow (15s) — Cheque due date to bank & customer ledger
    {
      dur: 15,
      spec: {
        kind: 'dual-perspective-demo',
        title: 'زنجیره تسویه [c:سررسید چک] و [p:تراز نقدینگی]',
        saleAt: 2.0,
        journalAt: 4.8,
      },
      vo: 'در حسابداری سنتی، سررسید چک‌ها تا روز پرداخت در سررسیدها گم می‌شن؛ اما در حسابچه، با ثبت هر چک، زنجیره حساب بانکی، اعتبار مشتری و پیش‌بینی نقدینگی در لحظه به‌روز می‌شه.',
    },
    // Scene 03: Financial Intelligence (14s) — 30-Day Liquidity Forecast
    {
      dur: 14,
      spec: {
        kind: 'financial-intelligence',
        title: 'پیش‌بینی هوشمند [g:جریان نقدینگی و هشدار کسری]',
        revenue: 145000000,
        cogs: 92000000,
        grossProfit: 53000000,
        verdict: 'پیش‌بینی دقیق نقدینگی تا ۳۰ روز آینده؛ پایان استرس برگشت چک',
      },
      vo: 'حسابچه قبل از اینکه چک سررسید بشه، جریان نقدی ۳۰ روز آینده رو بهت نشون می‌ده تا بدونی کی کسری داری و اعتبار ۲۰ ساله‌ات تو بازار همیشه حفظ بشه.',
    },
    // Scene 04: Compare (15s) — Traditional notes vs Hisabche Automated Liquidity
    {
      dur: 15,
      spec: {
        kind: 'compare',
        title: 'مدیریت چک و نقدینگی: [r:دفتر دستی] در برابر [c:حسابچه]',
        columns: ['شاخص کلیدی', 'سررسید دستی', 'اکسل بازار', 'سیستم حسابچه'],
        rows: [
          { label: 'هشدار پیش از سررسید', marks: ['no', 'no', 'yes'] },
          { label: 'پیش‌بینی تراز بانکی', marks: ['no', 'part', 'yes'] },
          { label: 'تسویه آنی زنجیره اسناد', marks: ['no', 'no', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'دفاتر سنتی فقط عدد ثبت می‌کنن؛ اما حسابچه جریان نقدینگی رو هوشمند پیش‌بینی می‌کنه تا همیشه دست پر و مقتدر باشی.',
    },
    // Scene 05: CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | اعتبار بازارت را بیمه کن.',
        boxes: [
          {
            lead: 'پایان استرس سررسید چک‌های سر ماه…',
            action: 'کنترل نقدینگی:',
            word: 'نقدینگی',
            tone: 'cyan',
          },
          {
            lead: 'اعتبار بازارت را هوشمند بیمه کن.',
            action: 'شروع حسابچه:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'اعتبار بازار با سال‌ها تلاش به دست میاد؛ با حسابچه خیالت از پاس شدن سر وقت چک‌ها راحت باشه. همین الان شروع کن.',
    },
  ],
  'financial-intelligence',
  {
    targetCustomer: 'wholesaler',
    customerPain:
      'سر برج موعد چک‌های تأمین‌کننده فرا می‌رسد اما نقدینگی واقعی شفاف نیست و خطر برگشت چک و خدشه‌دار شدن اعتبار کاسب وجود دارد.',
    oldWorkflow: 'یادداشت تاریخ چک در تقویم رومیزی و شوک ناشی از کسری حساب در روز موعد.',
    friction: 'عدم تطبیق چک‌های دریافتی نسیه با چک‌های پرداختی سر ماه.',
    hisabcheAction: 'ماژول پیش‌بینی جریان نقدینگی ۳۰ روزه متصل به تقویم بانکی و حساب مشتریان.',
    automatedResult:
      'هشدار زودهنگام کسری نقدینگی ۵ روز قبل از سررسید چک و امکان برنامه‌ریزی وصول مطالبات.',
    businessOutcome: 'صفر شدن برگشت چک و ارتقای اعتبار بانکی و اعتباری در بازار بنکداری.',
    emotionalPayoff: 'آرامش خاطر کامل مدیر هنگام امضای چک‌های خرید بعدی.',
    cta: 'کامنت کنید: نقدینگی | مشاوره در hisabche.com',
    selectedOperators: [
      'Waterfall Value Cascade',
      'Dual Camera Horizon',
      'Odometer Counter Roll',
      'Glassmorphic Edge Refraction',
      'Dynamic Spotlight Cone',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 37: «یک روز کاری کامل: از باز کردن کرکره تا بستن صندوق شب با ساعت زنده» (59s)
// Persona: Retail Shopkeeper / Store Manager
// Theme: kinetic-manifesto
// Special Feature: Analog Clock with progressive process arc in Day scene
// ─────────────────────────────────────────────────────────────────────────────

export const reel37 = reel(
  '37',
  'یک روز کاری کامل: از باز کردن کرکره تا بستن صندوق شب',
  [
    // Scene 01: Kinetic Manifesto Hook (7s) — Daily hustle vs peaceful night
    {
      dur: 7,
      spec: {
        kind: 'kinetic-manifesto',
        headline: ['از ۸ صبح تا ۱۰ شب دویدی؛', 'اما آخر شب دخل و سودت با هم می‌خواند؟'],
        subheadline: 'مدیریت یعنی بعد از یک روز شلوغ، با خیال آسوده در مغازه را ببندی',
        statements: [
          'هزار قلم فروش خرد و عمده؟',
          'پرداخت‌های کارت‌خوان و نسیه پراکنده؟',
          'تردید در سود واقعی دخل امروز؟',
        ],
        accentTone: 'cyan',
      },
      vo: 'از اول صبح تا آخر شب در مغازه می‌دوی، فاکتور می‌زنی، بار خالی می‌کنی؛ اما آیا آخر شب دقیقاً می‌دونی چقدر سود کردی؟',
    },
    // Scene 02: The Living Analog Clock Timeline (22s) — 09:00 -> 13:30 -> 18:00 -> 21:30
    {
      dur: 22,
      spec: {
        kind: 'day',
        title: 'چرخه ۲۴ ساعته [c:یک روز کاری شفاف]',
        interval: 4.8,
        moments: [
          { time: '۰۹:۰۰', icon: 'sun', text: 'شروع شیفت: باز کردن صندوق و ورود مانده پایه' },
          {
            time: '۱۳:۳۰',
            icon: 'store',
            text: 'اوج شلوغی ظهر: فاکتورهای برق‌آسا و تسویه کارت‌خوان',
          },
          { time: '۱۸:۰۰', icon: 'boxes', text: 'ورود بار جدید: تطبیق آنی کاردکس انبار' },
          { time: '۲۱:۳۰', icon: 'moon', text: 'بستن صندوق شب: صفر مغایرت، گزارش خودکار سود روز' },
        ],
      },
      vo: 'ساعت ۹ صبح با مانده مشخص شروع می‌کنی؛ ساعت ۱ ظهر شلوغ‌ترین فاکتورها در ۳ ثانیه ثبت می‌شن؛ ساعت ۶ عصر بار ورودی به کاردکس می‌شینه؛ و ساعت ۹:۳۰ شب در ۵ دقیقه صندوق رو با صفر مغایرت می‌بندی.',
    },
    // Scene 03: Versus (12s) — Paper receipt mess vs automated night audit
    {
      dur: 12,
      spec: {
        kind: 'versus',
        title: 'بستن حساب روزانه: [r:دفترهای خط‌خورده] یا [c:گزارش تحلیلی شبانه]؟',
        left: {
          label: 'روش سنتی بازار',
          value: '۱ ساعت کلنجار با فیش‌های پوز و کاغذ',
          tone: 'red',
        },
        right: {
          label: 'بستن هوشمند حسابچه',
          value: 'تطبیق اتوماتیک پوز و تفکیک سود خالص',
          tone: 'cyan',
        },
        verdict: 'پایان کار روزانه در آرامش کامل و بدون ابهام',
      },
      vo: 'به جای یک ساعت جمع زدن فیش‌های پوز و دفترچه‌های خط خورده، در حسابچه با یک کلیک تراز کل روز بسته می‌شه.',
    },
    // Scene 04: Cinematic Product (11s) — Integrated Daily Health Snapshot
    {
      dur: 11,
      spec: {
        kind: 'cinematic-product',
        title: 'نمای متمرکز [g:گزارش جامع دخل و سود روز]',
        subtitle: 'تفکیک فروش نقدی، پوز، نسیه و سود خالص روزانه',
        floatingBadge: 'صفر مغایرت صندوق در پایان شیفت',
        layers: [
          {
            title: 'جمع‌آوری هوشمند پوزها',
            desc: 'تطبیق خودکار با تراکنش‌های شاپرک',
            icon: 'receipt',
            tone: 'cyan',
            z: 60,
          },
          {
            title: 'سود ناخالص و خالص روز',
            desc: 'کسر اتوماتیک بهای تمام شده اقلام فروش رفته',
            icon: 'coins',
            tone: 'purple',
            z: 40,
          },
          {
            title: 'کاردکس لحظه‌ای اقلام',
            desc: 'به‌روزرسانی خودکار موجودی قفسه‌ها',
            icon: 'boxes',
            tone: 'green',
            z: 20,
          },
        ],
      },
      vo: 'وقتی تمام اطلاعات فاکتور، پوز و انبار به هم متصل باشن، در پایان روز می‌دونی دقیقاً چند تومان سود به دست آوردی.',
    },
    // Scene 05: CTA (7s)
    {
      dur: 7,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | روز کاری‌ات را با خیال آسوده تمام کن.',
        boxes: [
          {
            lead: 'بستن ۵ دقیقه‌ای صندوق و دخل مغازه…',
            action: 'صندوق شفاف:',
            word: 'صندوق',
            tone: 'cyan',
          },
          {
            lead: 'کسب‌وکارت را حرفه‌ای و سریع مدیریت کن.',
            action: 'شروع کار:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 3.5,
      },
      vo: 'شب‌ها با خیال راحت کلید بنداز و برو خانه. همین امشب کار با حسابچه را شروع کن.',
    },
  ],
  'kinetic-manifesto',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'خستگی مفرط آخر شب ناشی از شمردن دستی فیش‌های پوز و عدم اطمینان از سود واقعی روز.',
    oldWorkflow: 'شمارش دستی فیش‌های کارت‌خوان و کاغذهای خط‌خورده پای صندوق به مدت ۱ ساعت.',
    friction:
      'تطبیق نیافتن ارقام پوز با فاکتورهای دستی و بی‌پاسخ ماندن سوال «امروز چقدر سود خالص کردیم؟».',
    hisabcheAction:
      'گردش کار خودکار با ساعت آنالوگ از ثبت آغازین شیفت تا جمع‌آوری اتوماتیک پوزها و محاسبه سود در ۲۱:۳۰.',
    automatedResult: 'بستن کامل دخل، انبار و سود روز در کمتر از ۵ دقیقه با دقت ۱۰۰٪.',
    businessOutcome: 'آزادسازی زمان مغازه‌دار و حذف خطاهای صندوقداری و کسری دخل.',
    emotionalPayoff: 'رفتن به خانه با خیال آسوده و تسلط کامل بر عملکرد مالی مغازه.',
    cta: 'کامنت کنید: صندوق | دمو رایگان در hisabche.com',
    selectedOperators: [
      'Radial Clock Dial & Progress Ring',
      'Odometer Counter Roll',
      'Split-Screen Blade Shutter',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 38: «در تورم امروز، آیا واقعاً سود می‌کنی یا داری مالت را ارزان می‌فروشی؟» (59s)
// Persona: Hardware / Auto Parts / Electronics Merchant
// Theme: financial-intelligence
// Pain: Inflation gap, fake paper profit, selling below replacement cost
// ─────────────────────────────────────────────────────────────────────────────

export const reel38 = reel(
  '38',
  'در تورم امروز، آیا واقعاً سود می‌کنی یا داری مالت را ارزان می‌فروشی؟',
  [
    // Scene 01: Hook (7s) — Fake profit illusion in inflation
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'تله سود کاذب در تورم',
        lines: ['فروش داری و صندوق پر می‌شه؛', 'اما چرا موقع خرید بار جدید [r:کم می‌آوری؟]'],
        cards: [
          {
            icon: 'coins',
            title: 'سود کاذب روی کاغذ',
            sub: 'فروش به قیمت قدیم، بدون احتساب بهای روز',
            tone: 'red',
          },
          {
            icon: 'trending',
            title: 'تورم بهای جایگزینی',
            sub: 'آیا با پول فروش، می‌توانی همان جنس را بخری؟',
            tone: 'cyan',
          },
        ],
      },
      vo: 'فروش روزمره‌ات عالیه و حساب پرپوله؛ اما وقتی می‌خوای جای بار فروخته‌شده خرید کنی، می‌بینی پول کم آوردی! این یعنی گرفتار تله سود کاذب شدی.',
    },
    // Scene 02: Profit Waterfall Breakdown (16s) — Deconstruct real gross vs net
    {
      dur: 16,
      spec: {
        kind: 'profit-waterfall-demo',
        title: 'کالبدشکافی بهای واقعی کالا: [r:سود کاذب] در برابر [c:سود خالص واقعی]',
        grossRevenue: 420000000,
        cogs: 295000000,
        expenses: 45000000,
      },
      vo: 'اگر بهای تمام‌شده بر اساس لایه‌های واقعی خرید محاسبه نشه، با هر فاکتور فروش فکر می‌کنی سود کردی، در حالی که در حال آب کردن سرمایه‌ات هستی.',
    },
    // Scene 03: Compare (14s) — Guesswork costing vs FIFO Inventory layers
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'محاسبه بهای کالا: [r:میانگین حدسی] در برابر [c:لایه‌های FIFO حسابچه]',
        columns: ['قابلیت استراتژیک', 'محاسبه دستی', 'نرم‌افزار سنتی', 'موتور حسابچه'],
        rows: [
          { label: 'کاردکس ریالی لایه‌ای (FIFO)', marks: ['no', 'part', 'yes'] },
          { label: 'سود واقعی بر اساس بچ خرید', marks: ['no', 'no', 'yes'] },
          { label: 'هشدار حاشیه سود منفی در فاکتور', marks: ['no', 'no', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'موتور لایه‌ای حسابچه، بهای هر قلم کالا رو دقیقاً بر اساس خرید همون بچ استخراج می‌کنه تا هیچ جنسی زیر قیمت جایگزینی فروخته نشه.',
    },
    // Scene 04: Versus (14s) — Capital melting vs Real asset preservation
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title: 'فروش در بازار امروز: [r:آب شدن سرمایه] در برابر [c:حفظ ارزش واقعی دارایی]',
        left: {
          label: 'فروش بدون لایه بهای تمام شده',
          value: 'سود اسمی بالا، اما ناتوانی در خرید مجدد بار',
          tone: 'red',
        },
        right: {
          label: 'کنترل لحظه‌ای سود در حسابچه',
          value: 'سود خالص واقعی، حفظ ارزش سرمایه در تورم',
          tone: 'cyan',
        },
        verdict: 'در تورم، تنها با حسابداری دقیق بهای تمام‌شده دوام می‌آوری',
      },
      vo: 'در تورم بازار، کسی برنده است که نه فقط فروش بالا، بلکه کنترل لحظه‌ای روی بهای تمام شده و حاشیه سود واقعی داشته باشه.',
    },
    // Scene 05: CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | سرمایه‌ات را در تورم حفظ کن.',
        boxes: [
          {
            lead: 'جلوگیری از آب شدن سرمایه و سود کاذب…',
            action: 'محاسبه سود:',
            word: 'سود واقعی',
            tone: 'cyan',
          },
          {
            lead: 'حسابداری لایه‌ای و دقیق بهای تمام شده.',
            action: 'شروع با حسابچه:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'اجازه نده سرمایه‌ات ذره‌ذره آب بشه. همین امروز حسابداری لایه‌ای حسابچه رو امتحان کن.',
    },
  ],
  'financial-intelligence',
  {
    targetCustomer: 'wholesaler',
    customerPain:
      'فروشنده در تورم کالا را با سود ظاهری می‌فروشد اما هنگام خرید مجدد جنس از کارخانه متوجه کسری سرمایه در گردش می‌شود.',
    oldWorkflow: 'قیمت‌گذاری بر مبنای آخرین فاکتور خرید یا میانگین ساده ذهنی.',
    friction: 'تفاوت نرخ تورم با بهای لایه‌ای خرید در انبار و ذوب تدریجی سرمایه کاسب.',
    hisabcheAction: 'موتور کاردکس لایه‌ای FIFO/AVCO و محاسبه بهای تمام شده لحظه‌ای در صدور فاکتور.',
    automatedResult:
      'استخراج سود خالص واقعی و آلارم حاشیه سود منفی در صورت فروش زیر قیمت جایگزینی.',
    businessOutcome: 'حفظ ارزش دارایی انبار و رشد پایدار سود در شرایط نوسان شدید بازار.',
    emotionalPayoff:
      'اطمینان قطعی از اینکه هر فاکتور فروش واقعاً به سرمایه افزوده است نه اینکه از آن کاسته باشد.',
    cta: 'کامنت کنید: سود واقعی | فعال‌سازی در hisabche.com',
    selectedOperators: [
      'Waterfall Value Cascade',
      'Odometer Counter Roll',
      'Dual Camera Horizon',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 39: «چند شعبه و انبار داری؛ اما آیا واقعاً از همه جا خبر داری؟» (59s)
// Persona: Multi-Branch Chain / Distributed Merchant
// Theme: procedural-spatial
// Pain: Multi-location blind spots, telephone-based stock checks, branch discrepancies
// ─────────────────────────────────────────────────────────────────────────────

export const reel39 = reel(
  '39',
  'چند شعبه و انبار داری؛ اما آیا واقعاً از همه جا خبر داری؟',
  [
    // Scene 01: Hook (7s) — Expansion bottleneck
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'چالش گسترش کسب‌وکار',
        lines: ['وقتی شعبه دوم رو باز می‌کنی؛', 'سودت دو برابر می‌شه یا [r:دردسرهایت؟]'],
        cards: [
          {
            icon: 'store',
            title: 'موجودی قفسه شعبه',
            sub: 'مشتری پای صندوق جنس می‌خواهد',
            tone: 'cyan',
          },
          {
            icon: 'boxes',
            title: 'انبار مرکزی و کسری نامرئی',
            sub: 'چرا بار گم می‌شود یا مغایرت دارد؟',
            tone: 'red',
          },
        ],
      },
      vo: 'کسب‌وکارت بزرگ شده و چند مغازه و انبار داری؛ اما آیا هر بار برای آمار گرفتن باید تلفن بزنی یا در سفر هم روی همه شعبات تسلط داری؟',
    },
    // Scene 02: Warehouse Movement Demo (16s) — Central to Branch Transfer
    {
      dur: 16,
      spec: {
        kind: 'warehouse-movement-demo',
        title: 'حواله هوشمند بین‌انبار [c:بدون تماس تلفنی و بدون مغایرت]',
        transitAt: 2.2,
        arriveAt: 4.5,
      },
      vo: 'دیگه نیازی به تلفن زدن به انباردار نیست. با صدور حواله، موجودی انبار مرکزی کسر، در کاردکس شعبات رزرو و به محض تایید وصول، تراز هر دو طرف همگام می‌شه.',
    },
    // Scene 03: Hub Architecture (14s) — Central Core + Distributed Outlets
    {
      dur: 14,
      spec: {
        kind: 'hub',
        title: 'همگام‌سازی متمرکز [c:شبکه شعب و انبارهای حسابچه]',
        core: 'پایگاه مرکزی',
        coreSub: 'هماهنگی ابری متمرکز',
        nodes: [
          { icon: 'boxes', label: 'انبار مرکزی' },
          { icon: 'store', label: 'فروشگاه اصلی' },
          { icon: 'briefcase', label: 'شعبه بازار' },
          { icon: 'file', label: 'کاردکس یکپارچه' },
        ],
      },
      vo: 'تمام انبارها و شعبات در یک اکوسیستم متمرکز به هم متصلن. مدیر در هر لحظه از روی گوشی، موجودی دقیق تک‌تک قفسه‌ها رو می‌بینه.',
    },
    // Scene 04: Compare (14s) — Phone calls/chat vs Hisabche Multi-Branch ERP
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'کنترل شعب: [r:تماس تلفنی و تلگرام] در برابر [c:سامانه یکپارچه حسابچه]',
        columns: ['معیار مدیریت', 'تماس تلفنی', 'شیت اکسل', 'حسابچه چندشعبه'],
        rows: [
          { label: 'دید لحظه‌ای موجودی شعب', marks: ['no', 'part', 'yes'] },
          { label: 'حواله رسمی بین‌انباری', marks: ['no', 'no', 'yes'] },
          { label: 'سود و زیان به تفکیک هر شعبه', marks: ['no', 'part', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'به جای ارسال عکس فاکتور در پیام‌رسان‌ها، مدیریت مدرن یعنی تسلط لحظه‌ای بر تراز سود و موجودی هر شعبه.',
    },
    // Scene 05: CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | کسب‌وکارت را از هر کجا مدیریت کن.',
        boxes: [
          {
            lead: 'تسلط کامل بر تمام شعب و انبارها از روی گوشی…',
            action: 'مدیریت شعب:',
            word: 'شعبات',
            tone: 'cyan',
          },
          {
            lead: 'یکپارچه‌سازی آسان و سریع با حسابچه.',
            action: 'دریافت نسخه دمو:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'کسب‌وکارت را بدون نیاز به حضور فیزیکی از هر کجای دنیا مدیریت کن. همین حالا حسابچه را فعال کن.',
    },
  ],
  'procedural-spatial',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'مدیر برای اطلاع از موجودی شعب مجبور به برقراری ده‌ها تماس تلفنی در روز است و کالاها در جابه‌جایی بین شعب گم یا مغایرت می‌خورند.',
    oldWorkflow: 'ثبت فاکتورهای جداگانه در اکسل‌های مجزا و ارسال تصویر بارنامه در پیام‌رسان‌ها.',
    friction:
      'تطبیق نداشتن کاردکس انبار مرکزی با فروشگاه‌ها و لغو خرید مشتری پای صندوق به دلیل کسری پیش‌بینی‌نشده.',
    hisabcheAction:
      'حواله الکترونیکی بین‌انبار با مکانیزم صدور، ترانزیت، و وصول قطعی متصل به کاردکس لحظه‌ای.',
    automatedResult:
      'دید ۳۶۰ درجه مدیریتی به موجودی و سود هر شعبه از روی تبلت و گوشی بدون نیاز به حضور در محل.',
    businessOutcome: 'صفر شدن مغایرت انبارگردانی و امکان توسعه شعبات جدید بدون افزایش بار سرپرستی.',
    emotionalPayoff: 'احساس تسلط کامل یک مدیرعامل مقتدر بر تمام نقاط عملیاتی زنجیره کسب‌وکار.',
    cta: 'کامنت کنید: شعبات | مشاهده امکانات چندانباره در hisabche.com',
    selectedOperators: [
      'Circuit Path Tracer',
      'Dual Camera Horizon',
      'Magnetic Particle Stream',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 40: «اگر وسط شلوغی بازار اینترنت قطع شود، صندوق تو متوقف می‌شود؟» (59s)
// Persona: Supermarket / Fast Food / Busy Retailer
// Theme: obsidian-cinematic
// Pain: Internet/electricity blackout, frozen cloud web apps, lost walk-out sales
// ─────────────────────────────────────────────────────────────────────────────

export const reel40 = reel(
  '40',
  'اگر وسط شلوغی بازار اینترنت قطع شود، صندوق تو متوقف می‌شود؟',
  [
    // Scene 01: Hook (7s) — Sudden network blackout nightmare
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'کابوس بزرگ فروشگاه‌ها',
        lines: ['صف مشتریان پای صندوق شلوغ است؛', 'ناگهان [r:اینترنت و شبکه قطع می‌شود!]'],
        cards: [
          {
            icon: 'wifiOff',
            title: 'قطعی ناگهانی شبکه',
            sub: 'نرم‌افزارهای ابری قفل و متوقف می‌شوند',
            tone: 'red',
          },
          {
            icon: 'users',
            title: 'کلافگی و ترک خرید مشتری',
            sub: 'از دست رفتن فروش و اعتبار مغازه',
            tone: 'cyan',
          },
        ],
      },
      vo: 'وسط شلوغ‌ترین ساعات فروش، اینترنت ناگهان قطع می‌شه؛ نرم‌افزارهای تحت‌وب قفل می‌کنن و مشتریان عصبانی خریدها رو می‌ذارن و می‌رن!',
    },
    // Scene 02: Offline Sync Demo (16s) — Local queue & resilient reconnect
    {
      dur: 16,
      spec: {
        kind: 'offline-sync-demo',
        title: 'تداوم صد در صدی فروش با [c:معماری آفلاین‌فرست حسابچه]',
        subtitle: 'ثبت محلی اسناد روی حافظه دستگاه و ارسال امن پس از اتصال',
        reconnectAt: 3.0,
        syncCompleteAt: 5.5,
      },
      vo: 'حسابچه آفلاین‌فرست ساخته شده. یعنی حتی اگر کل شهر اینترنت نداشته باشه، صندوق تو بدون وقفه فاکتور می‌زنه و چاپ می‌کنه و با وصل شدن اینترنت، همه‌چیز اتوماتیک همگام می‌شه.',
    },
    // Scene 03: Versus (14s) — Fragile cloud vs Infinite local durability
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title: 'پایداری فروش: [r:نرم‌افزارهای وب سنتی] در برابر [c:پایداری بی‌نهایت حسابچه]',
        left: {
          label: 'سامانه‌های ابری شکننده',
          value: 'وابستگی مطلق به نت · توقف کامل فروش در قطعی',
          tone: 'red',
        },
        right: {
          label: 'حسابچه آفلاین‌فرست',
          value: 'پایگاه داده محلی سریع · صفر ثانیه معطلی پای صندوق',
          tone: 'cyan',
        },
        verdict: 'صندوق فروشگاه تو نباید حتی یک ثانیه به خاطر اینترنت متوقف شود',
      },
      vo: 'صندوق مغازه شریان اصلی پوله؛ نباید معطل سرعت اینترنت بشه. سرعت و آرامش پای صندوق رو با حافظه محلی تضمین کن.',
    },
    // Scene 04: Compare (14s) — Outage resistance comparison
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'تضمین پایداری صندوق: [r:نرم‌افزار قدیمی] در برابر [c:حسابچه]',
        columns: ['معیار پایداری', 'تحت وب معمولی', 'برنامه سنتی', 'حسابچه مدرن'],
        rows: [
          { label: 'کارکرد صددرصد بدون اینترنت', marks: ['no', 'yes', 'yes'] },
          { label: 'همگام‌سازی خودکار پس از اتصال', marks: ['no', 'no', 'yes'] },
          { label: 'عدم گم شدن حتی یک فاکتور', marks: ['no', 'part', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'دیگه نگران قطعی برق یا اینترنت نباش؛ با حسابچه قوی‌ترین و پایدارترین صندوق فروشگاهی رو در اختیار داری.',
    },
    // Scene 05: CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | صندوقی که هرگز متوقف نمی‌شود.',
        boxes: [
          {
            lead: 'فروش بدون وقفه حتی بدون یک بایت اینترنت…',
            action: 'صندوق ضد قطعی:',
            word: 'آفلاین',
            tone: 'cyan',
          },
          {
            lead: 'پایداری صد در صدی با حسابچه.',
            action: 'شروع رایگان:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'فروشگاهت رو روی پایدارترین زیرساخت بساز. صندوق بدون توقف حسابچه رو همین الان تجربه کن.',
    },
  ],
  'obsidian-cinematic',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'در ساعات اوج شلوغی و قطعی مقطعی اینترنت یا برق، نرم‌افزار قفل کرده و مشتریان صف صندوق را ترک می‌کنند.',
    oldWorkflow: 'نرم‌افزارهای تحت وب سنتی که بدون اینترنت قادر به چاپ فاکتور و صدور سند نیستند.',
    friction: 'توقف جریان نقدینگی فروشگاه و از دست رفتن قطعی درآمدهای نقدی روزانه.',
    hisabcheAction:
      'موتور دیتابیس محلی آفلاین‌فرست بر بستر SQLite با قابلیت صف‌بندی تراکنش‌ها و بک‌آپ لحظه‌ای.',
    automatedResult:
      'صدور فاکتور زیر ۲ ثانیه حتی در قطع کامل اینترنت؛ ارسال خودکار اطلاعات به محض اتصال مجدد.',
    businessOutcome: 'تضمین ۱۰۰ درصدی پایداری دخل و وفاداری مشتریان حتی در بدترین شرایط زیرساختی.',
    emotionalPayoff: 'احساس شکست‌ناپذیری در برابر بحران‌های زیرساختی شهر و بازار.',
    cta: 'کامنت کنید: آفلاین | دریافت نسخه بدون قطعی در hisabche.com',
    selectedOperators: [
      'Split-Screen Blade Shutter',
      'Dual Camera Horizon',
      'Odometer Counter Roll',
      'Glassmorphic Edge Refraction',
      'Dynamic Spotlight Cone',
    ],
  },
)
