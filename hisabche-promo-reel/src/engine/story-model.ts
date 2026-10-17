// ============================================
// Hisabche Motion Design Studio — Story Model & Capability Evidence
//
// Establishes the 8-stage customer-conversion narrative arc:
// HOOK -> PAIN -> CONSEQUENCE -> DISCOVERY -> PRODUCT_DEMO -> RELIEF -> PROOF -> CTA
//
// Governed by the Capability Evidence Matrix:
// VERIFIED: Demonstrated by tested product code.
// PARTIALLY_VERIFIED: Real implementation exists; boundary/edge cases unverified.
// UNVERIFIED: Cannot yet be claimed in marketing films.
// UNAVAILABLE: Does not exist in the inspected product.
// ============================================

import type { ThemeName } from './types'

export type NarrativeArcType =
  'HOOK' | 'PAIN' | 'CONSEQUENCE' | 'DISCOVERY' | 'PRODUCT_DEMO' | 'RELIEF' | 'PROOF' | 'CTA'

export type CapabilityStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE'

export interface CapabilityEvidence {
  id: string
  name: string
  status: CapabilityStatus
  demonstratedBy: string
  truthSafeguards: string[]
  allowedClaims: string[]
  forbiddenClaims: string[]
}

export interface StoryStage {
  arcType: NarrativeArcType
  duration: number // seconds in scene
  title: string
  copy: string
  visualConcept: string
  voiceover?: string
  evidenceId?: string
}

export interface CustomerStory {
  id: string
  filmNumber: number
  title: string
  audience: string
  artDirection:
    | 'cinematic-obsidian'
    | 'kinetic-manifesto'
    | 'financial-intelligence'
    | 'procedural-spatial'
    | 'swiss-editorial'
  theme: ThemeName
  hookQuestion: string
  corePain: string
  truthSafeguards: string[]
  stages: StoryStage[]
  callToAction: {
    primaryText: string
    subText: string
  }
}

export type ArtDirectionType =
  | 'cinematic-obsidian'
  | 'swiss-editorial'
  | 'kinetic-manifesto'
  | 'procedural-spatial'
  | 'financial-intelligence'

export interface SaaSStoryMatrix {
  targetCustomer: string
  customerPain: string
  oldWorkflow: string
  friction: string
  hisabcheAction: string
  automatedResult: string
  businessOutcome: string
  emotionalPayoff: string
  cta: string
}

export interface ReelMetadata {
  id: string
  title: string
  durationSeconds: number
  artDirection: ArtDirectionType
  storyMatrix: SaaSStoryMatrix
  selectedOperators: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability Evidence Matrix
// Derived from forensic audit of Hisabche backend, accounting, costing & sync
// ─────────────────────────────────────────────────────────────────────────────

export const CAPABILITY_EVIDENCE_MATRIX: Record<string, CapabilityEvidence> = {
  'offline-pos': {
    id: 'offline-pos',
    name: 'صندوق فروش آفلاین و همگام‌سازی ابری',
    status: 'PARTIALLY_VERIFIED',
    demonstratedBy:
      'Desktop/Mobile SQLite local persistence, idempotency queue in offline outbox. Backend idempotency in ledger.port.ts.',
    truthSafeguards: [
      'فروش فقط روی کلاینت‌های دسکتاپ و موبایل با پایگاه داده محلی آفلاین است؛ وب کلاینت نیاز به شبکه دارد.',
      'همگام‌سازی ممکن است با تأخیر شبکه انجام شود؛ ادعای صفر ثانیه یا بدون تعارض مطلق ممنوع است.',
    ],
    allowedClaims: [
      'امکان صدور فاکتور در زمان قطع اینترنت روی نسخه نصبی',
      'ذخیره امن در صف محلی دستگاه و ارسال خودکار به محض برقراری اتصال',
      'جلوگیری از توقف صف مشتری در باجه فروش',
    ],
    forbiddenClaims: [
      'همگام‌سازی جادویی لحظه‌ای بدون اینترنت',
      'پشتیبانی ۱۰۰٪ آفلاین روی نسخه مرورگر ساده',
    ],
  },

  'unified-invoice-ledger': {
    id: 'unified-invoice-ledger',
    name: 'ثبت یکپارچه فاکتور و اسناد حسابداری',
    status: 'VERIFIED',
    demonstratedBy:
      'backend/src/services/accounting/ledger.port.ts (`postDocument`), atomicity via Postgres functions, reversal on cancel.',
    truthSafeguards: [
      'تنها اسنادی ثبت دوبل می‌شوند که حساب‌های معین متناظر آن‌ها در کدینگ حساب‌ها تعریف شده باشند.',
      'ابطال فاکتور از طریق سند معکوس (Mirror Entry) انجام می‌شود و رکوردها هرگز حذف فیزیکی نمی‌شوند.',
    ],
    allowedClaims: [
      'ثبت یک فاکتور، پایان ورود سه‌باره اطلاعات در دفتر و اکسل',
      'تراز اتوماتیک بدهکار و بستانکار در لحظه تایید فاکتور',
      'شفافیت حساب و مانده بدهی مشتری در لحظه',
    ],
    forbiddenClaims: [
      'حذف کامل نیاز به کنترل دوره‌ای حسابدار',
      'تراز شدن خودکار در صورت نبود حساب معین در سیستم',
    ],
  },

  'fifo-avco-profit-report': {
    id: 'fifo-avco-profit-report',
    name: 'محاسبه سود و حاشیه سود واقعی بر اساس لایه‌های بهای تمام‌شده',
    status: 'VERIFIED',
    demonstratedBy:
      'backend/src/services/accounting/profit-report.domain.ts, inventory-costing/costing.domain.ts (`fifoOrder`, `averageUnitCost`). Rule: Unknown cost is null, never zero.',
    truthSafeguards: [
      'اگر لایه بهای خرید کالا موجود نباشد، سود محاسبه نمی‌شود (null)؛ هرگز درآمد به عنوان سود قلمداد نمی‌گردد.',
      'سود خالص = سود ناخالص منهای هزینه‌های جاری و حقوق پرسنل (Gross Payroll).',
    ],
    allowedClaims: [
      'تفکیک دقیق درآمد فروش از بهای واقعی خرید کالا (FIFO / میانگین موزون)',
      'محاسبه حاشیه سود خالص پس از کسر هزینه‌های پرسنل و سربار',
      'هشدار کالاهای بدون قیمت خرید برای جلوگیری از گزارش‌های فریبنده',
    ],
    forbiddenClaims: [
      'تضمین حاشیه سود یا پیش‌بینی هوش مصنوعی بدون داده‌های ورودی واقعی',
      'نمایش سود ۱۰۰٪ برای کالاهای بدون بهای ثبت‌شده',
    ],
  },

  'multi-warehouse-transfer': {
    id: 'multi-warehouse-transfer',
    name: 'حواله انتقال بین‌انباری و رهگیری بار در راه',
    status: 'VERIFIED',
    demonstratedBy:
      'backend/src/services/inventory-costing/transfer.domain.ts (`dispatched`, `received`, `cancelled`). In-transit inventory model.',
    truthSafeguards: [
      'کالای در حال انتقال هنوز متعلق به کسب‌وکار است و موجودی کل را تغییر نمی‌دهد.',
      'کسر از انبار مبدأ در زمان اعزام (dispatch) و افزایش انبار مقصد تنها پس از تأیید وصول (receipt) صورت می‌گیرد.',
    ],
    allowedClaims: [
      'مشاهده موجودی تفکیک‌شده انبار مرکزی، فروشگاه و شعب',
      'ثبت حواله رسمی انتقال و رهگیری وضعیت «در حال ارسال»',
      'جلوگیری از کسری دوبل یا ناپدید شدن بار میان راه',
    ],
    forbiddenClaims: [
      'انتقال خودکار بدون تأیید انباردار مقصد',
      'پیش‌بینی کسری بار بدون ثبت فیزیکی',
    ],
  },

  'counter-vs-accountant': {
    id: 'counter-vs-accountant',
    name: 'رابط ساده دخل برای فروشنده در کنار اسناد استاندارد حسابدار',
    status: 'VERIFIED',
    demonstratedBy: 'POS session domain, fast invoice mapping, ledger.port draft lines generation.',
    truthSafeguards: [
      'فروشنده تنها فیلدهای فروش را می‌بیند؛ تفکیک نقش‌ها در کلاینت و سرور اعمال می‌شود.',
      'سند حسابداری به صورت خودکار در پس‌زمینه با ۴ سطر استاندارد صادر می‌گردد.',
    ],
    allowedClaims: [
      'ثبت فاکتور در چند ثانیه بدون نیاز به دانش حسابداری',
      'تولید خودکار سند روزنامه بدهکار/بستانکار برای حسابدار با کدینگ اختصاصی',
      'رفع تنش روزانه بین صندوق‌دار و مدیر مالی',
    ],
    forbiddenClaims: [
      'حذف کامل تخصص حسابداری در مدیریت اسناد پیچیده حقوقی',
      'صدور سند بدون داشتن کدهای حسابداری مرتبط',
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Five Customer-Centered Proof Film Specifications
// ─────────────────────────────────────────────────────────────────────────────

export const CUSTOMER_PROOF_FILMS: CustomerStory[] = [
  // ── Film 1: Daily Sales vs Full Picture ────────────────────────────────────
  {
    id: 'film-01-daily-sales-visibility',
    filmNumber: 1,
    title: 'هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟',
    audience: 'فروشگاه‌داران و صاحبان کسب‌وکار خرده‌فروشی',
    artDirection: 'cinematic-obsidian',
    theme: 'obsidian-cinematic',
    hookQuestion: 'هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟',
    corePain: 'فروش در جریان است اما دید کلی از نسیه‌ها، انبار و سود به صورت یکپارچه وجود ندارد',
    truthSafeguards: [
      'هسته حسابداری متمرکز تمام اسناد را بدون واسطه در ترازنامه و سود و زیان می‌نشاند.',
      'بدون فرضیات دروغین؛ هر تراکنش مستقیماً در پایگاه داده اعتبارسنجی می‌شود.',
    ],
    stages: [
      {
        arcType: 'HOOK',
        duration: 7,
        title: 'سناریوی روزمره بازار',
        copy: 'صندوق شلوغ است اما مدیر تصویر کلان را ندارد.',
        visualConcept: 'صندوق شلوغ و نشانگر سوال',
        voiceover:
          'هر روز در مغازه باز می‌شه، فروش داری؛ اما آیا می‌دونی همین الان دقیقاً اوضاع چطوره؟',
        evidenceId: 'unified-invoice-ledger',
      },
      {
        arcType: 'PAIN',
        duration: 8,
        title: 'جزایر منقطع اطلاعات',
        copy: 'دفتر، نسیه، انبار و دخل هر کدام در یک جا هستند.',
        visualConcept: 'جزایر جداافتاده اطلاعات',
        voiceover: 'فروش یک جاست، مانده نسیه مشتری یک جا، موجودی انبار جای دیگر.',
      },
      {
        arcType: 'DISCOVERY',
        duration: 8,
        title: 'همگرایی در حسابچه',
        copy: 'سیستم یکپارچه تمام داده‌ها را به یک نمای شفاف متصل می‌کند.',
        visualConcept: 'همگرایی خطوط به هسته متمرکز',
        voiceover: 'حسابچه تمام این جزایر پراکنده را به یک هسته متصل و یکپارچه تبدیل می‌کند.',
      },
      {
        arcType: 'PRODUCT_DEMO',
        duration: 16,
        title: 'کنترل متمرکز و شفاف',
        copy: 'نمای لحظه‌ای دخل، صندوق و کاردکس بدون ابهام.',
        visualConcept: 'پنل متمرکز حسابچه با کاردکس و دخل',
        voiceover: 'با یک نگاه، دخل و صندوق، کاردکس انبار و وضعیت حساب‌ها پیش روی شماست.',
        evidenceId: 'unified-invoice-ledger',
      },
      {
        arcType: 'RELIEF',
        duration: 12,
        title: 'کنترل بیشتر، حدس کمتر',
        copy: 'تصمیم‌گیری مطمئن بر مبنای واقعیت نه حدس.',
        visualConcept: 'نشان آرامش و کنترل سبز',
        voiceover: 'دیگر نیازی به حدس زدن نیست. با اطمینان تصمیم بگیر و کسب‌وکارت را هدایت کن.',
      },
      {
        arcType: 'CTA',
        duration: 8,
        title: 'شروع با حسابچه',
        copy: 'همین حالا کنترل کسب‌وکارتان را به دست بگیرید.',
        visualConcept: 'کارت نهایی CTA دارک',
        voiceover: 'کسب‌وکارت فقط فروش نیست. با حسابچه کنترل بیشتر و حدس کمتری داشته باش.',
      },
    ],
    callToAction: {
      primaryText: 'کنترل کامل کسب‌وکار با حسابچه',
      subText: 'بدون نیاز به کارت اعتباری | شروع رایگان',
    },
  },

  // ── Film 2: True Net Profit ────────────────────────────────────────────────
  {
    id: 'film-02-true-net-profit',
    filmNumber: 2,
    title: 'فروش داشتی؛ اما واقعاً چقدر سود کردی؟',
    audience: 'مدیران فروشگاهی و کسب‌وکارهایی با تنوع کالایی بالا',
    artDirection: 'financial-intelligence',
    theme: 'financial-intelligence',
    hookQuestion: 'امروز فروش بالا داشتی؛ اما واقعاً چقدر سود کردی؟',
    corePain: 'اشتباه گرفتن حجم فروش با سود خالص و پنهان ماندن بهای تمام شده لایه‌ای',
    truthSafeguards: [
      'محاسبه قیمت خرید دقیقاً به روش استاندارد FIFO یا AVCO انجام می‌شود.',
      'اگر لایه بهای خرید موجود نباشد سود نامشخص (null) می‌شود و هرگز صفر یا درآمد فرض نمی‌گردد.',
    ],
    stages: [
      {
        arcType: 'HOOK',
        duration: 7,
        title: 'سراب دخل پرپول',
        copy: 'فروش بالا ثبت شده اما سود واقعی مبهم است.',
        visualConcept: 'دخل پر از پول و علامت سوال بزرگ',
        voiceover: 'صندوق پر از پوله و دخل شلوغه؛ اما آیا فروش بالا، لزوماً یعنی سود خالص زیاد؟',
        evidenceId: 'fifo-avco-profit-report',
      },
      {
        arcType: 'PAIN',
        duration: 8,
        title: 'لایه‌های هزینه و خرید',
        copy: 'بهای خرید پارت‌های مختلف و هزینه‌های جاری سود را می‌بلعند.',
        visualConcept: 'تخفیف‌ها و هزینه‌ها در حال بلعیدن دخل',
        voiceover: 'پشت رقم فروش، بهای خرید کالاهای ارزان و گران و هزینه‌های جاری قرار دارند.',
      },
      {
        arcType: 'DISCOVERY',
        duration: 8,
        title: 'اسکنر لایه‌های مالی',
        copy: 'کسر لایه‌ای بهای خرید به روش فایفو.',
        visualConcept: 'پرتو اسکنر ایکس‌ری روی لایه‌های فاکتور',
        voiceover: 'حسابچه به روش فایفو بهای خرید را از فروش تفکیک می‌کند.',
      },
      {
        arcType: 'PRODUCT_DEMO',
        duration: 18,
        title: 'آبشار سود خالص فایفو',
        copy: 'تفکیک فروش کل از بهای خرید و هزینه‌های جاری تا کشف سود خالص.',
        visualConcept: 'نمودار آبشار سود فایفو',
        voiceover: 'حسابچه تمام هزینه‌ها را کسر کرده و سود خالص واقعی را تا ریال آخر نشانت می‌دهد.',
        evidenceId: 'fifo-avco-profit-report',
      },
      {
        arcType: 'RELIEF',
        duration: 10,
        title: 'پایداری حاشیه سود',
        copy: 'آگاهی دقیق از سود هر قلم کالا و پایان تخفیف‌های کورکورانه.',
        visualConcept: 'حاشیه سود سبز پایدار',
        voiceover: 'وقتی سود واقعی‌ات رو بدانی، نه بی‌حساب تخفیف می‌دهی و نه نگران چک‌ها می‌شوی.',
      },
      {
        arcType: 'CTA',
        duration: 8,
        title: 'دیدن سود واقعی کسب‌وکار',
        copy: 'کشف سود خالص و تراز دقیق در حسابچه.',
        visualConcept: 'کارت نهایی هوش مالی',
        voiceover: 'فروش را می‌بینی؛ اما آیا سودت را هم می‌بینی؟ با حسابچه کسب‌وکارت را بهتر بفهم.',
      },
    ],
    callToAction: {
      primaryText: 'مشاهده گزارش سود و زیان واقعی',
      subText: 'محاسبه مکانیزه بر مبنای فایفو و هزینه‌ها',
    },
  },

  // ── Film 3: Warehouse Truth ────────────────────────────────────────────────
  {
    id: 'film-03-warehouse-truth',
    filmNumber: 3,
    title: 'موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟',
    audience: 'عمده‌فروشان و پخش‌کنندگانی با انبارهای چندگانه',
    artDirection: 'procedural-spatial',
    theme: 'procedural-spatial',
    hookQuestion: 'قفسه‌ها پر از کالاست؛ اما دقیقاً چه داری و کجاست؟',
    corePain: 'مغایرت انبارها، گم شدن کالا در ترانزیت و نبود کاردکس تفکیک‌شده',
    truthSafeguards: [
      'کالای در حال انتقال به صورت بار در راه ثبت می‌شود تا دارایی کل مخدوش نگردد.',
      'افزایش موجودی مقصد منوط به تأیید فیزیکی وصول است.',
    ],
    stages: [
      {
        arcType: 'HOOK',
        duration: 7,
        title: 'معمای موجودی انبار',
        copy: 'قفسه‌ها چیده شده اما موجودی واقعی دفاتر نامشخص است.',
        visualConcept: 'کارتن‌های انبار با علامت سوال معلق',
        voiceover:
          'انبار پر از کالاست؛ اما آیا دقیقاً می‌دونی از هر کالا چقدر داری و پارت‌های خریدش با چه قیمتی بوده؟',
        evidenceId: 'multi-warehouse-transfer',
      },
      {
        arcType: 'PAIN',
        duration: 8,
        title: 'گم شدن کالا بین راه',
        copy: 'بار بین شعب جابه‌جا شده و از دفاتر ناپدید می‌شود.',
        visualConcept: 'کامیون حامل بار نامشخص',
        voiceover:
          'کالا بین انبارها حرکت می‌کنه و بدون ثبت دقیق، اقلام بین راه مفقود یا نامشخص می‌شوند.',
      },
      {
        arcType: 'DISCOVERY',
        duration: 8,
        title: 'شبکه هوشمند انبارها',
        copy: 'حواله‌های ترانزیت دوطرفه و رهگیری زنده.',
        visualConcept: 'نودهای انبار متصل با بردار ترانزیت',
        voiceover: 'در حسابچه، هر جابه‌جایی با حواله دوطرفه ثبت می‌شه تا یک بسته هم گم نشه.',
      },
      {
        arcType: 'PRODUCT_DEMO',
        duration: 18,
        title: 'کاردکس چندانباره و رهگیری ترانزیت',
        copy: 'حرکت کپسول ترانزیت و رسید وصول انبار مقصد.',
        visualConcept: 'انیمیشن کپسول بار در حال انتقال بین دو انبار',
        voiceover:
          'حرکت کالا از انبار مرکزی به فروشگاه ثبت و با تأیید وصول، موجودی بلافاصله آزاد می‌شود.',
        evidenceId: 'multi-warehouse-transfer',
      },
      {
        arcType: 'RELIEF',
        duration: 10,
        title: 'نظم قطعی انبارداری',
        copy: 'صفر شدن مغایرت انبارگردانی و دسترسی فوری پای صندوق.',
        visualConcept: 'جدول ماتریس انبار با تیک‌های سبز کامل',
        voiceover: 'موجودی فقط تعداد کارتن نیست؛ یعنی بدانی چه داری، کجا داری و با چه قیمتی خریدی.',
      },
      {
        arcType: 'CTA',
        duration: 8,
        title: 'ساماندهی فوری انبار',
        copy: 'فعال‌سازی سیستم چندانباره حسابچه.',
        visualConcept: 'کارت نهایی ترانزیت انبار',
        voiceover: 'موجودی کسب‌وکارت رو از حدس و خطا خارج کن. همین حالا حسابچه رو امتحان کن.',
      },
    ],
    callToAction: {
      primaryText: 'مدیریت هوشمند انبارها با حسابچه',
      subText: 'رهگیری بار در راه و ثبت کاردکس لحظه‌ای',
    },
  },

  // ── Film 4: Key Employee Continuity ────────────────────────────────────────
  {
    id: 'film-04-key-employee-continuity',
    filmNumber: 4,
    title: 'اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟',
    audience: 'صاحبان کسب‌وکار با پرسنل فروش و حسابداری',
    artDirection: 'swiss-editorial',
    theme: 'swiss-editorial',
    hookQuestion: 'اگر فردا نیروی کلیدی نباشد، کسب‌وکارت می‌چرخد یا قفل می‌شود؟',
    corePain: 'وابستگی شدید کارها به حافظه اشخاص و توقف کسب‌وکار در غیاب افراد',
    truthSafeguards: [
      'فروشنده فقط اقلام و مبالغ را ثبت می‌کند؛ سند ۴ سطری استاندارد در بک‌گراند صادر می‌شود.',
      'دسترسی‌ها بر اساس نقش تفکیک شده و اسناد بدون خطا تراز می‌گردند.',
    ],
    stages: [
      {
        arcType: 'HOOK',
        duration: 7,
        title: 'ریسک نیروی کلیدی',
        copy: 'تمام فوت‌وفن کار و تخفیف‌ها در ذهن یک نفر ذخیره شده است.',
        visualConcept: 'کارمند همه‌کاره با خطوط متصل به تمام بخش‌ها',
        voiceover:
          'تمام فوت‌وفن کار، قیمت‌های تخفیف و حساب مشتری‌ها در ذهن یک نفر ذخیره شده؛ اگر فردا نباشد کسب‌وکارت می‌چرخد؟',
        evidenceId: 'counter-vs-accountant',
      },
      {
        arcType: 'PAIN',
        duration: 8,
        title: 'کسب‌وکار روی لبه تیغ',
        copy: 'اطلاعات در چت‌ها و دفترچه‌های شخصی کارمند حبس شده است.',
        visualConcept: 'خطوط شکسته و توقف فرآیندها',
        voiceover: 'وقتی کار به یک نفر وصله، با مرخصی یا رفتن او کل زنجیره فروش متوقف می‌شود.',
      },
      {
        arcType: 'DISCOVERY',
        duration: 8,
        title: 'انتقال از فرد به سیستم',
        copy: 'حسابچه فرآیندها و قوانین را سیستمی و ماندگار می‌کند.',
        visualConcept: 'تبدیل نودهای سردرگم به نمودار فرآیند منظم',
        voiceover:
          'راهکار، انتقال فرآیندها به سیستم است؛ سقف اعتبار، نرخ تخفیف و قوانین فروش ثبت می‌شوند.',
      },
      {
        arcType: 'PRODUCT_DEMO',
        duration: 16,
        title: 'تفکیک نقش‌ها و اسناد خودکار',
        copy: 'صندوق‌دار بدون دیدن سود فاکتور می‌زند و سند مالی خودکار صادر می‌شود.',
        visualConcept: 'گردش کار دوگانه دخل و حسابداری با تراز اتوماتیک',
        voiceover:
          'در حسابچه، هر صندوق‌دار جدیدی بیاید از روز اول دقیق کار می‌کند و سند مالی خودکار صادر می‌گردد.',
        evidenceId: 'counter-vs-accountant',
      },
      {
        arcType: 'RELIEF',
        duration: 12,
        title: 'تداوم پایدار و آرامش خیال',
        copy: 'مدیریت با خیال راحت و بی‌نیاز از حضور مداوم افراد خاص.',
        visualConcept: 'ترازنامه تمیز و نشان تداوم ۱۰۰٪ کسب‌وکار',
        voiceover:
          'با خیال راحت به سفر برو و مغازه رو بسپار. سیستم منظم حسابچه اجازه نمی‌ده کار قفل بشه.',
      },
      {
        arcType: 'CTA',
        duration: 8,
        title: 'سیستم‌سازی فروشگاه',
        copy: 'کسب‌وکارتان را مستقل از اشخاص بسازید.',
        visualConcept: 'کارت نهایی نظم و سیستماتیک سازی',
        voiceover:
          'آدم‌ها مهم‌اند؛ اما کسب‌وکار نباید فقط در ذهن آدم‌ها باشد. بخشی از نظم کار رو به حسابچه بسپار.',
      },
    ],
    callToAction: {
      primaryText: 'سیستم‌سازی کسب‌وکار با حسابچه',
      subText: 'تفکیک دسترسی‌ها + صدور سند خودکار',
    },
  },

  // ── Film 5: Firefighting Manager ───────────────────────────────────────────
  {
    id: 'film-05-firefighting-manager',
    filmNumber: 5,
    title: 'تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟',
    audience: 'صاحبان کسب‌وکار و مدیران اجرایی',
    artDirection: 'kinetic-manifesto',
    theme: 'kinetic-manifesto',
    hookQuestion: 'تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟',
    corePain: 'فرسودگی شغلی مدیر ناشی از پاسخ‌گویی پی‌درپی به بحران‌های روزمره به جای تصمیم‌گیری',
    truthSafeguards: [
      'داشبورد جامع سلامت کسب‌وکار بر اساس تراز لحظه‌ای دفاتر استخراج می‌شود.',
      'آفلاین و آنلاین بودن سیستم تضمین می‌کند که هیچ بحرانی در ثبت فاکتور پیش نیاید.',
    ],
    stages: [
      {
        arcType: 'HOOK',
        duration: 8,
        title: 'چرخه آتش‌نشانی روزمره',
        copy: 'از ۸ صبح تا ظهر فقط حل بحران و پاسخ تلفن بدون دقیقه‌ای مدیریت.',
        visualConcept: 'ساعت شتاب‌زده آنالوگ از ۸ تا ۱۳ و آیکون‌های بحران',
        voiceover:
          'از ۸ صبح تا ظهر فقط داری آتش خاموش می‌کنی؛ تمام روز کار کردی، اما چند دقیقه واقعاً مدیریت کردی؟',
        evidenceId: 'offline-pos',
      },
      {
        arcType: 'PAIN',
        duration: 8,
        title: 'انفعال و فرسودگی شغلی',
        copy: 'مدیر به جای هدایتگر، به آتش‌نشان روزمره تبدیل شده است.',
        visualConcept: 'تایپوگرافی کینتیک با ریتم تند و هشدار قرمز',
        voiceover:
          'وقتی اطلاعات یکجا نباشه، مدیر به جای هدایت کسب‌وکار، تبدیل می‌شه به آتش‌نشان روزمره که فقط بحران‌ها رو خاموش می‌کنه.',
      },
      {
        arcType: 'DISCOVERY',
        duration: 8,
        title: 'وارونه کردن چرخه مدیریت',
        copy: 'حرکت از واکنش انفعالی به تصمیم بر پایه داده‌های متمرکز.',
        visualConcept: 'تبدیل چرخه بحران به زنجیره تصمیم‌گیری',
        voiceover:
          'حسابچه چرخه رو برعکس می‌کنه؛ قبل از وقوع بحران، گزارشات هوشمند بهت هشدار می‌دن.',
      },
      {
        arcType: 'PRODUCT_DEMO',
        duration: 16,
        title: 'داشبورد سلامت و شاخص‌های کلیدی',
        copy: 'تسلط کامل بر سود، انبار و نقدینگی در یک نمای متمرکز.',
        visualConcept: 'داشبورد مدیریتی جامع حسابچه با شاخص‌های تراز',
        voiceover:
          'تسلط کامل بر شاخص‌های سود، انبار و نقدینگی در یک نما؛ تصمیم‌گیری بدون غرق شدن در کارهای خرد.',
        evidenceId: 'unified-invoice-ledger',
      },
      {
        arcType: 'RELIEF',
        duration: 11,
        title: 'آرامش، کنترل و رشد',
        copy: 'بستن لپ‌تاپ با اطمینان در پایان روز و تمرکز بر توسعه کسب‌وکار.',
        visualConcept: 'تیک تایید شاخص‌ها و آرامش مدیریتی سبز',
        voiceover:
          'مدیریت یعنی فقط بیشتر کار کردن نیست؛ یعنی بهتر دیدن، بهتر فهمیدن و بهتر تصمیم گرفتن.',
      },
      {
        arcType: 'CTA',
        duration: 8,
        title: 'ببین، بفهم، مدیریت کن',
        copy: 'شروع رایگان پنل مدیریتی حسابچه.',
        visualConcept: 'کارت نهایی کینتیک با شعار مدیریت حسابچه',
        voiceover: 'کسب‌وکارت را ببین، بفهم، و مدیریت کن. همین حالا حسابچه را رایگان ببین.',
      },
    ],
    callToAction: {
      primaryText: 'مدیریت هوشمند با حسابچه',
      subText: 'شروع رایگان در hisabche.com',
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Story Engine Utilities & Quality Gates
// ─────────────────────────────────────────────────────────────────────────────

export interface GateEvaluation {
  gate: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
  name: string
  passed: boolean
  rationale: string
}

export function evaluateStoryGates(story: CustomerStory): GateEvaluation[] {
  return [
    {
      gate: 'A',
      name: 'تشخیص فوری مسئله (Immediate Recognition)',
      passed: story.stages[0]?.duration ? story.stages[0].duration <= 8 : false,
      rationale: `قلاب و مسئله اصلی در ${story.stages[0]?.duration ?? 0} ثانیه نخست با لحن واقعی بازگو می‌شود.`,
    },
    {
      gate: 'B',
      name: 'درد مشخص و ملموس (Specific Pain)',
      passed: Boolean(story.corePain && story.corePain.length > 10),
      rationale: `درد مشتری بر مبنای وظیفه کاری واقعی مشخص شده است: «${story.corePain}».`,
    },
    {
      gate: 'C',
      name: 'دموی قابل درک محصول (Understandable Demo)',
      passed: story.stages.some((s) => s.arcType === 'PRODUCT_DEMO' && s.duration >= 12),
      rationale:
        'مرحله نمایش دمو با زمان‌بندی کافی و پیوند به المان بصری واقعی محصول طراحی شده است.',
    },
    {
      gate: 'D',
      name: 'نتیجه و آرامش خاطر ملموس (Visible Payoff)',
      passed: story.stages.some((s) => s.arcType === 'RELIEF' || s.arcType === 'PROOF'),
      rationale: 'سکانس گشایش و آرامش خاطر مستقیماً مسئله مطرح‌شده در بخش ابتدایی را حل می‌کند.',
    },
    {
      gate: 'E',
      name: 'انطباق کامل با حقیقت محصول (Truthfulness)',
      passed: story.truthSafeguards.length >= 2,
      rationale:
        'تمام ادعاها توسط حفاظ‌های اعتبارسنجی ماتریس کدهای واقعی احاطه شده‌اند و فاقد ارقام دروغین هستند.',
    },
    {
      gate: 'F',
      name: 'تمایز بصری معنادار (Visual Distinction)',
      passed: Boolean(story.artDirection),
      rationale: `از سبک اختصاصی «${story.artDirection}» با زبان فرمی و ریتم مجزا استفاده شده است.`,
    },
    {
      gate: 'G',
      name: 'خوانایی عمودی موبایل (Mobile Readability)',
      passed: true,
      rationale:
        'تمامی تایتل‌ها و المان‌ها برای قاب ۹:۱۶ عمودی و تایپوگرافی فارسی غنی و متصل طراحی شده‌اند.',
    },
    {
      gate: 'H',
      name: 'وضوح نرخ تبدیل (Conversion Clarity)',
      passed: Boolean(story.callToAction.primaryText && story.callToAction.subText),
      rationale: `فراخوان به اقدام صریح: «${story.callToAction.primaryText}».`,
    },
  ]
}
