import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')
const LOCALES = [
  { file: 'packages/i18n/src/locales/en.json', lang: 'en' },
  { file: 'packages/i18n/src/locales/fa-IR.json', lang: 'fa' },
  { file: 'packages/i18n/src/locales/fa-AF.json', lang: 'af' },
]

// کلیدهای واقعی گمشده — فقط UI keys که با t() استفاده می‌شوند
const MISSING_KEYS = {
  // accounting
  'accounting.accounts.title': { en: 'Accounts', fa: 'حساب‌ها', af: 'حسابونه' },
  'accounting.accounts.code': { en: 'Account Code', fa: 'کد حساب', af: 'کد حساب' },
  'accounting.accounts.name': { en: 'Account Name', fa: 'نام حساب', af: 'د حساب نوم' },
  'accounting.accounts.type': { en: 'Account Type', fa: 'نوع حساب', af: 'د حساب ډول' },
  'accounting.accounts.parent': { en: 'Parent Account', fa: 'حساب والد', af: 'د حساب پلر' },
  'accounting.accounts.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'accounting.accounts.active': { en: 'Active', fa: 'فعال', af: 'فعال' },
  'accounting.accounts.inactive': { en: 'Inactive', fa: 'غیرفعال', af: 'غیرفعال' },
  'accounting.accounts.create': { en: 'Create Account', fa: 'ایجاد حساب', af: 'حساب جوړول' },
  'accounting.accounts.empty.title': {
    en: 'No accounts',
    fa: 'حسابی وجود ندارد',
    af: 'حسابونه شته نه دي',
  },
  'accounting.accounts.empty.subtitle': {
    en: 'Create your first account',
    fa: 'اولین حساب خود را ایجاد کنید',
    af: 'خپل پوره حساب جوړوئ',
  },
  'accounting.journal.title': {
    en: 'Journal Entries',
    fa: 'ورودی‌های دفتر کل',
    af: 'د کتاب ورودي',
  },
  'accounting.journal.account': { en: 'Account', fa: 'حساب', af: 'حساب' },
  'accounting.journal.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'accounting.journal.description': { en: 'Description', fa: 'توضیحات', af: 'تفصیلات' },
  'accounting.journal.credit': { en: 'Credit', fa: 'بدهکار', af: 'ښونډه' },
  'accounting.journal.debit': { en: 'Debit', fa: 'بستانکار', af: 'آبادي' },
  'accounting.journal.balanced': { en: 'Balanced', fa: 'متعادل', af: 'متعادل' },
  'accounting.journal.unbalanced': { en: 'Unbalanced', fa: 'نامتعادل', af: 'نامتعادل' },
  'accounting.journal.create': {
    en: 'New Journal Entry',
    fa: 'ورودی جدید دفتر کل',
    af: 'نوې د کتاب وردو',
  },
  'accounting.journal.lines': { en: 'Lines', fa: 'سطرها', af: 'لیکې' },
  'accounting.journal.reference': { en: 'Reference', fa: 'مرجع', af: 'مرجع' },
  'accounting.journal.empty.title': {
    en: 'No journal entries',
    fa: 'ورودی دفتر کلی وجود ندارد',
    af: 'د کتاب وردونه شته نه دي',
  },
  'accounting.journal.empty.subtitle': {
    en: 'Create your first journal entry',
    fa: 'اولین ورودی دفتر کل را ایجاد کنید',
    af: 'خپله لومړۍ د کتاب وردو جوړوئ',
  },
  'accounting.tabs.label': { en: 'Tabs', fa: 'تب‌ها', af: 'ټبوټونه' },
  'accounting.export.button': { en: 'Export', fa: 'خروجی', af: 'اخراج' },
  'accounting.export.label': { en: 'Export Data', fa: 'خروجی داده‌ها', af: 'د معلومات اخراج' },
  'accounting.income': { en: 'Income', fa: 'درآمد', af: 'علیحدل' },
  'accounting.expense': { en: 'Expense', fa: 'هزینه', af: 'اخراج' },

  // action
  'action.back': { en: 'Back', fa: 'بازگشت', af: 'بیرته' },
  'action.cancel': { en: 'Cancel', fa: 'لغو', af: 'لغوي' },
  'action.clear': { en: 'Clear', fa: 'پاک کردن', af: 'pak کول' },
  'action.close': { en: 'Close', fa: 'بستن', af: 'بندول' },
  'action.create': { en: 'Create', fa: 'ایجاد', af: 'جوړول' },
  'action.open': { en: 'Open', fa: 'باز کردن', af: 'خول' },
  'action.remove': { en: 'Remove', fa: 'حذف', af: 'ړنګول' },
  'action.retry': { en: 'Retry', fa: 'تلاش مجدد', af: 'بیا هڅه' },
  'action.save': { en: 'Save', fa: 'ذخیره', af: 'خوندي' },
  'action.search': { en: 'Search', fa: 'جستجو', af: 'لټون' },

  // activity
  'activity.empty': { en: 'No activity found', fa: 'فعالیتی یافت نشد', af: 'هیڅد نه موندل شو' },

  // admin
  'admin.dashboard.description': {
    en: 'Admin dashboard',
    fa: 'داشبورد مدیریت',
    af: 'د اداري ډشبورډ',
  },
  'admin.error.retry': { en: 'Retry', fa: 'تلاش مجدد', af: 'بیا هڅه' },
  'admin.filters.all': { en: 'All', fa: 'همه', af: 'ټول' },
  'admin.member.email': { en: 'Email', fa: 'ایمیل', af: 'بریښنالیک' },
  'admin.member.joined': { en: 'Joined', fa: 'عضویت', af: 'ګډون' },
  'admin.member.name': { en: 'Name', fa: 'نام', af: 'نوم' },
  'admin.member.remove': { en: 'Remove', fa: 'حذف', af: 'ړنګول' },
  'admin.member.unknown': { en: 'Unknown', fa: 'ناشناخته', af: 'ناپېژندلی' },
  'admin.pagination.label': { en: 'Page', fa: 'صفحه', af: 'panse' },
  'admin.pagination.next': { en: 'Next', fa: 'بعدی', af: 'بل' },
  'admin.pagination.previous': { en: 'Previous', fa: 'قبلی', af: 'مخکینی' },
  'admin.subscriptions.empty': {
    en: 'No subscriptions',
    fa: 'اشتراکی وجود ندارد',
    af: 'ځایلی شته نه دي',
  },
  'admin.subscriptions.expired': { en: 'Expired', fa: 'منقضی', af: 'موده ته ورسېدل' },
  'admin.subscriptions.plan': { en: 'Plan', fa: 'طرح', af: 'نقشه' },
  'admin.subscriptions.reason': { en: 'Reason', fa: 'دلیل', af: 'omon主要原因' },
  'admin.subscriptions.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'admin.subscriptions.trial': { en: 'Trial', fa: 'آزمایشی', af: 'آزمایشي' },
  'admin.users.empty': { en: 'No users', fa: 'کاربری وجود ندارد', af: 'کاروونکي شته نه دي' },
  'admin.users.search': { en: 'Search users', fa: 'جستجوی کاربران', af: 'د کاروونکو لټون' },
  'admin.workspaces.active': { en: 'Active', fa: 'فعال', af: 'فعال' },
  'admin.workspaces.inactive': { en: 'Inactive', fa: 'غیرفعال', af: 'غیرفعال' },
  'admin.workspaces.members': { en: 'Members', fa: 'اعضا', af: 'غړي' },
  'admin.workspaces.owner': { en: 'Owner', fa: 'مالک', af: 'مالک' },
  'admin.workspaces.search': { en: 'Search workspaces', fa: 'جستجوی فضاها', af: 'د ځایونو لټون' },

  // auth
  'auth.brand': { en: 'Hisabche', fa: 'حسابچه', af: 'حسابچه' },
  'auth.legal': { en: 'Terms & Privacy', fa: 'شرایط و حریم خصوصی', af: 'شرایط او خصوصي' },
  'auth.submit': { en: 'Submit', fa: 'ارسال', af: 'استول' },
  'auth.tagline': {
    en: 'Business Management System',
    fa: 'سیستم مدیریت کسب‌وکار',
    af: 'د کسبوکار اداره سیستم',
  },
  'auth.title': { en: 'Settings', fa: 'تنظیمات', af: 'ترتیبات' },

  // billing
  'billing.plans.free.name': { en: 'Free', fa: 'رایگان', af: 'وړیا' },
  'billing.plans.pro.name': { en: 'Pro', fa: 'حرفه‌ای', af: 'าม卡' },
  'billing.plans.enterprise.name': { en: 'Enterprise', fa: 'سازمانی', af: 'Organization' },

  // common (additional)
  'common.active': { en: 'Active', fa: 'فعال', af: 'فعال' },
  'common.back': { en: 'Back', fa: 'بازگشت', af: 'بیرته' },
  'common.currency': { en: 'Currency', fa: 'ارز', af: 'اسعار' },
  'common.details': { en: 'Details', fa: 'جزئیات', af: 'تفصیلات' },
  'common.empty': { en: 'Empty', fa: 'خالی', af: 'خالي' },
  'common.error': { en: 'Error', fa: 'خطا', af: 'تېروتنه' },
  'common.logout': { en: 'Logout', fa: 'خروج', af: 'وتل' },
  'common.refresh': { en: 'Refresh', fa: 'بازخوانی', af: 'تازه کول' },
  'common.saved': { en: 'Saved', fa: 'ذخیره شد', af: 'خوندي شو' },
  'common.saving': { en: 'Saving...', fa: 'در حال ذخیره...', af: 'خوندي کيږي...' },
  'common.search': { en: 'Search', fa: 'جستجو', af: 'لټون' },
  'common.share': { en: 'Share', fa: 'اشتراک', af: 'شریکول' },
  'common.total': { en: 'Total', fa: 'مجموع', af: 'ټول' },
  'common.unit': { en: 'Unit', fa: 'واحد', af: 'واحد' },

  // customers
  'customers.transactions': { en: 'Transactions', fa: 'تراکنش‌ها', af: 'مالم𝒜لي' },

  // entity
  'entity.activity.empty': { en: 'No activity', fa: 'فعالیتی نیست', af: 'هیڅد نه دي' },

  // home
  'home.greeting': { en: 'Hello', fa: 'سلام', af: 'سلام' },
  'home.title': { en: 'Dashboard', fa: 'داشبورد', af: 'ډشبورډ' },

  // inventory
  'inventory.price': { en: 'Price', fa: 'قیمت', af: 'قیمت' },
  'inventory.product': { en: 'Product', fa: 'محصول', af: 'مېله' },
  'inventory.sku': { en: 'SKU', fa: 'کد کالا', af: 'د مېلو کد' },
  'inventory.stock': { en: 'Stock', fa: 'موجودی', af: 'موجودي' },
  'inventory.title': { en: 'Inventory', fa: 'انبار', af: 'انبار' },

  // invoice
  'invoice.open': { en: 'Open', fa: 'باز', af: 'خول شوی' },

  // more
  'more.account': { en: 'Account', fa: 'حساب', af: 'حساب' },
  'more.language': { en: 'Language', fa: 'زبان', af: 'ژبه' },
  'more.security': { en: 'Security', fa: 'امنیت', af: 'امنیت' },
  'more.sync': { en: 'Sync', fa: 'همگام‌سازی', af: 'همغږي' },

  // nav
  'nav.billing_description': {
    en: 'Current plan, upgrades and subscription billing',
    fa: 'طرح فعلی، ارتقا و صورتحساب اشتراک',
    af: 'فعلي نقشه، ارتقا او ځایلی بلن',
  },
  'nav.money_description': {
    en: 'Your income, spending and profit',
    fa: 'درآمد، هزینه و سود شما',
    af: 'ستا علیحدل، لګښت او لاس',
  },

  // notifications
  'notifications.activities': { en: 'Activities', fa: 'فعالیت‌ها', af: 'دندونه' },

  // sales
  'sales.amount': { en: 'Amount', fa: 'مبلغ', af: 'مبلغ' },
  'sales.customer': { en: 'Customer', fa: 'مشتری', af: 'اخېسندوی' },
  'sales.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'sales.details': { en: 'Details', fa: 'جزئیات', af: 'تفصیلات' },
  'sales.discount': { en: 'Discount', fa: 'تخفیف', af: 'تخفیف' },
  'sales.items': { en: 'Items', fa: 'اقلام', af: 'شیونه' },
  'sales.paid': { en: 'Paid', fa: 'پرداخت شده', af: 'تادیه شوی' },
  'sales.print': { en: 'Print', fa: 'چاپ', af: 'چاپ' },
  'sales.purchase': { en: 'Purchase', fa: 'خرید', af: 'پریوال' },
  'sales.sale': { en: 'Sale', fa: 'فروش', af: 'پلنه' },
  'sales.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'sales.subtotal': { en: 'Subtotal', fa: 'جمع جزئی', af: 'د جزئي ټول' },
  'sales.supplier': { en: 'Supplier', fa: 'تأمین‌کننده', af: 'تامین کوونکی' },
  'sales.title': { en: 'Sales', fa: 'فروش', af: 'پلنه' },
  'sales.unit': { en: 'Unit', fa: 'واحد', af: 'واحد' },

  // sync
  'sync.failed': { en: 'Sync failed', fa: 'همگام‌سازی ناموفق', af: 'همغږي ناکام شو' },
  'sync.never': { en: 'Never synced', fa: 'هرگز همگام نشده', af: 'هیڅکله همغږي نه شوی' },

  // workflow
  'workflow.templates.title': {
    en: 'Workflow Templates',
    fa: 'قالب‌های گردش کار',
    af: 'د کار جریان ټپلونه',
  },
  'workflow.templates.description': {
    en: 'Manage workflow templates',
    fa: 'مدیریت قالب‌های گردش کار',
    af: 'د کار جریان ټپلونه اداره کول',
  },

  // workspace
  'workspace.employee': { en: 'Employee', fa: 'کارمند', af: 'کارمند' },
  'workspace.redirecting': {
    en: 'Redirecting...',
    fa: 'در حال انتقال...',
    af: 'دلته ته لیږدل کيږي...',
  },
}

// خواندن و بازنویسی فایل‌ها
for (const { file, lang } of LOCALES) {
  const path = resolve(ROOT, file)
  const data = JSON.parse(readFileSync(path, 'utf8'))

  let added = 0
  for (const [keyPath, values] of Object.entries(MISSING_KEYS)) {
    const parts = keyPath.split('.')
    let current = data

    // بررسی آیا کلید از قبل وجود دارد
    let exists = true
    for (const part of parts) {
      if (current[part] === undefined) {
        exists = false
        break
      }
      current = current[part]
    }
    if (exists) continue

    // ایجاد مسیر تو در تو
    current = data
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      const val = current[key]
      // اگر مقدار رشته باشد و باید آبجکت شود، تبدیل کن
      if (typeof val === 'string') {
        current[key] = { title: val }
        current = current[key]
      } else if (!val || typeof val !== 'object') {
        current[key] = {}
        current = current[key]
      } else {
        current = current[key]
      }
    }

    // اضافه کردن مقدار
    const finalKey = parts[parts.length - 1]
    if (current[finalKey] === undefined || typeof current[finalKey] === 'string') {
      current[finalKey] = values[lang] || values.en
      added++
    }
  }

  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
  console.log(`✅ ${file}: ${added} کلید اضافه شد`)
}

console.log('\n🎉 تمام کلیدهای گمشده اضافه شدند!')
