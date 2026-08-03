// ============================================
// Desktop-only strings, layered onto the shared i18next instance.
// ============================================

interface DesktopBundle {
  nav: Record<
    | 'dashboard'
    | 'sales'
    | 'inventory'
    | 'customers'
    | 'accounting'
    | 'settings'
    | 'sync',
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
  sales: Record<
    'title' | 'invoiceNumber' | 'customer' | 'date' | 'status' | 'amount' | 'newInvoice' | 'print',
    string
  >
  inventory: Record<
    'title' | 'product' | 'barcode' | 'stock' | 'price' | 'lowStock' | 'outOfStock' | 'inStock',
    string
  >
  customers: Record<'title' | 'name' | 'phone' | 'balance' | 'debt' | 'credit' | 'settled', string>
  accounting: Record<'title' | 'income' | 'expense' | 'trialBalance' | 'profitLoss', string>
  sync: Record<'title' | 'pending' | 'failed' | 'syncNow' | 'queueEmpty' | 'localOnly', string>
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
  sales: {
    title: 'فروش',
    invoiceNumber: 'شماره',
    customer: 'مشتری',
    date: 'تاریخ',
    status: 'وضعیت',
    amount: 'مبلغ',
    newInvoice: 'فاکتور جدید',
    print: 'چاپ فاکتور',
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
  },
}

const faAF: DesktopBundle = {
  ...faIR,
  nav: { ...faIR.nav, sales: 'فروشات', inventory: 'گدام' },
  sales: { ...faIR.sales, title: 'فروشات', newInvoice: 'بل جدید', print: 'چاپ بل' },
  inventory: { ...faIR.inventory, title: 'گدام', product: 'جنس' },
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
  sales: {
    title: 'Sales',
    invoiceNumber: 'No.',
    customer: 'Customer',
    date: 'Date',
    status: 'Status',
    amount: 'Amount',
    newInvoice: 'New invoice',
    print: 'Print invoice',
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
  },
}

export const desktopStrings: Record<'fa-IR' | 'fa-AF' | 'en', DesktopBundle> = {
  'fa-IR': faIR,
  'fa-AF': faAF,
  en,
}
