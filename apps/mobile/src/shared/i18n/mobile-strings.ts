// ============================================
// Mobile-only string bundle.
// Merged into the shared @hisabche/i18n instance under the `mobile`
// namespace so the web locale files stay untouched.
// ============================================

import { unitSchema } from '@hisabche/validation'

/**
 * Every unit the product actually has.
 *
 * ⚠️ DERIVED, NOT RETYPED. `MobileBundle['units']` was a hand-written union of
 * nine literals while `unitSchema` had fifteen, so mg, ton, cm, km, ml and
 * dozen had NO LABEL — a mobile invoice line rendered «۱۰» where it should say
 * «۱۰ میلی‌گرم». On a gold invoice that is a materially different claim.
 *
 * Reading the enum means the next unit added to the schema breaks the build
 * here instead of shipping a blank label. `unitSchema` is used only in type
 * position, so TypeScript elides the import from the emitted bundle.
 */
type Unit = (typeof unitSchema.options)[number]

interface MobileBundle {
  tabs: Record<'home' | 'sales' | 'inventory' | 'customers' | 'more', string>
  auth: Record<
    | 'title'
    | 'subtitle'
    | 'email'
    | 'emailPlaceholder'
    | 'password'
    | 'passwordPlaceholder'
    | 'submit'
    | 'invalidEmail'
    | 'invalidPassword'
    | 'failed'
    | 'networkError'
    | 'biometricPrompt'
    | 'biometricEnable'
    | 'biometricUnlock'
    | 'brand'
    | 'tagline'
    | 'legal',
    string
  >
  common: Record<
    | 'retry'
    | 'loading'
    | 'error'
    | 'empty'
    | 'search'
    | 'clear'
    | 'logout'
    | 'comingSoon'
    | 'cancel'
    | 'save'
    | 'delete'
    | 'offline'
    | 'offlineLocalData'
    | 'total'
    | 'all'
    | 'today'
    | 'currency'
    | 'seeAll'
    | 'share'
    | 'selectedCount'
    | 'unit',
    string
  >
  home: Record<
    | 'title'
    | 'greeting'
    | 'totalSales'
    | 'todaySales'
    | 'customerDebt'
    | 'warehouseValue'
    | 'salesTrend'
    | 'insights'
    | 'lowStock'
    | 'pendingPayments'
    | 'quickInvoice'
    | 'vsLastMonth',
    string
  >
  sales: Record<
    | 'title'
    | 'newInvoice'
    | 'invoiceNumber'
    | 'customer'
    | 'selectCustomer'
    | 'items'
    | 'addItem'
    | 'quantity'
    | 'unitPrice'
    | 'discount'
    | 'subtotal'
    | 'grandTotal'
    | 'paid'
    | 'unpaid'
    | 'partial'
    | 'draft'
    | 'emptyTitle'
    | 'emptyDescription'
    | 'savedOffline'
    | 'noItems'
    | 'created'
    | 'statusPending'
    | 'statusPaid'
    | 'statusCompleted'
    | 'statusPartial'
    | 'statusOverdue'
    | 'statusCancelled'
    | 'sale'
    | 'purchase'
    | 'transactionType'
    | 'newPurchase'
    | 'supplier'
    | 'selectSupplier'
    | 'unit'
    | 'customUnit'
    | 'customUnitPlaceholder'
    | 'weightGrams'
    | 'details'
    | 'detailTitle'
    | 'amount'
    | 'addDetails'
    | 'hideDetails'
    | 'addDetail'
    | 'removeDetail'
    | 'componentsSum'
    | 'detailsArePriced',
    string
  >
  quickInvoice: Record<
    | 'stepProduct'
    | 'stepCustomer'
    | 'stepPrice'
    | 'stepPreview'
    | 'stepDone'
    | 'previewTitle'
    | 'previewDesc'
    | 'confirmCreate'
    | 'backToEdit'
    | 'created'
    | 'createdDesc'
    | 'viewInvoice'
    | 'createAnother'
    | 'backToInvoices'
    | 'next'
    | 'back'
    | 'customItem'
    | 'customItemName'
    | 'noItems'
    | 'elapsedTime'
    | 'items'
    | 'type'
    | 'paymentMethod'
    | 'cash'
    | 'credit'
    | 'clickToView',
    string
  >
  inventory: Record<
    | 'title'
    | 'products'
    | 'stock'
    | 'lowStock'
    | 'outOfStock'
    | 'inStock'
    | 'scanBarcode'
    | 'scanPrompt'
    | 'cameraDenied'
    | 'emptyTitle'
    | 'emptyDescription'
    | 'price'
    | 'sku',
    string
  >
  customers: Record<
    | 'title'
    | 'debt'
    | 'credit'
    | 'settled'
    | 'transactions'
    | 'emptyTitle'
    | 'emptyDescription'
    | 'phone',
    string
  >
  accounting: Record<
    'title' | 'transactions' | 'income' | 'expense' | 'trialBalance' | 'reports' | 'balance',
    string
  >
  sync: Record<
    | 'title'
    | 'pending'
    | 'syncing'
    | 'synced'
    | 'failed'
    | 'syncNow'
    | 'lastSync'
    | 'never'
    | 'queueEmpty'
    | 'offlineBanner'
    | 'pendingBanner',
    string
  >
  more: Record<
    'title' | 'language' | 'account' | 'accounting' | 'employees' | 'sync' | 'security',
    string
  >
  /**
   * Unit labels, keyed by the `unitSchema` enum in `@hisabche/validation`.
   * Mirrors the shared catalog's `unit.*` so a gram reads the same on every
   * platform. `custom` is the escape hatch — the user's own label lives in the
   * item's `unitLabel`, so this entry is only a placeholder in pickers.
   */
  /**
   * ⚠️ KEYED BY THE CANONICAL ENUM, NOT BY A HAND-WRITTEN SUBSET.
   *
   * This was nine literals while `unitSchema` in `@hisabche/validation` had
   * fifteen. The six that were missing — mg, ton, cm, km, ml, dozen — rendered
   * as a BARE NUMBER on mobile: «۱۰» where the invoice says «۱۰ میلی‌گرم».
   * On a gold invoice that is a materially different claim, which is exactly
   * what the guard in `__tests__/units.test.ts` was written to catch, and it
   * had been failing.
   *
   * Deriving the key from `unitSchema` means adding a unit to the schema now
   * breaks the build here rather than shipping a blank label.
   */
  units: Record<Unit, string>
}

const UNITS_FA: MobileBundle['units'] = {
  // ─── weight ───
  mg: 'میلی‌گرم',
  gram: 'گرم',
  kg: 'کیلوگرم',
  ton: 'تن',
  // ─── length ───
  cm: 'سانتی‌متر',
  meter: 'متر',
  km: 'کیلومتر',
  // ─── volume ───
  ml: 'میلی‌لیتر',
  liter: 'لیتر',
  // ─── count ───
  piece: 'عدد',
  box: 'جعبه',
  pack: 'بسته',
  carton: 'کارتن',
  dozen: 'دوجین',
  custom: 'دلخواه',
}

const UNITS_EN: MobileBundle['units'] = {
  mg: 'mg',
  gram: 'g',
  kg: 'kg',
  ton: 't',
  cm: 'cm',
  meter: 'm',
  km: 'km',
  ml: 'mL',
  liter: 'L',
  piece: 'pcs',
  box: 'box',
  pack: 'pack',
  carton: 'carton',
  dozen: 'dz',
  custom: 'Custom',
}

const faIR: MobileBundle = {
  tabs: { home: 'خانه', sales: 'فروش', inventory: 'انبار', customers: 'مشتریان', more: 'بیشتر' },
  auth: {
    title: 'ورود به حسابچه',
    subtitle: 'حساب کسب‌وکار خود را در دست بگیرید',
    email: 'ایمیل',
    emailPlaceholder: 'name@example.com',
    password: 'رمز عبور',
    passwordPlaceholder: '••••••••',
    submit: 'ورود',
    invalidEmail: 'ایمیل معتبر نیست',
    invalidPassword: 'رمز عبور حداقل ۸ کاراکتر است',
    failed: 'ورود ناموفق بود',
    networkError: 'ارتباط با سرور برقرار نشد',
    biometricPrompt: 'برای ورود احراز هویت کنید',
    biometricEnable: 'ورود با اثر انگشت',
    biometricUnlock: 'ورود با بیومتریک',
    brand: 'حسابچه',
    tagline: 'مدیریت هوشمند کسب‌وکار شما',
    legal: 'با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرید',
  },
  common: {
    retry: 'تلاش دوباره',
    loading: 'در حال بارگذاری…',
    error: 'خطایی رخ داد',
    empty: 'موردی یافت نشد',
    search: 'جستجو',
    clear: 'پاک کردن',
    logout: 'خروج از حساب',
    comingSoon: 'به‌زودی',
    cancel: 'انصراف',
    save: 'ذخیره',
    delete: 'حذف',
    offline: 'آفلاین',
    offlineLocalData: 'آفلاین — داده محلی نمایش داده شد',
    total: 'مجموع',
    all: 'همه',
    today: 'امروز',
    currency: 'افغانی',
    seeAll: 'مشاهده همه',
    share: 'اشتراک‌گذاری',
    selectedCount: '{{count}} مورد انتخاب شد',
    unit: 'عدد',
  },
  home: {
    title: 'خانه',
    greeting: 'خوش آمدید',
    totalSales: 'کل فروش',
    todaySales: 'فروش امروز',
    customerDebt: 'بدهی مشتریان',
    warehouseValue: 'ارزش انبار',
    salesTrend: 'روند فروش',
    insights: 'تحلیل هوشمند',
    lowStock: 'کالای رو به اتمام',
    pendingPayments: 'پرداخت‌های معوق',
    quickInvoice: 'فاکتور سریع',
    vsLastMonth: 'نسبت به ماه گذشته',
  },
  sales: {
    title: 'فروش',
    newInvoice: 'فاکتور جدید',
    invoiceNumber: 'شماره فاکتور',
    customer: 'مشتری',
    selectCustomer: 'انتخاب مشتری',
    items: 'اقلام',
    addItem: 'افزودن کالا',
    quantity: 'تعداد',
    unitPrice: 'قیمت واحد',
    discount: 'تخفیف',
    subtotal: 'جمع جزء',
    grandTotal: 'مبلغ نهایی',
    paid: 'پرداخت‌شده',
    unpaid: 'پرداخت‌نشده',
    partial: 'پرداخت جزئی',
    draft: 'پیش‌نویس',
    emptyTitle: 'هنوز فاکتوری ثبت نشده',
    emptyDescription: 'اولین فاکتور فروش خود را ثبت کنید',
    savedOffline: 'آفلاین ذخیره شد و پس از اتصال ارسال می‌شود',
    noItems: 'حداقل یک کالا اضافه کنید',
    created: 'فاکتور ثبت شد',
    statusPending: 'در انتظار',
    statusPaid: 'پرداخت‌شده',
    statusCompleted: 'تکمیل‌شده',
    statusPartial: 'پرداخت جزئی',
    statusOverdue: 'سررسید گذشته',
    statusCancelled: 'لغو شده',
    sale: 'فروش',
    purchase: 'خرید',
    transactionType: 'نوع تراکنش',
    newPurchase: 'خرید جدید',
    supplier: 'فروشنده',
    selectSupplier: 'انتخاب فروشنده',
    unit: 'واحد',
    customUnit: 'واحد دلخواه',
    customUnitPlaceholder: 'مثلاً: مثقال',
    weightGrams: 'وزن (گرم)',
    details: 'جزئیات',
    detailTitle: 'عنوان',
    amount: 'مبلغ',
    addDetails: 'افزودن جزئیات',
    hideDetails: 'بستن جزئیات',
    addDetail: 'افزودن جزئیات',
    removeDetail: 'حذف جزئیات',
    componentsSum: 'جمع اجزا',
    detailsArePriced: 'مبلغ خط از جمع اجزا محاسبه شود',
  },
  quickInvoice: {
    stepProduct: 'محصول',
    stepCustomer: 'مشتری',
    stepPrice: 'قیمت',
    stepPreview: 'پیش‌نمایش',
    stepDone: 'پایان',
    previewTitle: 'پیش‌نمایش فاکتور',
    previewDesc: 'قبل از ثبت نهایی، فاکتور را بررسی کنید',
    confirmCreate: 'تأیید و ساخت فاکتور',
    backToEdit: 'بازگشت و ویرایش',
    created: 'فاکتور ثبت شد',
    createdDesc: 'فاکتور شما با موفقیت ثبت شد',
    viewInvoice: 'مشاهده فاکتور',
    createAnother: 'فاکتور جدید',
    backToInvoices: 'بازگشت به فاکتورها',
    next: 'ادامه',
    back: 'برگشت',
    customItem: 'با نام دلخواه پر کن',
    customItemName: 'نام دلخواه (مثلاً: کرایه تاکسی)',
    noItems: 'حداقل یک کالا اضافه کنید',
    items: '{{count}} کالا',
    elapsedTime: '{{m}}:{{s}}',
    type: 'نوع',
    paymentMethod: 'نوع پرداخت',
    cash: 'نقد',
    credit: 'نسیه',
    clickToView: 'کلیک کنید تا فاکتور را ببینید',
  },
  inventory: {
    title: 'انبار',
    products: 'کالاها',
    stock: 'موجودی',
    lowStock: 'رو به اتمام',
    outOfStock: 'ناموجود',
    inStock: 'موجود',
    scanBarcode: 'اسکن بارکد',
    scanPrompt: 'بارکد را مقابل دوربین بگیرید',
    cameraDenied: 'دسترسی به دوربین داده نشد',
    emptyTitle: 'کالایی ثبت نشده',
    emptyDescription: 'برای شروع، کالاهای خود را اضافه کنید',
    price: 'قیمت',
    sku: 'کد کالا',
  },
  customers: {
    title: 'مشتریان',
    debt: 'بدهکار',
    credit: 'بستانکار',
    settled: 'تسویه',
    transactions: 'تراکنش‌ها',
    emptyTitle: 'مشتری‌ای ثبت نشده',
    emptyDescription: 'مشتریان خود را اضافه کنید تا حساب‌شان را دنبال کنید',
    phone: 'تلفن',
  },
  accounting: {
    title: 'حسابداری',
    transactions: 'تراکنش‌ها',
    income: 'درآمد',
    expense: 'هزینه',
    trialBalance: 'تراز آزمایشی',
    reports: 'گزارش‌ها',
    balance: 'مانده',
  },
  sync: {
    title: 'همگام‌سازی',
    pending: 'در انتظار ارسال',
    synced: 'همگام شد',
    failed: 'ناموفق',
    syncNow: 'همگام‌سازی اکنون',
    lastSync: 'آخرین همگام‌سازی',
    never: 'هرگز',
    queueEmpty: 'همه‌چیز همگام است',
    syncing: 'در حال ارسال',
    offlineBanner: 'آفلاین هستید — تغییرات ذخیره و بعداً ارسال می‌شود',
    pendingBanner: '{{count}} مورد منتظر همگام‌سازی',
  },
  more: {
    title: 'بیشتر',
    language: 'زبان',
    account: 'حساب کاربری',
    accounting: 'حسابداری',
    employees: 'کارمندان',
    sync: 'همگام‌سازی',
    security: 'امنیت',
  },
  units: UNITS_FA,
}

const faAF: MobileBundle = {
  ...faIR,
  tabs: { home: 'خانه', sales: 'فروشات', inventory: 'گدام', customers: 'مشتریان', more: 'بیشتر' },
  auth: {
    ...faIR.auth,
    subtitle: 'حساب تجارت خود را مدیریت کنید',
    invalidPassword: 'رمز عبور حداقل ۸ حرف باشد',
    failed: 'ورود ناکام شد',
  },
  common: { ...faIR.common, retry: 'دوباره کوشش کنید', empty: 'چیزی پیدا نشد', currency: 'افغانی' },
  home: {
    ...faIR.home,
    salesTrend: 'روند فروشات',
    todaySales: 'فروشات امروز',
    totalSales: 'مجموع فروشات',
  },
  sales: {
    ...faIR.sales,
    title: 'فروشات',
    newInvoice: 'بل جدید',
    invoiceNumber: 'شماره بل',
    created: 'بل ثبت شد',
  },
  inventory: { ...faIR.inventory, title: 'گدام', products: 'اجناس', emptyTitle: 'جنسی ثبت نشده' },
  quickInvoice: {
    ...faIR.quickInvoice,
    stepProduct: 'جنس',
    stepCustomer: 'مشتری',
    stepPrice: 'قیمت',
    stepPreview: 'پیش‌نمایش',
    stepDone: 'پایان',
  },
  more: { ...faIR.more, title: 'بیشتر' },
  units: UNITS_FA,
}

const en: MobileBundle = {
  tabs: {
    home: 'Home',
    sales: 'Sales',
    inventory: 'Inventory',
    customers: 'Customers',
    more: 'More',
  },
  auth: {
    title: 'Sign in to Hisabche',
    subtitle: 'Take control of your business books',
    email: 'Email',
    emailPlaceholder: 'name@example.com',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    submit: 'Sign in',
    invalidEmail: 'Enter a valid email address',
    invalidPassword: 'Password must be at least 8 characters',
    failed: 'Sign in failed',
    networkError: 'Could not reach the server',
    biometricPrompt: 'Authenticate to continue',
    biometricEnable: 'Enable biometric sign-in',
    biometricUnlock: 'Unlock with biometrics',
    brand: 'Hisabche',
    tagline: 'Run your business, intelligently',
    legal: 'By signing in you accept the terms and privacy policy',
  },
  common: {
    retry: 'Try again',
    loading: 'Loading…',
    error: 'Something went wrong',
    empty: 'Nothing here yet',
    search: 'Search',
    clear: 'Clear',
    logout: 'Sign out',
    comingSoon: 'Coming soon',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    offline: 'Offline',
    offlineLocalData: 'Offline — showing local data',
    total: 'Total',
    all: 'All',
    today: 'Today',
    currency: 'AFN',
    seeAll: 'See all',
    share: 'Share',
    selectedCount: '{{count}} selected',
    unit: 'pcs',
  },
  home: {
    title: 'Home',
    greeting: 'Welcome back',
    totalSales: 'Total sales',
    todaySales: "Today's sales",
    customerDebt: 'Customer debt',
    warehouseValue: 'Warehouse value',
    salesTrend: 'Sales trend',
    insights: 'Insights',
    lowStock: 'Low stock',
    pendingPayments: 'Pending payments',
    quickInvoice: 'Quick invoice',
    vsLastMonth: 'vs last month',
  },
  sales: {
    title: 'Sales',
    newInvoice: 'New invoice',
    invoiceNumber: 'Invoice no.',
    customer: 'Customer',
    selectCustomer: 'Select customer',
    items: 'Items',
    addItem: 'Add item',
    quantity: 'Qty',
    unitPrice: 'Unit price',
    discount: 'Discount',
    subtotal: 'Subtotal',
    grandTotal: 'Grand total',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partial: 'Partially paid',
    draft: 'Draft',
    emptyTitle: 'No invoices yet',
    emptyDescription: 'Create your first sales invoice',
    savedOffline: 'Saved offline — will sync once you are back online',
    noItems: 'Add at least one item',
    created: 'Invoice created',
    statusPending: 'Pending',
    statusPaid: 'Paid',
    statusCompleted: 'Completed',
    statusPartial: 'Partial',
    statusOverdue: 'Overdue',
    statusCancelled: 'Cancelled',
    sale: 'Sale',
    purchase: 'Purchase',
    transactionType: 'Transaction type',
    newPurchase: 'New purchase',
    supplier: 'Supplier',
    selectSupplier: 'Select supplier',
    unit: 'Unit',
    customUnit: 'Custom unit',
    customUnitPlaceholder: 'e.g. mithqal',
    weightGrams: 'Weight (g)',
    details: 'Details',
    detailTitle: 'Title',
    amount: 'Amount',
    addDetails: 'Add details',
    hideDetails: 'Hide details',
    addDetail: 'Add detail',
    removeDetail: 'Remove detail',
    componentsSum: 'Components total',
    detailsArePriced: 'Calculate line total from components',
  },
  quickInvoice: {
    stepProduct: 'Product',
    stepCustomer: 'Customer',
    stepPrice: 'Price',
    stepPreview: 'Preview',
    stepDone: 'Done',
    previewTitle: 'Invoice preview',
    previewDesc: 'Review the invoice before final confirmation',
    confirmCreate: 'Confirm & create invoice',
    backToEdit: 'Back to edit',
    created: 'Invoice created',
    createdDesc: 'Your invoice has been created successfully',
    viewInvoice: 'View invoice',
    createAnother: 'Create another',
    backToInvoices: 'Back to invoices',
    next: 'Next',
    back: 'Back',
    customItem: 'Create custom item',
    customItemName: 'Custom item name',
    noItems: 'Add at least one item',
    items: '{{count}} items',
    elapsedTime: '{{m}}:{{s}}',
    type: 'Type',
    paymentMethod: 'Payment method',
    cash: 'Cash',
    credit: 'Credit',
    clickToView: 'Tap to view the invoice',
  },
  inventory: {
    title: 'Inventory',
    products: 'Products',
    stock: 'Stock',
    lowStock: 'Low stock',
    outOfStock: 'Out of stock',
    inStock: 'In stock',
    scanBarcode: 'Scan barcode',
    scanPrompt: 'Point the camera at a barcode',
    cameraDenied: 'Camera permission denied',
    emptyTitle: 'No products yet',
    emptyDescription: 'Add your products to get started',
    price: 'Price',
    sku: 'SKU',
  },
  customers: {
    title: 'Customers',
    debt: 'Owes you',
    credit: 'In credit',
    settled: 'Settled',
    transactions: 'Transactions',
    emptyTitle: 'No customers yet',
    emptyDescription: 'Add customers to track their balances',
    phone: 'Phone',
  },
  accounting: {
    title: 'Accounting',
    transactions: 'Transactions',
    income: 'Income',
    expense: 'Expense',
    trialBalance: 'Trial balance',
    reports: 'Reports',
    balance: 'Balance',
  },
  sync: {
    title: 'Sync',
    pending: 'Pending',
    synced: 'Synced',
    failed: 'Failed',
    syncNow: 'Sync now',
    lastSync: 'Last sync',
    never: 'Never',
    queueEmpty: 'Everything is in sync',
    syncing: 'Sending',
    offlineBanner: 'You are offline — changes are saved and sent later',
    pendingBanner: '{{count}} item(s) waiting to sync',
  },
  more: {
    title: 'More',
    language: 'Language',
    account: 'Account',
    accounting: 'Accounting',
    employees: 'Employees',
    sync: 'Sync',
    security: 'Security',
  },
  units: UNITS_EN,
}

export const mobileStrings: Record<'fa-IR' | 'fa-AF' | 'en', MobileBundle> = {
  'fa-IR': faIR,
  'fa-AF': faAF,
  en,
}
