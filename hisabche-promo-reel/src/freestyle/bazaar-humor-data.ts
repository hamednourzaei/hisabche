// ============================================
// Hisabche Promo Reel — Standalone Free-Reels Catalog
// Authentic bazaar & commerce narratives unconstrained by restrictive rules:
// - Real merchant personas, authentic dialogues, market idioms
// - Real grocery products, units of money (تومان، ریال)
// - Dynamic comic panels, sound-synced animations, deterministic clock
// - No bottom subtitle overlay (dialogues integrated on stage)
// ============================================

export interface FreeCue {
  at: number
  kind:
    | 'pop'
    | 'chatPop'
    | 'tick'
    | 'clockTickRapid'
    | 'typewriterClick'
    | 'markerScribble'
    | 'paperRustle'
    | 'paperTear'
    | 'cardEnter'
    | 'cardThock'
    | 'cash'
    | 'receiptPrint'
    | 'whoosh'
    | 'cameraSwish'
    | 'softTransition'
    | 'sceneTransition'
    | 'impact'
    | 'alert'
    | 'titleHit'
    | 'bigReveal'
    | 'majorReveal'
    | 'cinematicReveal'
    | 'insightReveal'
    | 'dataFlow'
    | 'sync'
    | 'scan'
    | 'precisionSequence'
    | 'success'
    | 'chime'
    | 'financialMilestone'
    | 'successResolution'
    | 'ctaResolution'
}

export interface FreeScene {
  id: number
  title: string
  start: number
  end: number
  dur: number
  vo: string
}

export interface FreeReelMeta {
  id: string
  title: string
  duration: number
  targetAudience: string
  theme: string
}

// ─── REEL 1: The Bounced Cheque & Cash Deficit (30s) ─────────────────────────
export const BAZAAR_REEL_METADATA: FreeReelMeta = {
  id: 'free-bazaar-humor',
  title: '۱. ماجرای دفتر نسیه حاجی، چک برگشتی و کسری دخل',
  duration: 30,
  targetAudience: 'کسبه بازار، بنکداران و خرده‌فروشان سنتی',
  theme: 'bazaar-vintage-to-modern',
}

export const BAZAAR_SCENES: readonly FreeScene[] = [
  {
    id: 1,
    title: 'دفتر چهل‌برگ چای‌خورده و معمای ۵ میلیون کسری دخل!',
    start: 0,
    end: 6,
    dur: 6,
    vo: 'شاگرد داد می‌زنه: حاجی! ۵ میلیون تومن دخل امروز لنگه! حاجی هم دنبال اون سررسید چهل‌برگی می‌گرده که پارسال روش چای ریخته بود!',
  },
  {
    id: 2,
    title: 'چک صیادی ۲۸۰ میلیونی برگشت خورد و گوشی مشتری خاموشه!',
    start: 6,
    end: 12,
    dur: 6,
    vo: 'چک ۲۸۰ میلیونی صیادی برگشت خورده و مشتری هم گوشیش خاموشه! تازه یادت می‌افته آدرس و تلفنش رو اصلاً درست تو دفتر ننوشتی!',
  },
  {
    id: 3,
    title: 'ماشین‌حساب در مرز انفجار؛ دخل شلوغ اما جیب خالی؟',
    start: 12,
    end: 18,
    dur: 6,
    vo: 'ماشین‌حساب داره دود می‌کنه! از صبح تا شب دکان شلوغه و بار می‌ره، اما آخر ماه معلوم نیست سود واقعی کجاست و پول‌ها کجا غیب شده؟',
  },
  {
    id: 4,
    title: 'انقلاب حسابچه در دکان: فاکتور ۲ ثانیه‌ای و تراز خودکار پوز',
    start: 18,
    end: 25,
    dur: 7,
    vo: 'وقتشه دفتر رو ببندی! با حسابچه، فاکتور با بارکد در ۲ ثانیه صادر می‌شه، کارتخوان با دخل تراز می‌شه و پیامک سررسید خودکار به بدهکار می‌ره!',
  },
  {
    id: 5,
    title: 'چای قندپهلو در آرامش؛ حسابت رو مدرن کن!',
    start: 25,
    end: 30,
    dur: 5,
    vo: 'چای قندپهلوتو با خیال راحت بنوش؛ حسابچه حواسش به تک‌تک ریال‌های دخلت هست. همین الان رایگان شروع کن در hisabche.com',
  },
] as const

export const BAZAAR_AUDIO_CUES: readonly FreeCue[] = [
  { at: 0.15, kind: 'whoosh' },
  { at: 0.7, kind: 'paperRustle' },
  { at: 1.4, kind: 'typewriterClick' },
  { at: 2.2, kind: 'alert' },
  { at: 3.8, kind: 'impact' },
  { at: 5.6, kind: 'sceneTransition' },
  { at: 6.2, kind: 'whoosh' },
  { at: 7.2, kind: 'cardThock' },
  { at: 8.5, kind: 'impact' },
  { at: 9.3, kind: 'alert' },
  { at: 11.0, kind: 'cameraSwish' },
  { at: 11.8, kind: 'sceneTransition' },
  { at: 12.3, kind: 'receiptPrint' },
  { at: 13.8, kind: 'clockTickRapid' },
  { at: 15.2, kind: 'titleHit' },
  { at: 17.6, kind: 'softTransition' },
  { at: 18.0, kind: 'majorReveal' },
  { at: 19.1, kind: 'scan' },
  { at: 20.3, kind: 'pop' },
  { at: 21.6, kind: 'chatPop' },
  { at: 23.0, kind: 'dataFlow' },
  { at: 24.5, kind: 'financialMilestone' },
  { at: 25.2, kind: 'chime' },
  { at: 26.8, kind: 'cash' },
  { at: 28.5, kind: 'ctaResolution' },
] as const

// ─── REEL 2: The Phantom Warehouse Mystery (42s) ─────────────────────────────
export const WAREHOUSE_REEL_METADATA: FreeReelMeta = {
  id: 'free-warehouse-phantom',
  title: '۲. معمای کارتن‌های غیب‌شده و انباردار خسته!',
  duration: 42,
  targetAudience: 'انبارداران، پخش و توزیع، عمده‌فروشان و کارخانجات',
  theme: 'warehouse-industrial-to-modern',
}

export const WAREHOUSE_SCENES: readonly FreeScene[] = [
  {
    id: 1,
    title: 'نیسان آبی دم در با بوق ممتد و ۱۶ کارتن شوینده غیب‌شده!',
    start: 0,
    end: 6,
    dur: 6,
    vo: 'راننده نیسان آبی دستش رو روی بوق گذاشته: بارنامه ۵۰ کارتن شوینده و مایع ظرفشوییه، ولی تو قفسه‌ها فقط ۳۴ تاست! ۱۶ کارتن کجاست؟!',
  },
  {
    id: 2,
    title: 'سرگردانی آقا ناصر بین راهروها با دفتر اندیکاتور!',
    start: 6,
    end: 12,
    dur: 6,
    vo: 'آقا ناصر خط‌کش به دست تو راهروهای خاک‌گرفته می‌دوئه: من خودم هفته پیش شمردم، ۵۰ تا بود! کی برده؟ حواله خروجش کو؟!',
  },
  {
    id: 3,
    title: 'تلفن مشتری شاکی و جوهر پخش‌شده روی دفتر!',
    start: 12,
    end: 18,
    dur: 6,
    vo: 'تلفن دفتر زنگ می‌خوره؛ مشتری شاکی داد می‌زنه: تالار امشب عروسی داره، بار شوینده نرسه خسارت می‌گیرم! آقا ناصر دفتر پاره رو ورق می‌زنه: جوهر چای ریخته و اسم تحویل‌گیرنده ناخواناست!',
  },
  {
    id: 4,
    title: 'کابوس انبارگردانی دستی؛ ۳۸ میلیون تومان کسری!',
    start: 18,
    end: 24,
    dur: 6,
    vo: 'کارتن‌های باز، کاردکس‌های مغایر و ماشین‌حساب دودکرده: ۳۸ میلیون تومان کسری انبار در ۳ ماه! بارها بی‌سند خارج شده و هیچ‌کس گردن نمی‌گیره.',
  },
  {
    id: 5,
    title: 'طلوع حسابچه در انبار: تبلت، بارکدخوان و نقشه قفسه',
    start: 24,
    end: 32,
    dur: 8,
    vo: 'وقتشه به این آشفتگی پایان بدی! با حسابچه و بارکدخوان بی‌سیم، هر کالا آدرس داره: راهرو ۴، طبقه ۲. هم‌زمان با فاکتور، کالا از کاردکس کسر می‌شه!',
  },
  {
    id: 6,
    title: 'امضای دیجیتال راننده و بارنامه بدون یک ریال مغایرت',
    start: 32,
    end: 38,
    dur: 6,
    vo: 'راننده روی گوشی امضا می‌کنه، حواله خروج در ۱ ثانیه برای مشتری پیامک می‌شه. موجودی فیزیکی و سیستمی ۱۰۰٪ تراز شد!',
  },
  {
    id: 7,
    title: 'آرامش انباردار؛ حتی یک کارتن هم گم نمی‌شود!',
    start: 38,
    end: 42,
    dur: 4,
    vo: 'انبارت رو هوشمند کن، خیالت رو آسوده. شروع رایگان حسابداری و انبارداری در hisabche.com',
  },
] as const

export const WAREHOUSE_AUDIO_CUES: readonly FreeCue[] = [
  { at: 0.2, kind: 'alert' },
  { at: 1.2, kind: 'cardThock' },
  { at: 2.5, kind: 'whoosh' },
  { at: 4.2, kind: 'impact' },
  { at: 5.8, kind: 'sceneTransition' },
  { at: 6.5, kind: 'paperRustle' },
  { at: 8.0, kind: 'clockTickRapid' },
  { at: 10.2, kind: 'cameraSwish' },
  { at: 11.8, kind: 'sceneTransition' },
  { at: 12.4, kind: 'alert' },
  { at: 14.0, kind: 'paperTear' },
  { at: 16.5, kind: 'impact' },
  { at: 17.8, kind: 'sceneTransition' },
  { at: 18.5, kind: 'receiptPrint' },
  { at: 20.2, kind: 'typewriterClick' },
  { at: 22.0, kind: 'titleHit' },
  { at: 23.8, kind: 'softTransition' },
  { at: 24.2, kind: 'majorReveal' },
  { at: 25.5, kind: 'scan' },
  { at: 27.2, kind: 'pop' },
  { at: 29.0, kind: 'dataFlow' },
  { at: 30.8, kind: 'sync' },
  { at: 31.8, kind: 'sceneTransition' },
  { at: 32.5, kind: 'chatPop' },
  { at: 34.2, kind: 'financialMilestone' },
  { at: 36.5, kind: 'success' },
  { at: 37.8, kind: 'sceneTransition' },
  { at: 38.5, kind: 'chime' },
  { at: 39.8, kind: 'cash' },
  { at: 41.0, kind: 'ctaResolution' },
] as const

// ─── REEL 3: The Partners' Dispute & Mystery Profit (44s) ────────────────────
export const PARTNERS_REEL_METADATA: FreeReelMeta = {
  id: 'free-partners-dispute',
  title: '۳. دعوای دو شریک سر حساب‌های آخر ماه!',
  duration: 44,
  targetAudience: 'کسب‌وکارهای مشارکتی، شرکا، فروشگاه‌های خانوادگی و حجره‌داران',
  theme: 'partners-dramatic-to-peace',
}

export const PARTNERS_SCENES: readonly FreeScene[] = [
  {
    id: 1,
    title: 'یک میلیارد تومن فروختیم؛ پس چرا تو حساب ۴۰ میلیونه؟!',
    start: 0,
    end: 6,
    dur: 6,
    vo: 'آقا کریم فاکتورها رو می‌کوبه رو میز: بهروز! یک میلیارد تومن این ماه دخل داشتیم، چرا تو حساب بانک فقط ۴۰ میلیون مونده؟! نکنه برداشتی داشتی؟!',
  },
  {
    id: 2,
    title: 'اکسل ۵ هزار ردیفی بهروز با ارور #REF! و جعبه‌های شیرینی!',
    start: 6,
    end: 13,
    dur: 7,
    vo: 'بهروز لپ‌تاپ رو نشون می‌ده: من چی برداشتم؟! تو فاکتور خرید پسته و زعفران رو پشت پاکت سیگار و جعبه شیرینی می‌نویسی می‌اندازی رو میز! اکسل ارور ۵ هزارتایی داده!',
  },
  {
    id: 3,
    title: 'فاکتورهای جیبی مچاله و قبض‌های محوشده عابر بانک!',
    start: 13,
    end: 20,
    dur: 7,
    vo: 'تکه‌های کاغذ روغنی و قبض‌های دستگاه پوز با جوهر پریده! ۷۵ میلیون تومن پرداخت شده ولی معلوم نیست بابت چه کالایی و به کی بوده!',
  },
  {
    id: 4,
    title: '۲۲۰ میلیون تومان هزینه‌های ریز پنهان و بی‌سند!',
    start: 20,
    end: 26,
    dur: 6,
    vo: 'طنز تلخ هزینه‌های ریز: کرایه پیک، انعام وانت، ناهار پرسنل و تخفیف‌های شفاهی؛ ۲۲۰ میلیون تومان سود خالص ناپدید شده و رفاقت‌ها رو به باد داده!',
  },
  {
    id: 5,
    title: 'حسابچه وارد می‌شود: حساب شفاف شرکا تا تک‌ریال!',
    start: 26,
    end: 34,
    dur: 8,
    vo: 'دیگه دعوا تمومه! با حسابچه، آقا کریم تو بازار با گوشی از فاکتور عکس می‌گیره و در لحظه ثبت می‌شه. بهروز هم تو دفتر سهم‌الشرکه و موجودی واقعی رو لحظه‌ای می‌بینه.',
  },
  {
    id: 6,
    title: 'لبخند دو شریک؛ سهم سود ۱۸۰ میلیونی شفاف و بی‌کدورت',
    start: 34,
    end: 39,
    dur: 5,
    vo: 'ترازنامه شفاف شد: سهم هر شریک دقیقاً ۱۸۰ میلیون تومان سود خالص. بدون شک، بدون دلخوری و با رفاقت پایدار!',
  },
  {
    id: 7,
    title: 'رفاقت سر جاش، حساب مو لا درزش نره!',
    start: 39,
    end: 44,
    dur: 5,
    vo: 'حسابچه؛ نرم‌افزار حسابداری شراکت و پایان سوتفاهم‌های مالی بازار. شروع رایگان در hisabche.com',
  },
] as const

export const PARTNERS_AUDIO_CUES: readonly FreeCue[] = [
  { at: 0.2, kind: 'impact' },
  { at: 1.5, kind: 'whoosh' },
  { at: 3.2, kind: 'alert' },
  { at: 5.5, kind: 'sceneTransition' },
  { at: 6.2, kind: 'typewriterClick' },
  { at: 8.5, kind: 'paperRustle' },
  { at: 10.8, kind: 'clockTickRapid' },
  { at: 12.6, kind: 'sceneTransition' },
  { at: 13.2, kind: 'paperTear' },
  { at: 15.5, kind: 'cardThock' },
  { at: 18.0, kind: 'cameraSwish' },
  { at: 19.6, kind: 'sceneTransition' },
  { at: 20.2, kind: 'receiptPrint' },
  { at: 22.5, kind: 'titleHit' },
  { at: 24.5, kind: 'alert' },
  { at: 25.8, kind: 'softTransition' },
  { at: 26.2, kind: 'majorReveal' },
  { at: 27.5, kind: 'pop' },
  { at: 29.2, kind: 'scan' },
  { at: 31.0, kind: 'dataFlow' },
  { at: 32.8, kind: 'financialMilestone' },
  { at: 33.8, kind: 'sceneTransition' },
  { at: 34.5, kind: 'chime' },
  { at: 36.2, kind: 'success' },
  { at: 37.8, kind: 'cash' },
  { at: 38.8, kind: 'sceneTransition' },
  { at: 39.5, kind: 'chime' },
  { at: 41.5, kind: 'cash' },
  { at: 43.0, kind: 'ctaResolution' },
] as const

export const FREE_REELS_CATALOG: readonly {
  meta: FreeReelMeta
  scenes: readonly FreeScene[]
  cues: readonly FreeCue[]
}[] = [
  { meta: BAZAAR_REEL_METADATA, scenes: BAZAAR_SCENES, cues: BAZAAR_AUDIO_CUES },
  { meta: WAREHOUSE_REEL_METADATA, scenes: WAREHOUSE_SCENES, cues: WAREHOUSE_AUDIO_CUES },
  { meta: PARTNERS_REEL_METADATA, scenes: PARTNERS_SCENES, cues: PARTNERS_AUDIO_CUES },
] as const
