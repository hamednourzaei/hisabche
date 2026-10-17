// ============================================
// Hisabche Motion Design Studio — Reels 31 to 35
//
// 5 High-Conversion Cinematic Films Generated via /new-reel
// Built strictly to the 5 High-Conversion Scenarios Screenplay:
//
// Reel 31: «هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟» (obsidian-cinematic)
// Reel 32: «فروش داشتی؛ اما واقعاً چقدر سود کردی؟» (financial-intelligence)
// Reel 33: «موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟» (procedural-spatial)
// Reel 34: «اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟» (swiss-editorial)
// Reel 35: «تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟» (kinetic-manifesto)
//
// Adheres strictly to:
// - Never start with the product (first 30-40% establishes the problem)
// - Create the information gap moment («من این را دقیق نمی‌دانم»)
// - 20% Card Quota (max 1 card scene per film)
// - Rotating layout topologies and art directions
// - HarfBuzz-safe RTL Persian typography
// - Zero hardcoded currency names, generic B2B goods, 100% dark themes
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
// REEL 31: «هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟» (59s)
// Persona: Business Owner / Shop Owner / Manager
// Theme: obsidian-cinematic (Cinematic Information Universe: Dark space -> Fragmented pieces -> Structured system)
// Metaphor: Missing information -> dark empty spaces between disconnected islands
// Operators (5): Magnetic Particle Stream, Camera Portal, Isometric UI Layer Explosion, Rack Focus Blur, Baseline Curtain Rise
// ─────────────────────────────────────────────────────────────────────────────

export const reel31 = reel(
  '31',
  'هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟',
  [
    // Scene 01: Normal Life Hook (7s) — Everyday sales rhythm
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'سناریوی روزمره بازار',
        lines: ['هر روز در مغازه باز می‌شه و فروش داری؛', 'اما الان [r:دقیقاً چه خبر است؟]'],
        cards: [
          {
            icon: 'store',
            title: 'فروش روزمره جاری',
            sub: 'صندوق شلوغ، پول و مشتری در حرکت',
            tone: 'cyan',
          },
          {
            icon: 'question',
            title: 'دید کلی کجاست؟',
            sub: 'اطلاعات در ذهن پراکنده است',
            tone: 'red',
          },
        ],
      },
      vo: 'هر روز در مغازه باز می‌شه، مشتری میاد، فروش داری، نقدینگی جابه‌جا می‌شه؛ اما آیا می‌دونی همین الان دقیقاً اوضاع چطوره؟',
    },
    // Scene 02: Information Overload & Fragmentation (15s) — Floating disconnected business layers
    {
      dur: 15,
      spec: {
        kind: 'fragmented-tools-demo',
        title: 'جزایر منقطع [r:اطلاعات پراکنده کسب‌وکار]',
        convergeAt: 7.0,
      },
      vo: 'فروش یک جاست، مانده نسیه مشتری یک جا، موجودی انبار جای دیگر. هر چه کسب‌وکارت بزرگ‌تر می‌شه، تکه‌های اطلاعات از هم دورتر می‌شن و تو وسط این شلوغی کمتر می‌فهمی.',
    },
    // Scene 03: The Question & The Blind Spot (13s) — Large empty space, emotional gap
    {
      dur: 13,
      spec: {
        kind: 'versus',
        title: 'شکاف اطلاعاتی [r:دیدن تکه‌ها] به‌جای [c:دیدن کل کسب‌وکار]',
        left: { label: 'تصور ذهنی مدیر', value: 'فقط دیدن فروش روزانه', tone: 'red' },
        right: { label: 'واقعیت کسب‌وکار', value: 'نسیه، انبار، نقدینگی و سود', tone: 'cyan' },
        verdict: 'کسب‌وکارت فقط فروش نیست؛ باید بدانی الان چه خبر است',
      },
      vo: 'فروش رو می‌بینی؛ اما آیا وضعیت طلب‌ها، کسری انبار و سود خالص رو هم به لحظه می‌دونی؟ تصمیم‌گیری روی حدس، یعنی ریسک خالص.',
    },
    // Scene 04: Hisabche Structured Clarity (16s) — Magnetic convergence into one coherent business view
    {
      dur: 16,
      spec: {
        kind: 'cinematic-product',
        title: 'کنترل متمرکز در [c:سیستم یکپارچه حسابچه]',
        subtitle: 'تبدیل اطلاعات پراکنده به یک نمای شفاف مدیریتی',
        floatingBadge: 'دید کامل · تصمیم‌گیری بدون حدس',
        layers: [
          {
            title: 'شفافیت دخل و صندوق',
            desc: 'نقدینگی و مانده بانک بدون مغایرت',
            icon: 'wallet',
            tone: 'cyan',
            z: 70,
          },
          {
            title: 'کاردکس لحظه‌ای انبار',
            desc: 'موجودی دقیق و ارزش ریالی کالاها',
            icon: 'boxes',
            tone: 'purple',
            z: 40,
          },
          {
            title: 'وضعیت زنده مطالبات',
            desc: 'راس‌گیری چک‌ها و مانده مشتریان',
            icon: 'receipt',
            tone: 'green',
            z: 10,
          },
        ],
      },
      vo: 'حسابچه بین واقعیت کسب‌وکار و تصمیمات تو قرار می‌گیره. تمام اطلاعات پراکنده به یک تصویر شفاف و قابل فهم تبدیل می‌شن.',
    },
    // Scene 05: Relief & High-Converting CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | کنترل بیشتر، حدس کمتر',
        boxes: [
          {
            lead: 'کسب‌وکارت فقط فروش نیست؛ باید بدانی الان چه خبر است…',
            action: 'کامنت کنید:',
            word: 'کنترل',
            tone: 'cyan',
          },
          {
            lead: 'برای شروع نسخه رایگان حسابچه…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'کسب‌وکارت فقط فروش نیست. باید بدانی الان چه خبر است. حسابچه؛ کنترل بیشتر، حدس کمتر. همین حالا شروع کن.',
    },
  ],
  'obsidian-cinematic',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'کسب‌وکار هر روز می‌چرخه و فروش هست؛ اما مدیر دید کلی و تصویر یکپارچه از وضعیت الان کسب‌وکارش نداره.',
    oldWorkflow:
      'نگاه کردن به کارتخوان، فاکتورهای روی میز، پیام‌های واتساپ و پرسیدن از شاگرد مغازه.',
    friction: 'اطلاعات جزیره‌ای و جدا از هم؛ مدیر تکه‌های کسب‌وکار را می‌بیند نه کل کسب‌وکار را.',
    hisabcheAction:
      'ورود اطلاعات به یک هسته متمرکز؛ همگرایی بلادرنگ صندوق، انبار، طلب‌ها و نقدینگی.',
    automatedResult: 'اتصال مغناطیسی داده‌ها و نمایش یک نمای واحد از سلامت کسب‌وکار.',
    businessOutcome:
      'مدیر با یک نگاه در ثانیه وضعیت لحظه‌ای را می‌فهمد و با اطمینان تصمیم می‌گیرد.',
    emotionalPayoff: 'پایان گیجی و ابهام؛ کنترل بیشتر، حدس کمتر.',
    cta: 'کامنت کنید: کنترل | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Magnetic Particle Stream',
      'Camera Portal Pass-Through',
      'Isometric UI Layer Explosion',
      'Rack Focus Blur',
      'Baseline Curtain Rise',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 32: «فروش داشتی؛ اما واقعاً چقدر سود کردی؟» (59s)
// Persona: Owner / Store Manager
// Theme: financial-intelligence (Money -> Layers -> Hidden cost -> Financial clarity)
// Metaphor: Unknown profit -> money disappearing into purchase costs, discounts, overhead layers
// Operators (5): X-Ray Profit Scanner, Profit Waterfall Drain, Radial Clock Dial, Odometer Slot Roll, Highlighter Sweep
// ─────────────────────────────────────────────────────────────────────────────

export const reel32 = reel(
  '32',
  'فروش داشتی؛ اما واقعاً چقدر سود کردی؟',
  [
    // Scene 01: Success & Rush Hook (7s) — Big revenue number
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'سناریوی خطای سود',
        lines: ['امروز فروش بالا داشتی؛', 'اما واقعاً [r:چقدر سود کردی؟]'],
        cards: [
          { icon: 'wallet', title: 'دخل پر از پول', sub: '۵۰ میلیون فروش ثبت شد', tone: 'cyan' },
          {
            icon: 'question',
            title: 'سود واقعی کجاست؟',
            sub: 'بهای خرید لایه‌ای کسر نشده',
            tone: 'red',
          },
        ],
      },
      vo: 'صندوق پر از پوله و دخل شلوغه؛ اما آیا فروش بالا، لزوماً یعنی سود خالص زیاد؟',
    },
    // Scene 02: Interruption & The Profit Waterfall Drain (18s) — Exposing the layers underneath
    {
      dur: 18,
      spec: {
        kind: 'profit-waterfall-demo',
        title: 'تفکیک دقیق [c:سود خالص] از [r:بهای خرید فایفو]',
        grossRevenue: 50000000,
        cogs: 32000000,
        expenses: 8000000,
      },
      vo: 'پشت رقم بزرگ فروش، بهای خرید کالاهای ارزان و گران، تخفیف‌های پای صندوق و هزینه‌های جاری قرار دارند که اگر دقیق کسر نشوند، داری با ضرر می‌فروشی.',
    },
    // Scene 03: The X-Ray Reality Check (14s) — True net profit calculation
    {
      dur: 14,
      spec: {
        kind: 'financial-intelligence',
        title: 'اسکن لایه‌های مالی و [g:محاسبه سود واقعی]',
        revenue: 50000000,
        cogs: 32000000,
        grossProfit: 10000000,
        verdict: 'سود خالص واقعی: ۱۰٬۰۰۰٬۰۰۰؛ شفاف بدون حدس ذهنی',
      },
      vo: 'حسابچه به روش استاندارد فایفو، بهای خرید دقیق هر قلم کالا را کسر می‌کنه و سود خالص واقعی را تا ریال آخر نشانت می‌ده.',
    },
    // Scene 04: Monthly Net Margin Stability Area Chart (12s)
    {
      dur: 12,
      spec: {
        kind: 'chart',
        title: 'نمودار پایداری [c:حاشیه سود خالص]',
        chartType: 'area',
        kpis: [
          { label: 'فروش کل', value: 50000000, unit: '', tone: 'cyan' },
          { label: 'سود خالص واقعی', value: 10000000, unit: '', trend: '+۲۳٪', tone: 'green' },
        ],
        data: [
          { label: 'هفته ۱', value: 2100000 },
          { label: 'هفته ۲', value: 2450000 },
          { label: 'هفته ۳', value: 2650000 },
          { label: 'هفته ۴', value: 2800000 },
        ],
      },
      vo: 'وقتی سود واقعی‌ات رو به دقیقه بدانی، نه بی‌حساب تخفیف می‌دی و نه نگران چک‌های سررسید می‌شی.',
    },
    // Scene 05: Tailored Financial Payoff CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | فقط فروش را ثبت نکن؛ کسب‌وکارت را بهتر بفهم',
        boxes: [
          {
            lead: 'فروش را می‌بینی؛ اما آیا سودت را هم می‌بینی؟',
            action: 'کامنت کنید:',
            word: 'سود',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی هوش مالی…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'فروش را می‌بینی. اما آیا سودت را هم می‌بینی؟ با حسابچه، فقط فروش را ثبت نکن؛ کسب‌وکارت را بهتر بفهم.',
    },
  ],
  'financial-intelligence',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'فروش بالاست و رقم دخل بزرگه، اما آخر ماه نقدینگی برای خرید مجدد کمه چون سود واقعی پشت لایه‌های هزینه پنهانه.',
    oldWorkflow: 'جمع زدن دخل با ماشین‌حساب و تخمین ذهنی درصد سود.',
    friction:
      'شارژ کالا با قیمت‌های خرید مختلف (خرید قدیم ارزان، خرید جدید گران)، تخفیف‌ها، هزینه‌های جاری و نسیه که سود را می‌بلعند.',
    hisabcheAction:
      'پرتو اسکنر ایکس‌ری و آبشار سود بر اساس بهای تمام شده لایه‌ای فایفو (FIFO COGS).',
    automatedResult: 'کسر لایه‌به‌لایه‌ی هزینه‌ها و نمایش یک عدد شفاف از سود خالص واقعی.',
    businessOutcome: 'پایان توهم فروش بالا؛ تعیین قیمت فروش سودآور و کنترل دقیق سرمایه در گردش.',
    emotionalPayoff: 'دیدن سود واقعی در جیب و آرامش خاطر از سلامت دخل.',
    cta: 'کامنت کنید: سود | شروع رایگان در hisabche.com',
    selectedOperators: [
      'X-Ray Profit Scanner',
      'Profit Waterfall Drain',
      'Radial Clock Dial & Progress Ring',
      'Odometer Slot Roll',
      'Highlighter Sweep',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 33: «موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟» (59s)
// Persona: Retailer / Store Owner / Inventory-Heavy Business
// Theme: procedural-spatial (Warehouse -> Physical objects -> Invisible information -> Organized system)
// Metaphor: Inventory uncertainty -> physical shelves disappearing into darkness
// Operators (5): Multi-Warehouse Transfer Mesh, Camera Portal, Isometric UI Layer Explosion, Magnetic Particles, Bezier Timeline
// ─────────────────────────────────────────────────────────────────────────────

export const reel33 = reel(
  '33',
  'موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟',
  [
    // Scene 01: Full Warehouse & Blind Spot Hook (7s) — Organized facade vs hidden darkness
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'معمای موجودی انبار',
        lines: ['قفسه‌ها پر از کالاست؛', 'اما دقیقاً [r:چه داری و کجاست؟]'],
        cards: [
          {
            icon: 'boxes',
            title: 'کارتن‌های انبار',
            sub: 'موجودی فیزیکی در انبار چیده شده',
            tone: 'cyan',
          },
          {
            icon: 'question',
            title: 'مغایرت دفاتر',
            sub: 'قیمت خرید و تعداد دقیق نامشخص',
            tone: 'red',
          },
        ],
      },
      vo: 'انبار پر از کالاست و قفسه‌ها چیده شده؛ اما آیا دقیقاً می‌دونی از هر کالا چقدر داری و پارت‌های خریدش با چه قیمتی بوده؟',
    },
    // Scene 02: Warehouse Movement Vector Pipeline (18s) — Live transit capsule animation
    {
      dur: 18,
      spec: {
        kind: 'warehouse-movement-demo',
        title: 'ردیابی لحظه‌ای کالا بین [c:شعب و انبارها]',
        transitAt: 4.5,
        arriveAt: 12.0,
      },
      vo: 'کالا بین انبار مرکزی، فروشگاه و خودروهای توزیع حرکت می‌کنه. در حسابچه هر جابه‌جایی با حواله دوطرفه ثبت می‌شه تا یک بسته هم در مسیر گم نشه.',
    },
    // Scene 03: Multi-Node Topology Hub (14s) — Central warehouse & satellite network
    {
      dur: 14,
      spec: {
        kind: 'hub',
        title: 'مدیریت یکپارچه [g:موجودی تمام انبارها]',
        core: 'انبار مرکزی',
        coreSub: 'پایگاه داده متمرکز',
        nodes: [
          { icon: 'store', label: 'شعبه بازار' },
          { icon: 'boxes', label: 'انبار پشتیبان' },
          { icon: 'truck', label: 'ناوگان توزیع' },
          { icon: 'receipt', label: 'صندوق فروش' },
        ],
      },
      vo: 'دیگر نیازی به تماس تلفنی و شمارش چشمی نیست. با ثبت هر فاکتور فروش، کاردکس انبار در کسری از ثانیه کسر می‌گردد.',
    },
    // Scene 04: Matrix Comparison: Guesswork vs Clarity (12s)
    {
      dur: 12,
      spec: {
        kind: 'compare',
        title: 'انبارداری سنتی در برابر [c:شفافیت کاردکس حسابچه]',
        columns: ['شاخص انبار', 'شمارش سنتی', 'اکسل دستی', 'حسابچه'],
        rows: [
          { label: 'اطلاع از موجودی پای صندوق', marks: ['no', 'no', 'yes'] },
          { label: 'تفکیک قیمت‌های مختلف خرید', marks: ['no', 'part', 'yes'] },
          { label: 'انتقال کالا بدون مغایرت', marks: ['no', 'no', 'yes'] },
        ],
      },
      vo: 'موجودی فقط تعداد کالا نیست. یعنی بدانی چه داری، کجا داری و چه اتفاقی برایش افتاده.',
    },
    // Scene 05: Tailored Inventory Payoff CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | موجودی را از حدس خارج کن',
        boxes: [
          {
            lead: 'موجودی فقط تعداد کالا نیست؛ یعنی بدانی چه داری…',
            action: 'کامنت کنید:',
            word: 'انبار',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی رایگان سیستم انبارداری…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'موجودی فقط تعداد کالا نیست. یعنی بدانی چه داری، کجا داری و چه اتفاقی برایش افتاده. حسابچه؛ موجودی را از حدس خارج کن.',
    },
  ],
  'procedural-spatial',
  {
    targetCustomer: 'wholesaler',
    customerPain:
      'کارتن‌ها و اجناس در انبار چیده شده‌اند، اما انباردار و سیستم موجودی دقیق، محل قرارگیری و قیمت خرید هر پارت را نمی‌دانند.',
    oldWorkflow: 'کاردکس دستی یا اکسل و تماس تلفنی برای چک کردن چشمی قفسه‌ها.',
    friction:
      'کالایی که در انبار خاک می‌خورد در سیستم صفر خورده؛ یا به مشتری قول جنس داده می‌شود ولی در انبار نیست!',
    hisabcheAction: 'کاردکس هوشمند چندانباره، ردیابی لات و بارکد کالا، صدور حواله انتقال داخلی.',
    automatedResult:
      'تبدیل آشفتگی انبار به ساختار منظم، ردیابی ورود و خروج با ثبت خودکار پای فاکتور.',
    businessOutcome: 'صفر شدن مغایرت انبارگردانی و اطلاع دقیق از ارزش ریالی موجودی.',
    emotionalPayoff: 'پایان دلهره کسری بار و بدقولی به خریدار عمده.',
    cta: 'کامنت کنید: انبار | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Multi-Warehouse Transfer Mesh',
      'Camera Portal Pass-Through',
      'Isometric UI Layer Explosion',
      'Magnetic Particle Stream',
      'Snake / Bezier Timeline Path',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 34: «اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟» (59s)
// Persona: Owner / Manager with Employees
// Theme: swiss-editorial (One person -> Overloaded network -> Collapse -> Systemized workflow)
// Metaphor: Employee dependency -> all business threads tied to one person, breaking when they vanish
// Operators (5): Metaball Merge, Magnetic Particle Stream, Isometric UI Explosion, Laser Caret Typewriter, Rack Focus Blur
// ─────────────────────────────────────────────────────────────────────────────

export const reel34 = reel(
  '34',
  'اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟',
  [
    // Scene 01: The Hero Employee & Dependency Hook (7s) — Critical knowledge in one head
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'ریسک مدیریت کسب‌وکار',
        lines: ['اگر فردا نیروی کلیدی نباشد،', 'کسب‌وکارت [r:می‌چرخد یا قفل می‌شود؟]'],
        cards: [
          {
            icon: 'user',
            title: 'کارمند همه‌کاره',
            sub: 'اطلاعات مشتری و قیمت در ذهن اوست',
            tone: 'cyan',
          },
          {
            icon: 'question',
            title: 'وابستگی پرخطر',
            sub: 'بدون او کارها متوقف می‌شود',
            tone: 'red',
          },
        ],
      },
      vo: 'تمام فوت‌وفن کار، قیمت‌های تخفیف و حساب مشتری‌ها در ذهن یک نفر ذخیره شده؛ اگر فردا نباشد کسب‌وکارت می‌چرخد؟',
    },
    // Scene 02: The Fragile Human Network (14s) — Why business shouldn't live inside someone's head
    {
      dur: 14,
      spec: {
        kind: 'branch',
        cards: [
          {
            icon: 'user',
            title: 'اطلاعات در ذهن فرد',
            sub: 'چت‌های واتساپ و یادداشت شخصی',
            tone: 'red',
          },
          {
            icon: 'briefcase',
            title: 'سیستم ثبت متمرکز',
            sub: 'دفاتر شفاف و پایگاه داده مستقل',
            tone: 'cyan',
          },
        ],
        question: 'اگر همه‌چیز به یک نفر وابسته باشد، واقعاً سیستم داری؟',
        answer: 'خیر! حسابچه وابستگی به فرد را به سیستم تبدیل می‌کند.',
        badge: 'تداوم ۱۰۰٪ کسب‌وکار',
      },
      vo: 'آدم‌ها مهم‌اند؛ اما فرآیندها، تخفیف‌ها و سوابق مشتری نباید فقط در ذهن آدم‌ها باشه. وقتی کار به یک نفر وصله، کسب‌وکارت روی لبه تیغه.',
    },
    // Scene 03: Systemization of Operations (16s) — Roles, permissions & automated records
    {
      dur: 16,
      spec: {
        kind: 'stagger',
        title: 'انتقال وابستگی فردی به [c:نظم سیستمی]',
        header: ['فرآیند عملیاتی', 'نحوه اجرای خودکار در حسابچه'],
        interval: 1.1,
        tone: 'cyan',
        rows: [
          { icon: 'shield', text: 'سقف اعتبار و تخفیف مصوب برای هر مشتری' },
          { icon: 'receipt', text: 'ثبت خودکار فاکتورها در دفاتر بدون خطای انسانی' },
          { icon: 'store', text: 'دسترسی تفکیک‌شده صندوق‌دار بدون دیدن سود و قیمت خرید' },
          { icon: 'history', text: 'ردیابی کامل تمام ویرایش‌ها و حذف اسناد' },
        ],
      },
      vo: 'در حسابچه، سقف اعتبار، نرخ تخفیف و قوانین فروش ثبت می‌شن. هر صندوق‌دار جدیدی بیاید، از روز اول دقیق و بدون اشتباه کار می‌کنه.',
    },
    // Scene 04: Balance & Operational Continuity (14s)
    {
      dur: 14,
      spec: {
        kind: 'financial-intelligence',
        title: 'ثبات عملیاتی و [g:تراز دفاتر مالی]',
        revenue: 76000000,
        cogs: 48000000,
        grossProfit: 28000000,
        verdict: 'عملیات مستقل از فرد؛ ثبت ۱۰۰٪ اسناد در دفترکل با رعایت دسترسی‌ها',
      },
      vo: 'با خیال راحت به سفر برو و مغازه رو بسپار. سیستم منظم حسابچه اجازه نمی‌ده کار قفل بشه یا خطایی رخ بده.',
    },
    // Scene 05: Dedicated Systemization CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | بخشی از نظم کسب‌وکارت را به سیستم بسپار',
        boxes: [
          {
            lead: 'آدم‌ها مهم‌اند؛ اما کسب‌وکار نباید در ذهن آدم‌ها باشد…',
            action: 'کامنت کنید:',
            word: 'سیستم',
            tone: 'cyan',
          },
          {
            lead: 'برای دریافت دموی مدیریت دسترسی‌ها…',
            action: 'کامنت کنید:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'آدم‌ها مهم‌اند. اما کسب‌وکار نباید فقط داخل ذهن آدم‌ها باشد. حسابچه؛ بخشی از نظم کسب‌وکارت را به سیستم بسپار.',
    },
  ],
  'swiss-editorial',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'تمام فوت‌وفن کار، قیمت‌های تخفیف، حساب نسیه مشتریان و چیدمان انبار در ذهن یک شاگرد یا کارمند قدیمی ذخیره شده؛ اگر نباشد کار قفل می‌شود.',
    oldWorkflow: 'اعتماد به حافظه فردی، چت‌های پراکنده واتساپ و دفترچه‌های شخصی کارمند.',
    friction:
      'وابستگی پرخطر به فرد؛ با مرخصی، بیماری یا رفتن کارمند، کل زنجیره فروش و مشتری‌ها متوقف می‌شوند.',
    hisabcheAction:
      'انتقال دانش و فرآیندها به سیستم: سقف اعتبار، قیمت‌های مصوب، دسترسی نقش‌ها، دفاتر اتوماتیک.',
    automatedResult:
      'تبدیل شبکه متکی به فرد به یک سیستم ساختاریافته؛ هر پرسنل جدید در روز اول دقیقا کار را پیش می‌برد.',
    businessOutcome: 'تداوم و پایداری کسب‌وکار بدون وابستگی به اشخاص.',
    emotionalPayoff:
      'آرامش خاطر مدیر از سیستماتیک بودن فروشگاه؛ سفر رفتن بدون استرس قفل شدن مغازه.',
    cta: 'کامنت کنید: سیستم | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Liquid Metaball Merge',
      'Magnetic Particle Stream',
      'Isometric UI Layer Explosion',
      'Laser Caret Typewriter',
      'Rack Focus Blur',
    ],
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// REEL 35: «تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟» (59s)
// Persona: Owner / Executive Manager
// Theme: kinetic-manifesto (Time Pressure: Clock -> Overload -> Silence -> Managerial clarity)
// Metaphor: Firefighting manager -> accelerating clock, relentless notifications, sudden silence, clear decisions
// Operators (5): Radial Clock Dial & Progress Ring, Odometer Slot Roll, Camera Portal, SVG Shape Morphing, Dynamic Spotlight Cone
// ─────────────────────────────────────────────────────────────────────────────

export const reel35 = reel(
  '35',
  'تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟',
  [
    // Scene 01: Accelerating Clock & Firefighting Hook (11s) — 08:00 to 13:00 rush
    {
      dur: 11,
      spec: {
        kind: 'day',
        title: 'یک روز کامل با [c:آتش‌نشانی و پاسخ به بحران‌ها]',
        interval: 1.3,
        moments: [
          { time: '۰۸:۰۰', icon: 'sun', text: 'ورود به مغازه با آرامش اول صبح' },
          { time: '۰۸:۱۷', icon: 'alert', text: 'اعتراض مشتری به تاخیر سفارش' },
          { time: '۰۸:۴۲', icon: 'receipt', text: 'خطای صندوق‌دار در ثبت قیمت فاکتور' },
          { time: '۰۹:۱۰', icon: 'boxes', text: 'کسری ناگهانی موجودی در انبار' },
          { time: '۱۰:۰۵', icon: 'wallet', text: 'سردرگمی در پرداخت چک سررسید' },
          { time: '۱۱:۲۰', icon: 'users', text: 'اعتراض مشتری جدید به حساب نسیه' },
          {
            time: '۱۳:۰۰',
            icon: 'moon',
            text: 'تمام روز کار کردی؛ اما چند دقیقه واقعاً مدیریت کردی؟',
          },
        ],
      },
      vo: 'از ۸ صبح تا ظهر فقط داری آتش خاموش می‌کنی؛ جواب تلفن، رفع کسری انبار، اصلاح فاکتور! تمام روز کار کردی، اما چند دقیقه واقعاً مدیریت کردی؟',
    },
    // Scene 02: Fragmented Decisions & Job Burnout (12s) — Kinetic Manifesto confrontation
    {
      dur: 12,
      spec: {
        kind: 'kinetic-manifesto',
        headline: ['تمام روز کار کردی؛', 'اما چند دقیقه واقعاً مدیریت کردی؟'],
        subheadline: 'وقتی اطلاعات پراکنده باشد، تصمیم‌گیری هم پراکنده می‌شود',
        statements: [
          'پاسخ تلفنی مداوم به بحران‌های خرد روزمره؟',
          'تصمیم‌گیری‌های شتاب‌زده بر اساس حدس ذهنی؟',
          'سوختن زمان توسعه کسب‌وکار در کارهای خرد؟',
        ],
        accentTone: 'red',
      },
      vo: 'وقتی اطلاعات یکجا نباشه، مدیر به جای هدایت کسب‌وکار، تبدیل می‌شه به آتش‌نشان روزمره که فقط بحران‌ها رو خاموش می‌کنه.',
    },
    // Scene 03: Transformation from Reaction to Decision (16s) — Clean contrast
    {
      dur: 16,
      spec: {
        kind: 'versus',
        title: 'تحول چرخه مدیریت: [r:واکنش انفعالی] به [c:تصمیم بر پایه داده]',
        left: { label: 'مدیریت آتش‌نشانی', value: 'مدیر ← واکنش ← واکنش ← خستگی', tone: 'red' },
        right: { label: 'مدیریت هوشمند حسابچه', value: 'داده ← تحلیل ← تصمیم ← رشد', tone: 'cyan' },
        verdict: 'کسب‌وکارت را ببین، بفهم و با آرامش مدیریت کن',
      },
      vo: 'حسابچه چرخه رو برعکس می‌کنه. قبل از اینکه مشتری شاکی بشه یا انبار کسری بیاره، گزارشات هوشمند بهت هشدار می‌دن تا با آرامش تصمیم بگیری.',
    },
    // Scene 04: Focused Managerial Visibility Dashboard (12s)
    {
      dur: 12,
      spec: {
        kind: 'financial-intelligence',
        title: 'داشبورد جامع [g:سلامت و شاخص‌های کلیدی]',
        revenue: 84000000,
        cogs: 52000000,
        grossProfit: 32000000,
        verdict: 'تسلط کامل بر شاخص‌های سود، انبار و نقدینگی در یک نما',
      },
      vo: 'مدیریت یعنی فقط بیشتر کار کردن نیست؛ یعنی بهتر دیدن، بهتر فهمیدن، و بهتر تصمیم گرفتن.',
    },
    // Scene 05: Hero Executive CTA (8s)
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | کسب‌وکارت را ببین. بفهم. مدیریت کن.',
        boxes: [
          {
            lead: 'مدیریت یعنی فقط بیشتر کار کردن نیست؛ یعنی بهتر دیدن…',
            action: 'برای مدیریت:',
            word: 'مدیریت',
            tone: 'cyan',
          },
          {
            lead: 'کسب‌وکارت را ببین. بفهم. مدیریت کن.',
            action: 'مشاهده دمو:',
            word: 'حسابچه',
            tone: 'purple',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'مدیریت یعنی فقط بیشتر کار کردن نیست؛ یعنی بهتر دیدن، بهتر فهمیدن، بهتر تصمیم گرفتن. کسب‌وکارت را ببین، بفهم، مدیریت کن. همین حالا حسابچه را ببین.',
    },
  ],
  'kinetic-manifesto',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'مدیر تمام روز از ۸ صبح تا غروب در حال پاسخ به تلفن، حل دعوای انبار و رفع خطای قیمت است؛ تمام روز کار می‌کند اما وقتی برای مدیریت ندارد.',
    oldWorkflow: 'واکنش به بحران‌های لحظه‌ای (Firefighting) به دلیل نبود داده‌های لحظه‌ای.',
    friction:
      'وقتی اطلاعات پراکنده باشد، تصمیم‌گیری هم پراکنده و انفعالی می‌شود؛ فرسودگی شغلی مدیر.',
    hisabcheAction:
      'داشبورد مدیریتی متمرکز؛ آلارم‌های خودکار نقدینگی، کسری انبار و چک‌ها قبل از وقوع بحران.',
    automatedResult: 'تبدیل چرخه «مدیر → واکنش → واکنش → واکنش» به «داده → درک → تصمیم → اقدام».',
    businessOutcome:
      'کاهش ۹۰ درصدی تماس‌ها و بحران‌های روزمره؛ آزاد شدن وقت مدیر برای توسعه کسب‌وکار.',
    emotionalPayoff: 'بستن لپ‌تاپ با اطمینان کامل در پایان روز کاری؛ حس واقعی مدیریت نه آتش‌نشانی.',
    cta: 'کامنت کنید: مدیریت | شروع رایگان در hisabche.com',
    selectedOperators: [
      'Radial Clock Dial & Progress Ring',
      'Odometer Slot Roll',
      'Camera Portal Pass-Through',
      'SVG Shape Morphing',
      'Dynamic Spotlight Cone',
    ],
  },
)
