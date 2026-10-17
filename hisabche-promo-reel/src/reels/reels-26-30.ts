// ============================================
// Hisabche Motion Design Studio — Reels 26 to 30
//
// 5-Layer Product-Led SaaS Storytelling Engine
// Compliant with CLAUDE.md & SAAS_MOTION_STANDARDS.md:
// - Mandatory 9-Step SaaS Story Matrix attached to every reel
// - 5 to 6 Purpose-Bound Motion Operators per reel (Restraint Rule)
// - The 20% Card Quota (max 1 card scene per reel)
// - Rotating Layout Topologies (Split-Screen, Asymmetric, Isometric 2.5D, Full-Bleed, Camera Canvas)
// - Rotating Art Directions (Obsidian, Financial, Spatial, Kinetic, Swiss)
// - Zero hardcoded currency names, Generic B2B goods, 100% Dark themes
// - Exactly 59s duration per reel with frame-deterministic math
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
// Reel 26: «کی فاکتور رو پاک کرد؟ ردیابی اسناد و امنیت مالی» (59s)
// Persona: Retail Shopkeeper / Store Manager
// Theme: obsidian-cinematic (Deep Obsidian, security lock, laser cyan/violet)
// Dominant Layout: Split-Screen (Audit log vs Permission Lock)
// Hook: Micro-Disaster (Disappearing high-value invoice in the morning)
// Operators (5): Laser Caret, Unraveling Conduit, Camera Portal, Isometric Explosion, Odometer Roll
// ─────────────────────────────────────────────────────────────────────────────

export const reel26 = reel(
  '26',
  'کی فاکتور رو پاک کرد؟ ردیابی اسناد و امنیت مالی',
  [
    // Scene 1: The Micro-Disaster Hook (7s) — Split-Screen Dilemma
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'هشدار امنیتی فروشگاه',
        lines: ['وارد مغازه شدی و…', 'یکی از فاکتورها [r:غیب شده است!]'],
        cards: [
          { icon: 'trash', title: 'فاکتور حذف‌شده', sub: 'سند مالی از سیستم پاک شد', tone: 'red' },
          {
            icon: 'users',
            title: 'عدم مسئولیت‌پذیری',
            sub: 'صندوق‌دار انکار می‌کند',
            tone: 'purple',
          },
        ],
      },
      vo: 'صبح رسیدی پای دخل و متوجه شدی یکی از فاکتورهای سنگین پاک شده؛ نه کسی گردن می‌گیره، نه ردی باقی مونده!',
    },
    // Scene 2: The Audit Trail Live Stream (18s) — Full inspection
    {
      dur: 18,
      spec: {
        kind: 'stagger',
        title: 'ردیابی ثانیه‌ای [c:تمام تغییرات اسناد]',
        header: ['عملیات انجام شده توسط پرسنل', 'تاریخ و ساعت دقیق'],
        interval: 1.1,
        tone: 'cyan',
        rows: [
          { icon: 'check', text: 'ویرایش قیمت فروش توسط صندوق‌دار ۱ (ساعت ۱۱:۲۳)' },
          { icon: 'receipt', text: 'تلاش برای حذف فاکتور خرید توسط کاربر میهمان (مسدود شد)' },
          { icon: 'shield', text: 'تایید حواله مرجوعی کالا با امضای دیجیتال مدیر' },
          { icon: 'history', text: 'بازیابی فوری سند حذف‌شده به همراه تاریخچه اولیه' },
        ],
      },
      vo: 'در حسابچه هیچ عملیاتی پنهان نمی‌ماند. ثانیه به ثانیه مشخصه چه کسی، با چه نام کاربری، در چه ساعتی فاکتور را ویرایش یا صادر کرده است.',
    },
    // Scene 3: Role-Based Access Control Architecture (14s) — Permission lock
    {
      dur: 14,
      spec: {
        kind: 'branch',
        cards: [
          {
            icon: 'store',
            title: 'صندوق‌دار فروشگاه',
            sub: 'فقط صدور فاکتور و دریافت وجه',
            tone: 'cyan',
          },
          {
            icon: 'briefcase',
            title: 'مدیریت و حسابدار',
            sub: 'دسترسی به سود، گزارشات و لغو اسناد',
            tone: 'purple',
          },
        ],
        question: 'آیا صندوق‌دار باید سود خالص و قیمت خرید بنکدار را ببیند؟',
        answer: 'خیر! حسابچه قیمت خرید و سود را از دید پرسنل قفل می‌کند.',
        badge: 'امنیت ۱۰۰٪ اختیارات مالی',
      },
      vo: 'به هر پرسنل فقط دسترسی کار خودش را بده. صندوق‌دار فقط فاکتور می‌زنه، بدون اینکه سود خالص یا قیمت خرید عمده را ببیند.',
    },
    // Scene 4: Financial Recovery & Equilibrium (12s)
    {
      dur: 12,
      spec: {
        kind: 'financial-intelligence',
        title: 'تطبیق تراز دخل و [c:رفع کسری صندوق]',
        revenue: 42000000,
        cogs: 28000000,
        grossProfit: 14000000,
        verdict: 'تمام اسناد تطبیق داده شد؛ صفر درصد ابهام یا کسری در دخل',
      },
      vo: 'با ردیابی هوشمند حسابچه، جلوی خطای انسانی و سوءاستفاده‌های پنهان مالی در فروشگاه برای همیشه گرفته می‌شود.',
    },
    // Scene 5: Dedicated Security CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | امنیت مطلق اسناد و دسترسی پرسنل',
        boxes: [
          {
            lead: 'برای فعال‌سازی سیستم ردیابی اسناد…',
            action: 'کامنت کنید:',
            word: 'امنیت',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی رایگان نقش‌های کاربری…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'خیال خودت رو از امنیت دخل و اسناد راحت کن. همین حالا حسابچه رو رایگان امتحان کن.',
    },
  ],
  'obsidian-cinematic',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'صندوق‌دار یا پرسنل فاکتور را اشتباه زده یا پاک کرده و هیچ ردی باقی نمانده؛ ترس از سوءاستفاده مالی.',
    oldWorkflow:
      'نرم‌افزارهای قفل‌نشده بدون ثبت تاریخچه که هرکسی می‌تواند فاکتورها را بدون ثبت تغییر دهد.',
    friction: 'اختلاس پنهان، خطای صندوق‌دار که به گردن مشتری می‌افتد، گم شدن مانده حساب‌ها.',
    hisabcheAction:
      'تعریف نقش‌های اختصاصی (صندوق‌دار، انباردار، مدیر مالی) + سیستم ردیابی تغییرات (Audit Trail).',
    automatedResult:
      'ثبت لاگ ضدگلوله از نام کاربر، ساعت، مبلغ اولیه و تغییر داده شده با امکان بازیابی فوری.',
    businessOutcome: 'صفر شدن خطای پرسنل و سوءاستفاده مالی در فروشگاه؛ امنیت ۱۰۰٪ دفاتر.',
    emotionalPayoff: 'آرامش خاطر کامل مدیر هنگام ترک فروشگاه؛ سپردن دخل به صندوق‌دار با خیال راحت.',
    cta: 'کامنت کنید: امنیت | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Laser Caret Typewriter',
      'Unraveling Border Conduit',
      'Camera Portal Pass-Through',
      'Isometric UI Layer Explosion',
      'Odometer Slot Roll',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Reel 27: «چک و قسط سررسید؛ وصول بدون فراموشی» (59s)
// Persona: Wholesaler & Retail Distributor
// Theme: financial-intelligence (Deep emerald matrix, calendar flow, balance scale)
// Dominant Layout: Asymmetrical Grid (Calendar schedule vs Cashflow recovery)
// Hook: Silent Profit Leak (Overdue cheque forgotten while supplier demands cash)
// Operators (5): Radial Clock Dial, Double-Entry Balance Scale, Highlighter Sweep, Snake Timeline, Odometer Roll
// ─────────────────────────────────────────────────────────────────────────────

export const reel27 = reel(
  '27',
  'چک و قسط سررسید؛ وصول به موقع بدون فراموشی',
  [
    // Scene 1: The Timeline Schedule Hook (11s) — Featuring Radial Clock Choreography
    {
      dur: 11,
      spec: {
        kind: 'day',
        title: 'چرخه سررسید چک‌ها و [c:خواب سرمایه]',
        moments: [
          { time: '۰۹:۰۰', icon: 'receipt', text: 'دریافت چک مدت‌دار از خریدار عمده' },
          { time: '۱۴:۰۰', icon: 'history', text: 'نزدیک شدن به موعد سررسید وصول' },
          { time: '۱۹:۰۰', icon: 'wallet', text: 'موعد پرداخت چک به بنکدار اصلی' },
          { time: '۲۱:۰۰', icon: 'moon', text: 'خطر برگشت چک به دلیل فراموشی وصولی‌ها!' },
        ],
      },
      vo: 'بار رو تحویل دادی و چک گرفتی؛ اما موعد سررسید فراموش شد و درست زمانی که باید به بنکدار پول بدی، حسابت خالیه!',
    },
    // Scene 2: Cheque Maturation & Cashflow Drainage (18s) — Rising waterfall
    {
      dur: 18,
      spec: {
        kind: 'profit-waterfall-demo',
        title: 'جریان نقدینگی [c:مطالبات وصولی] در برابر [r:تعهدات بانکی]',
        grossRevenue: 64000000,
        cogs: 42000000,
        expenses: 12000000,
      },
      vo: 'حسابچه تقویم سررسید تمام چک‌ها و اقساط رو هوشمند مدیریت می‌کنه؛ قبل از موعد پیامک یادآوری می‌فرسته و خواب پول رو به صفر می‌رسونه.',
    },
    // Scene 3: Double-Entry Balance & Cheque Clearance (13s)
    {
      dur: 13,
      spec: {
        kind: 'financial-intelligence',
        title: 'راس‌گیری خودکار و [g:تعادل نقدینگی]',
        revenue: 64000000,
        cogs: 42000000,
        grossProfit: 10000000,
        verdict: 'پاس شدن خودکار اسناد در موعد سررسید؛ تراز ۱۰۰٪ بانک و صندوق',
      },
      vo: 'به محض پاس شدن چک در بانک، مانده مشتری تسویه می‌شه و سند دوبل دفترکل بدون ۱ ثانیه کار دستی ثبت می‌گردد.',
    },
    // Scene 4: Cashflow Trend Chart (10s)
    {
      dur: 10,
      spec: {
        kind: 'chart',
        title: 'پیش‌بینی نقدینگی [c:۳۰ روز آینده]',
        chartType: 'area',
        kpis: [
          { label: 'چک‌های در راه وصول', value: 64000000, unit: '', tone: 'cyan' },
          { label: 'وصولی به موقع', value: 58000000, unit: '', trend: '+۹۴٪', tone: 'green' },
        ],
        data: [
          { label: 'هفته ۱', value: 12000000 },
          { label: 'هفته ۲', value: 18000000 },
          { label: 'هفته ۳', value: 24000000 },
          { label: 'هفته ۴', value: 32000000 },
        ],
      },
      vo: 'همیشه یک قدم از بازار جلوتر باش و نقدینگی هفته‌های آینده‌ات رو از قبل با شفافیت ببین.',
    },
    // Scene 5: Dedicated Cheque CTA (7s)
    {
      dur: 7,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | مدیریت بی‌نقص چک، اقساط و نقدینگی',
        boxes: [
          {
            lead: 'برای ساماندهی فوری چک‌های مدت‌دار…',
            action: 'کامنت کنید:',
            word: 'چک',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی هوش مالی حسابچه…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 3.5,
      },
      vo: 'چک‌هات رو به موقع وصول کن و اعتبارت رو در بازار حفظ کن. همین حالا حسابچه رو امتحان کن.',
    },
  ],
  'financial-intelligence',
  {
    targetCustomer: 'wholesaler',
    customerPain:
      'فراموش کردن تاریخ سررسید چک‌ها و اقساط مشتریان؛ گیر افتادن در بدهی به تأمین‌کننده به خاطر عدم وصول به موقع.',
    oldWorkflow: 'نوشتن تاریخ چک‌ها در تقویم رومیزی یا دفترچه سررسید که همیشه جا می‌ماند.',
    friction:
      'خوابیدن سرمایه، چک برگشتی بی‌خبر، بدحسابی جلوی بنکدار اصلی به خاطر فراموشی وصولی‌ها.',
    hisabcheAction:
      'ثبت چک و قسط در حسابچه با سررسید هوشمند، هشدار خودکار پیامکی به مشتری و راس‌گیری اتوماتیک.',
    automatedResult:
      'محاسبه خواب پول، لیست وصولی‌های هفته آینده و بستن خودکار سند به محض پاس شدن چک.',
    businessOutcome: 'جلوگیری از قفل شدن نقدینگی و وصول ۱۰۰٪ به موقع مطالبات.',
    emotionalPayoff: 'پایان دلهره چک‌های پاس‌نشده و شرمندگی مالی در بازار.',
    cta: 'کامنت کنید: چک | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Radial Clock Dial & Progress Ring',
      'Double-Entry Balance Scale',
      'Highlighter Sweep',
      'Snake / Bezier Timeline Path',
      'Odometer Slot Roll',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Reel 28: «دو مغازه، یک صاحب؛ مدیریت چند شعبه بدون مغایرت» (59s)
// Persona: Multi-Store Retailer & Warehouse Network
// Theme: procedural-spatial (Spatial coordinate grid, vector transfer flows, cyan/indigo)
// Dominant Layout: Isometric 2.5D (Branch 1, Branch 2, Central Warehouse spatial mesh)
// Hook: Binary Dilemma (Customer wants item at Branch 1, clerk says out of stock, while Branch 2 has 20 units)
// Operators (5): Multi-Warehouse Mesh, Camera Portal, Magnetic Particles, Split-Screen Before/After, Odometer Roll
// ─────────────────────────────────────────────────────────────────────────────

export const reel28 = reel(
  '28',
  'دو مغازه، یک صاحب؛ مدیریت چند شعبه بدون مغایرت',
  [
    // Scene 1: The Binary Branch Dilemma Hook (7s)
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'معمای موجودی شعب',
        lines: ['مشتری کالا را می‌خواهد،', 'شعبه ۱ می‌گوید: [r:موجود نداریم!]'],
        cards: [
          { icon: 'store', title: 'شعبه بازار', sub: 'قفسه خالی، مشتری از دست رفت', tone: 'red' },
          {
            icon: 'boxes',
            title: 'شعبه مرکزی',
            sub: 'کارتن‌ها در انبار خاک می‌خورند',
            tone: 'purple',
          },
        ],
      },
      vo: 'مشتری تو شعبه ۱ جنس می‌خواد؛ فروشنده می‌گه تموم کردیم! در حالی که همون کالا تو شعبه ۲ داره خاک می‌خوره!',
    },
    // Scene 2: The Multi-Warehouse Transfer Mesh (18s) — Spatial 2.5D coordination
    {
      dur: 18,
      spec: {
        kind: 'warehouse-movement-demo',
        title: 'انتقال کالا بین [c:شعب و انبارها] بدون مغایرت',
        transitAt: 4.5,
        arriveAt: 12.0,
      },
      vo: 'در حسابچه، موجودی تمام شعب پای صندوق جلوی چشمته. با یک کلیک حواله انتقال داخلی صادر می‌شه و کالا بدون کسری جابه‌جا می‌گردد.',
    },
    // Scene 3: Centralized Multi-Branch Hub (14s)
    {
      dur: 14,
      spec: {
        kind: 'hub',
        title: 'مدیریت متمرکز [g:تمام فروشگاه‌ها] در یک پنل',
        core: 'مالک کسب‌وکار',
        coreSub: 'مدیریت متمرکز شعب',
        nodes: [
          { icon: 'store', label: 'شعبه بازار' },
          { icon: 'store', label: 'شعبه پاساژ' },
          { icon: 'boxes', label: 'انبار مرکزی' },
          { icon: 'truck', label: 'ناوگان پخش' },
        ],
      },
      vo: 'دیگر نیازی به تماس تلفنی و عکس فرستادن از فاکتور نیست. دخل، انبار و طلب‌های هر دو مغازه همزمان در جیب شماست.',
    },
    // Scene 4: Comparative Accuracy Matrix (12s)
    {
      dur: 12,
      spec: {
        kind: 'compare',
        title: 'روش سنتی در برابر [c:همگام‌سازی ابری حسابچه]',
        columns: ['قابلیت هماهنگی', 'تماس تلفنی', 'ثبت دستی', 'حسابچه'],
        rows: [
          { label: 'استعلام موجودی شعب پای صندوق', marks: ['no', 'no', 'yes'] },
          { label: 'انتقال کالا با حواله دوطرفه', marks: ['no', 'part', 'yes'] },
          { label: 'تراز متمرکز دخل تمام فروشگاه‌ها', marks: ['no', 'no', 'yes'] },
        ],
      },
      vo: 'سرعت گردش کالاهات رو دو برابر کن و جلوی خریدهای اشتباه و خواب سرمایه در شعب رو بگیر.',
    },
    // Scene 5: Dedicated Multi-Branch CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | اتصال هوشمند تمام شعب و انبارها',
        boxes: [
          {
            lead: 'برای اتصال شعب و مدیریت متمرکز…',
            action: 'کامنت کنید:',
            word: 'شعبه',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی رایگان چند شعبه…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'چند مغازه رو مثل یک فروشگاه منسجم مدیریت کن. همین حالا حسابچه رو رایگان شروع کن.',
    },
  ],
  'procedural-spatial',
  {
    targetCustomer: 'wholesaler',
    customerPain:
      'داشتن ۲ یا چند فروشگاه و بی‌خبری از موجودی و دخل شعب دیگر؛ از دست دادن مشتری به خاطر عدم اطلاع از کالای شعبه کناری.',
    oldWorkflow: 'تماس تلفنی مداوم با شاگرد مغازه دیگر، واتساپ زدن و ارسال عکس فاکتور کاغذی.',
    friction:
      'خرید دوباره کالایی که در شعبه دیگر خاک می‌خورد، فروش همزمان ۱ کالا به دو مشتری مختلف، مغایرت انبار بین شعب.',
    hisabcheAction:
      'تعریف چند شعبه و چند انبار در یک حساب کاربری با دسترسی مستقل برای هر فروشنده و دید متمرکز برای مالک.',
    automatedResult:
      'مشاهده آنی موجودی تمام شعب پای صندوق، صدور حواله انتقال داخلی با تأیید دوطرفه.',
    businessOutcome: 'افزایش ۴۰ درصدی سرعت گردش کالا و صفر شدن خریدهای تکراری و اشتباه.',
    emotionalPayoff: 'مدیریت همزمان ۵ مغازه از روی یک گوشی بدون نیاز به حضور فیزیکی در بازار.',
    cta: 'کامنت کنید: شعبه | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Multi-Warehouse Transfer Mesh',
      'Camera Portal Pass-Through',
      'Magnetic Particle Stream',
      'Split-Screen Before / After',
      'Odometer Slot Roll',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Reel 29: «از مواد اولیه تا محصول نهایی؛ حسابداری تولید» (59s)
// Persona: Manufacturing Workshop & Production Manager
// Theme: kinetic-manifesto (Brutalist industrial, heavy red/amber typography)
// Dominant Layout: Full-Bleed Text & BOM Assembly Recipe
// Hook: Manual Interrupt (Still estimating production costing on paper with raw material inflation?)
// Operators (5): Text Stencil Knockout Mask, Baseline Curtain Rise, Isometric UI Layer Explosion, Profit Waterfall Drain, Kinetic Weight Pulse
// ─────────────────────────────────────────────────────────────────────────────

export const reel29 = reel(
  '29',
  'از مواد اولیه تا محصول نهایی؛ حسابداری تولید',
  [
    // Scene 1: The Manual Production Interrupt (6s) — Kinetic Manifesto
    {
      dur: 6,
      spec: {
        kind: 'kinetic',
        headline: 'تولید می‌کنی؛ اما [r:با چه بهای تمام‌شده‌ای؟]',
        words: ['مواد اولیه گران شد،', 'قیمت فروش تغییر نکرد؛', 'داری با ضرر تولید می‌کنی!'],
        tone: 'red',
      },
      vo: 'صبر کن! با این همه نوسان قیمت مواد اولیه، هنوز داری قیمت تمام‌شده محصول کارگاه رو چشمی حساب می‌کنی؟',
    },
    // Scene 2: BOM Assembly Recipe Flow (18s) — Raw materials to finished good
    {
      dur: 18,
      spec: {
        kind: 'pile',
        title: 'تبدیل خودکار [c:مواد اولیه] به [g:محصول استاندارد]',
        papers: [
          { icon: 'boxes', label: 'ماده اولیه اصلی کد ۱۰۱ (کسر از انبار مواد)' },
          { icon: 'factory', label: 'قطعه جانبی کد ۲۰۲ (محاسبه بهای خرید)' },
          { icon: 'users', label: 'سربار و دستمزد مستقیم خط مونتاژ' },
          { icon: 'package', label: 'بسته‌بندی و لیبل‌گذاری نهایی' },
        ],
        counter: 'تولید {n} قلم کالا با فرمول ساخت مصوب',
        merge: 'محصول نهایی کد ۵۰۰ با بهای تمام‌شده دقیق',
      },
      vo: 'در حسابچه فرمول ساخت رو یک بار تعریف می‌کنی؛ با ثبت هر تیراژ تولید، مواد اولیه خودکار کسر و بهای روز محصول محاسبه می‌شود.',
    },
    // Scene 3: Production Cost Breakdown (14s) — Waterfall of manufacturing costs
    {
      dur: 14,
      spec: {
        kind: 'profit-waterfall-demo',
        title: 'تفکیک اجزای [c:بهای ساخت] از [g:حاشیه سود تولید]',
        grossRevenue: 85000000,
        cogs: 55000000,
        expenses: 12000000,
      },
      vo: 'ضایعات، افت بار و نوسان قیمت خرید آهن و قطعات دقیق محاسبه می‌شه تا سود خالص هر بچ تولیدی شفاف دربیاد.',
    },
    // Scene 4: Margin Protection & Breakeven (13s)
    {
      dur: 13,
      spec: {
        kind: 'financial-intelligence',
        title: 'نقطه سر‌به‌سر و [g:تعیین قیمت فروش سودآور]',
        revenue: 85000000,
        cogs: 55000000,
        grossProfit: 18000000,
        verdict: 'سود خالص واقعی هر قطعه: ۱۸٬۰۰۰ بدون توهم محاسباتی',
      },
      vo: 'دیگر نگران فروش زیر قیمت بازار نباش. حسابچه بهت می‌گه با قیمت روز مواد، محصولت را دقیقاً چند قیمت‌گذاری کنی.',
    },
    // Scene 5: Dedicated Production CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | سیستم یکپارچه فرمول تولید و بهای ساخت',
        boxes: [
          {
            lead: 'برای فعال‌سازی ماژول فرمول ساخت کارگاه…',
            action: 'کامنت کنید:',
            word: 'تولید',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی رایگان حسابداری صنعتی…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'کارگاهت رو اصولی و سودآور اداره کن. همین حالا حسابچه رو رایگان امتحان کن.',
    },
  ],
  'kinetic-manifesto',
  {
    targetCustomer: 'workshop-producer',
    customerPain:
      'تولید کارگاهی شلوغه اما صاحب کارگاه نمی‌دونه با افزایش قیمت مواد اولیه، هر عدد محصول نهایی چقدر براش تموم شده.',
    oldWorkflow: 'محاسبه سرانگشتی بهای تمام شده روی کاغذ و فروش محصول به قیمت پارسال.',
    friction: 'فروش با ضرر به خاطر محاسبه نکردن ضایعات، دستمزد کارگر و نوسان قیمت خرید مواد اولیه.',
    hisabcheAction:
      'تعریف فرمول ساخت استاندارد (BOM) در حسابچه؛ با ثبت تولید، مواد کسر و بهای تمام شده لایه‌ای محاسبه می‌شود.',
    automatedResult:
      'محاسبه خودکار بهای هر واحد کالای تولیدی بر اساس قیمت روز خرید مواد و ثبت مستقیم در کاردکس.',
    businessOutcome: 'تعیین قیمت فروش سودآور و تضمین سود خالص هر سفارش تولیدی.',
    emotionalPayoff: 'تبدیل کارگاه سنتی و پرهزینه به یک خط تولید مهندسی‌شده و پول‌ساز.',
    cta: 'کامنت کنید: تولید | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Text Stencil Knockout Mask',
      'Baseline Curtain Rise',
      'Isometric UI Layer Explosion',
      'Profit Waterfall Drain',
      'Kinetic Weight Pulse',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Reel 30: «لپ‌تاپ سوخت؛ حساب‌ها چی شد؟ بازیابی فوری» (59s)
// Persona: Shopkeeper / Accountant / Financial Manager
// Theme: swiss-editorial (Precision dark graphite, electric amber/cobalt accents)
// Dominant Layout: Camera Canvas (Terminal crash -> Cloud vault -> Instant encrypted restore)
// Hook: Role Paradox (Thought enterprise database security needed dedicated server rooms?)
// Operators (5): Chromatic Glitch Pulse, Magnetic Particle Stream, Dynamic Spotlight Cone, Rack Focus Blur, Odometer Slot Roll
// ─────────────────────────────────────────────────────────────────────────────

export const reel30 = reel(
  '30',
  'لپ‌تاپ سوخت؛ حساب‌ها چی شد؟ بازیابی فوری',
  [
    // Scene 1: Hardware Crash & Disaster Hook (7s)
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'کابوس مالی کسب‌وکار',
        lines: ['لپ‌تاپ سوخت، هارد پرید؛', 'حساب‌وکتاب [r:پنج سالت چی شد؟]'],
        cards: [
          { icon: 'laptop', title: 'سوختن سیستم مغازه', sub: 'ویندوز بالا نمی‌آید', tone: 'red' },
          { icon: 'drive', title: 'خرابی هارددیسک', sub: 'اطلاعات در دسترس نیست', tone: 'purple' },
        ],
      },
      vo: 'لپ‌تاپ مغازه سوخت، هارد پرید، یا سیستم رو دزد برد؛ حساب پنج سال نسیه و بستانکاری مشتری‌ها چی شد؟',
    },
    // Scene 2: Offline SQLite & Cloud Vault Architecture (18s) — Queue & Sync
    {
      dur: 18,
      spec: {
        kind: 'queue',
        title: 'پشتیبان خودکار و [c:رمزنگاری ابری]',
        offlineLabel: 'پایگاه داده محلی فعال (ایمن روی دستگاه)',
        syncedLabel: 'پایگاه داده همگام با سرور ابری رمزنگاری‌شده',
        items: [
          'ثبت رمزنگاری‌شده فاکتورها در بانک محلی',
          'تهیه نسخه پشتیبان ابری خودکار در هر تراکنش',
          'محافظت از دفاتر دوبل با کلید امنیتی اختصاصی',
          'آماده‌باش برای بازیابی آنی روی دستگاه جدید',
        ],
        reconnectAt: 9.0,
      },
      vo: 'معماری هیبریدی حسابچه از اطلاعاتت مثل گاوصندوق محافظت می‌کنه. پایگاه داده امن محلی به محض اتصال به اینترنت، رمزنگاری‌شده ابری ذخیره می‌شه.',
    },
    // Scene 3: Instant 5-Second Recovery (14s) — Swiss Editorial Clarity
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title: 'سرعت بازیابی [g:کل حساب‌ها] روی سیستم جدید',
        left: {
          label: 'پشتیبان‌گیری سنتی روی فلش',
          value: 'گم شدن فلش و نابودی داده‌ها',
          tone: 'red',
        },
        right: {
          label: 'بازیابی فوری حسابچه',
          value: 'ورود به حساب و بازگشت کامل در ۵ ثانیه',
          tone: 'cyan',
        },
        verdict: 'حتی اگر تمام کامپیوترها بسوزند، داده‌های مالی شما ۱۰۰٪ امن است',
      },
      vo: 'کافیه روی یک لپ‌تاپ یا گوشی جدید وارد حسابت بشی؛ تمام فاکتورها، مانده اشخاص و دفاتر در چند ثانیه دقیقا مثل روز اول ظاهر می‌شن.',
    },
    // Scene 4: Ledger Integrity Verification (12s)
    {
      dur: 12,
      spec: {
        kind: 'financial-intelligence',
        title: 'صحت‌سنجی مانده‌ها و [c:پایداری اطلاعات]',
        revenue: 96000000,
        cogs: 64000000,
        grossProfit: 32000000,
        verdict: 'تطبیق ۱۰۰٪ تمام اسناد؛ صفر بایت از دست رفتن اطلاعات',
      },
      vo: 'بدون یک ریال مغایرت، بدون دلهره و بدون ۱ روز تعطیلی کار فروشگاه؛ کسب‌وکارت همیشه برپاست.',
    },
    // Scene 5: Dedicated Disaster Recovery CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | امنیت تراز اول و بازیابی آنی داده‌های مالی',
        boxes: [
          {
            lead: 'برای بیمه کردن حساب‌های کسب‌وکارت…',
            action: 'کامنت کنید:',
            word: 'پشتیبان',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت نسخه رایگان حسابچه…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'حساب‌هات رو بیمه کن و با خیال آسوده تجارت کن. همین حالا حسابچه رو رایگان امتحان کن.',
    },
  ],
  'swiss-editorial',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'کابوس از کار افتادن کامپیوتر مغازه، ویروسی شدن ویندوز یا دزدیده شدن لپ‌تاپ حسابداری و نابودی کل سوابق مالی.',
    oldWorkflow: 'گرفتن پشتیبان دستی روی فلش مموری که همیشه فراموش می‌شود یا گم می‌شود.',
    friction: 'سوختن هارد و از دست رفتن سال‌ها حساب نسیه و بستانکاری مشتریان بدون هیچ راه بازگشت.',
    hisabcheAction:
      'معماری هیبریدی حسابچه: پایگاه داده محلی SQLite با رمزنگاری سرتاسری و همگام‌سازی ابری.',
    automatedResult:
      'با ورود در لپ‌تاپ یا گوشی جدید، کل اطلاعات، فاکتورها و دفاتر در ۵ ثانیه بازیابی می‌شوند.',
    businessOutcome:
      'تداوم ۱۰۰٪ کسب‌وکار و مصونیت در برابر خرابی سخت‌افزار، نوسان برق یا سرقت سیستم.',
    emotionalPayoff: 'آرامش خاطر ابدی؛ حساب‌های تو امن‌تر از گاوصندوق بانک هستند.',
    cta: 'کامنت کنید: پشتیبان | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Chromatic Glitch Pulse',
      'Magnetic Particle Stream',
      'Dynamic Spotlight Cone',
      'Rack Focus Blur',
      'Odometer Slot Roll',
    ],
  },
)
