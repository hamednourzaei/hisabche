// ============================================
// Flagship Proof-of-Capability Films (Reels 21–25)
// Demonstrating 5 distinct artistic and creative directions:
// - Film 21: Obsidian Cinematic (3D Perspective Product Film)
// - Film 22: Kinetic Manifesto (Typographic Architecture)
// - Film 23: Financial Intelligence (Living Data Storytelling)
// - Film 24: Procedural Spatial (Continuous Morphing Transformation)
// - Film 25: Alabaster Daylight (Swiss Editorial Design)
// Each film has a duration of exactly 59 seconds.
// ============================================

import type { Reel } from '../engine/types'
import { COMPARE_COLUMNS, ctaScene, sequence, total } from './shared'

const reel = (
  id: string,
  title: string,
  parts: Parameters<typeof sequence>[0],
  theme?: Reel['theme'],
): Reel => {
  const scenes = sequence(parts)
  return { id, title, duration: total(scenes), scenes, theme }
}

// ─── Film A (Reel 21): Cinematic Product Film (59s) [Obsidian Cinematic] ──
export const reel21 = reel(
  '21',
  'شاهکار سینمایی حسابچه',
  [
    {
      dur: 14,
      spec: {
        kind: 'cinematic-product',
        title: 'حسابداری ابری، [c:بدون مرز]',
        subtitle: 'پلتفرم یکپارچه مالی، ارزی و انبارداری حسابچه',
        floatingBadge: 'امنیت بانکی و رمزنگاری روی سرور ابری',
        layers: [
          {
            title: 'پایگاه داده چندارزی پیشرفته',
            desc: 'مدیریت همزمان ارزهای مختلف و مبادلات ارزی با نرخ تسعیر لحظه‌ای',
            icon: 'wallet',
            tone: 'cyan',
            z: 80,
          },
          {
            title: 'هماهنگی آنی بین شعب و انبارها',
            desc: 'ثبت در شعبه کابل، مشاهده لحظه‌ای در هرات و مزارشریف',
            icon: 'sync',
            tone: 'purple',
            z: 0,
          },
          {
            title: 'پایداری دائم و رهایی از سخت‌افزار',
            desc: 'حتی اگر لپ‌تاپ بسوزد یا دزدیده شود، دفاتر شما محفوظ است',
            icon: 'shield',
            tone: 'green',
            z: -80,
          },
        ],
      },
      vo: 'حسابچه نسل جدید نرم‌افزارهای ابری است؛ سیستمی بدون مرز که دفاتر مالی و دارایی‌های شما را در امن‌ترین بستر دنیا نگه می‌دارد.',
    },
    {
      dur: 15,
      spec: {
        kind: 'branch',
        cards: [
          {
            icon: 'laptop',
            title: 'دفتر سنتی یا هارد مغازه',
            sub: 'وابسته به یک کامپیوتر',
            tone: 'red',
          },
          {
            icon: 'cloud',
            title: 'ابر حسابچه در جیب شما',
            sub: 'روی موبایل، لپ‌تاپ و تبلت',
            tone: 'cyan',
          },
        ],
        question: 'آیا هنوز حساب‌وکتابت را به یک دستگاه گره زده‌ای؟',
        answer: 'با حسابچه، هر جا اینترنت داری دخل و حساب مغازه‌ات همان‌جاست.',
        badge: 'انعطاف نامحدود',
      },
      vo: 'در روش‌های قدیمی، یک خرابی ساده هارد یعنی نابودی تمام دفاتر. با حسابچه، اطلاعات شما روی سرورهای فوق امن همیشه در دسترس است.',
    },
    {
      dur: 15,
      spec: {
        kind: 'hub',
        title: 'مرکز فرماندهی [g:یکپارچه کسب‌وکار]',
        core: 'حسابچه',
        coreSub: 'هسته ابری',
        nodes: [
          { icon: 'receipt', label: 'فاکتور هوشمند' },
          { icon: 'boxes', label: 'انبارداری خودکار' },
          { icon: 'user', label: 'حساب مشتریان' },
          { icon: 'trend', label: 'سود و ترازنامه' },
        ],
      },
      vo: 'تمام فرآیندهای مالی شما از صدور سریع فاکتور تا کسر اتوماتیک انبار و ثبت سند دوبل در یک سیستم روان مدیریت می‌شود.',
    },
    ctaScene(15),
  ],
  'obsidian-cinematic',
)

// ─── Film B (Reel 22): Kinetic Typography Manifesto (59s) [Kinetic Manifesto]
export const reel22 = reel(
  '22',
  'مانیفست تایپوگرافی کینتیک',
  [
    {
      dur: 14,
      spec: {
        kind: 'kinetic-manifesto',
        headline: ['کاسبی مدرن،', 'شمارش ریال به ریال است', 'نه حدس و گمان!'],
        subheadline: 'اصول مدیریت مالی برای کسب‌وکارهای پیشرو',
        statements: [
          'هر قطره سود باید ثبت و ردیابی شود',
          'تخفیف بدون محاسبه دقیق بهای تمام‌شده، سم کسب‌وکار است',
          'نرم‌افزار باید در خدمت سرعت فروشنده باشد، نه سد راه او',
        ],
        accentTone: 'cyan',
      },
      vo: 'کاسبی در بازار امروز شوخی‌بردار نیست. بدون اشراف کامل به تک‌تک ارقام دخل و انبار، رشد پایدار ممکن نمی‌شود.',
    },
    {
      dur: 15,
      spec: {
        kind: 'stagger',
        title: '۳ قانون طلایی [c:بقا در بازار]',
        header: ['اصل حسابداری', 'نتیجه عملیاتی'],
        rows: [
          { icon: 'wallet', text: 'کنترل لحظه‌ای طلب‌ها و موعد اقساط مشتری' },
          { icon: 'boxes', text: 'بهای تمام‌شده متحرک برای مقابله با تورم خرید' },
          { icon: 'shield', text: 'بک‌آپ دائمی روی سرور ابری برای آرامش خاطر' },
        ],
        interval: 0.7,
        tone: 'purple',
      },
      vo: 'حسابچه این قوانین را به شکل خودکار در کسب‌وکارت جاری می‌کنه؛ بدون اینکه نیاز باشه یک حسابدار کهنه‌کار باشی.',
    },
    {
      dur: 15,
      spec: {
        kind: 'kinetic',
        headline: 'وقتت رو پای [r:کاغذ و اکسل] تلف نکن!',
        words: ['دفتر کاغذی؟', 'اکسل پرخطا؟', 'حسابچه همیشه همراه شماست!'],
        sub: 'سرعت، دقت و امنیت بی‌وقفه در دست‌های شما.',
        tone: 'cyan',
      },
      vo: 'دیگه نگران دست‌خط بد شاگرد، گم شدن قبض‌ها یا محاسبات طولانی آخر شب نباش. همه‌چیز در چند ثانیه محاسبه می‌شود.',
    },
    ctaScene(15),
  ],
  'kinetic-manifesto',
)

// ─── Film C (Reel 23): Financial Intelligence (59s) [Financial Intelligence]
export const reel23 = reel(
  '23',
  'هوش و بینش مالی حسابچه',
  [
    {
      dur: 15,
      spec: {
        kind: 'financial-intelligence',
        title: 'کالبدشکافی [g:سود و بهای تمام‌شده] کالا',
        revenue: 150,
        cogs: 90,
        grossProfit: 60,
        verdict: 'حسابچه بهای تمام‌شده را لحظه‌ای محاسبه می‌کند تا مطمئن شوی سودت واقعی است!',
      },
      vo: 'فروش بالا همیشه به معنی سود نیست. اگر بهای تمام‌شده هر قلم کالا رو دقیق ندونی، ممکنه با ضرر بفروشی و متوجه نشی!',
    },
    {
      dur: 14,
      spec: {
        kind: 'chart',
        title: 'روند رشد [c:فروش و حاشیه سود ۶ ماهه]',
        chartType: 'area',
        kpis: [
          { label: 'فروش کل دوره', value: 850000, unit: '', trend: '+۲۸٪', tone: 'cyan' },
          { label: 'سود ناخالص واقعی', value: 340000, unit: '', trend: '+۳۵٪', tone: 'green' },
        ],
        data: [
          { label: 'حمل', value: 35 },
          { label: 'ثور', value: 50 },
          { label: 'جوزا', value: 45 },
          { label: 'سرطان', value: 70 },
          { label: 'اسد', value: 65 },
          { label: 'سنبله', value: 92 },
        ],
      },
      vo: 'نمودارهای تحلیلی حسابچه وضعیت سلامت مالی کسب‌وکارت رو در یک نگاه روی صفحه نمایش می‌دن.',
    },
    {
      dur: 15,
      spec: {
        kind: 'ledger',
        title: 'صورت‌حساب شفاف [c:دفتر مشتری]',
        name: 'شرکت بازرگانی اتحاد',
        lines: [
          { label: 'فروش اعتباری پارت اول', amount: '۱۲۰٬۰۰۰' },
          { label: 'دریافت حواله بانکی', amount: '۸۰٬۰۰۰-' },
          { label: 'تخفیف تجاری مجاز', amount: '۵٬۰۰۰-' },
        ],
        balanceFrom: 120000,
        balanceTo: 35000,
        unit: '',
        footer: 'تسویه دقیق و شفاف بدون کوچک‌ترین مغایرت مالی',
      },
      vo: 'حساب و مانده طلب هر مشتری شفاف و دقیق است. گزارش بدهی رو مستقیم از روی نرم‌افزار برای مشتری ارسال کن.',
    },
    ctaScene(15),
  ],
  'financial-intelligence',
)

// ─── Film D (Reel 24): Continuous Transformation (59s) [Procedural Spatial]
export const reel24 = reel(
  '24',
  'دگرگونی و تحول پیوسته',
  [
    {
      dur: 15,
      spec: {
        kind: 'continuous-transform',
        title: 'تکامل امن یک [c:تراکنش مالی]',
        subtitle: 'سفر یک داده از لحظه ثبت فاکتور تا تراز نهایی',
        stages: [
          {
            at: 0.5,
            label: 'مرحله ۱: دریافت و رمزنگاری سیگنال فروش',
            sub: 'پردازش بارکد و دریافت هویت مشتری',
          },
          {
            at: 3.5,
            label: 'مرحله ۲: قفل ایمنی و مهار سرقت داده',
            sub: 'اعتبارسنجی سند در گاوصندوق امنیتی',
          },
          {
            at: 7.5,
            label: 'مرحله ۳: همگام‌سازی ابری میان تمام شعب',
            sub: 'توزیع آنی در کابل، مزار و هرات',
          },
          {
            at: 11.5,
            label: 'مرحله ۴: ثبت قطعی در دفتر کل دوبل',
            sub: 'تایید نهایی با مهر دیجیتال سیستم',
          },
        ],
        tone: 'cyan',
      },
      vo: 'یک فرم هندسی زنده که تکامل یک تراکنش مالی را از لحظه اسکن بارکد تا ثبت رسمی در دفتر کل به تصویر می‌کشد.',
    },
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'تفاوت ساختاری در [g:امنیت و کنترل]',
        columns: COMPARE_COLUMNS,
        interval: 0.8,
        rows: [
          { label: 'امنیت در برابر حریق و سوختن هارد', marks: ['no', 'no', 'yes'] },
          { label: 'دسترسی همزمان مدیر و حسابدار', marks: ['no', 'part', 'yes'] },
          { label: 'پشتیبان‌گیری خودکار بدون دخالت انسان', marks: ['no', 'no', 'yes'] },
          { label: 'کاردکس انبار و سود لحظه‌ای', marks: ['part', 'yes', 'yes'] },
        ],
      },
      vo: 'با مقایسه امکانات می‌بینید که سیستم‌های قدیمی دیگر پاسخگوی حجم و سرعت معاملات امروز نیستند.',
    },
    {
      dur: 15,
      spec: {
        kind: 'queue',
        title: 'پیوستگی فروش [c:حتی در قطعی اینترنت]',
        offlineLabel: 'حالت آفلاین (مغازه)',
        items: ['ثبت فاکتور شماره ۱۰۴۲', 'دریافت بیعانه نقدی مشتری', 'کسر خودکار موجودی انبار'],
        syncedLabel: 'اینترنت وصل شد — همگام‌سازی خودکار در ۲ ثانیه!',
        reconnectAt: 7,
      },
      vo: 'اینترنت هم که قطع شود، فروش یک ثانیه متوقف نمی‌شود. با اتصال مجدد، همه فاکتورها خودکار سینک می‌شوند.',
    },
    ctaScene(15),
  ],
  'procedural-spatial',
)

// ─── Film E (Reel 25): Swiss Daylight Editorial Showcase (59s) [Alabaster Daylight]
export const reel25 = reel(
  '25',
  'ویترین تحریریه روز',
  [
    {
      dur: 14,
      spec: {
        kind: 'daylight-editorial',
        category: 'گزارش تحریریه مالی حسابچه',
        headline: 'سادگی در ظاهر، قدرت بی‌پایان در هسته نرم‌افزار',
        points: [
          { label: 'میانگین زمان صدور فاکتور', value: '۴ ثانیه' },
          { label: 'دقت در مغایرت‌گیری انبار', value: '۱۰۰٪' },
          { label: 'کاهش خطای انسانی در دخل', value: '۹۴٪' },
          { label: 'پشتیبانی ۲۴ ساعته', value: '۳۶۵ روز' },
        ],
        quote: 'حسابچه طراحی شده تا کاسب افغان با وقار، آرامش و اطمینان کامل تجارت کند.',
      },
      vo: 'یک رویکرد دیزاین کاملاً روشن، مینیمال و سوییسی بدون نورهای نئونی؛ تمرکز مطلق بر شفافیت اعداد و وقار برند.',
    },
    {
      dur: 15,
      spec: {
        kind: 'split',
        title: 'مقایسه رویکرد کاری در بازار',
        left: {
          title: 'پیچیدگی نرم‌افزارهای قدیمی',
          subtitle: 'آموزش‌های چندماهه و ده‌ها منوی تو در تو',
          points: [
            'نیاز به حسابدار تخصصی برای ساده‌ترین کارها',
            'سیستم سنگین، کند و وابسته به ویندوز قدیمی',
            'از دست رفتن داده‌ها در نوسان برق مغازه',
          ],
          tone: 'red',
        },
        right: {
          title: 'روانی و مدرنیته حسابچه',
          subtitle: 'طراحی شده بر اساس تجربه واقعی بازار',
          points: [
            'شروع به کار در ۵ دقیقه بدون نیاز به آموزش',
            'اجرا روی گوشی، تبلت و کامپیوتر مغازه',
            'پایگاه داده امن ابری با پایداری ۹۹.۹٪',
          ],
          tone: 'cyan',
        },
        dividerLabel: 'تفاوت روز و شب',
      },
      vo: 'در روش سنتی همه‌چیز وقت‌گیر و فرساینده است. حسابچه را باز کن و از همان لحظه اول بدون دردسر بفروش.',
    },
    {
      dur: 15,
      spec: {
        kind: 'bridge',
        title: 'پیوند دخل روزانه به [g:آینده کسب‌وکار]',
        left: { icon: 'wallet', title: 'فروش روزمره', sub: 'دخل نقد و چک', tone: 'purple' },
        right: { icon: 'trend', title: 'سرمایه‌گذاری آتی', sub: 'خرید هوشمند بار', tone: 'cyan' },
        merged: 'تصمیم‌گیری بر پایه آمار واقعی، نه حدس',
        caption: 'هر فاکتوری که ثبت می‌کنی، چراغ راه تصمیم فردای توست.',
        summaries: [
          {
            question: 'امروز چقدر سود کردی؟',
            answer: 'گزارش سود خالص در یک کلیک',
            tone: 'purple',
            icons: ['wallet', 'receipt'],
          },
          {
            question: 'کدام کالا سریع‌تر نقد میشه؟',
            answer: 'کاردکس گردش کالای پرفروش',
            tone: 'cyan',
            icons: ['boxes', 'trend'],
          },
        ],
      },
      vo: 'با حسابچه دخل روزمره‌ات به تصمیمات بزرگ تجاری پیوند می‌خوره. آینده شغلی‌ات رو هوشمندانه بساز.',
    },
    ctaScene(15),
  ],
  'swiss-editorial',
)
