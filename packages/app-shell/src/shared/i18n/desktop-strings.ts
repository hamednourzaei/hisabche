// ============================================
// Desktop-only strings, layered onto the shared i18next instance.
// ============================================

interface DesktopBundle {
  nav: Record<
    'dashboard' | 'sales' | 'inventory' | 'customers' | 'accounting' | 'settings' | 'sync',
    string
  >
  auth: Record<
    'title' | 'tagline' | 'email' | 'password' | 'submit' | 'invalidEmail' | 'invalidPassword',
    string
  >
  common: Record<
    | 'search'
    | 'retry'
    | 'loading'
    | 'error'
    | 'empty'
    | 'save'
    | 'cancel'
    | 'new'
    | 'print'
    | 'export'
    | 'refresh'
    | 'offline'
    | 'logout'
    | 'total',
    string
  >
  shortcuts: Record<'title' | 'newInvoice' | 'save' | 'search' | 'print', string>
  unit: Record<
    'piece' | 'gram' | 'kg' | 'carton' | 'box' | 'pack' | 'meter' | 'liter' | 'custom',
    string
  >
  sales: Record<
    | 'title'
    | 'invoiceNumber'
    | 'customer'
    | 'date'
    | 'status'
    | 'amount'
    | 'newInvoice'
    | 'print'
    | 'sale'
    | 'purchase'
    | 'transactionType'
    | 'newPurchase'
    | 'supplier'
    | 'quantity'
    | 'unit'
    | 'customUnit'
    | 'customUnitPlaceholder'
    | 'weightGrams'
    | 'details'
    | 'detailTitle'
    | 'addDetail'
    | 'removeDetail'
    | 'componentsSum'
    | 'detailsArePriced',
    string
  >
  inventory: Record<
    'title' | 'product' | 'barcode' | 'stock' | 'price' | 'lowStock' | 'outOfStock' | 'inStock',
    string
  >
  customers: Record<'title' | 'name' | 'phone' | 'balance' | 'debt' | 'credit' | 'settled', string>
  accounting: Record<'title' | 'income' | 'expense' | 'trialBalance' | 'profitLoss', string>
  sync: Record<'title' | 'pending' | 'failed' | 'syncNow' | 'queueEmpty' | 'localOnly', string> & {
    // The outbox screen (features/sync/sync-page.tsx). These were used and
    // never defined, so Windows and Android showed «sync.col.record» as a
    // column heading. `stage` and `entity`/`op` are read with a computed key,
    // so every value of their unions is listed — tsc then refuses a missing one.
    col: Record<'record' | 'operation' | 'stage' | 'reason' | 'time', string>
    stage: Record<'queued' | 'sending' | 'retrying' | 'rejected' | 'committed', string>
    entity: Record<
      | 'product'
      | 'customer'
      | 'invoice'
      | 'invoice_item'
      | 'transaction'
      | 'inventory_movement'
      | 'employee',
      string
    >
    op: Record<'create' | 'update' | 'delete', string>
    rejectedHint: string
    committedTitle: string
    committedHint: string
  }
}

const faIR: DesktopBundle = {
  nav: {
    dashboard: 'داشبورد',
    sales: 'فروش',
    inventory: 'انبار',
    customers: 'مشتریان',
    accounting: 'حسابداری',
    settings: 'تنظیمات',
    sync: 'همگام‌سازی',
  },
  auth: {
    title: 'ورود به حسابچه',
    tagline: 'مدیریت هوشمند کسب‌وکار شما',
    email: 'ایمیل',
    password: 'رمز عبور',
    submit: 'ورود',
    invalidEmail: 'ایمیل معتبر نیست',
    invalidPassword: 'رمز عبور حداقل ۸ کاراکتر است',
  },
  common: {
    search: 'جستجو',
    retry: 'تلاش دوباره',
    loading: 'در حال بارگذاری…',
    error: 'خطایی رخ داد',
    empty: 'موردی یافت نشد',
    save: 'ذخیره',
    cancel: 'انصراف',
    new: 'جدید',
    print: 'چاپ',
    export: 'خروجی',
    refresh: 'بازخوانی',
    offline: 'آفلاین',
    logout: 'خروج',
    total: 'مجموع',
  },
  shortcuts: {
    title: 'میان‌برها',
    newInvoice: 'فاکتور جدید',
    save: 'ذخیره',
    search: 'جستجو',
    print: 'چاپ',
  },
  unit: {
    piece: 'عدد',
    gram: 'گرم',
    kg: 'کیلوگرم',
    carton: 'کارتن',
    box: 'جعبه',
    pack: 'بسته',
    meter: 'متر',
    liter: 'لیتر',
    custom: 'دلخواه',
  },
  sales: {
    title: 'فروش',
    invoiceNumber: 'شماره',
    customer: 'مشتری',
    date: 'تاریخ',
    status: 'وضعیت',
    amount: 'مبلغ',
    newInvoice: 'فاکتور جدید',
    print: 'چاپ فاکتور',
    sale: 'فروش',
    purchase: 'خرید',
    transactionType: 'نوع تراکنش',
    newPurchase: 'خرید جدید',
    supplier: 'فروشنده',
    quantity: 'تعداد',
    unit: 'واحد',
    customUnit: 'واحد دلخواه',
    customUnitPlaceholder: 'مثلاً: مثقال',
    weightGrams: 'وزن (گرم)',
    details: 'جزئیات',
    detailTitle: 'عنوان',
    addDetail: 'افزودن جزئیات',
    removeDetail: 'حذف جزئیات',
    componentsSum: 'جمع اجزا',
    detailsArePriced: 'مبلغ خط از جمع اجزا',
  },
  inventory: {
    title: 'انبار',
    product: 'کالا',
    barcode: 'بارکد',
    stock: 'موجودی',
    price: 'قیمت',
    lowStock: 'رو به اتمام',
    outOfStock: 'ناموجود',
    inStock: 'موجود',
  },
  customers: {
    title: 'مشتریان',
    name: 'نام',
    phone: 'تلفن',
    balance: 'مانده',
    debt: 'بدهکار',
    credit: 'بستانکار',
    settled: 'تسویه',
  },
  accounting: {
    title: 'حسابداری',
    income: 'درآمد',
    expense: 'هزینه',
    trialBalance: 'تراز آزمایشی',
    profitLoss: 'سود و زیان',
  },
  sync: {
    title: 'همگام‌سازی',
    pending: 'در انتظار',
    failed: 'ناموفق',
    syncNow: 'همگام‌سازی اکنون',
    queueEmpty: 'همه‌چیز همگام است',
    localOnly: 'پایگاه‌داده محلی در دسترس نیست — فقط آنلاین',
    col: { record: 'رکورد', operation: 'عملیات', stage: 'مرحله', reason: 'دلیل', time: 'زمان' },
    stage: {
      queued: 'در صف',
      sending: 'در حال ارسال',
      retrying: 'تلاش دوباره',
      rejected: 'رد شد',
      committed: 'ثبت شد',
    },
    entity: {
      product: 'کالا',
      customer: 'مشتری',
      invoice: 'فاکتور',
      invoice_item: 'ردیف فاکتور',
      transaction: 'پرداخت',
      inventory_movement: 'حرکت انبار',
      employee: 'کارمند',
    },
    op: { create: 'ایجاد', update: 'ویرایش', delete: 'حذف' },
    rejectedHint:
      'سرور این تغییرها را نپذیرفت. تا خودتان «تلاش دوباره» را نزنید دوباره فرستاده نمی‌شوند — دلیل هر کدام در ستون «دلیل» آمده است.',
    committedTitle: 'ثبت‌شده در این نشست',
    committedHint:
      'این تغییرها به سرور رسیده‌اند و از صف خارج شده‌اند؛ این فهرست فقط تا بستن برنامه می‌ماند.',
  },
}

const faAF: DesktopBundle = {
  ...faIR,
  nav: { ...faIR.nav, sales: 'فروشات', inventory: 'گدام' },
  sales: { ...faIR.sales, title: 'فروشات', newInvoice: 'بل جدید', print: 'چاپ بل' },
  inventory: { ...faIR.inventory, title: 'گدام', product: 'جنس' },
  sync: {
    ...faIR.sync,
    entity: { ...faIR.sync.entity, product: 'جنس', inventory_movement: 'حرکت گدام' },
  },
}

const en: DesktopBundle = {
  nav: {
    dashboard: 'Dashboard',
    sales: 'Sales',
    inventory: 'Inventory',
    customers: 'Customers',
    accounting: 'Accounting',
    settings: 'Settings',
    sync: 'Sync',
  },
  auth: {
    title: 'Sign in to Hisabche',
    tagline: 'Run your business, intelligently',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    invalidEmail: 'Enter a valid email address',
    invalidPassword: 'Password must be at least 8 characters',
  },
  common: {
    search: 'Search',
    retry: 'Try again',
    loading: 'Loading…',
    error: 'Something went wrong',
    empty: 'Nothing here yet',
    save: 'Save',
    cancel: 'Cancel',
    new: 'New',
    print: 'Print',
    export: 'Export',
    refresh: 'Refresh',
    offline: 'Offline',
    logout: 'Sign out',
    total: 'Total',
  },
  shortcuts: {
    title: 'Shortcuts',
    newInvoice: 'New invoice',
    save: 'Save',
    search: 'Search',
    print: 'Print',
  },
  unit: {
    piece: 'pcs',
    gram: 'g',
    kg: 'kg',
    carton: 'carton',
    box: 'box',
    pack: 'pack',
    meter: 'm',
    liter: 'L',
    custom: 'Custom',
  },
  sales: {
    title: 'Sales',
    invoiceNumber: 'No.',
    customer: 'Customer',
    date: 'Date',
    status: 'Status',
    amount: 'Amount',
    newInvoice: 'New invoice',
    print: 'Print invoice',
    sale: 'Sale',
    purchase: 'Purchase',
    transactionType: 'Transaction type',
    newPurchase: 'New purchase',
    supplier: 'Supplier',
    quantity: 'Qty',
    unit: 'Unit',
    customUnit: 'Custom unit',
    customUnitPlaceholder: 'e.g. mithqal',
    weightGrams: 'Weight (g)',
    details: 'Details',
    detailTitle: 'Title',
    addDetail: 'Add detail',
    removeDetail: 'Remove detail',
    componentsSum: 'Components total',
    detailsArePriced: 'Line total from components',
  },
  inventory: {
    title: 'Inventory',
    product: 'Product',
    barcode: 'Barcode',
    stock: 'Stock',
    price: 'Price',
    lowStock: 'Low stock',
    outOfStock: 'Out of stock',
    inStock: 'In stock',
  },
  customers: {
    title: 'Customers',
    name: 'Name',
    phone: 'Phone',
    balance: 'Balance',
    debt: 'Owes you',
    credit: 'In credit',
    settled: 'Settled',
  },
  accounting: {
    title: 'Accounting',
    income: 'Income',
    expense: 'Expense',
    trialBalance: 'Trial balance',
    profitLoss: 'Profit & loss',
  },
  sync: {
    title: 'Sync',
    pending: 'Pending',
    failed: 'Failed',
    syncNow: 'Sync now',
    queueEmpty: 'Everything is in sync',
    localOnly: 'Local database unavailable — online only',
    col: {
      record: 'Record',
      operation: 'Operation',
      stage: 'Stage',
      reason: 'Reason',
      time: 'Time',
    },
    stage: {
      queued: 'Queued',
      sending: 'Sending',
      retrying: 'Retrying',
      rejected: 'Rejected',
      committed: 'Saved',
    },
    entity: {
      product: 'Product',
      customer: 'Customer',
      invoice: 'Invoice',
      invoice_item: 'Invoice line',
      transaction: 'Payment',
      inventory_movement: 'Stock movement',
      employee: 'Employee',
    },
    op: { create: 'Create', update: 'Edit', delete: 'Delete' },
    rejectedHint:
      'The server refused these changes. They are not sent again until you press “Try again” — each one’s reason is in the Reason column.',
    committedTitle: 'Saved this session',
    committedHint:
      'These changes reached the server and left the queue; this list lasts until the app is closed.',
  },
}

export const desktopStrings: Record<'fa-IR' | 'fa-AF' | 'en', DesktopBundle> = {
  'fa-IR': faIR,
  'fa-AF': faAF,
  en,
}
