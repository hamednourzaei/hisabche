// ============================================
// docs/industries — the hand-written half.
//
// Everything a person wrote about the 67 trades lives HERE, as data, and the
// builder renders it. Two notations keep it honest:
//
//   [[/route?tab=x]]      an app address. The builder refuses the build when
//                         the route is not in the shell, or the `?tab=`/`?view=`
//                         is not one the redirect table already uses.
//   {{METHOD /path}}      an API endpoint. The builder refuses it when the
//                         offline matrix has no such row, and prints the row's
//                         real offline status next to it.
//
// So a page or an endpoint cannot be invented in this file: the suite goes red.
// What the product does NOT do is written as a gap, never as a page.
// ============================================

import type { IndustryKey } from '@hisabche/validation'

export const FAMILY_IDS = [
  'retail',
  'wholesale',
  'personal_services',
  'education',
  'repairs',
  'food_hospitality',
  'health',
  'manufacturing',
  'construction',
  'transport',
  'tourism_lodging',
  'professional_office',
  'finance_trading',
] as const

export type FamilyId = (typeof FAMILY_IDS)[number]

/** Every registered id belongs to exactly one family (guarded by the suite). */
export const FAMILY_OF: Readonly<Record<IndustryKey, FamilyId>> = {
  retail: 'retail',
  wholesale: 'wholesale',
  grocery: 'retail',
  bakery: 'food_hospitality',
  butcher: 'retail',
  restaurant: 'food_hospitality',
  cafe: 'food_hospitality',
  fruitVegetable: 'retail',
  dairy: 'retail',
  nuts: 'retail',
  spices: 'retail',
  jewellery: 'retail',
  watches: 'retail',
  currencyExchange: 'finance_trading',
  clothing: 'retail',
  fabric: 'retail',
  fabricRoll: 'wholesale',
  shoes: 'retail',
  carpet: 'retail',
  tailoring: 'personal_services',
  mobilePhones: 'retail',
  computers: 'retail',
  computerComponents: 'retail',
  electronics: 'retail',
  itServices: 'repairs',
  hardware: 'retail',
  buildingMaterials: 'wholesale',
  paint: 'retail',
  timber: 'wholesale',
  glass: 'retail',
  construction: 'construction',
  manufacturing: 'manufacturing',
  autoParts: 'retail',
  carDealer: 'finance_trading',
  mechanic: 'repairs',
  fuel: 'wholesale',
  furniture: 'retail',
  kitchenware: 'retail',
  homeAppliances: 'retail',
  stationery: 'retail',
  toys: 'retail',
  giftShop: 'retail',
  pharmacy: 'health',
  cosmetics: 'retail',
  clinic: 'health',
  barber: 'personal_services',
  beautySalon: 'personal_services',
  optician: 'health',
  agriculture: 'manufacturing',
  livestock: 'manufacturing',
  seedsFertilizer: 'wholesale',
  flowers: 'retail',
  transport: 'transport',
  freightTransport: 'transport',
  passengerTransport: 'transport',
  courier: 'transport',
  travelAgency: 'tourism_lodging',
  realEstate: 'professional_office',
  printing: 'manufacturing',
  photography: 'personal_services',
  education: 'education',
  laundry: 'personal_services',
  repairs: 'repairs',
  wedding: 'personal_services',
  security: 'professional_office',
  consulting: 'professional_office',
  other: 'retail',
}

export interface Workflow {
  readonly title: string
  readonly steps: readonly string[]
}

export interface DashboardPriority {
  readonly what: string
  /** Where the figure really comes from today, or the gap. */
  readonly source: string
}

export interface FamilySpec {
  readonly title: string
  readonly model: string
  readonly cycle: readonly string[]
  readonly workflows: readonly [Workflow, Workflow, Workflow, Workflow, Workflow]
  readonly dashboard: readonly [
    DashboardPriority,
    DashboardPriority,
    DashboardPriority,
    DashboardPriority,
    DashboardPriority,
  ]
  /** Pages this family leans on, with what the family reads there. */
  readonly pages: readonly { readonly route: string; readonly use: string }[]
  readonly accounting: readonly string[]
  readonly bySize: string
}

// ─── Building blocks shared by several families ─────────────────────────────

const SALE = 'فاکتور فروش در [[/invoices/new]] ثبت می‌شود ({{POST /invoices}}).'
const PAY = 'دریافت پول روی همان فاکتور یا از صفحه‌ی مشتری ثبت می‌شود ({{POST /payments}}).'
const TILL_OPEN = 'صندوق روز در [[/till]] باز می‌شود ({{POST /pos/sessions}}).'
const TILL_CLOSE = 'پایان روز: شمارش و بستن صندوق ({{POST /pos/sessions/:x/close}}).'
const PURCHASE =
  'خرید = فاکتور خرید در همان جدول فاکتورها ([[/invoices?type=purchase]])؛ هر خرید لایه‌ی بهای خودش را می‌سازد.'
const PEOPLE: Workflow = {
  title: 'نیروی انسانی',
  steps: [
    'کارمندان در [[/team-and-payroll]] تعریف می‌شوند ({{POST /employees}}).',
    'برگه‌ی حضور و غیاب ({{PUT /attendance-sheet}}) — «ثبت‌نشده» غایب نیست و به حقوق وصل نیست.',
    'حقوق ثبت و تسویه می‌شود ({{POST /payrolls}}، {{PATCH /payrolls/:x}})؛ «پرداخت‌شده» نهایی است.',
    'مرخصی درخواست و تصمیم‌گیری می‌شود ({{POST /leaves}}، {{PATCH /leaves/:x}}).',
  ],
}
const MANAGE: Workflow = {
  title: 'مدیریتی',
  steps: [
    'داشبورد ([[/dashboard]]، {{GET /analytics/dashboard}}) — رقمی که شخص مجوزش را ندارد حذف می‌شود، صفر نشان داده نمی‌شود.',
    'گزارش سود به تفکیک ارز ({{GET /accounting/profit-report/by-currency}}) در [[/accounting?tab=reports]]؛ بهای نامعلوم «نامعلوم» می‌ماند.',
    'تراز آزمایشی ({{GET /accounting/trial-balance}}) و دفتر ({{GET /accounting/journal}}) در [[/accounting]].',
    'تأیید سندها در [[/approvals]] — تا گردش‌کاری تعریف نشده، این صفحه خالی است و دلیلش را می‌گوید.',
  ],
}
const ACC_SALES =
  'فروش ≠ درآمد تحقق‌یافته ≠ سود: سود فقط از گزارش سود می‌آید و با بهای نامعلوم، «نامعلوم» است.'
const ACC_ADVANCE =
  'بیعانه و پیش‌دریافت بدهی است تا کالا/خدمت تحویل شود؛ درآمد فقط با فاکتور شناخته می‌شود (یک موتور: `order_deposits`).'
const ACC_FX =
  'فاکتور ارزِ دیگر بدون نرخ ثبت نمی‌شود؛ نرخ روی همان فاکتور منجمد است و مانده‌ی طرف حساب به تفکیک ارز است.'

const STOCK_PAGE = {
  route: '/warehouse',
  use: 'کالا، موجودی هر انبار، قفسه‌ها ({{GET /products}}، {{GET /warehouses/overview}}).',
}
const INVOICE_PAGE = {
  route: '/invoices',
  use: 'فروش، خرید، مرجوعی و قیمت‌گذاری در یک جدول ({{GET /invoices}}).',
}
const CUSTOMER_PAGE = {
  route: '/customers',
  use: 'طرف حساب، مانده به تفکیک ارز، پیگیری ({{GET /customers}}، {{GET /customers/:x/accounting}}).',
}
const TILL_PAGE = { route: '/till', use: 'صندوق نقد هر ارز ({{GET /pos/sessions/current}}).' }
const TEAM_PAGE = {
  route: '/team-and-payroll',
  use: 'کارمند، حضور و غیاب، حقوق ({{GET /employees}}، {{GET /payrolls}}).',
}
const ACCOUNTING_PAGE = {
  route: '/accounting',
  use: 'دفتر، خزانه و گزارش‌ها ({{GET /accounting/accounts}}).',
}

const SIZE =
  'تک‌نفره: صاحب کار همه‌ی نقش‌ها را دارد و منو با آچار کوتاه می‌شود. کوچک (چند نفر): نقش‌های پایه کافی است. متوسط: نقش سفارشی در [[/governance?tab=permissions]] و محدودیت شعبه/انبار. بزرگ: چند شعبه و گردش‌کار تأیید در [[/approvals?tab=workflows]]. این مرزها تنظیم کسب‌وکار است، نه قاعده‌ی محصول.'

export const FAMILIES: Readonly<Record<FamilyId, FamilySpec>> = {
  retail: {
    title: 'خرده‌فروشی',
    model:
      'کالای آماده خریده و به مصرف‌کننده‌ی نهایی فروخته می‌شود؛ بیشتر فروش‌ها نقدی و بی‌نام‌اند، تعداد فاکتور زیاد و مبلغ هر کدام کم است. موجودی، بهای خرید و صندوق سه چیزی است که هر روز باید درست باشد.',
    cycle: [
      'خرید از تأمین‌کننده',
      'ورود به انبار و قفسه',
      'فروش نقدی یا نسیه',
      'دریافت پول',
      'بستن صندوق',
      'سفارش دوباره',
    ],
    workflows: [
      {
        title: 'اصلی (فروش)',
        steps: [
          TILL_OPEN,
          SALE,
          'کالا با جست‌وجو یا بارکد انتخاب می‌شود ({{GET /products}})؛ چک موجودی از هیچ کشی نمی‌آید.',
          PAY,
          'مرجوعی روی همان فاکتور ({{POST /invoices/:x/returns}}).',
          TILL_CLOSE,
        ],
      },
      {
        title: 'مالی',
        steps: [
          PAY,
          'فروش نسیه مانده‌ی مشتری را می‌سازد ({{GET /payments/open-invoices/:x/:x}}).',
          'اقساط برنامه‌ی زمانی است، نه پرداخت ({{PUT /invoices/:x/installments}}).',
          'ورود و خروج نقد صندوق ({{POST /pos/sessions/:x/cash}}).',
        ],
      },
      {
        title: 'منابع (کالا و انبار)',
        steps: [
          PURCHASE,
          'انتقال بین انبارها ({{POST /stock-transfers}}).',
          'پیشنهاد سفارش دوباره ({{GET /inventory/reorder-suggestions}}).',
          'موجودی بی‌بها با اقدام صریح ارزش‌گذاری می‌شود ({{POST /inventory/unvalued/value}}).',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'فروش امروز و تعداد فاکتور', source: '{{GET /analytics/dashboard}}' },
      { what: 'صندوق باز و مانده‌ی نقد', source: '{{GET /pos/sessions/current}}' },
      { what: 'کالاهای رو به اتمام', source: '{{GET /inventory/reorder-suggestions}}' },
      { what: 'طلب از مشتریان', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
      { what: 'کالای راکد', source: '{{GET /inventory/dead-stock}}' },
    ],
    pages: [INVOICE_PAGE, STOCK_PAGE, TILL_PAGE, CUSTOMER_PAGE, ACCOUNTING_PAGE, TEAM_PAGE],
    accounting: [
      ACC_SALES,
      ACC_ADVANCE,
      ACC_FX,
      'ارزش موجودی = قیمت خرید؛ روش بها (FIFO یا میانگین موزون) در تنظیمات انبار است ({{GET /inventory/settings}}).',
      'فروش بیش از موجودی رد نمی‌شود؛ ثبت می‌شود و تعارض می‌سازد.',
    ],
    bySize: SIZE,
  },
  wholesale: {
    title: 'عمده‌فروشی',
    model:
      'کالا در حجم زیاد به کسب‌وکارهای دیگر فروخته می‌شود؛ فروش بیشتر نسیه و با مشتری نام‌دار است، قیمت به مشتری و مقدار بستگی دارد و وصول طلب به اندازه‌ی فروش مهم است.',
    cycle: [
      'قرارداد و قیمت با مشتری',
      'سفارش خرید',
      'دریافت کالا',
      'فروش نسیه',
      'وصول طلب',
      'تسویه با تأمین‌کننده',
    ],
    workflows: [
      {
        title: 'اصلی (فروش عمده)',
        steps: [
          'فهرست قیمت هر مشتری ({{GET /price-lists/for-customer/:x}}) در [[/invoices?tab=pricing]].',
          SALE,
          'واحد بسته و فله روی همان خط انتخاب می‌شود.',
          PAY,
        ],
      },
      {
        title: 'مالی (وصول)',
        steps: [
          'فاکتورهای باز هر مشتری ({{GET /payments/open-invoices/:x/:x}}).',
          PAY,
          'پرداخت فقط فاکتور هم‌ارز خودش را تسویه می‌کند.',
          'پیگیری وصول در [[/customers?tab=outreach]].',
        ],
      },
      {
        title: 'منابع (تأمین)',
        steps: [
          'سفارش خرید ({{POST /purchase-orders}}) و دریافت ({{POST /purchase-orders/:x/receive}}).',
          PURCHASE,
          'انتقال بین انبارها ({{POST /stock-transfers}}).',
          'موجودی هر انبار ({{GET /warehouses/overview}}).',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      {
        what: 'طلب سررسیدشده',
        source: '{{GET /customers}} و {{GET /payments/open-invoices/:x/:x}}',
      },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'سفارش خرید در راه', source: '{{GET /purchase-orders}}' },
      { what: 'موجودی هر انبار', source: '{{GET /warehouses/overview}}' },
      { what: 'سود به تفکیک ارز', source: '{{GET /accounting/profit-report/by-currency}}' },
    ],
    pages: [INVOICE_PAGE, CUSTOMER_PAGE, STOCK_PAGE, ACCOUNTING_PAGE, TEAM_PAGE],
    accounting: [
      ACC_SALES,
      ACC_FX,
      ACC_ADVANCE,
      'سقف اعتبار و مهلت پرداخت مشتری فقط با اتصال خوانده می‌شود ({{PATCH /customers/:x/terms}}).',
      'پیش‌خرید سمت تأمین‌کننده همان موتور بیعانه است، با نقش دیگر.',
    ],
    bySize: SIZE,
  },
  personal_services: {
    title: 'خدمات شخصی',
    model:
      'خدمت به یک آدم، در یک زمان و به دست یک متخصص داده می‌شود. آنچه فروخته می‌شود وقت است؛ نوبت خالی یا نیامدن مشتری همان اتلاف است. مواد مصرفی کنار خدمت خرج می‌شود.',
    cycle: [
      'نوبت‌دهی',
      'حضور مشتری',
      'ارائه‌ی خدمت',
      'فاکتور و دریافت',
      'کمیسیون متخصص',
      'نوبت بعد',
    ],
    workflows: [
      {
        title: 'اصلی (نوبت تا تحویل)',
        steps: [
          'نوبت = جلسه‌ی خدمت ({{POST /service-delivery/sessions}}).',
          '«حاضر شد / شروع شد / نیامد» بدون پول ({{POST /service-delivery/sessions/:x/status}}).',
          'تحویل خدمت فاکتور می‌سازد ({{POST /service-delivery/sessions/:x/deliver}}).',
          PAY,
        ],
      },
      {
        title: 'مالی',
        steps: [
          'بیعانه‌ی نوبت پیش‌دریافت مشتری است ({{GET /customers/:x/deposits}}).',
          TILL_OPEN,
          'کمیسیون از نرخ تعریف‌شده حساب می‌شود ({{GET /provider-commissions}}) — بی‌نرخ، کمیسیونی ساخته نمی‌شود.',
          TILL_CLOSE,
        ],
      },
      {
        title: 'منابع (وقت و مواد)',
        steps: [
          'صندلی/اتاق با رزرو منبع نگه داشته می‌شود ({{POST /resource-bookings}}).',
          'مواد مصرفی کالاست و با خرید وارد می‌شود ([[/invoices?type=purchase]]).',
          'ضایعات مواد ({{POST /products/:x/waste}}) — فقط آنلاین.',
          'لغو جلسه ({{POST /service-delivery/sessions/:x/cancel}}).',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      {
        what: 'نوبت‌های امروز به تفکیک متخصص و وضعیت',
        source: '{{GET /analytics/dashboard/today-sessions}}',
      },
      {
        what: 'بیعانه‌ی نگه‌داشته',
        source: '{{GET /analytics/dashboard/today-sessions}} (به تفکیک ارز)',
      },
      { what: 'فروش امروز', source: '{{GET /analytics/dashboard}}' },
      { what: 'کمیسیون دوره', source: '{{GET /provider-commissions}}' },
      {
        what: 'مشتریانی که نیامدند',
        source: '{{GET /service-delivery/sessions}} (وضعیت `no_show`)',
      },
    ],
    pages: [
      {
        route: '/customers',
        use: 'جلسه‌های خدمت و پیگیری مشتری ({{GET /service-delivery/sessions}}).',
      },
      INVOICE_PAGE,
      TILL_PAGE,
      TEAM_PAGE,
      STOCK_PAGE,
    ],
    accounting: [
      ACC_ADVANCE,
      ACC_SALES,
      'کمیسیون از قاعده و نرخ می‌آید، نه از درصدی روی کل فروش.',
      'جلسه‌ی «نیامد» درآمد نیست؛ بیعانه‌اش طبق تصمیم کسب‌وکار برگشت یا ضبط می‌شود.',
    ],
    bySize: SIZE,
  },
  education: {
    title: 'آموزش',
    model:
      'بسته‌ای از جلسه فروخته می‌شود و در طول زمان مصرف می‌شود. پول گرفته‌شده، جلسه‌های مانده و درآمد تحقق‌یافته سه عدد جدا هستند؛ حضور شاگرد همان مصرف اعتبار است.',
    cycle: ['ثبت‌نام', 'فروش بسته', 'برنامه‌ی جلسه', 'حضور و کسر جلسه', 'تمدید', 'تسویه‌ی مدرس'],
    workflows: [
      {
        title: 'اصلی (ثبت‌نام تا کسر جلسه)',
        steps: [
          'شاگرد یک مشتری است ({{POST /customers}}).',
          'فروش بسته با فاکتور ({{POST /invoices}}) اعتبار می‌دهد ({{POST /package-credits/grant}}).',
          'جلسه ثبت می‌شود ({{POST /service-delivery/sessions}}).',
          'تحویل جلسه یک واحد اعتبار کم می‌کند ({{POST /package-credits/consume}}).',
        ],
      },
      {
        title: 'مالی',
        steps: [
          PAY,
          'اقساط شهریه ({{PUT /invoices/:x/installments}}).',
          'مانده‌ی اعتبار هر شاگرد ({{GET /package-credits/balance}}).',
          'برگشت اعتبار اشتباه ({{POST /package-credits/reverse}}).',
        ],
      },
      {
        title: 'منابع (کلاس و مدرس)',
        steps: [
          'کلاس/اتاق با رزرو منبع ({{POST /resource-bookings}}).',
          'انقضای اعتبار ({{POST /package-credits/expire}}).',
          'تعلیق بسته ({{POST /package-credits/grants/:x/suspension}}).',
          'ظرفیت کلاس در محصول نیست — در بخش شکاف‌ها آمده است.',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      {
        what: 'شاگردانی که جلسه‌ی مانده‌ی کم دارند',
        source: '{{GET /analytics/dashboard/package-credits-low}}',
      },
      { what: 'جلسه‌های امروز', source: '{{GET /analytics/dashboard/today-sessions}}' },
      { what: 'شهریه‌ی دریافت‌نشده', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'دفتر اعتبار', source: '{{GET /package-credits/ledger}}' },
    ],
    pages: [
      { route: '/customers', use: 'شاگرد، بسته‌ها و جلسه‌ها ({{GET /package-credits/grants}}).' },
      INVOICE_PAGE,
      TEAM_PAGE,
      ACCOUNTING_PAGE,
    ],
    accounting: [
      'پول بسته ≠ جلسه‌ی مانده ≠ درآمد تحقق‌یافته: پول هنگام فروش می‌آید، درآمد با هر جلسه‌ی تحویل‌شده.',
      ACC_ADVANCE,
      ACC_SALES,
      'اعتبار منقضی طبق قاعده‌ی خود بسته بسته می‌شود، نه با حدس.',
    ],
    bySize: SIZE,
  },
  repairs: {
    title: 'تعمیرات',
    model:
      'کالای مشتری تحویل گرفته، عیب‌یابی، تعمیر و پس داده می‌شود. کالا مال مشتری است و در امانت می‌ماند؛ درآمد از دستمزد و قطعه است و هر کار یک پرونده با وضعیت دارد.',
    cycle: [
      'پذیرش',
      'عیب‌یابی و برآورد',
      'تأیید مشتری',
      'تعمیر و مصرف قطعه',
      'آماده',
      'تحویل و تسویه',
    ],
    workflows: [
      {
        title: 'اصلی (پرونده‌ی تعمیر)',
        steps: [
          'پذیرش پرونده می‌سازد ({{POST /repair-tickets}}).',
          'برآورد را مشتری تأیید می‌کند ({{POST /repair-tickets/:x/approve}}).',
          'وضعیت جلو می‌رود ({{POST /repair-tickets/:x/status}}).',
          'صورت‌حساب از خود پرونده ({{POST /repair-tickets/:x/bill}}).',
        ],
      },
      {
        title: 'مالی',
        steps: [
          'بیعانه‌ی تعمیر پیش‌دریافت است ({{GET /customers/:x/deposits}}).',
          PAY,
          'گارانتی کار ({{POST /warranties}}).',
          TILL_CLOSE,
        ],
      },
      {
        title: 'منابع (قطعه)',
        steps: [
          'قطعه برای پرونده نگه داشته می‌شود ({{POST /repair-tickets/:x/parts}}).',
          'مصرف قطعه از انبار ({{POST /repair-tickets/:x/parts/:x/consume}}).',
          'آزادکردن قطعه‌ی مصرف‌نشده ({{POST /repair-tickets/:x/parts/:x/release}}).',
          PURCHASE,
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      {
        what: 'پرونده‌های باز به تفکیک وضعیت',
        source: '{{GET /analytics/dashboard/open-repair-tickets}}',
      },
      { what: 'کارهای آماده‌ی تحویل', source: '{{GET /repair-tickets}} (وضعیت `ready`)' },
      { what: 'منتظر قطعه', source: '{{GET /repair-tickets}} (وضعیت `waiting_parts`)' },
      { what: 'فروش امروز', source: '{{GET /analytics/dashboard}}' },
      { what: 'قطعه‌های رو به اتمام', source: '{{GET /inventory/reorder-suggestions}}' },
    ],
    pages: [
      { route: '/customers', use: 'پرونده‌های تعمیر هر مشتری ({{GET /repair-tickets}}).' },
      INVOICE_PAGE,
      STOCK_PAGE,
      TILL_PAGE,
      TEAM_PAGE,
    ],
    accounting: [
      ACC_ADVANCE,
      ACC_SALES,
      'کالای مشتری در امانت است و موجودی کسب‌وکار نیست.',
      'قطعه‌ی مصرف‌شده از لایه‌ی بهای خودش کم می‌شود؛ بهای نامعلوم «نامعلوم» می‌ماند.',
    ],
    bySize: SIZE,
  },
  food_hospitality: {
    title: 'غذا و پذیرایی',
    model:
      'مواد اولیه خریده، به غذا تبدیل و همان روز فروخته می‌شود. فروش پرتعداد و نقدی است، مواد فاسدشدنی است و بهای هر بشقاب از دستور پخت می‌آید.',
    cycle: ['خرید مواد', 'آماده‌سازی', 'سفارش', 'فروش و دریافت', 'ضایعات', 'بستن صندوق'],
    workflows: [
      {
        title: 'اصلی (سفارش تا دریافت)',
        steps: [
          TILL_OPEN,
          'سفارش روی صندوق ({{POST /pos/sessions/:x/orders}}) یا فاکتور ({{POST /invoices}}).',
          PAY,
          TILL_CLOSE,
        ],
      },
      {
        title: 'مالی',
        steps: [
          'ورود و خروج نقد ({{POST /pos/sessions/:x/cash}}).',
          'ابطال سفارش ({{POST /pos/orders/:x/void}}).',
          'جریان نقد صندوق ({{GET /pos/cash-flow}}).',
          PAY,
        ],
      },
      {
        title: 'منابع (مواد و دستور پخت)',
        steps: [
          PURCHASE,
          'دستور پخت = فرمول ساخت ({{PUT /manufacturing/definitions}}) در [[/manufacturing]] — فقط آنلاین.',
          'ثبت تولید مواد را کم می‌کند ({{POST /manufacturing/produce}}).',
          'ضایعات ({{POST /products/:x/waste}}) — فقط آنلاین.',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'فروش امروز', source: '{{GET /analytics/dashboard}}' },
      { what: 'صندوق باز', source: '{{GET /pos/sessions/current}}' },
      { what: 'مواد رو به اتمام', source: '{{GET /inventory/reorder-suggestions}}' },
      { what: 'بهای تولید', source: '{{GET /manufacturing/report}} (فقط آنلاین)' },
      { what: 'جریان نقد', source: '{{GET /pos/cash-flow}}' },
    ],
    pages: [
      TILL_PAGE,
      INVOICE_PAGE,
      STOCK_PAGE,
      { route: '/manufacturing', use: 'دستور پخت و ثبت تولید ({{GET /manufacturing/runs}}).' },
      TEAM_PAGE,
    ],
    accounting: [
      ACC_SALES,
      'بهای تولید چهار رقم اعشار می‌گیرد تا مواد ارزان صفر نشود.',
      'تولید سند دفتر کل نمی‌زند و فقط آنلاین است.',
      ACC_ADVANCE,
    ],
    bySize: SIZE,
  },
  health: {
    title: 'سلامت',
    model:
      'کالای تاریخ‌دار (دارو، عدسی) و خدمت نوبتی (ویزیت) کنار هم‌اند. تاریخ انقضا و سری ساخت باید روی هر فروش دنبال شود و نوبت بیمار همان جلسه‌ی خدمت است.',
    cycle: [
      'خرید با سری و تاریخ',
      'نگهداری',
      'نوبت یا مراجعه',
      'فروش/خدمت',
      'دریافت',
      'کنترل تاریخ',
    ],
    workflows: [
      {
        title: 'اصلی',
        steps: [
          'نوبت بیمار ({{POST /service-delivery/sessions}}).',
          SALE,
          'کالای تاریخ‌دار از نزدیک‌ترین تاریخ برداشته می‌شود (تخصیص سری روی سرور).',
          PAY,
        ],
      },
      {
        title: 'مالی',
        steps: [PAY, TILL_OPEN, 'مرجوعی ({{POST /invoices/:x/returns}}).', TILL_CLOSE],
      },
      {
        title: 'منابع (کالای تاریخ‌دار)',
        steps: [
          PURCHASE,
          'کالاهای رو به انقضا در [[/warehouse?tab=expiry]].',
          'انتقال بین انبارها ({{POST /stock-transfers}}).',
          'شمارش دوره‌ای ({{POST /cycle-counts}}) — فقط آنلاین.',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'نوبت‌های امروز', source: '{{GET /analytics/dashboard/today-sessions}}' },
      { what: 'فروش امروز', source: '{{GET /analytics/dashboard}}' },
      { what: 'کالای رو به انقضا', source: 'بخش انقضا در [[/warehouse?tab=expiry]]' },
      { what: 'کالای رو به اتمام', source: '{{GET /inventory/reorder-suggestions}}' },
      { what: 'طلب از بیماران/بیمه', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
    ],
    pages: [STOCK_PAGE, INVOICE_PAGE, CUSTOMER_PAGE, TILL_PAGE, TEAM_PAGE],
    accounting: [
      ACC_SALES,
      ACC_ADVANCE,
      'سری و تاریخ روی دستگاه فقط آن چیزی است که همان دستگاه نوشته؛ تخصیص نهایی با سرور است.',
      'داده‌ی پزشکی بیمار در محصول نگه داشته نمی‌شود.',
    ],
    bySize: SIZE,
  },
  manufacturing: {
    title: 'تولید',
    model:
      'مواد اولیه به کالای تمام‌شده تبدیل می‌شود. بهای محصول از فرمول ساخت، مواد مصرف‌شده و هزینه‌های کار می‌آید و فروش مثل عمده یا خرده است.',
    cycle: ['خرید مواد', 'فرمول ساخت', 'ثبت تولید', 'انبار محصول', 'فروش', 'بهای تمام‌شده'],
    workflows: [
      {
        title: 'اصلی (تولید)',
        steps: [
          'فرمول ساخت ذخیره می‌شود ({{PUT /manufacturing/definitions}}) — استفاده‌شده ویرایش نمی‌شود، بازنگری می‌شود.',
          '«تکمیل» یعنی ثبت تولید ({{POST /manufacturing/produce}}).',
          'تاریخچه از snapshot همان اجرا خوانده می‌شود ({{GET /manufacturing/runs/:x}}).',
          SALE,
        ],
      },
      {
        title: 'مالی',
        steps: [
          PAY,
          'گزارش بهای تولید ({{GET /manufacturing/report}}).',
          'سود به تفکیک ارز ({{GET /accounting/profit-report/by-currency}}).',
          'سند دستی دفتر ({{POST /accounting/journal}}).',
        ],
      },
      {
        title: 'منابع (مواد)',
        steps: [
          PURCHASE,
          'سفارش خرید ({{POST /purchase-orders}}).',
          'موجودی هر انبار ({{GET /warehouses/overview}}).',
          'انتقال بین انبارها ({{POST /stock-transfers}}).',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'تولید دوره', source: '{{GET /manufacturing/runs}} (فقط آنلاین)' },
      { what: 'مواد رو به اتمام', source: '{{GET /inventory/reorder-suggestions}}' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'بهای تولید', source: '{{GET /manufacturing/report}}' },
      { what: 'سفارش خرید در راه', source: '{{GET /purchase-orders}}' },
    ],
    pages: [
      { route: '/manufacturing', use: 'فرمول، ثبت تولید و گزارش ({{GET /manufacturing/runs}}).' },
      STOCK_PAGE,
      INVOICE_PAGE,
      ACCOUNTING_PAGE,
      TEAM_PAGE,
    ],
    accounting: [
      'تولید فقط آنلاین است و سند دفتر کل نمی‌زند (کار در جریان و سربار تصمیم صاحب کار است).',
      'گردکردن بها چهار رقم اعشار است، جدا از گردکردن قیمت.',
      ACC_SALES,
      ACC_FX,
    ],
    bySize: SIZE,
  },
  construction: {
    title: 'ساخت‌وساز',
    model:
      'کار پروژه‌ای است: قرارداد، پیش‌پرداخت، مصرف مصالح و دستمزد در طول ماه‌ها، و صورت‌وضعیت. هزینه باید به پروژه نسبت داده شود تا سود هر پروژه معلوم باشد.',
    cycle: ['قرارداد', 'پیش‌دریافت', 'خرید مصالح', 'اجرا و دستمزد', 'صورت‌وضعیت', 'تسویه'],
    workflows: [
      {
        title: 'اصلی (پروژه)',
        steps: [
          'کارفرما یک مشتری است ({{POST /customers}}).',
          'هر صورت‌وضعیت یک فاکتور فروش است ({{POST /invoices}}).',
          'پیش‌دریافت کارفرما بدهی می‌ماند ({{GET /customers/:x/deposits}}).',
          PAY,
        ],
      },
      {
        title: 'مالی',
        steps: [
          PAY,
          'اقساط دریافت ({{PUT /invoices/:x/installments}}).',
          'سود به تفکیک مرکز هزینه ({{GET /accounting/profit-report/cost-objects}}) — فقط آنلاین.',
          'سند دستی ({{POST /accounting/journal}}).',
        ],
      },
      {
        title: 'منابع (مصالح)',
        steps: [
          PURCHASE,
          'سفارش خرید ({{POST /purchase-orders}}).',
          'انتقال مصالح بین انبارها ({{POST /stock-transfers}}).',
          'موجودی هر انبار ({{GET /warehouses/overview}}).',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'طلب از کارفرمایان', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
      { what: 'پیش‌دریافت نگه‌داشته', source: '{{GET /customers/:x/deposits}}' },
      {
        what: 'سود هر مرکز هزینه',
        source: '{{GET /accounting/profit-report/cost-objects}} (فقط آنلاین)',
      },
      { what: 'بدهی به تأمین‌کننده', source: '{{GET /customers}} (نقش تأمین‌کننده)' },
      { what: 'حقوق دوره', source: '{{GET /payrolls/summary}}' },
    ],
    pages: [INVOICE_PAGE, CUSTOMER_PAGE, ACCOUNTING_PAGE, STOCK_PAGE, TEAM_PAGE],
    accounting: [
      ACC_ADVANCE,
      ACC_SALES,
      ACC_FX,
      'هزینه‌ی پروژه فقط وقتی به پروژه می‌رسد که مرکز هزینه‌اش گفته شده باشد؛ حدس زده نمی‌شود.',
    ],
    bySize: SIZE,
  },
  transport: {
    title: 'حمل‌ونقل',
    model:
      'خدمت جابه‌جایی فروخته می‌شود: بار یا مسافر، با وسیله و راننده. درآمد به سفر و مسافت بسته است و هزینه‌ی اصلی سوخت، نگهداری و دستمزد است.',
    cycle: ['سفارش حمل', 'تخصیص وسیله', 'سفر', 'تحویل', 'صورت‌حساب', 'تسویه‌ی راننده'],
    workflows: [
      {
        title: 'اصلی (سفر)',
        steps: [
          'سفر به‌صورت جلسه‌ی خدمت ثبت می‌شود ({{POST /service-delivery/sessions}}).',
          'تحویل فاکتور می‌سازد ({{POST /service-delivery/sessions/:x/deliver}}).',
          PAY,
          'وسیله با رزرو منبع نگه داشته می‌شود ({{POST /resource-bookings}}).',
        ],
      },
      {
        title: 'مالی',
        steps: [
          PAY,
          'فاکتورهای باز هر مشتری ({{GET /payments/open-invoices/:x/:x}}).',
          'هزینه‌ی سوخت = فاکتور خرید ([[/invoices?type=purchase]]).',
          'سود به تفکیک ارز ({{GET /accounting/profit-report/by-currency}}).',
        ],
      },
      {
        title: 'منابع (وسیله)',
        steps: [
          'رزرو وسیله ({{GET /resource-bookings}}).',
          'آزادکردن رزرو ({{POST /resource-bookings/:x/release}}).',
          'قطعه و سوخت کالاست ({{GET /products}}).',
          'ناوگان و اعزام در محصول نیست — در بخش شکاف‌ها آمده است.',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'سفرهای امروز', source: '{{GET /analytics/dashboard/today-sessions}}' },
      { what: 'طلب از مشتریان', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'رزرو وسیله‌ها', source: '{{GET /resource-bookings}}' },
      { what: 'حقوق دوره', source: '{{GET /payrolls/summary}}' },
    ],
    pages: [CUSTOMER_PAGE, INVOICE_PAGE, TEAM_PAGE, ACCOUNTING_PAGE],
    accounting: [ACC_SALES, ACC_ADVANCE, ACC_FX, 'سفر تحویل‌نشده درآمد نیست.'],
    bySize: SIZE,
  },
  tourism_lodging: {
    title: 'اقامت و گردشگری',
    model:
      'رزرو برای تاریخ آینده فروخته می‌شود: بلیت، تور یا اتاق. پول پیش از خدمت می‌آید، بخش بزرگی از آن مال تأمین‌کننده است و لغو و برگشت پول عادی است.',
    cycle: [
      'درخواست',
      'رزرو و بیعانه',
      'تأیید تأمین‌کننده',
      'صدور',
      'خدمت',
      'تسویه با تأمین‌کننده',
    ],
    workflows: [
      {
        title: 'اصلی (رزرو)',
        steps: [
          'رزرو با منبع و بازه ({{POST /resource-bookings}}).',
          'بیعانه پیش‌دریافت است ({{GET /customers/:x/deposits}}).',
          SALE,
          PAY,
        ],
      },
      {
        title: 'مالی',
        steps: [
          PAY,
          'برگشت پول مرجوعی جدا از سند مرجوعی است ({{POST /invoices/:x/returns/:x/refunds}}) — فقط آنلاین.',
          'سهم تأمین‌کننده = فاکتور خرید ([[/invoices?type=purchase]]).',
          'نرخ ارز روی هر فاکتور منجمد است.',
        ],
      },
      {
        title: 'منابع (ظرفیت)',
        steps: [
          'فهرست رزروها ({{GET /resource-bookings}}).',
          'آزادکردن رزرو ({{POST /resource-bookings/:x/release}}).',
          'دو دستگاه آفلاین که یک بازه را بگیرند تعارض صریح می‌سازند، نه آخرین‌نویسنده.',
          'شب‌اقامت در محصول نیست — در بخش شکاف‌ها آمده است.',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'رزروهای پیش رو', source: '{{GET /resource-bookings}}' },
      { what: 'بیعانه‌ی نگه‌داشته', source: '{{GET /customers/:x/deposits}}' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'بدهی به تأمین‌کننده', source: '{{GET /customers}} (نقش تأمین‌کننده)' },
      { what: 'سود به تفکیک ارز', source: '{{GET /accounting/profit-report/by-currency}}' },
    ],
    pages: [CUSTOMER_PAGE, INVOICE_PAGE, ACCOUNTING_PAGE, TEAM_PAGE],
    accounting: [ACC_ADVANCE, ACC_FX, ACC_SALES, 'پولی که مال تأمین‌کننده است درآمد نیست.'],
    bySize: SIZE,
  },
  professional_office: {
    title: 'حرفه‌ای و اداری',
    model:
      'دانش و وقت فروخته می‌شود: مشاوره، نگهبانی، واسطه‌گری ملک. کالایی در کار نیست، قرارداد ماهانه یا پروژه‌ای است و درآمد از صورت‌حساب دوره‌ای می‌آید.',
    cycle: ['قرارداد', 'انجام کار', 'ثبت ساعت/خدمت', 'صورت‌حساب', 'وصول', 'گزارش به مشتری'],
    workflows: [
      {
        title: 'اصلی (خدمت تا صورت‌حساب)',
        steps: [
          'مشتری و شرایطش ({{POST /customers}}).',
          'خدمت انجام‌شده = جلسه ({{POST /service-delivery/sessions}}).',
          SALE,
          PAY,
        ],
      },
      {
        title: 'مالی',
        steps: [
          'فاکتورهای باز ({{GET /payments/open-invoices/:x/:x}}).',
          PAY,
          'پیگیری وصول در [[/customers?tab=outreach]].',
          'ساعت کار در [[/team-and-payroll?tab=pay&view=timesheets]].',
        ],
      },
      {
        title: 'منابع (آدم و وقت)',
        steps: [
          'کارمندان ({{GET /employees}}).',
          'حضور و غیاب ({{GET /attendance-sheet}}).',
          'مرخصی ({{GET /leaves}}).',
          'صورت‌حساب از روی ساعت کار در محصول نیست — در بخش شکاف‌ها آمده است.',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'طلب از مشتریان', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'خدمت‌های امروز', source: '{{GET /analytics/dashboard/today-sessions}}' },
      { what: 'حقوق دوره', source: '{{GET /payrolls/summary}}' },
      { what: 'سود به تفکیک ارز', source: '{{GET /accounting/profit-report/by-currency}}' },
    ],
    pages: [CUSTOMER_PAGE, INVOICE_PAGE, TEAM_PAGE, ACCOUNTING_PAGE],
    accounting: [
      ACC_SALES,
      ACC_ADVANCE,
      ACC_FX,
      'خدمت انجام‌نشده درآمد نیست، حتی اگر پولش آمده باشد.',
    ],
    bySize: SIZE,
  },
  finance_trading: {
    title: 'مالی و بازرگانی',
    model:
      'خودِ پول یا یک دارایی گران کالاست: صرافی، حواله، خرید و فروش خودرو. هر معامله دو ارز یا یک دارایی یکتا دارد، حاشیه‌ی سود کم و اشتباه نرخ گران است.',
    cycle: ['نرخ روز', 'معامله', 'دریافت و پرداخت', 'تسعیر', 'تطبیق صندوق', 'گزارش'],
    workflows: [
      {
        title: 'اصلی (معامله)',
        steps: [
          SALE,
          'ارز فاکتور ≠ ارز دفاتر ⇒ نرخ اجباری است و روی فاکتور منجمد می‌شود.',
          PAY,
          'دارایی یکتا (خودرو) با سریال دنبال می‌شود.',
        ],
      },
      {
        title: 'مالی',
        steps: [
          'هر ارز صندوق خودش را دارد ({{POST /pos/sessions}}).',
          'انتقال بانکی از صندوق ({{POST /pos/sessions/:x/bank-transfer}}).',
          'سود و زیان تسعیر با پرداخت شناخته می‌شود.',
          TILL_CLOSE,
        ],
      },
      {
        title: 'منابع (نقد و دارایی)',
        steps: [
          'سرمایه‌ی اول صندوق ({{POST /pos/opening-capital}}).',
          'دفتر صندوق ({{GET /pos/sessions/:x/ledger}}).',
          PURCHASE,
          'خزانه در [[/accounting?tab=treasury]].',
        ],
      },
      PEOPLE,
      MANAGE,
    ],
    dashboard: [
      { what: 'مانده‌ی هر صندوق به ارز خودش', source: '{{GET /pos/sessions/open}}' },
      { what: 'سود به تفکیک ارز', source: '{{GET /accounting/profit-report/by-currency}}' },
      { what: 'طلب و بدهی به تفکیک ارز', source: '{{GET /customers}}' },
      { what: 'جریان نقد', source: '{{GET /pos/cash-flow}}' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
    ],
    pages: [TILL_PAGE, INVOICE_PAGE, CUSTOMER_PAGE, ACCOUNTING_PAGE, TEAM_PAGE],
    accounting: [
      ACC_FX,
      'نقد به نرخ روز پرداخت، بدهی به نرخ فاکتور؛ تفاوت به حساب سود و زیان تسعیر می‌رود.',
      'جمع پول بدون ارز بی‌صدا غلط است؛ هر جمعی به تفکیک ارز است.',
      ACC_SALES,
    ],
    bySize: SIZE,
  },
}

// ─── The four representative trades ─────────────────────────────────────────

export interface Operation {
  readonly action: string
  /** `METHOD /path` — the offline column is read from the matrix, not typed. */
  readonly endpoint: string
  readonly books: string
  readonly stock: string
  readonly onFailure: string
}

export interface PageSpec {
  readonly route: string
  readonly purpose: string
  /** Top to bottom. */
  readonly layout: readonly string[]
  readonly data: readonly string[]
  readonly changes: string
}

export interface Gap {
  readonly need: string
  readonly status:
    'NEW_CAPABILITY_REQUIRED' | 'EXISTING_BUT_INCOMPLETE' | 'NOT_SUPPORTED' | 'BLOCKED_EXTERNAL'
  readonly plan: string
}

export interface RepresentativeSpec {
  /** Other ids that read this spec instead of repeating it. */
  readonly alsoCovers: readonly IndustryKey[]
  readonly day: readonly string[]
  readonly pages: readonly PageSpec[]
  readonly operations: readonly Operation[]
  readonly kpis: readonly DashboardPriority[]
  readonly roles: readonly { readonly role: string; readonly does: string }[]
  readonly gaps: readonly Gap[]
}

const ROLE_NOTE =
  'نقش پایه (`owner`، `admin`، `member`، `viewer`) را سرور می‌سنجد؛ نقش سفارشی که کسب‌وکار در [[/governance?tab=permissions]] می‌سازد جایگزین مجموعه‌ی نقش پایه می‌شود. صفحه‌ی ممنوع mount نمی‌شود.'

export const REPRESENTATIVES: Readonly<Partial<Record<IndustryKey, RepresentativeSpec>>> = {
  clothing: {
    alsoCovers: ['shoes'],
    day: [
      'باز کردن صندوق در [[/till]].',
      'فروش: انتخاب کالا، بعد سایز و رنگ روی همان خط فاکتور ([[/invoices/new]]).',
      'تعویض یا مرجوعی روی فاکتور اصلی.',
      'بررسی سایز/رنگ‌های رو به اتمام روی داشبورد.',
      'خرید جنس تازه با فاکتور خرید ([[/invoices?type=purchase]]).',
      'بستن صندوق.',
    ],
    pages: [
      {
        route: '/dashboard',
        purpose: 'شروع روز: کدام سایز/رنگ کم است.',
        layout: ['قطعه‌ی «سایز/رنگ رو به اتمام»', 'شاخص‌های فروش', 'صف کار', 'نمودار فروش'],
        data: ['{{GET /analytics/dashboard/low-stock-variants}}', '{{GET /analytics/dashboard}}'],
        changes: 'قطعه‌ی سایز/رنگ اول می‌آید؛ بقیه همان داشبورد عمومی است.',
      },
      {
        route: '/warehouse/:id',
        purpose: 'یک مدل لباس با همه‌ی سایز و رنگ‌هایش.',
        layout: ['مشخصات مدل', 'جدول سایز × رنگ با موجودی هر خانه', 'موجودی هر انبار'],
        data: [
          '{{GET /products/:x/variants}}',
          '{{GET /products/:x/variants/stock}}',
          '{{GET /products/:x/warehouse-breakdown}}',
        ],
        changes:
          'جدول سایز × رنگ فقط برای کالای واریانت‌دار دیده می‌شود. موجودی هر واریانت فقط آنلاین خوانده می‌شود.',
      },
      {
        route: '/invoices/new',
        purpose: 'فروش با انتخاب سایز و رنگ.',
        layout: ['مشتری (اختیاری)', 'خط‌های کالا با انتخاب واریانت', 'تخفیف و جمع', 'پرداخت'],
        data: ['{{GET /products}}', '{{GET /products/:x/variants}}', '{{POST /invoices}}'],
        changes: 'واریانت روی خط فاکتور انتخاب می‌شود؛ فرم همان فاکتورساز مشترک است.',
      },
    ],
    operations: [
      {
        action: 'فروش',
        endpoint: 'POST /invoices',
        books: 'درآمد و دریافتنی/نقد؛ بهای فروش از لایه‌ها',
        stock: 'کسر از واریانت و انبار انتخاب‌شده',
        onFailure: 'پیام سرور زیر همان فیلد؛ چیزی نیمه‌ثبت نمی‌ماند',
      },
      {
        action: 'دریافت پول',
        endpoint: 'POST /payments',
        books: 'نقد/بانک در برابر دریافتنی',
        stock: '—',
        onFailure: 'پرداخت ارز دیگر روی فاکتور رد می‌شود',
      },
      {
        action: 'مرجوعی',
        endpoint: 'POST /invoices/:x/returns',
        books: 'اعتبار مشتری؛ بازپرداخت جداست',
        stock: 'برگشت به همان واریانت',
        onFailure: 'بیش از مقدار فروخته‌شده رد می‌شود',
      },
      {
        action: 'تعویض',
        endpoint: 'POST /invoices/:x/exchange',
        books: 'تفاوت دو کالا',
        stock: 'یکی برمی‌گردد، یکی می‌رود',
        onFailure: 'فقط آنلاین',
      },
      {
        action: 'ساخت جدول سایز × رنگ',
        endpoint: 'POST /products/:x/variants/matrix',
        books: '—',
        stock: 'واریانت ساخته می‌شود، موجودی نه',
        onFailure: 'فقط آنلاین',
      },
      {
        action: 'موجودی اول یک واریانت',
        endpoint: 'POST /products/:x/variants/:x/stock',
        books: '—',
        stock: 'حرکت انبار برای همان واریانت',
        onFailure: 'فقط آنلاین',
      },
    ],
    kpis: [
      { what: 'سایز/رنگ‌های زیر حد', source: '{{GET /analytics/dashboard/low-stock-variants}}' },
      { what: 'سود هر واریانت', source: '{{GET /accounting/profit-report/variants}} (فقط آنلاین)' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'کالای راکد', source: '{{GET /inventory/dead-stock}}' },
      { what: 'ارزش موجودی', source: '{{GET /warehouses/overview}}' },
    ],
    roles: [
      { role: 'صاحب کار', does: 'همه چیز، از جمله قیمت خرید و سود.' },
      {
        role: 'فروشنده (member)',
        does: 'فاکتور، دریافت، مرجوعی؛ قیمت خرید را فقط اگر نقشش اجازه بدهد می‌بیند.',
      },
      { role: 'بیننده (viewer)', does: 'فقط می‌خواند.' },
    ],
    gaps: [
      {
        need: 'حد سفارش دوباره برای هر سایز/رنگ',
        status: 'EXISTING_BUT_INCOMPLETE',
        plan: 'قطعه‌ی داشبورد از حد خود واریانت می‌خواند؛ فرم تعیین حد برای هر واریانت باید سنجیده شود.',
      },
      {
        need: 'فصل، مجموعه (کالکشن) و برند',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'فیلدی برای فصل و برند در مدل کالا نیست؛ دسته‌بندی آزاد می‌تواند جایش بنشیند. سایز و رنگ واقعی‌اند و روی `product_variants.attributes` می‌نشینند، نه روی فرم کالا.',
      },
      {
        need: 'موجودی هر واریانت در حالت آفلاین',
        status: 'EXISTING_BUT_INCOMPLETE',
        plan: 'خواندن موجودی واریانت در ماتریس «فقط آنلاین» است.',
      },
      {
        need: 'قفل صفحه‌ی دستگاه با رمز',
        status: 'NOT_SUPPORTED',
        plan: 'دستگاه مشترک فروشگاه رمز و قفل ندارد؛ بدون ذخیره‌ی امن و کنترل امنیتی ساخته نمی‌شود.',
      },
    ],
  },
  beautySalon: {
    alsoCovers: ['barber'],
    day: [
      'دیدن نوبت‌های امروز روی داشبورد.',
      'مشتری آمد: «حاضر شد».',
      'خدمت شروع و تمام می‌شود؛ تحویل فاکتور می‌سازد.',
      'دریافت پول؛ بیعانه‌ی قبلی از همان فاکتور کم می‌شود.',
      'مشتری‌ای که نیامد «نیامد» ثبت می‌شود.',
      'پایان روز: بستن صندوق و نگاه به کمیسیون.',
    ],
    pages: [
      {
        route: '/dashboard',
        purpose: 'نوبت‌های امروز، به تفکیک متخصص و وضعیت.',
        layout: [
          'قطعه‌ی «نوبت‌های امروز» با بیعانه‌ی نگه‌داشته',
          'شاخص‌های فروش',
          'صف کار',
          'نمودار',
        ],
        data: ['{{GET /analytics/dashboard/today-sessions}}', '{{GET /analytics/dashboard}}'],
        changes:
          'قطعه‌ی نوبت‌ها اول می‌آید. «امروز نوبتی نیست» با «هنوز خدمتی تعریف نشده» دو پیام جداست.',
      },
      {
        route: '/customers',
        purpose: 'جلسه‌های خدمت: ساختن، حرکت وضعیت، تحویل.',
        layout: ['تب‌های هاب مشتریان', 'فهرست جلسه‌ها', 'گفت‌وگوی ساخت/تحویل/لغو'],
        data: [
          '{{GET /service-delivery/sessions}}',
          '{{POST /service-delivery/sessions}}',
          '{{POST /service-delivery/sessions/:x/status}}',
        ],
        changes: 'جلسه‌ی خدمت در همین هاب است؛ صفحه‌ی نوبت جدا ساخته نشده.',
      },
      {
        route: '/team-and-payroll',
        purpose: 'متخصص‌ها و کمیسیون.',
        layout: ['کارمندان', 'حضور و غیاب', 'حقوق'],
        data: [
          '{{GET /employees}}',
          '{{GET /provider-commissions}}',
          '{{GET /provider-commissions/rates}}',
        ],
        changes: 'کمیسیون فقط آنلاین خوانده می‌شود و تا نرخی تعریف نشده، عددی ندارد.',
      },
    ],
    operations: [
      {
        action: 'ثبت نوبت',
        endpoint: 'POST /service-delivery/sessions',
        books: '—',
        stock: '—',
        onFailure: 'هم‌پوشانی با رزرو منبع رد می‌شود',
      },
      {
        action: 'حاضر شد / شروع / نیامد',
        endpoint: 'POST /service-delivery/sessions/:x/status',
        books: '—',
        stock: '—',
        onFailure: 'حرکت غیرمجاز وضعیت رد می‌شود',
      },
      {
        action: 'تحویل خدمت',
        endpoint: 'POST /service-delivery/sessions/:x/deliver',
        books: 'فاکتور فروش؛ درآمد همین‌جا شناخته می‌شود',
        stock: 'مواد مصرفی اگر تعریف شده باشد',
        onFailure: 'جلسه‌ی لغوشده تحویل نمی‌شود',
      },
      {
        action: 'لغو نوبت',
        endpoint: 'POST /service-delivery/sessions/:x/cancel',
        books: '—',
        stock: '—',
        onFailure: 'جلسه‌ی تحویل‌شده لغو نمی‌شود',
      },
      {
        action: 'رزرو صندلی/اتاق',
        endpoint: 'POST /resource-bookings',
        books: '—',
        stock: '—',
        onFailure: 'دو رزرو روی یک بازه: تعارض صریح',
      },
      {
        action: 'دریافت پول',
        endpoint: 'POST /payments',
        books: 'نقد در برابر دریافتنی',
        stock: '—',
        onFailure: 'ارز دیگر روی فاکتور رد می‌شود',
      },
      {
        action: 'تعیین نرخ کمیسیون',
        endpoint: 'PUT /provider-commissions/rates',
        books: '—',
        stock: '—',
        onFailure: 'فقط آنلاین',
      },
    ],
    kpis: [
      {
        what: 'نوبت‌های امروز به تفکیک وضعیت',
        source: '{{GET /analytics/dashboard/today-sessions}}',
      },
      {
        what: 'بیعانه‌ی نگه‌داشته به تفکیک ارز',
        source: '{{GET /analytics/dashboard/today-sessions}}',
      },
      { what: 'کمیسیون هر متخصص', source: '{{GET /provider-commissions}} (فقط آنلاین)' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      {
        what: 'نرخ پرشدن صندلی',
        source: 'شکاف: ظرفیت روزانه‌ی هر متخصص تعریف نمی‌شود، پس مخرجی نیست.',
      },
    ],
    roles: [
      { role: 'صاحب سالن', does: 'همه چیز؛ نرخ کمیسیون را فقط او تعیین می‌کند.' },
      { role: 'پذیرش (member)', does: 'نوبت، وضعیت، فاکتور و دریافت.' },
      {
        role: 'متخصص (member)',
        does: 'جلسه‌های خودش و کمیسیون خودش ({{GET /provider-commissions/my}}).',
      },
      { role: 'بیننده (viewer)', does: 'فقط می‌خواند.' },
    ],
    gaps: [
      {
        need: 'تقویم هفتگی نوبت‌ها',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'فهرست جلسه هست، نمای تقویمی نیست.',
      },
      {
        need: 'نرخ پرشدن صندلی',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'ساعت کاری و ظرفیت هر متخصص باید تعریف شود.',
      },
      { need: 'یادآور پیامکی نوبت', status: 'BLOCKED_EXTERNAL', plan: 'درگاه پیامک وصل نیست.' },
      {
        need: 'کمیسیون در حالت آفلاین',
        status: 'EXISTING_BUT_INCOMPLETE',
        plan: 'خواندن و نوشتن نرخ در ماتریس «فقط آنلاین» است.',
      },
      {
        need: 'کمیسیون قاعده‌محور (به تفکیک خدمت، دسته یا پله)',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'امروز یک نرخ ثابت برای هر متخصص است (`provider_commission_rates.rate_bp`) و فقط گزارش می‌شود؛ قاعده‌ی چندسطحی جدول و موتور محاسبه می‌خواهد.',
      },
      {
        need: 'تعریف خدمت با مدت و منبع پیش‌فرض',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'خدمت یک کالای معمولی است؛ مدت روی هر جلسه نوشته می‌شود نه روی خدمت، و منبع پیش‌فرض ندارد.',
      },
      {
        need: 'قفل صفحه‌ی دستگاه با رمز',
        status: 'NOT_SUPPORTED',
        plan: 'دستگاه مشترک سالن رمز و قفل ندارد؛ بدون ذخیره‌ی امن و کنترل امنیتی ساخته نمی‌شود.',
      },
    ],
  },
  education: {
    alsoCovers: [],
    day: [
      'دیدن شاگردانی که جلسه‌ی مانده‌ی کم دارند.',
      'ثبت‌نام شاگرد تازه و فروش بسته.',
      'ثبت جلسه‌های امروز.',
      'حضور: تحویل جلسه یک واحد اعتبار کم می‌کند.',
      'دریافت شهریه یا قسط.',
      'تمدید بسته‌ی شاگردی که اعتبارش تمام شده.',
    ],
    pages: [
      {
        route: '/dashboard',
        purpose: 'چه کسی باید تمدید کند.',
        layout: [
          'قطعه‌ی «جلسه‌ی مانده‌ی کم»',
          'قطعه‌ی «جلسه‌های امروز»',
          'شاخص‌های فروش',
          'صف کار',
        ],
        data: [
          '{{GET /analytics/dashboard/package-credits-low}}',
          '{{GET /analytics/dashboard/today-sessions}}',
        ],
        changes: 'دو قطعه‌ی آموزشی اول می‌آیند.',
      },
      {
        route: '/customers/:id',
        purpose: 'پرونده‌ی شاگرد: بسته‌ها، اعتبار مانده، پرداخت‌ها.',
        layout: ['مشخصات', 'مانده‌ی حساب به تفکیک ارز', 'بسته‌ها و دفتر اعتبار'],
        data: [
          '{{GET /customers/:x}}',
          '{{GET /package-credits/balance}}',
          '{{GET /package-credits/ledger}}',
        ],
        changes:
          'واژه‌ی «مشتری» برای آموزشگاه می‌تواند «شاگرد» خوانده شود اگر واژگان پروفایل تعریفش کرده باشد.',
      },
      {
        route: '/invoices/new',
        purpose: 'فروش بسته‌ی جلسه.',
        layout: ['شاگرد', 'خط بسته', 'اقساط (اختیاری)', 'پرداخت'],
        data: ['{{POST /invoices}}', '{{PUT /invoices/:x/installments}}'],
        changes: 'فروش بسته اعتبار می‌دهد؛ فرم همان فاکتورساز مشترک است.',
      },
    ],
    operations: [
      {
        action: 'فروش بسته',
        endpoint: 'POST /invoices',
        books: 'پول می‌آید؛ درآمد با هر جلسه شناخته می‌شود',
        stock: '—',
        onFailure: 'شاگرد ناشناس ساخته نمی‌شود',
      },
      {
        action: 'دادن اعتبار',
        endpoint: 'POST /package-credits/grant',
        books: 'تعهد به شاگرد',
        stock: '—',
        onFailure: 'بی‌فاکتور اعتبار داده نمی‌شود',
      },
      {
        action: 'کسر جلسه',
        endpoint: 'POST /package-credits/consume',
        books: 'درآمد همان جلسه',
        stock: '—',
        onFailure: 'اعتبار ناکافی رد می‌شود',
      },
      {
        action: 'برگشت کسر اشتباه',
        endpoint: 'POST /package-credits/reverse',
        books: 'معکوس همان درآمد',
        stock: '—',
        onFailure: 'فقط کسر موجود برمی‌گردد',
      },
      {
        action: 'تعلیق بسته',
        endpoint: 'POST /package-credits/grants/:x/suspension',
        books: '—',
        stock: '—',
        onFailure: 'بسته‌ی منقضی تعلیق نمی‌شود',
      },
      {
        action: 'ثبت جلسه',
        endpoint: 'POST /service-delivery/sessions',
        books: '—',
        stock: '—',
        onFailure: 'هم‌پوشانی منبع رد می‌شود',
      },
      {
        action: 'دریافت شهریه',
        endpoint: 'POST /payments',
        books: 'نقد در برابر دریافتنی',
        stock: '—',
        onFailure: 'ارز دیگر روی فاکتور رد می‌شود',
      },
    ],
    kpis: [
      {
        what: 'شاگردان با جلسه‌ی مانده‌ی کم',
        source: '{{GET /analytics/dashboard/package-credits-low}}',
      },
      { what: 'جلسه‌های امروز', source: '{{GET /analytics/dashboard/today-sessions}}' },
      { what: 'شهریه‌ی دریافت‌نشده', source: '{{GET /customers}} (مانده به تفکیک ارز)' },
      { what: 'درآمد تحقق‌یافته‌ی دوره', source: '{{GET /accounting/profit-report/by-currency}}' },
      { what: 'نرخ پرشدن کلاس', source: 'شکاف: ظرفیت کلاس در محصول نیست.' },
    ],
    roles: [
      { role: 'مدیر آموزشگاه', does: 'همه چیز.' },
      { role: 'پذیرش (member)', does: 'ثبت‌نام، فروش بسته، دریافت.' },
      { role: 'مدرس (member)', does: 'جلسه‌های خودش و حضور.' },
      { role: 'بیننده (viewer)', does: 'فقط می‌خواند.' },
    ],
    gaps: [
      {
        need: 'ظرفیت کلاس و فهرست انتظار',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'جدول کلاس با ظرفیت و ثبت‌نام گروهی لازم است؛ امروز هر جلسه یک نفر است.',
      },
      {
        need: 'نمره و کارنامه',
        status: 'NOT_SUPPORTED',
        plan: 'بیرون از دامنه‌ی حسابداری و عملیات؛ برنامه‌ای برایش نیست.',
      },
      {
        need: 'حضور و غیاب گروهی یک کلاس',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'به مدل کلاس وابسته است.',
      },
      {
        need: 'علامت‌زدن کالا به‌عنوان خدمت/کلاس',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'کالا فیلدی برای «خدمت است» ندارد؛ برای همین «هنوز خدمتی تعریف نشده» از «امروز جلسه‌ای نیست» قابل تشخیص نیست.',
      },
      {
        need: 'قفل صفحه‌ی دستگاه با رمز',
        status: 'NOT_SUPPORTED',
        plan: 'دستگاه مشترک آموزشگاه رمز و قفل ندارد؛ بدون ذخیره‌ی امن و کنترل امنیتی ساخته نمی‌شود.',
      },
    ],
  },
  repairs: {
    alsoCovers: ['mobilePhones', 'mechanic', 'itServices'],
    day: [
      'دیدن پرونده‌های باز روی داشبورد.',
      'پذیرش دستگاه تازه: پرونده، مشخصات، عیب گفته‌شده.',
      'عیب‌یابی و برآورد؛ تأیید مشتری.',
      'تعمیر: قطعه از انبار مصرف می‌شود.',
      'آماده شد: خبر به مشتری.',
      'تحویل: صورت‌حساب از پرونده و دریافت پول.',
    ],
    pages: [
      {
        route: '/dashboard',
        purpose: 'پرونده‌های باز، به تفکیک وضعیت.',
        layout: ['قطعه‌ی «پرونده‌های باز»', 'شاخص‌های فروش', 'صف کار', 'نمودار'],
        data: ['{{GET /analytics/dashboard/open-repair-tickets}}', '{{GET /analytics/dashboard}}'],
        changes: 'قطعه‌ی پرونده‌ها اول می‌آید.',
      },
      {
        route: '/customers',
        purpose: 'پرونده‌های تعمیر: پذیرش، وضعیت، قطعه، صورت‌حساب.',
        layout: ['تب‌های هاب مشتریان', 'فهرست پرونده‌ها', 'پنل کار یک پرونده'],
        data: [
          '{{GET /repair-tickets}}',
          '{{GET /repair-tickets/:x}}',
          '{{POST /repair-tickets/:x/status}}',
        ],
        changes: 'پرونده‌ی تعمیر در همین هاب است؛ صفحه‌ی جدا ساخته نشده.',
      },
      {
        route: '/warehouse',
        purpose: 'قطعه‌ها و سریال‌ها.',
        layout: ['فهرست کالا', 'موجودی هر انبار', 'پیشنهاد سفارش دوباره'],
        data: [
          '{{GET /products}}',
          '{{GET /inventory/reorder-suggestions}}',
          '{{GET /warranties}}',
        ],
        changes: 'قطعه یک کالای معمولی است؛ قطعه‌ی نگه‌داشته برای پرونده از موجودی آزاد کم می‌شود.',
      },
    ],
    operations: [
      {
        action: 'پذیرش',
        endpoint: 'POST /repair-tickets',
        books: '—',
        stock: 'کالای مشتری موجودی نیست',
        onFailure: 'مشتری ناشناس ساخته نمی‌شود',
      },
      {
        action: 'تأیید برآورد',
        endpoint: 'POST /repair-tickets/:x/approve',
        books: '—',
        stock: '—',
        onFailure: 'پرونده‌ی بسته تأیید نمی‌شود',
      },
      {
        action: 'حرکت وضعیت',
        endpoint: 'POST /repair-tickets/:x/status',
        books: '—',
        stock: '—',
        onFailure: 'حرکت بیرون از `REPAIR_MOVES` رد می‌شود',
      },
      {
        action: 'نگه‌داشتن قطعه',
        endpoint: 'POST /repair-tickets/:x/parts',
        books: '—',
        stock: 'رزرو از موجودی آزاد',
        onFailure: 'موجودی ناکافی',
      },
      {
        action: 'مصرف قطعه',
        endpoint: 'POST /repair-tickets/:x/parts/:x/consume',
        books: 'بهای قطعه',
        stock: 'کسر قطعی از انبار',
        onFailure: 'قطعه‌ی آزادشده مصرف نمی‌شود',
      },
      {
        action: 'صورت‌حساب',
        endpoint: 'POST /repair-tickets/:x/bill',
        books: 'فاکتور فروش دستمزد و قطعه',
        stock: '—',
        onFailure: 'پرونده دو بار صورت‌حساب نمی‌شود',
      },
      {
        action: 'گارانتی کار',
        endpoint: 'POST /warranties',
        books: '—',
        stock: '—',
        onFailure: '—',
      },
    ],
    kpis: [
      {
        what: 'پرونده‌های باز به تفکیک وضعیت',
        source: '{{GET /analytics/dashboard/open-repair-tickets}}',
      },
      { what: 'منتظر قطعه', source: '{{GET /repair-tickets}} (وضعیت `waiting_parts`)' },
      { what: 'آماده‌ی تحویل', source: '{{GET /repair-tickets}} (وضعیت `ready`)' },
      { what: 'فروش دوره', source: '{{GET /analytics/sales}}' },
      { what: 'میانگین زمان تعمیر', source: 'شکاف: زمان هر حرکت وضعیت گزارش نمی‌شود.' },
    ],
    roles: [
      { role: 'صاحب کار', does: 'همه چیز.' },
      { role: 'پذیرش (member)', does: 'پذیرش، تأیید برآورد، صورت‌حساب و دریافت.' },
      { role: 'تکنسین (member)', does: 'وضعیت و قطعه‌ی پرونده.' },
      { role: 'بیننده (viewer)', does: 'فقط می‌خواند.' },
    ],
    gaps: [
      {
        need: 'کنترل کیفیت پیش از تحویل',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'وضعیت جدا و چک‌لیست لازم است؛ امروز «آماده» مستقیم به «تحویل» می‌رود.',
      },
      {
        need: 'نگه‌داشتن رمز دستگاه مشتری',
        status: 'NOT_SUPPORTED',
        plan: 'بدون کنترل امنیتی جدا ذخیره نمی‌شود؛ در محصول نیست و بی‌طرح امنیتی ساخته نمی‌شود.',
      },
      {
        need: 'قفل صفحه‌ی دستگاه پذیرش با رمز',
        status: 'NOT_SUPPORTED',
        plan: 'دستگاه مشترک تعمیرگاه رمز و قفل ندارد؛ بدون ذخیره‌ی امن و کنترل امنیتی ساخته نمی‌شود.',
      },
      {
        need: 'میانگین زمان تعمیر',
        status: 'NEW_CAPABILITY_REQUIRED',
        plan: 'تاریخچه‌ی حرکت وضعیت باید گزارش شود.',
      },
      {
        need: 'خبر «آماده شد» به مشتری',
        status: 'BLOCKED_EXTERNAL',
        plan: 'درگاه پیامک وصل نیست.',
      },
    ],
  },
}

export { ROLE_NOTE }

/** The ten states every page answers for (written once, not per page). */
export const PAGE_STATES: readonly { readonly state: string; readonly rule: string }[] = [
  { state: 'در حال بارگذاری', rule: 'اسکلت صفحه؛ هرگز «خالی» نشان داده نمی‌شود.' },
  { state: 'خالی', rule: 'دلیلش را می‌گوید و راه پرکردن را نشان می‌دهد.' },
  { state: 'خطا', rule: 'شاخه‌ی جدا از «خالی»؛ پیام سرور و دکمه‌ی دوباره.' },
  { state: 'بدون دسترسی', rule: 'صفحه mount نمی‌شود؛ `NoAccessNotice`.' },
  { state: 'قفل ماژول', rule: 'بخش از منو و هاب برداشته می‌شود.' },
  { state: 'آفلاین، در دسترس', rule: 'از موتور محلی می‌خواند؛ نوشتن در صف می‌رود.' },
  { state: 'آفلاین، فقط آنلاین', rule: '`CloudRequiredNotice`، بدون درخواست شبکه.' },
  { state: 'روی دستگاه نیامده', rule: '«نمی‌دانم»، نه فهرست خالی.' },
  { state: 'در انتظار ارسال', rule: 'برچسب «روی این دستگاه ثبت شد — در حال ارسال».' },
  { state: 'رد شده از سرور', rule: 'ردیف صف `failed` با کد سرور؛ بی‌صدا حذف نمی‌شود.' },
]
