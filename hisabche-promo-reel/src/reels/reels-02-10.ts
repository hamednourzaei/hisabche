// ============================================
// Videos 02–10: SaaS Production Level Product Marketing Reels
// Rewritten for claims-controlled SaaS marketing with realistic UIs.
// All themes are 100% DARK (obsidian, dark-neon, midnight-gold, cyber-emerald, procedural-spatial).
// Features: New sound design cues, interactive mockups, financial flows, and stacked comparisons.
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const reel = (
  id: string,
  title: string,
  parts: Parameters<typeof sequence>[0],
  theme?: Reel['theme'],
  options?: { noZoom?: boolean | undefined } | undefined,
): Reel => {
  const isNoZoom = options?.noZoom ?? true
  const scenes = sequence(parts, { noZoom: isNoZoom })
  return { id, title, duration: total(scenes), scenes, theme, noZoom: isNoZoom }
}

// ─── 02. One sale; multiple traceable effects (45s) [Theme: Dark-Neon] ───
export const reel02 = reel(
  '02',
  'یک فروش؛ چند اثر قابل‌پیگیری',
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'جریان فروش حسابچه',
        lines: ['یک فروش را...', '[r:چند بار] باید در دفاتر ثبت کنی؟'],
        cards: [
          { icon: 'receipt', title: 'کالا و مشتری', sub: 'ورود نام و قیمت', tone: 'cyan' },
          {
            icon: 'wallet',
            title: 'دریافت وجه و انبار',
            sub: 'ثبت در چند جای جدا',
            tone: 'purple',
          },
        ],
      },
      vo: 'برای یک فروش، چند جا باید اطلاعات را دوباره وارد کنی؟',
    },
    {
      dur: 7,
      spec: {
        kind: 'pile',
        title: 'تکرار یعنی [r:یک فرصت دیگر برای خطا]',
        papers: [
          { icon: 'receipt', label: 'دفتر فروش' },
          { icon: 'user', label: 'حساب مشتری' },
          { icon: 'wallet', label: 'دریافت وجه' },
          { icon: 'boxes', label: 'کاردکس انبار' },
        ],
        counter: '[r:{n} بار] ورود دوباره اطلاعات',
        merge: 'یک فاکتور واحد',
      },
      vo: 'هر بار ورود دوباره اطلاعات، یعنی یک فرصت دیگر برای اشتباه.',
    },
    {
      dur: 5,
      spec: {
        kind: 'mockup',
        device: 'phone',
        title: 'از فاکتور شروع کن',
        screen: {
          type: 'invoice',
          header: 'فاکتور فروش شماره ۱۰۵',
          items: [
            { name: 'کالای تجاری کد ۱۰۱', qty: '۲ عدد', price: '۱٬۵۰۰' },
            { name: 'محصول استاندارد کد ۲۰۲', qty: '۱ بسته', price: '۳٬۲۰۰' },
          ],
          totalLabel: 'جمع فاکتور',
          totalValue: '۴٬۷۰۰',
        },
      },
      vo: 'در حسابچه، فرایند را از فاکتور فروش شروع کن.',
    },
    {
      dur: 15,
      spec: {
        kind: 'stagger',
        title: 'فاکتور و [c:اطلاعات مرتبط با آن]',
        header: ['عملیات متصل', 'اثر مستقیم در سیستم'],
        rows: [
          { icon: 'boxes', text: 'کسر خودکار اقلام از موجودی انبار' },
          { icon: 'user', text: 'به‌روزرسانی مانده حساب و نسیه مشتری' },
          { icon: 'book', text: 'ثبت سند حسابداری در صورت فعال بودن دفتر کل' },
        ],
        interval: 0.8,
        tone: 'cyan',
      },
      vo: 'بسته به نوع فاکتور و تنظیمات حساب، اطلاعات مرتبط را از همان عملیات پیگیری کن.',
    },
    {
      dur: 8,
      spec: {
        kind: 'ledger',
        title: 'اطلاعات مرتبط، [g:کاملاً قابل‌پیگیری]',
        name: 'شرکت بازرگانی رحیمی',
        lines: [
          { label: 'فاکتور فروش شماره ۱۰۵', amount: '۴٬۷۰۰' },
          { label: 'دریافت نقدی پای صندوق', amount: '۳٬۰۰۰-' },
        ],
        balanceFrom: 4700,
        balanceTo: 1700,
        unit: '',
        footer: 'بازگشت به جزئیات فاکتور با یک کلیک',
      },
      vo: 'به‌جای جست‌وجو در چند دفتر، از اطلاعات مرتبط به جزئیات برگرد.',
    },
    ctaScene(6),
  ],
  'dark-neon',
  { noZoom: true },
)

// ─── 03. You gave credit; what is the balance now? (50s) [Theme: Midnight-Gold] ─
export const reel03 = reel(
  '03',
  'نسیه دادی؛ حالا مانده چقدر است؟',
  [
    {
      dur: 5,
      spec: {
        kind: 'versus',
        title: 'از احمد آقا [r:چقدر طلب داری]؟',
        right: { label: 'دفتر نسیه دستی', value: 'نامشخص؟', tone: 'red' },
        left: { label: 'پرونده مشتری حسابچه', value: 'دقیق و شفاف', tone: 'cyan' },
        verdict: 'نسیه‌دادن بخشی از کار است؛ نباید به حافظه تکیه کرد',
      },
      vo: 'مشتری خوش‌حساب هم اگر حسابش جایی ثبت نشده باشد، ممکن است مانده‌اش فراموش شود.',
    },
    {
      dur: 8,
      spec: {
        kind: 'pile',
        title: 'چقدر؟ [r:بابت کدام فاکتور]؟',
        papers: [
          { icon: 'receipt', label: 'فاکتور ماه گذشته' },
          { icon: 'notebook', label: 'یادداشت تلفنی' },
          { icon: 'wallet', label: 'بیعانه متفرقه' },
        ],
        counter: 'اطلاعات در {n} جای پراکنده',
        merge: 'یک پرونده مشتری',
      },
      vo: 'مبلغ، تاریخ و فاکتور را باید دوباره پیدا کنی.',
    },
    {
      dur: 12,
      spec: {
        kind: 'ledger',
        title: 'حساب مشتری [c:در یک نمای روشن]',
        name: 'مشتری حقوقی (کد ۱۰۴)',
        lines: [
          { label: 'فاکتور خرید بار تجاری', amount: '۱۸٬۵۰۰' },
          { label: 'واریز نقدی اول', amount: '۸٬۵۰۰-' },
          { label: 'خرید مجدد کالا', amount: '۴٬۲۰۰' },
        ],
        balanceFrom: 18500,
        balanceTo: 14200,
        unit: '',
        footer: 'مشاهده مانده قطعی و تاریخچه فاکتورها',
      },
      vo: 'در حسابچه، سابقه و مانده مشتری را از صفحه خودش بررسی کن.',
    },
    {
      dur: 13,
      spec: {
        kind: 'mockup',
        device: 'window',
        title: 'فاکتورهای مرتبط و پرداخت‌ها',
        screen: {
          type: 'invoice',
          header: 'پرونده تسویه حساب و فاکتورهای مشتری',
          items: [
            { name: 'فاکتور شماره ۴۰۲ (تحویل شده)', price: '۱۰٬۰۰۰' },
            { name: 'فاکتور شماره ۴۵۸ (در انتظار تسویه)', price: '۴٬۲۰۰' },
          ],
          totalLabel: 'مانده قابل‌پیگیری',
          totalValue: '۱۴٬۲۰۰',
        },
      },
      vo: 'جزئیات ثبت‌شده را کنار هم ببین تا بدانی مانده از کجا آمده است.',
    },
    ctaScene(12),
  ],
  'midnight-gold',
  { noZoom: true },
)

// ─── 04. Sales were high; what about profit? (50s) [Theme: Financial-Intelligence] ─
export const reel04 = reel(
  '04',
  'فروش بالا بود؛ سود چطور؟',
  [
    {
      dur: 5,
      spec: {
        kind: 'versus',
        title: 'فروش بیشتر، [r:همیشه سود بیشتر نیست]',
        right: { label: 'رقم فاکتور فروش', value: 'بالا و جذاب', tone: 'cyan' },
        left: { label: 'موجودی دخل', value: 'کمتر از حدس؟', tone: 'red' },
        verdict: 'اگر بهای خرید را ندانی، عدد سود هم قابل‌اعتماد نیست',
      },
      vo: 'ممکن است فروشت بالا رفته باشد؛ اما آیا می‌دانی واقعاً چقدر سود کرده‌ای؟',
    },
    {
      dur: 9,
      spec: {
        kind: 'stagger',
        title: 'داده ناقص یعنی [r:نتیجه نامطمئن]',
        header: ['عامل محاسبه', 'اثر بر نتیجه'],
        rows: [
          { icon: 'receipt', text: 'فروش بدون بهای خرید ثبت‌شده' },
          { icon: 'alert', text: 'سود نامعلوم، بهتر از عدد ساختگی است' },
          { icon: 'check', text: 'ثبت درست بهای خرید = گزارش سود قابل اتکا' },
        ],
        interval: 0.8,
        tone: 'purple',
      },
      vo: 'اگر بهای خرید یک کالا مشخص نباشد، عدد سود آن هم قابل‌اعتماد نیست.',
    },
    {
      dur: 14,
      spec: {
        kind: 'financial-intelligence',
        title: 'سود را [g:بر پایه داده واقعی] بررسی کن',
        revenue: 120,
        cogs: 80,
        grossProfit: 40,
        verdict: 'حسابچه نتیجه فروش را با داده‌های ثبت‌شده بررسی می‌کند، نه با حدس!',
      },
      vo: 'حسابچه می‌تواند به بررسی نتیجه فروش کمک کند، به شرط آنکه داده‌های لازم درست ثبت شده باشند.',
    },
    {
      dur: 11,
      spec: {
        kind: 'split',
        title: 'محاسبه سود: تفاوت شفافیت با حدس',
        left: {
          title: 'روش تخمینی و حدسی',
          subtitle: 'خطر اعلام سود کاذب در کالا',
          points: [
            'بی‌اطلاعی از هزینه خرید بار جدید',
            'تخفیف دادن بیش از مارجین سود کالا',
            'کسری نقدینگی در پایان ماه',
          ],
          tone: 'red',
        },
        right: {
          title: 'گزارش داده‌محور حسابچه',
          subtitle: 'محاسبه بر اساس بهای ثبت‌شده',
          points: [
            'نمایش صریح وضعیت نامعلوم در کمبود داده',
            'گزارش سود ناخالص واقعی هر فاکتور',
            'تصمیم‌گیری آگاهانه برای خرید بعدی',
          ],
          tone: 'cyan',
        },
        dividerLabel: 'سود واقعی',
      },
      vo: 'وقتی داده کافی نیست، نباید عددی را به‌عنوان سود قطعی جا زد.',
    },
    ctaScene(11),
  ],
  'financial-intelligence',
  { noZoom: true },
)

// ─── 05. Internet disconnected; what still works? (45s) [Theme: Procedural-Spatial] ─
export const reel05 = reel(
  '05',
  'اینترنت قطع شد؛ چه چیزی هنوز کار می‌کند؟',
  [
    {
      dur: 5,
      spec: {
        kind: 'hook',
        label: 'پایداری عملیاتی حسابچه',
        lines: ['وقتی [r:اینترنت قطع می‌شود]…', 'کسب‌وکارت لنگ می‌ماند؟'],
        cards: [
          { icon: 'wifi-off', title: 'قطعی ناگهانی شبکه', sub: 'وسط روز کاری شلوغ', tone: 'red' },
          { icon: 'users', title: 'مشتری پای صندوق', sub: 'نیاز به فاکتور فوری', tone: 'purple' },
        ],
      },
      vo: 'اینترنت همیشه قابل‌اعتماد نیست؛ مخصوصاً وسط یک روز شلوغ کاری.',
    },
    {
      dur: 7,
      spec: {
        kind: 'mockup',
        device: 'phone',
        title: 'در اپ‌های پشتیبانی‌شده',
        subtitle: 'طراحی ویژه جریان‌های آفلاین فروشگاهی',
        screen: {
          type: 'pos',
          header: 'حالت محلی اپلیکیشن حسابچه',
          items: [
            { name: 'کالای بازرگانی کد ۱۰۱', qty: '۲ عدد', price: '۳٬۶۰۰' },
            { name: 'محصول تجاری کد ۲۰۲', qty: '۱ بسته', price: '۱٬۴۰۰' },
          ],
          totalLabel: 'جمع فروش محلی',
          totalValue: '۵٬۰۰۰',
        },
      },
      vo: 'حسابچه برای جریان‌های آفلاین در اپ‌های پشتیبانی‌شده طراحی شده است.',
    },
    {
      dur: 15,
      spec: {
        kind: 'queue',
        title: 'ثبت محلی [c:در صف آفلاین]',
        offlineLabel: 'حالت آفلاین (مغازه)',
        items: ['ثبت فاکتور شماره ۱۲۴۰', 'ثبت بیعانه نقدی مشتری', 'کسر موجودی کالا از حافظه محلی'],
        syncedLabel: 'اتصال برقرار شد — ارسال خودکار تغییرات در صف!',
        reconnectAt: 7,
      },
      vo: 'عملیات پشتیبانی‌شده را در اپ ادامه بده و وضعیت ثبت را بررسی کن.',
    },
    {
      dur: 10,
      spec: {
        kind: 'continuous-transform',
        title: 'پس از اتصال، [c:همگام‌سازی]',
        subtitle: 'انتقال خودکار فاکتورهای صف به پایگاه ابری',
        stages: [
          { at: 0.5, label: 'بررسی صحت صف فاکتورها', sub: 'بدون تداخل و بدون گم‌شدن ردیف‌ها' },
          { at: 5.0, label: 'تایید ثبت در سرور ابری', sub: 'به‌روز شدن مانده حساب‌ها' },
        ],
        tone: 'cyan',
      },
      vo: 'با برگشت اتصال، تغییراتِ در صف طبق سازوکار همگام‌سازی ارسال می‌شوند.',
    },
    ctaScene(8),
  ],
  'procedural-spatial',
  { noZoom: true },
)

// ─── 06. Multiple currencies in one business (50s) [Theme: Cyber-Emerald] ─
export const reel06 = reel(
  '06',
  'چند ارز در یک کسب‌وکار',
  [
    {
      dur: 5,
      spec: {
        kind: 'hook',
        label: 'معاملات چندارزی',
        lines: ['وقتی معامله‌ها با [c:یک ارز] نیستند…', 'چطور حساب‌ها رو منظم نگه می‌داری؟'],
        cards: [
          {
            icon: 'wallet',
            title: 'خرید و فروش چندارزی',
            sub: 'معاملات نقدی و اعتباری',
            tone: 'cyan',
          },
          {
            icon: 'wallet',
            title: 'تسویه با ارزهای مختلف',
            sub: 'واردات، صادرات و حواله‌ها',
            tone: 'purple',
          },
        ],
      },
      vo: 'در بعضی کسب‌وکارها، همه معامله‌ها با یک ارز انجام نمی‌شوند.',
    },
    {
      dur: 9,
      spec: {
        kind: 'mockup',
        device: 'window',
        title: 'ارز و نرخ را شفاف ثبت کن',
        screen: {
          type: 'invoice',
          header: 'فاکتور خرید ارزی کالا',
          items: [
            { name: 'کالای تجاری وارداتی', qty: '۱۰ واحد', price: '۵۰۰' },
            { name: 'نرخ تسعیر توافقی', qty: '۱', price: '۷۱.۵۰' },
          ],
          totalLabel: 'معادل به ارز پایه دفتر',
          totalValue: '۳۵٬۷۵۰',
        },
      },
      vo: 'ارز معامله و نرخ مورد استفاده باید روشن و قابل‌ردیابی باشد.',
    },
    {
      dur: 14,
      spec: {
        kind: 'ledger',
        title: 'نرخِ لازم را [r:جا نینداز]',
        name: 'شرکت بازرگانی پارس (حساب ارزی)',
        lines: [
          { label: 'فاکتور خرید کالا', amount: '۱٬۲۰۰' },
          { label: 'نرخ ثبت‌شده در فاکتور', amount: '۷۱.۵۰' },
          { label: 'معادل در دفتر کل', amount: '۸۵٬۸۰۰' },
        ],
        balanceFrom: 85800,
        balanceTo: 85800,
        unit: '',
        footer: 'ثبت شفاف ارز مبادله و نرخ قبل از نهایی‌کردن',
      },
      vo: 'اگر فرایند ثبت به نرخ نیاز دارد، پیش از نهایی‌کردن، مقدار لازم را بررسی کن.',
    },
    {
      dur: 11,
      spec: {
        kind: 'hub',
        title: 'تبدیل ارز، [g:فقط یک عدد نیست]',
        core: 'دفتر کل',
        coreSub: 'سیستم چندارزی',
        nodes: [
          { icon: 'wallet', label: 'نرخ تسعیر' },
          { icon: 'wallet', label: 'حواله ارزی' },
          { icon: 'wallet', label: 'سود و زیان تسعیر' },
          { icon: 'trend', label: 'ارز مبنا' },
        ],
      },
      vo: 'مانده‌ها، پرداخت‌ها و گزارش‌ها باید ارز را درست حفظ کنند؛ این بخش به دقت حسابداری نیاز دارد.',
    },
    ctaScene(11),
  ],
  'cyber-emerald',
)

// ─── 07. System stock differs from shelf (50s) [Theme: Obsidian-Cinematic] ─
export const reel07 = reel(
  '07',
  'موجودی سیستم با قفسه فرق دارد',
  [
    {
      dur: 5,
      spec: {
        kind: 'versus',
        title: 'سیستم: [c:۲۰ عدد] / قفسه: [r:۱۰ عدد]',
        right: { label: 'موجودی قفسه مغازه', value: '۱۰ واحد', tone: 'red' },
        left: { label: 'عدد در سیستم', value: '۲۰ واحد', tone: 'cyan' },
        verdict: 'مغایرت موجودی یعنی تصمیم اشتباه در خرید و فروش',
      },
      vo: 'اگر عدد سیستم با قفسه فرق داشته باشد، تصمیم خرید و فروش سخت می‌شود.',
    },
    {
      dur: 8,
      spec: {
        kind: 'stagger',
        title: 'اختلاف را [c:پیدا و مستند] کن',
        header: ['مسیر بررسی', 'اقدام انبارداری'],
        rows: [
          { icon: 'boxes', text: 'شمارش فیزیکی دوره‌ای کالاها' },
          { icon: 'receipt', text: 'کنترل حواله‌های خروج ثبت‌نشده' },
          { icon: 'trash', text: 'ثبت صریح ضایعات و شکستگی بار' },
        ],
        interval: 0.8,
        tone: 'purple',
      },
      vo: 'حدس‌زدن کافی نیست؛ باید اختلاف را بررسی و ثبت کنی.',
    },
    {
      dur: 14,
      spec: {
        kind: 'mockup',
        device: 'window',
        title: 'موجودی به تفکیک انبار',
        screen: {
          type: 'dashboard',
          header: 'کاردکس تفکیکی انبارها',
          items: [
            { name: 'انبار مرکزی (کابل)', qty: '۱۵۰ کیسه', price: 'موجود' },
            { name: 'انبار مغازه (فروشگاهی)', qty: '۱۰ کیسه', price: 'نیاز به شارژ' },
          ],
          totalLabel: 'مجموع موجودی واقعی',
          totalValue: '۱۶۰ کیسه',
        },
      },
      vo: 'اگر چند انبار داری، موجودی را در محل درستش پیگیری کن.',
    },
    {
      dur: 12,
      spec: {
        kind: 'compare',
        title: 'شمارش و بررسی اختلاف',
        columns: ['قلم کالا', 'ثبت سیستم', 'شمارش فیزیکی', 'اقدام'],
        interval: 0.8,
        rows: [
          { label: 'کالای بازرگانی کد ۱۰۱', marks: ['part', 'yes', 'yes'] },
          { label: 'محصول تجاری کد ۲۰۲', marks: ['no', 'yes', 'yes'] },
          { label: 'کالای مصرفی کد ۳۰۳', marks: ['yes', 'yes', 'yes'] },
        ],
      },
      vo: 'شمارش فیزیکی را با عدد ثبت‌شده مقایسه کن و اصلاح را طبق روال مجاز انجام بده.',
    },
    ctaScene(11),
  ],
  'obsidian-cinematic',
)

// ─── 08. Who made what change? (45s) [Theme: Midnight-Gold] ───────────────
export const reel08 = reel(
  '08',
  'چه کسی چه تغییری داد؟',
  [
    {
      dur: 5,
      spec: {
        kind: 'hook',
        label: 'امنیت و کنترل دسترسی',
        lines: ['یک فاکتور تغییر کرده؛', '[r:این تغییر را چه کسی انجام داد]؟'],
        cards: [
          { icon: 'user', title: 'چند کارمند', sub: 'با یک حساب مشترک؟', tone: 'red' },
          { icon: 'alert', title: 'عدم شفافیت در خطا', sub: 'مسئولیت نامشخص', tone: 'purple' },
        ],
      },
      vo: 'وقتی چند نفر با سیستم کار می‌کنند، حدس‌زدن درباره تغییرات کافی نیست.',
    },
    {
      dur: 9,
      spec: {
        kind: 'versus',
        title: 'دسترسی روشن، [c:مسئولیت روشن]',
        right: { label: 'رمز مشترک بدون تفکیک', value: 'خطر خطا', tone: 'red' },
        left: { label: 'نقش اختصاصی کارمند', value: 'ردیابی شفاف', tone: 'cyan' },
        verdict: 'حساب‌های مشترک، تشخیص مسئول هر عملیات را دشوار می‌کنند',
      },
      vo: 'حساب‌های مشترک، تشخیص مسئول هر عملیات را دشوار می‌کنند.',
    },
    {
      dur: 14,
      spec: {
        kind: 'stagger',
        title: 'هر نقش، [g:دسترسی متناسب با مسئولیت]',
        header: ['سمت سازمانی', 'محدوده مجاز'],
        rows: [
          { icon: 'receipt', text: 'صندوقدار: فقط صدور فاکتور و دریافت پول' },
          { icon: 'boxes', text: 'انباردار: ثبت ورود و خروج حواله بار' },
          { icon: 'shield', text: 'مدیر و حسابدار: دسترسی کامل به سود و ترازنامه' },
        ],
        interval: 0.8,
        tone: 'cyan',
      },
      vo: 'دسترسی هر همکار را متناسب با مسئولیتش تنظیم کن.',
    },
    {
      dur: 9,
      spec: {
        kind: 'day',
        title: 'تاریخچه فعالیت و لاگ دقیق',
        moments: [
          { time: '۱۰:۱۵', icon: 'receipt', text: 'ویرایش قیمت فاکتور توسط کاربر فروشنده' },
          { time: '۱۰:۱۶', icon: 'shield', text: 'ثبت لاگ با ساعت، شناسه کاربر و آی‌پی' },
          { time: '۱۰:۱۸', icon: 'check', text: 'تایید تغییر توسط مدیر سیستم' },
        ],
      },
      vo: 'هرجا تاریخچه فعالیت در دسترس است، جزئیات ثبت‌شده را برای بررسی دنبال کن.',
    },
    ctaScene(8),
  ],
  'midnight-gold',
)

// ─── 09. Start from Excel, not from scratch (45s) [Theme: Procedural-Spatial] ─
export const reel09 = reel(
  '09',
  'از اکسل شروع کن، نه از صفر',
  [
    {
      dur: 5,
      spec: {
        kind: 'hook',
        label: 'انتقال آسان داده‌ها',
        lines: ['سال‌ها اطلاعات جمع کرده‌ای؛', '[c:اطلاعاتت را دوباره تایپ نکن]!'],
        cards: [
          { icon: 'sheet', title: 'فایل اکسل موجود', sub: 'صدها کالا و مشتری', tone: 'purple' },
          { icon: 'sync', title: 'ورود به حسابچه', sub: 'بدون شروع از صفر', tone: 'cyan' },
        ],
      },
      vo: 'سال‌ها اطلاعات کالا و مشتری جمع کرده‌ای؛ شروع دوباره نباید یعنی تایپ دوباره همه‌چیز.',
    },
    {
      dur: 8,
      spec: {
        kind: 'mockup',
        device: 'window',
        title: 'از فایل موجود شروع کن',
        screen: {
          type: 'invoice',
          header: 'ورود اطلاعات کالا از اکسل',
          items: [
            { name: 'شناسایی خودکار فایل اکسل', price: 'تایید شد' },
            { name: 'قالب‌های پشتیبانی‌شده', price: 'CSV / XLSX' },
          ],
          totalLabel: 'ردیف‌های آماده بررسی',
          totalValue: '۲۵۰ قلم کالا',
        },
      },
      vo: 'اگر فایل با قالب‌های پشتیبانی‌شده سازگار باشد، می‌توانی از فرایند ورود اطلاعات استفاده کنی.',
    },
    {
      dur: 14,
      spec: {
        kind: 'split',
        title: 'ستون‌های مبهم را بررسی کن',
        left: {
          title: 'فایل اکسل شما',
          subtitle: 'نام، قیمت، موجودی، بارکد',
          points: [
            'ستون نام کالا در فایل اکسل',
            'ستون موجودی اولیه انبار',
            'ستون قیمت خرید پایه کالا',
          ],
          tone: 'purple',
        },
        right: {
          title: 'فیلدهای استاندارد حسابچه',
          subtitle: 'نگاشت با تایید شما، نه حدس',
          points: [
            'اتصال به عنوان کالا در سیستم',
            'اتصال به موجودی انبار منتخب',
            'ثبت بهای تمام‌شده پایه کالا',
          ],
          tone: 'cyan',
        },
        dividerLabel: 'نگاشت دقیق',
      },
      vo: 'نگاشت ستون‌ها را بررسی کن؛ تصمیم مبهم را به خودت واگذار کن، نه به حدس سیستم.',
    },
    {
      dur: 10,
      spec: {
        kind: 'compare',
        title: 'قبل از ثبت، بازبینی کن',
        columns: ['ردیف', 'کد کالا', 'اعتبارسنجی', 'نتیجه'],
        interval: 0.8,
        rows: [
          { label: 'کالای ۱۰۱ (موجودی مجاز)', marks: ['yes', 'yes', 'yes'] },
          { label: 'کالای ۱۰۲ (قیمت منفی)', marks: ['part', 'no', 'no'] },
          { label: 'کالای ۱۰۳ (تأیید استاندارد)', marks: ['yes', 'yes', 'yes'] },
        ],
      },
      vo: 'پیش از ثبت نهایی، نتیجه و خطاهای هر ردیف را مرور کن.',
    },
    ctaScene(8),
  ],
  'procedural-spatial',
)

// ─── 10. A workday with Hisabche (59s) [Theme: Dark-Neon] ─────────────────
export const reel10 = reel(
  '10',
  'یک روز کاری با حسابچه',
  [
    {
      dur: 5,
      spec: {
        kind: 'hook',
        label: 'روزمرگی یک کاسب',
        lines: ['کرکره مغازه بالا می‌رود؛', '[c:یک روز شلوغ دیگر]'],
        cards: [
          { icon: 'store', title: 'آغاز روز کاری', sub: 'تصمیم‌های کوچک و بزرگ', tone: 'cyan' },
          { icon: 'trend', title: 'مدیریت منظم مالی', sub: 'بدون گم‌شدن در اسناد', tone: 'purple' },
        ],
      },
      vo: 'روز کاری با چند تصمیم کوچک شروع می‌شود.',
    },
    {
      dur: 10,
      spec: {
        kind: 'mockup',
        device: 'window',
        title: 'صبح: ثبت فروش',
        screen: {
          type: 'pos',
          header: 'صندوق فروش فروشگاهی حسابچه',
          items: [
            { name: 'کالای بازرگانی کد ۱۰۱', qty: '۲ عدد', price: '۱٬۹۰۰' },
            { name: 'محصول تجاری کد ۲۰۲', qty: '۵ بسته', price: '۱٬۲۵۰' },
          ],
          totalLabel: 'فاکتور صبحگاهی',
          totalValue: '۳٬۱۵۰',
        },
      },
      vo: 'فروش را ثبت کن و اطلاعات فاکتور را همان‌جا نگه دار.',
    },
    {
      dur: 10,
      spec: {
        kind: 'ledger',
        title: 'ظهر: پیگیری حساب مشتری',
        name: 'مشتری بازرگانی (کد ۳۰۲)',
        lines: [
          { label: 'خرید پارت اول', amount: '۱۵٬۰۰۰' },
          { label: 'دریافت نقدی ظهر', amount: '۱۰٬۰۰۰-' },
        ],
        balanceFrom: 15000,
        balanceTo: 5000,
        unit: '',
        footer: 'سابقه ثبت‌شده در پرونده مشتری',
      },
      vo: 'اگر مشتری حساب باز دارد، سابقه ثبت‌شده‌اش را بررسی کن.',
    },
    {
      dur: 10,
      spec: {
        kind: 'chart',
        title: 'بعدازظهر: بررسی موجودی کالا',
        chartType: 'bar',
        kpis: [
          { label: 'موجودی کالای پرفروش', value: 340, unit: 'عدد', tone: 'cyan' },
          { label: 'اقلام نیازمند شارژ', value: 4, unit: 'قلم', tone: 'red' },
        ],
        data: [
          { label: 'کالای A', value: 80 },
          { label: 'کالای B', value: 65 },
          { label: 'کالای C', value: 40 },
          { label: 'کالای D', value: 90 },
        ],
      },
      vo: 'تغییرات موجودی را از روی اسناد و ثبت‌های مربوط پیگیری کن.',
    },
    {
      dur: 10,
      spec: {
        kind: 'financial-intelligence',
        title: 'پایان روز: مرور اطلاعات',
        revenue: 160,
        cogs: 105,
        grossProfit: 55,
        verdict: 'در پایان روز، اطلاعاتی را ببین که برای تصمیم فردا لازم داری.',
      },
      vo: 'در پایان روز، اطلاعاتی را ببین که برای تصمیم فردا لازم داری.',
    },
    {
      dur: 8,
      spec: {
        kind: 'stagger',
        title: 'کمتر دنبال عددها بگرد',
        header: ['دستاورد روزانه', 'نتیجه عملیاتی'],
        rows: [
          { icon: 'check', text: 'اطلاعات لازم روشن و در دسترس است' },
          { icon: 'shield', text: 'سرمایه و دفاتر مالی ایمن و منظم است' },
          { icon: 'sparkles', text: 'پایان روز با آرامش و تصمیم‌گیری آگاهانه' },
        ],
        interval: 0.8,
        tone: 'cyan',
      },
      vo: 'قرار نیست نرم‌افزار جای تصمیم تو را بگیرد؛ باید اطلاعات لازم را روشن‌تر کند.',
    },
    ctaScene(6),
  ],
  'dark-neon',
)
