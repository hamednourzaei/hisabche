import type { Reel } from '../engine/types'

export const reel71: Reel = {
  id: '71',
  title: 'سناریوی ترکیبی: چرخه کامل کسب‌وکار از فروش تا تسویه — ۴۲ ثانیه',
  duration: 42.0,
  theme: 'procedural-spatial',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'تک‌تک بخش‌های کسب‌وکار (فروش، انبار، بانک، تولید) جدا از هم کار می‌کنند و هیچ‌کدام با هم صحبت نمی‌کنند',
    oldWorkflow:
      'فاکتور در اکسل، موجودی روی کاغذ، چک در دفترچه، بوم تولید در ذهن کارگری — هم‌پیوستگی صفر',
    friction:
      'سفارش می‌گیری، انبار نداره، چک برمی‌گرده، تولید متوقف می‌شه، مشتری می‌ره، پول گم می‌شه',
    hisabcheAction:
      'یک فاکتور = ۵ ثبت همزمان: انبار کسر می‌شه، دفتر کل سند می‌زنه، طلب مشتری ثبت می‌شه، چک‌برگشتی پیش‌بینی می‌شه، موجودی قفسه آپدیت می‌شه',
    automatedResult: 'فروشگاه، انبار، بانک، دفتر، تولید — هم‌زمان و آنی، حتی آفلاین',
    businessOutcome: 'یک عدد واقعی سود، موجودی دقیق قفسه، چکی که برنگرده، ترازنامه بدون sorpresa',
    emotionalPayoff:
      'شب‌ها با اطمینان می‌خوابی؛ صباح چک می‌پس، انبار هم‌خوانی، سود واقعی‌ست نه کاغذی',
    cta: 'چرخه کامل رو در hisabche.com تجربه کن',
    selectedOperators: [
      'cinematic-camera-orbit',
      'continuous-transform',
      'bridge-merge',
      'split-reveal',
    ],
  },
  scenes: [
    // SCENE 1: HOOK (0.0s – 5.5s) - Visual Pattern Interrupt with cinematic camera
    {
      start: 0.0,
      end: 5.5,
      vo: 'یک فاکتور، پنج صداع — مگر نه؟',
      spec: {
        kind: 'hook',
        theme: 'procedural-spatial',
        openingArchetype: 'visual-pattern-interrupt',
        lines: ['یک فاکتور', 'پنج سیستم جدا', 'مگر نه؟'],
        interrupt: {
          colossalHeadline: 'یک فاکتور',
          subHeadline: 'پنج سیستم جدا',
          shatteredTool: 'اکسل',
        },
        cards: [
          { icon: 'receipt', title: 'فروش', sub: 'فاکتور دستی', tone: 'red' },
          { icon: 'boxes', title: 'انبار', sub: 'کاردکس کاغذی', tone: 'red' },
          { icon: 'book', title: 'دفتر', sub: 'سند دستی', tone: 'red' },
          { icon: 'bank', title: 'بانک', sub: 'چک صیادی', tone: 'red' },
          { icon: 'factory', title: 'تولید', sub: 'بوم ذهنی', tone: 'red' },
        ],
        consequence: {
          alertBanner: 'مغایرت داده‌ها: ۴۳٪',
          stoppedAction: 'تولید متوقف',
          lossMetric: 'سود واقعی نامشخص',
        },
      },
    },

    // SCENE 2: CINEMATIC PRODUCT - 2.5D Camera Orbit (5.5s – 12.5s)
    {
      start: 5.5,
      end: 12.5,
      vo: 'حسابچه: هسته مرکزی که همه را می‌چسباند',
      spec: {
        kind: 'cinematic-product',
        theme: 'procedural-spatial',
        title: 'معماری هسته مرکزی',
        floatingBadge: 'Single Source of Truth',
        layers: [
          {
            title: 'فروشگاه / پوز',
            desc: 'فاکتور، بارکد، قیمت‌لیست، پرداخت',
            icon: 'smartphone',
            tone: 'cyan',
            z: 1,
          },
          {
            title: 'انبار هوشمند',
            desc: 'موجودی لحظه‌ای، قفسه‌بندی، کنساین',
            icon: 'boxes',
            tone: 'green',
            z: 2,
          },
          {
            title: 'دفتر کل خودکار',
            desc: 'سند دوطرفه، تراز آزمایشی، مالیات',
            icon: 'book',
            tone: 'purple',
            z: 3,
          },
          {
            title: 'بانک و چک',
            desc: 'سررسید، پاس، برگشت، تسویه',
            icon: 'bank',
            tone: 'cyan',
            z: 4,
          },
          {
            title: 'تولید و بوم',
            desc: 'محاسبه بهای تمام‌شده، MRP',
            icon: 'factory',
            tone: 'purple',
            z: 5,
          },
          {
            title: 'حسابچه کور',
            desc: 'هسته مشترک، آفلاین‌فست',
            icon: 'shield',
            tone: 'green',
            z: 0,
          },
        ],
      },
    },

    // SCENE 3: CONTINUOUS TRANSFORM - Live workflow (12.5s – 20.0s)
    {
      start: 12.5,
      end: 20.0,
      vo: 'از لحظه فاکتور تا تسویه نهایی، همه زنده است',
      spec: {
        kind: 'continuous-transform',
        theme: 'procedural-spatial',
        title: 'چرخه زنده یک تراکنش',
        stages: [
          { at: 0.0, label: 'فاکتور صادر شد', sub: 'موجودی کسر، سند زد، طلب ثبت' },
          { at: 1.8, label: 'پرداخت دریافت شد', sub: 'صندوق/بانک تسویه، چک بایگانی' },
          { at: 3.6, label: 'انبار تحویل داد', sub: 'بارکد اسکن، قفسه خالی، کنساین' },
          { at: 5.4, label: 'تولید Съره گرفت', sub: 'بها محاسبه، موجودی کالا آپدیت' },
          { at: 7.2, label: 'ترازنامه لحظه‌ای', sub: 'سود واقعی، مالیات، تصمیم‌گیری' },
        ],
        tone: 'green',
      },
    },

    // SCENE 4: SPLIT - Manual Chaos vs Hisabche Flow (20.0s – 27.0s)
    {
      start: 20.0,
      end: 27.0,
      vo: 'چپ: آشفتگی روزانه. راست: جریان یکپارچه',
      spec: {
        kind: 'split',
        theme: 'procedural-spatial',
        title: 'مقایسه جانبی: روش قدیمی vs حسابچه',
        dividerLabel: 'مرز کنترل',
        left: {
          title: 'روش سنتی ( thủ công )',
          subtitle: 'هر بخش ایزوله، داده کپی می‌شود، خطا неизбежный',
          points: [
            'فاکتور اکسل → کپی دستی به انبار',
            'موجودی قفسه → کپی دستی به دفتر',
            'چک صیادی → بدون هشدار سررسید',
            'بوم تولید → محاسبه دستی، خطای ۱۵٪',
            'ترازنامه ماهانه → ۱۰ روز تاخیر، مفاجآت',
          ],
          tone: 'red',
        },
        right: {
          title: 'حسابچه (اتوماسیون کامل)',
          subtitle: 'یک ورودی، پنج ثبت آنی، صفر کپی',
          points: [
            'فاکتور → انبار کسر آنی (FIFO/AVCO)',
            'سند دوطرفه → دفتر کل خودکار',
            'چک/پرداخت → سررسید زنده، پیامک پیش‌دست',
            'بوم تولید → بهای تمام‌شده لحظه‌ای',
            'داشبورد لحظه‌ای → سود واقعی، تصمیم آنی',
          ],
          tone: 'green',
        },
      },
    },

    // SCENE 5: BRIDGE - Offline Resilience (27.0s – 34.0s)
    {
      start: 27.0,
      end: 34.0,
      vo: 'اینترنت قطع شد؟ کسب‌وکار تو دوام میاد',
      spec: {
        kind: 'bridge',
        theme: 'procedural-spatial',
        title: 'مقاومت در برابر قطع اتصال',
        left: {
          icon: 'offline',
          title: 'پوز آفلاین',
          sub: 'فاکتور می‌زنه، بارکد اسکن می‌کنه',
          tone: 'cyan',
        },
        right: {
          icon: 'sync',
          title: 'همگام‌سازی آنی',
          sub: 'هرچه در صفه، لحظه وصل شدن فلَش می‌شه',
          tone: 'green',
        },
        merged: 'حسابچه آفلاین‌فست',
        caption: 'فروش متوقف نمی‌شود. داده گم نمی‌شود. تسویه تأخیر نمی‌یابد.',
        summaries: [
          {
            question: 'بدون حسابچه؟',
            answer: 'صف خالی، دخل صفر، مشتری ناراضی',
            tone: 'red',
            icons: ['trash', 'alert'],
          },
          {
            question: 'با حسابچه؟',
            answer: 'فروش ادامه دار، صف محلی، سینک آنی',
            tone: 'green',
            icons: ['check', 'sync'],
          },
        ],
      },
    },

    // SCENE 6: CTA - Dual Box Conversion (34.0s – 42.0s)
    {
      start: 34.0,
      end: 42.0,
      vo: 'چرخه کامل را همین امروز تجربه کن — hisabche.com',
      spec: {
        kind: 'cta',
        theme: 'cyber-emerald',
        tagline: 'یک سامانه. صفر جداسازی. سود واقعی.',
        switchAt: 3.5,
        boxes: [
          {
            lead: 'فروش، انبار، بانک، دفتر، تولید — هم‌زمان',
            action: 'شروع رایگان، بدون نصب، ۳۰ روز',
            word: 'حسابچه',
            tone: 'cyan',
          },
          {
            lead: 'در گوگل سرچ کن:',
            action: 'hisabche.com — وارد شو، فاکتور بزن',
            word: 'حسابچه',
            tone: 'green',
          },
        ],
      },
    },
  ],
}
