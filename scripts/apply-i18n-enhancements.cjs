const fs = require('fs')
const path = require('path')

console.log('=== APPLYING I18N ENHANCEMENTS ACROSS 3 LANGUAGES ===')

// 1. Update message catalogs
const enPath = 'packages/i18n/messages/en/common.json'
const faPath = 'packages/i18n/messages/fa/common.json'
const afPath = 'packages/i18n/messages/af/common.json'

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
const fa = JSON.parse(fs.readFileSync(faPath, 'utf8'))
const af = JSON.parse(fs.readFileSync(afPath, 'utf8'))

// Helpers to merge nested objects
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
}

// English enhancements
deepMerge(en, {
  notifications: {
    invoiceCreated: 'New invoice created',
    invoiceRegisteredBody: 'Invoice #{number} was registered.',
    invoicePaid: 'Invoice paid',
    invoicePaidBody: 'Invoice #{number} was paid.',
    paymentRecorded: 'Payment {ref} recorded',
    invoiceOverdue: 'Overdue invoice',
    customerCreated: 'New customer: {name}',
    escalatedToYou: 'Unanswered approval referred to you',
    escalatedNoOne: 'Approval pending and no one to assign',
    requiresApproval: 'Requires approval',
    approved: 'Approved',
    rejected: 'Rejected',
    activityOne: 'activity',
    activities: 'activities',
  },
  time: {
    justNow: 'Just now',
    minuteAgo: '1 minute ago',
    minutesAgo: '{m} minutes ago',
    hourAgo: '1 hour ago',
    hoursAgo: '{h} hours ago',
    dayAgo: '1 day ago',
    daysAgo: '{d} days ago',
    weekAgo: '1 week ago',
    weeksAgo: '{w} weeks ago',
    monthAgo: '1 month ago',
    monthsAgo: '{mo} months ago',
    yearAgo: '1 year ago',
    yearsAgo: '{y} years ago',
  },
  activity: {
    created: 'Created',
    updated: 'Updated',
    status_changed: 'Status changed',
    payment: 'Payment',
    approved: 'Approved',
    rejected: 'Rejected',
    sent: 'Sent',
    archived: 'Archived',
    cancelled: 'Cancelled',
    actions: {
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      view: 'View',
      export: 'Export',
      login: 'Login',
      logout: 'Logout',
    },
  },
  status: {
    pending: 'Pending',
    paid: 'Paid',
    completed: 'Completed',
    cancelled: 'Cancelled',
    partial: 'Partially paid',
    overdue: 'Overdue',
    draft: 'Draft',
  },
  units: {
    problems: {
      oneBaseRequired: 'Exactly one base unit must be selected',
      onlyOneBase: 'Only one unit can be the base unit',
      baseMultiplierOne: 'Base unit multiplier must be exactly 1',
      multiplierPositive: 'Unit multiplier must be greater than zero',
      selectUnitPerRow: 'Select a unit for each row',
      duplicateUnit: 'Each unit can only be added once',
      singlePurchaseDefault: 'Only one unit can be the default purchase unit',
      singleSaleDefault: 'Only one unit can be the default sale unit',
    },
  },
  warehouse: {
    movements: {
      sale: 'Sale',
      purchase: 'Purchase',
      production: 'Production',
      transfer: 'Transfer',
      adjustment: 'Adjustment',
      opening: 'Opening balance',
    },
  },
  accounting: {
    accounts: {
      code: 'Code',
      name: 'Name',
      type: 'Type',
      status: 'Status',
    },
    balanceSheet: {
      section: 'Section',
      label: 'Description',
      amount: 'Amount',
    },
    journal: {
      date: 'Date',
      description: 'Description',
      reference: 'Reference',
      total: 'Total',
    },
  },
  common: {
    active: 'Active',
    inactive: 'Inactive',
  },
})

// Persian (fa) enhancements
deepMerge(fa, {
  notifications: {
    invoiceCreated: 'صورت‌حساب جدید ایجاد شد',
    invoiceRegisteredBody: 'صورت‌حساب شماره {number} ثبت شد.',
    invoicePaid: 'صورت‌حساب پرداخت شد',
    invoicePaidBody: 'صورت‌حساب شماره {number} پرداخت شد.',
    paymentRecorded: 'پرداخت {ref} ثبت شد',
    invoiceOverdue: 'صورت‌حساب سررسید شده',
    customerCreated: 'مشتری جدید: {name}',
    escalatedToYou: 'تأییدی که بی‌پاسخ مانده به شما ارجاع شد',
    escalatedNoOne: 'تأییدی منتظر مانده و کسی برای ارجاع نیست',
    requiresApproval: 'نیاز به تأیید دارد',
    approved: 'تأیید شد',
    rejected: 'رد شد',
    activityOne: 'فعالیت',
    activities: 'فعالیت',
  },
  time: {
    justNow: 'همین الان',
    minuteAgo: '۱ دقیقه پیش',
    minutesAgo: '{m} دقیقه پیش',
    hourAgo: '۱ ساعت پیش',
    hoursAgo: '{h} ساعت پیش',
    dayAgo: '۱ روز پیش',
    daysAgo: '{d} روز پیش',
    weekAgo: '۱ هفته پیش',
    weeksAgo: '{w} هفته پیش',
    monthAgo: '۱ ماه پیش',
    monthsAgo: '{mo} ماه پیش',
    yearAgo: '۱ سال پیش',
    yearsAgo: '{y} سال پیش',
  },
  activity: {
    created: 'ایجاد شد',
    updated: 'ویرایش شد',
    status_changed: 'تغییر وضعیت',
    payment: 'پرداخت',
    approved: 'تأیید شد',
    rejected: 'رد شد',
    sent: 'ارسال شد',
    archived: 'بایگانی شد',
    cancelled: 'لغو شد',
    actions: {
      create: 'ایجاد',
      update: 'ویرایش',
      delete: 'حذف',
      view: 'مشاهده',
      export: 'خروجی',
      login: 'ورود',
      logout: 'خروج',
    },
  },
  status: {
    pending: 'در انتظار',
    paid: 'پرداخت شده',
    completed: 'تکمیل شده',
    cancelled: 'لغو شده',
    partial: 'بخشی پرداخت',
    overdue: 'سررسید شده',
    draft: 'پیش‌نویس',
  },
  units: {
    problems: {
      oneBaseRequired: 'باید دقیقاً یک واحد پایه انتخاب شود',
      onlyOneBase: 'فقط یک واحد می‌تواند پایه باشد',
      baseMultiplierOne: 'ضریب واحد پایه باید دقیقاً ۱ باشد',
      multiplierPositive: 'ضریب هر واحد باید بزرگ‌تر از صفر باشد',
      selectUnitPerRow: 'برای هر سطر یک واحد انتخاب کنید',
      duplicateUnit: 'هر واحد فقط یک بار می‌تواند اضافه شود',
      singlePurchaseDefault: 'فقط یک واحد می‌تواند پیش‌فرض خرید باشد',
      singleSaleDefault: 'فقط یک واحد می‌تواند پیش‌فرض فروش باشد',
    },
  },
  warehouse: {
    movements: {
      sale: 'فروش',
      purchase: 'خرید',
      production: 'تولید',
      transfer: 'انتقال',
      adjustment: 'تعدیل',
      opening: 'مانده‌ی اول دوره',
    },
  },
  accounting: {
    accounts: {
      code: 'کد',
      name: 'نام',
      type: 'نوع',
      status: 'وضعیت',
    },
    balanceSheet: {
      section: 'بخش',
      label: 'شرح',
      amount: 'مبلغ',
    },
    journal: {
      date: 'تاریخ',
      description: 'شرح',
      reference: 'مرجع',
      total: 'جمع',
    },
  },
  common: {
    active: 'فعال',
    inactive: 'غیرفعال',
  },
})

// Dari (af) enhancements — Native Afghan Dari terminology
deepMerge(af, {
  notifications: {
    invoiceCreated: 'بل جدید ایجاد شد',
    invoiceRegisteredBody: 'بل شماره {number} ثبت شد.',
    invoicePaid: 'پرداخت بل ثبت شد',
    invoicePaidBody: 'بل شماره {number} پرداخت شد.',
    paymentRecorded: 'پرداخت {ref} ثبت شد',
    invoiceOverdue: 'بل سررسید شده',
    customerCreated: 'مشتری جدید: {name}',
    escalatedToYou: 'تأییدی که بی‌پاسخ مانده به شما ارجاع شد',
    escalatedNoOne: 'تأییدی منتظر مانده و کسی برای ارجاع نیست',
    requiresApproval: 'نیاز به تأیید دارد',
    approved: 'تأیید شد',
    rejected: 'رد شد',
    activityOne: 'فعالیت',
    activities: 'فعالیت',
  },
  time: {
    justNow: 'همین اکنون',
    minuteAgo: '1 دقیقه قبل',
    minutesAgo: '{m} دقیقه قبل',
    hourAgo: '1 ساعت قبل',
    hoursAgo: '{h} ساعت قبل',
    dayAgo: '1 روز قبل',
    daysAgo: '{d} روز قبل',
    weekAgo: '1 هفته قبل',
    weeksAgo: '{w} هفته قبل',
    monthAgo: '1 ماه قبل',
    monthsAgo: '{mo} ماه قبل',
    yearAgo: '1 سال قبل',
    yearsAgo: '{y} سال قبل',
  },
  activity: {
    created: 'ایجاد شد',
    updated: 'ویرایش شد',
    status_changed: 'تغییر حالت',
    payment: 'پرداخت',
    approved: 'تأیید شد',
    rejected: 'رد شد',
    sent: 'ارسال شد',
    archived: 'آرشیف شد',
    cancelled: 'لغو شد',
    actions: {
      create: 'ایجاد',
      update: 'ویرایش',
      delete: 'حذف',
      view: 'مشاهده',
      export: 'خروجی',
      login: 'ورود',
      logout: 'خروج',
    },
  },
  status: {
    pending: 'در انتظار',
    paid: 'پرداخت شده',
    completed: 'تکمیل شده',
    cancelled: 'لغو شده',
    partial: 'قسمتی پرداخت',
    overdue: 'سررسید شده',
    draft: 'پیش‌نویس',
  },
  units: {
    problems: {
      oneBaseRequired: 'باید دقیقاً یک واحد اساسی انتخاب شود',
      onlyOneBase: 'تنها یک واحد می‌تواند اساسی باشد',
      baseMultiplierOne: 'ضریب واحد اساسی باید دقیقاً ۱ باشد',
      multiplierPositive: 'ضریب هر واحد باید بزرگ‌تر از صفر باشد',
      selectUnitPerRow: 'برای هر ردیف یک واحد انتخاب کنید',
      duplicateUnit: 'هر واحد تنها یک بار می‌تواند اضافه شود',
      singlePurchaseDefault: 'تنها یک واحد می‌تواند پیش‌فرض خرید باشد',
      singleSaleDefault: 'تنها یک واحد می‌تواند پیش‌فرض فروش باشد',
    },
  },
  warehouse: {
    movements: {
      sale: 'فروش',
      purchase: 'خرید',
      production: 'تولید',
      transfer: 'انتقال',
      adjustment: 'تعدیل',
      opening: 'موجودی ابتدایی',
    },
  },
  accounting: {
    accounts: {
      code: 'کد',
      name: 'نام',
      type: 'نوع',
      status: 'حالت',
    },
    balanceSheet: {
      section: 'بخش',
      label: 'شرح',
      amount: 'مبلغ',
    },
    journal: {
      date: 'تاریخ',
      description: 'شرح',
      reference: 'مرجع',
      total: 'مجموع',
    },
  },
  common: {
    active: 'فعال',
    inactive: 'غیرفعال',
  },
})

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8')
fs.writeFileSync(faPath, JSON.stringify(fa, null, 2) + '\n', 'utf8')
fs.writeFileSync(afPath, JSON.stringify(af, null, 2) + '\n', 'utf8')

console.log('Catalogs updated successfully in en, fa, af.')
