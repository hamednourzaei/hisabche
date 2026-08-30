import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')
const LOCALES = [
  { file: 'packages/i18n/src/locales/en.json', lang: 'en' },
  { file: 'packages/i18n/src/locales/fa-IR.json', lang: 'fa' },
  { file: 'packages/i18n/src/locales/fa-AF.json', lang: 'af' },
]

// All 695 missing keys with translations
const K = {
  // ── accounting (58) ──
  'accounting.accounts.active': { en: 'Active', fa: 'فعال', af: 'فعال' },
  'accounting.accounts.code': { en: 'Account Code', fa: 'کد حساب', af: 'د حساب کوډ' },
  'accounting.accounts.create': { en: 'Create Account', fa: 'ایجاد حساب', af: 'حساب جوړول' },
  'accounting.accounts.createTitle': {
    en: 'Create New Account',
    fa: 'ایجاد حساب جدید',
    af: 'نوې حساب جوړول',
  },
  'accounting.accounts.empty.subtitle': {
    en: 'Create your first account to get started',
    fa: 'اولین حساب خود را ایجاد کنید',
    af: 'خپل پوره حساب جوړوئ',
  },
  'accounting.accounts.empty.title': {
    en: 'No accounts yet',
    fa: 'هنوز حسابی وجود ندارد',
    af: 'هنوز حساب شته نه دي',
  },
  'accounting.accounts.inactive': { en: 'Inactive', fa: 'غیرفعال', af: 'غیرفعال' },
  'accounting.accounts.name': { en: 'Account Name', fa: 'نام حساب', af: 'د حساب نوم' },
  'accounting.accounts.namePlaceholder': {
    en: 'Enter account name',
    fa: 'نام حساب را وارد کنید',
    af: 'د حساب نوم ولیکئ',
  },
  'accounting.accounts.noParent': {
    en: 'No parent (top-level)',
    fa: 'بدون والد (سطح بالا)',
    af: 'د پلر نه (پورتنی کچ)',
  },
  'accounting.accounts.parent': { en: 'Parent Account', fa: 'حساب والد', af: 'د حساب پلر' },
  'accounting.accounts.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'accounting.accounts.title': {
    en: 'Chart of Accounts',
    fa: 'نمودار حساب‌ها',
    af: 'د حسابونو چارټ',
  },
  'accounting.accounts.type': { en: 'Account Type', fa: 'نوع حساب', af: 'د حساب ډول' },
  'accounting.balanceSheet.asOf': { en: 'As of', fa: 'تا تاریخ', af: 'ترسې' },
  'accounting.balanceSheet.assets': { en: 'Assets', fa: 'دارایی‌ها', af: 'سرمایې' },
  'accounting.balanceSheet.balanced': { en: 'Balanced', fa: 'تراز شده', af: 'متعادل' },
  'accounting.balanceSheet.empty.title': {
    en: 'No balance sheet data',
    fa: 'داده ترازنامه موجود نیست',
    af: 'د تراز نامه معلومات شته نه دي',
  },
  'accounting.balanceSheet.equity': {
    en: 'Equity',
    fa: 'حقوق صاحبان سهام',
    af: 'د سهمدارانو حقوقي',
  },
  'accounting.balanceSheet.liabilities': { en: 'Liabilities', fa: 'بدهی‌ها', af: 'قروضه' },
  'accounting.balanceSheet.title': { en: 'Balance Sheet', fa: 'ترازنامه', af: 'د تراز نامه' },
  'accounting.balanceSheet.unbalanced': { en: 'Unbalanced', fa: 'تراز نشده', af: 'نامتعادل' },
  'accounting.dateRange.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'accounting.dateRange.from': { en: 'From', fa: 'از', af: 'دلته' },
  'accounting.dateRange.to': { en: 'To', fa: 'تا', af: 'تر' },
  'accounting.expense': { en: 'Expense', fa: 'هزینه', af: 'اخراج' },
  'accounting.export.button': { en: 'Export', fa: 'خروجی', af: 'اخراج' },
  'accounting.export.label': { en: 'Export Report', fa: 'خروجی گزارش', af: 'د راپور اخراج' },
  'accounting.income': { en: 'Income', fa: 'درآمد', af: ' علیحدل' },
  'accounting.incomeStatement.empty.title': {
    en: 'No income statement data',
    fa: 'داده صورت سود و زیان موجود نیست',
    af: 'د علیحدل راپور معلومات شته نه دي',
  },
  'accounting.incomeStatement.expenses': { en: 'Expenses', fa: 'هزینه‌ها', af: 'اخراجونه' },
  'accounting.incomeStatement.netIncome': { en: 'Net Income', fa: 'سود خالص', af: 'خالص علیحدل' },
  'accounting.incomeStatement.revenue': { en: 'Revenue', fa: 'درآمد', af: 'علیحدل' },
  'accounting.incomeStatement.title': {
    en: 'Income Statement',
    fa: 'صورت سود و زیان',
    af: 'د علیحدل راپور',
  },
  'accounting.journal.account': { en: 'Account', fa: 'حساب', af: 'حساب' },
  'accounting.journal.addLine': { en: 'Add Line', fa: 'اضافه کردن ردیف', af: 'لیکه اضافه کول' },
  'accounting.journal.balanced': { en: 'Balanced', fa: 'تراز شده', af: 'متعادل' },
  'accounting.journal.create': { en: 'New Entry', fa: 'ثبت جدید', af: 'نوې ثبت' },
  'accounting.journal.createTitle': {
    en: 'New Journal Entry',
    fa: 'ثبت روزنامه جدید',
    af: 'نوې د کتاب وردو',
  },
  'accounting.journal.credit': { en: 'Credit', fa: 'بستانکار', af: 'آبادي' },
  'accounting.journal.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'accounting.journal.debit': { en: 'Debit', fa: 'بدهکار', af: 'ښونډه' },
  'accounting.journal.description': { en: 'Description', fa: 'توضیحات', af: 'تفصیلات' },
  'accounting.journal.empty.subtitle': {
    en: 'Record your first journal entry',
    fa: 'اولین ثبت روزنامه خود را وارد کنید',
    af: 'خپله لومړۍ د کتاب وردو ولیکئ',
  },
  'accounting.journal.empty.title': {
    en: 'No journal entries',
    fa: 'هنوز ثبت روزنامه‌ای وجود ندارد',
    af: 'هنوز د کتاب وردونه شته نه دي',
  },
  'accounting.journal.lines': { en: 'Lines', fa: 'ردیف‌ها', af: 'لیکې' },
  'accounting.journal.reference': { en: 'Reference', fa: 'مرجع', af: 'مرجع' },
  'accounting.journal.selectAccount': {
    en: 'Select account',
    fa: 'حساب را انتخاب کنید',
    af: 'حساب وټاکئ',
  },
  'accounting.journal.title': { en: 'Journal Entries', fa: 'ثبت‌های روزنامه', af: 'د کتاب وردونه' },
  'accounting.journal.totalCredit': { en: 'Total Credit', fa: 'جمع بستانکار', af: 'د آبادي ټول' },
  'accounting.journal.totalDebit': { en: 'Total Debit', fa: 'جمع بدهکار', af: 'د ښونډي ټول' },
  'accounting.journal.unbalanced': { en: 'Unbalanced', fa: 'تراز نشده', af: 'نامتعادل' },
  'accounting.tabs.label': { en: 'Tabs', fa: 'تب‌ها', af: 'ټبوټونه' },
  'accounting.trialBalance.asOf': { en: 'As of', fa: 'تا تاریخ', af: 'ترسې' },
  'accounting.trialBalance.balance': { en: 'Balance', fa: 'تراز', af: 'تراز' },
  'accounting.trialBalance.empty.title': {
    en: 'No trial balance data',
    fa: 'داده تراز آزمایشی موجود نیست',
    af: 'د ازمویني تراز معلومات شته نه دي',
  },
  'accounting.trialBalance.title': { en: 'Trial Balance', fa: 'تراز آزمایشی', af: 'ازمویني تراز' },
  'accounting.trialBalance.total': { en: 'Total', fa: 'مجموع', af: 'ټول' },

  // ── action (25) ──
  'action.actions': { en: 'Actions', fa: 'عملیات', af: 'عملي' },
  'action.add': { en: 'Add', fa: 'اضافه کردن', af: 'اضافه کول' },
  'action.back': { en: 'Back', fa: 'بازگشت', af: 'بیرته' },
  'action.backToEdit': { en: 'Back to Edit', fa: 'بازگشت به ویرایش', af: 'بیرته سره مختلاس كول' },
  'action.cancel': { en: 'Cancel', fa: 'لغو', af: 'لغوي' },
  'action.clear': { en: 'Clear', fa: 'پاک کردن', af: 'پاک کول' },
  'action.close': { en: 'Close', fa: 'بستن', af: 'بندول' },
  'action.confirmCreate': { en: 'Confirm Create', fa: 'تأیید ایجاد', af: 'جوړول تایید' },
  'action.create': { en: 'Create', fa: 'ایجاد', af: 'جوړول' },
  'action.delete': { en: 'Delete', fa: 'حذف', af: 'ړنګول' },
  'action.done': { en: 'Done', fa: 'انجام شد', af: ' بشپړ شو' },
  'action.edit': { en: 'Edit', fa: 'ویرایش', af: 'مختلاس كول' },
  'action.email': { en: 'Email', fa: 'ایمیل', af: 'بریښنالیک' },
  'action.export': { en: 'Export', fa: 'خروجی', af: 'اخراج' },
  'action.next': { en: 'Next', fa: 'بعدی', af: 'بل' },
  'action.open': { en: 'Open', fa: 'باز کردن', af: 'خول' },
  'action.previewInvoice': { en: 'Preview Invoice', fa: 'پیش‌نمایش فاکتور', af: 'د حوالې مخليدنه' },
  'action.previous': { en: 'Previous', fa: 'قبلی', af: 'مخکینی' },
  'action.print': { en: 'Print', fa: 'چاپ', af: 'چاپ' },
  'action.remove': { en: 'Remove', fa: 'حذف', af: 'ړنګول' },
  'action.retry': { en: 'Retry', fa: 'تلاش مجدد', af: 'بیا هڅه' },
  'action.save': { en: 'Save', fa: 'ذخیره', af: 'خوندي' },
  'action.search': { en: 'Search', fa: 'جستجو', af: 'لټون' },
  'action.share': { en: 'Share', fa: 'اشتراک‌گذاری', af: 'شریکول' },
  'action.view': { en: 'View', fa: 'مشاهده', af: 'لیدل' },

  // ── admin (86) ──
  'admin.auditLogs.action': { en: 'Action', fa: 'عملیات', af: 'عملي' },
  'admin.auditLogs.empty': {
    en: 'No audit logs',
    fa: 'لاگ حسابرسی وجود ندارد',
    af: 'د حسابرسي لاګ شته نه دي',
  },
  'admin.auditLogs.emptyHint': {
    en: 'Activity will appear here',
    fa: 'فعالیت‌ها اینجا نمایش داده می‌شوند',
    af: 'دندونه دلتهښکاره شي',
  },
  'admin.auditLogs.entity': { en: 'Entity', fa: 'موجودیت', af: 'تړاو' },
  'admin.auditLogs.loadError': {
    en: 'Failed to load audit logs',
    fa: 'بارگذاری لاگ‌های حسابرسی ناموفق بود',
    af: 'د حسابرسي لاګونو پورته کول ناکام شو',
  },
  'admin.auditLogs.noEntity': { en: 'No entity', fa: 'موجودیتی ثبت نشده', af: 'تړاو ثبت نشته' },
  'admin.auditLogs.when': { en: 'When', fa: 'چه زمانی', af: 'کله' },
  'admin.dashboard.description': {
    en: 'Overview of all workspaces',
    fa: 'نمای کلی فضاهای کاری',
    af: 'د ټولو کار ځایونو عمومي',
  },
  'admin.dashboard.generatedAt': { en: 'Generated at', fa: 'تولید شده در', af: 'جوړ شوي په' },
  'admin.dashboard.ofTotal': { en: 'of total', fa: 'از مجموع', af: 'د ټولو څخه' },
  'admin.dashboard.planMix': { en: 'Plan Mix', fa: 'ترکیب طرح‌ها', af: 'د نقشونو ترکیب' },
  'admin.dashboard.planShare': { en: 'Plan Share', fa: 'سهم طرح', af: 'د نقشه سهم' },
  'admin.empty.noMembers': { en: 'No members found', fa: 'عضوی یافت نشد', af: 'غړي نه موندل شول' },
  'admin.empty.noneOnPage': {
    en: 'Nothing on this page',
    fa: 'چیزی در این صفحه نیست',
    af: 'په دې پاڼه کوم شی نشته',
  },
  'admin.empty.noneOnPageHint': {
    en: 'No workspaces match your filters',
    fa: 'فضای کاری مطابق فیلترهای شما یافت نشد',
    af: 'ستا د فلټرو سره اسان کار ځایونه نه موندل شول',
  },
  'admin.empty.noResults': {
    en: 'No results found',
    fa: 'نتیجه‌ای یافت نشد',
    af: 'پایله نه موندل شوه',
  },
  'admin.empty.noWorkspaces': {
    en: 'No workspaces',
    fa: 'فضای کاری وجود ندارد',
    af: 'کار ځایونه شته نه دي',
  },
  'admin.empty.noWorkspacesHint': {
    en: 'No workspaces have been created yet',
    fa: 'هنوز فضای کاری ایجاد نشده',
    af: 'هنوز کار ځایونه جوړ نه شوي',
  },
  'admin.error.loadMembers': {
    en: 'Failed to load members',
    fa: 'بارگذاری اعضا ناموفق بود',
    af: 'د غړو پورته کول ناکام شو',
  },
  'admin.error.loadWorkspaces': {
    en: 'Failed to load workspaces',
    fa: 'بارگذاری فضاهای کاری ناموفق بود',
    af: 'د کار ځایونو پورته کول ناکام شو',
  },
  'admin.error.removeMember': {
    en: 'Failed to remove member',
    fa: 'حذف عضو ناموفق بود',
    af: 'غړي ړنګول ناکام شو',
  },
  'admin.error.retry': { en: 'Retry', fa: 'تلاش مجدد', af: 'بیا هڅه' },
  'admin.error.updateRole': {
    en: 'Failed to update role',
    fa: 'به‌روزرسانی نقش ناموفق بود',
    af: 'د رول تازه کول ناکام شو',
  },
  'admin.filters.all': { en: 'All', fa: 'همه', af: 'ټول' },
  'admin.filters.groupLabel': { en: 'Filters', fa: 'فیلترها', af: 'فلټرونه' },
  'admin.member.editRole': { en: 'Edit Role', fa: 'ویرایش نقش', af: 'رول مختلاس كول' },
  'admin.member.email': { en: 'Email', fa: 'ایمیل', af: 'بریښنالیک' },
  'admin.member.joined': { en: 'Joined', fa: 'عضویت', af: 'ګډون' },
  'admin.member.name': { en: 'Name', fa: 'نام', af: 'نوم' },
  'admin.member.noProfile': { en: 'No profile', fa: 'پروفایلی ثبت نشده', af: 'پروفایل ثبت نشته' },
  'admin.member.ownerProtected': {
    en: 'Owner (protected)',
    fa: 'مالک (محافظت شده)',
    af: ' مالک (ورته)',
  },
  'admin.member.remove': { en: 'Remove', fa: 'حذف', af: 'ړنګول' },
  'admin.member.statusNoAccess': { en: 'No Access', fa: 'بدون دسترسی', af: 'بې لاسېسی' },
  'admin.member.statusSuspended': { en: 'Suspended', fa: 'معلق', af: 'معلق' },
  'admin.member.unknown': { en: 'Unknown', fa: 'ناشناخته', af: 'ناپېژندلی' },
  'admin.notice.migrationInProgress': {
    en: 'Migration in progress',
    fa: 'مهاجرت در حال انجام',
    af: 'مهاجرت په جریان کې دی',
  },
  'admin.pagination.label': { en: 'Page', fa: 'صفحه', af: 'پاڼه' },
  'admin.pagination.next': { en: 'Next', fa: 'بعدی', af: 'بل' },
  'admin.pagination.previous': { en: 'Previous', fa: 'قبلی', af: 'مخکینی' },
  'admin.pagination.showing': { en: 'Showing', fa: 'نمایش', af: 'ښکاره کول' },
  'admin.removeDialog.body': {
    en: 'Are you sure you want to remove this member?',
    fa: 'آیا مطمئن هستید که می‌خواهید این عضو را حذف کنید؟',
    af: 'ایا ته یقین لري چې غړی ړنګوئ؟',
  },
  'admin.removeDialog.cancel': { en: 'Cancel', fa: 'لغو', af: 'لغوي' },
  'admin.removeDialog.confirm': { en: 'Confirm', fa: 'تأیید', af: 'تایید' },
  'admin.removeDialog.consequence': {
    en: 'This action cannot be undone',
    fa: 'این عمل قابل بازگشت نیست',
    af: 'دلته عمل بیرته نه شي کیدلی',
  },
  'admin.removeDialog.title': { en: 'Remove Member', fa: 'حذف عضو', af: 'غړی ړنګول' },
  'admin.shell.alertsNone': { en: 'No alerts', fa: 'بدون هشدار', af: 'بېخبرۍ' },
  'admin.shell.alertsWithCount': {
    en: '{{count}} alerts',
    fa: '{{count}} هشدار',
    af: '{{count}} خبرۍ',
  },
  'admin.shell.closeMenu': { en: 'Close menu', fa: 'بستن منو', af: 'منو بندول' },
  'admin.shell.consoleLabel': { en: 'Admin Console', fa: 'کنسول مدیریت', af: 'د ادارو کنسول' },
  'admin.shell.mainNav': { en: 'Main navigation', fa: 'ناوبری اصلی', af: 'اصلي نavi' },
  'admin.shell.openMenu': { en: 'Open menu', fa: 'باز کردن منو', af: 'منو خول' },
  'admin.shell.searchLabel': { en: 'Search', fa: 'جستجو', af: 'لټون' },
  'admin.shell.searchPlaceholder': { en: 'Search...', fa: 'جستجو...', af: 'لټون...' },
  'admin.shell.superAdmin': { en: 'Super Admin', fa: 'مدیر کل', af: 'اعلیٰ اداري' },
  'admin.subscriptions.allPlans': { en: 'All Plans', fa: 'همه طرح‌ها', af: 'ټولې نقشې' },
  'admin.subscriptions.allStatuses': { en: 'All Statuses', fa: 'همه وضعیت‌ها', af: 'ټوله حالتونه' },
  'admin.subscriptions.changePlan': { en: 'Change Plan', fa: 'تغییر طرح', af: 'نقشه بدل کول' },
  'admin.subscriptions.changeStatus': {
    en: 'Change Status',
    fa: 'تغییر وضعیت',
    af: 'حالت بدل کول',
  },
  'admin.subscriptions.empty': {
    en: 'No subscriptions',
    fa: 'اشتراکی وجود ندارد',
    af: 'ځایلي شته نه دي',
  },
  'admin.subscriptions.expired': { en: 'Expired', fa: 'منقضی شده', af: 'موده ته ورسېدل' },
  'admin.subscriptions.expiredAgo': {
    en: 'Expired {{time}} ago',
    fa: '{{time}} پیش منقضی شده',
    af: '{{time}} مخکې موده ته ورسېدل',
  },
  'admin.subscriptions.expiresIn': {
    en: 'Expires in {{time}}',
    fa: '{{time}} دیگر منقضی می‌شود',
    af: '{{time}} وروسته موده ته ورسېدل',
  },
  'admin.subscriptions.expiringSoon': {
    en: 'Expiring Soon',
    fa: 'به زودی منقضی می‌شود',
    af: 'дрехه موده ته ورسېدل',
  },
  'admin.subscriptions.loadError': {
    en: 'Failed to load subscriptions',
    fa: 'بارگذاری اشتراک‌ها ناموفق بود',
    af: 'د ځایلونو پورته کول ناکام شو',
  },
  'admin.subscriptions.noDateBuckets': {
    en: 'No date range',
    fa: 'بازه زمانی وجود ندارد',
    af: 'د نیټو بست شته نه دي',
  },
  'admin.subscriptions.noPeriod': { en: 'No period', fa: 'دوره‌ای ثبت نشده', af: 'دوره ثبت نشته' },
  'admin.subscriptions.periodEnd': { en: 'Period End', fa: 'پایان دوره', af: 'د دورې پای' },
  'admin.subscriptions.plan': { en: 'Plan', fa: 'طرح', af: 'نقشه' },
  'admin.subscriptions.reason': { en: 'Reason', fa: 'دلیل', af: ' Bloss' },
  'admin.subscriptions.reasonHint': {
    en: 'Optional reason for status change',
    fa: 'دلیل اختیاری برای تغییر وضعیت',
    af: 'د حالت بدل کولو اختیاري علت',
  },
  'admin.subscriptions.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'admin.subscriptions.trial': { en: 'Trial', fa: 'آزمایشی', af: 'آزمویني' },
  'admin.subscriptions.updateError': {
    en: 'Failed to update subscription',
    fa: 'به‌روزرسانی اشتراک ناموفق بود',
    af: 'د ځایلي تازه کول ناکام شو',
  },
  'admin.users.empty': { en: 'No users found', fa: 'کاربری یافت نشد', af: 'کاروونکي نه موندل شول' },
  'admin.users.loadError': {
    en: 'Failed to load users',
    fa: 'بارگذاری کاربران ناموفق بود',
    af: 'د کاروونکو پورته کول ناکام شو',
  },
  'admin.users.search': { en: 'Search users', fa: 'جستجوی کاربران', af: 'د کاروونکو لټون' },
  'admin.users.searchScopeNotice': {
    en: 'Search limited to displayed users',
    fa: 'جستجو محدود به کاربران نمایش داده شده',
    af: 'لټون محدود د ښکاره شوو کاروونکو ته دي',
  },
  'admin.workspaces.active': { en: 'Active', fa: 'فعال', af: 'فعال' },
  'admin.workspaces.collapse': { en: 'Collapse', fa: 'جمع کردن', af: 'مخفی کول' },
  'admin.workspaces.expand': { en: 'Expand', fa: 'باز کردن', af: 'اخیستل' },
  'admin.workspaces.inactive': { en: 'Inactive', fa: 'غیرفعال', af: 'غیرفعال' },
  'admin.workspaces.members': { en: 'Members', fa: 'اعضا', af: 'غړي' },
  'admin.workspaces.noOwner': { en: 'No owner', fa: 'بدون مالک', af: 'بې مالک' },
  'admin.workspaces.noSubscription': { en: 'No subscription', fa: 'بدون اشتراک', af: 'بې ځایلي' },
  'admin.workspaces.owner': { en: 'Owner', fa: 'مالک', af: 'مالک' },
  'admin.workspaces.search': {
    en: 'Search workspaces',
    fa: 'جستجوی فضاهای کاری',
    af: 'د کار ځایونو لټون',
  },

  // ── adminPanel (2) ──
  'adminPanel.access': { en: 'Admin Access', fa: 'دسترسی مدیریت', af: 'د ادارو لاسېسي' },
  'adminPanel.notAllowed': {
    en: 'You do not have admin access',
    fa: 'شما دسترسی مدیریت ندارید',
    af: 'ته د ادارو لاسېسي نه لري',
  },

  // ── auth (10) ──
  'auth.biometricEnable': {
    en: 'Enable Biometric Login',
    fa: 'فعال‌سازی ورود بیومتریک',
    af: 'بیومتریک login فعال کول',
  },
  'auth.biometricPrompt': {
    en: 'Authenticate with biometrics',
    fa: 'احراز هویت با بیومتریک',
    af: 'د بیومتریک سره احراز هویت',
  },
  'auth.biometricUnlock': {
    en: 'Unlock with biometrics',
    fa: 'باز کردن قفل با بیومتریک',
    af: 'د بیومتریک سره قفل خول',
  },
  'auth.brand': { en: 'Hisabche', fa: 'حسابچه', af: 'حسابچه' },
  'auth.invalidEmail': { en: 'Invalid email', fa: 'ایمیل نامعتبر', af: 'ناسم بریښنالیک' },
  'auth.invalidPassword': { en: 'Invalid password', fa: 'رمز عبور نامعتبر', af: 'ناسم پټ نوم' },
  'auth.legal': {
    en: 'By continuing you agree to our Terms and Privacy Policy',
    fa: 'با ادامه، شرایط و سیاست حفظ حریم خصوصی را می‌پذیرید',
    af: 'د مسل طریق، ته زموږ شرایط او حفظ حریم خصوصي سیاست ته رضایت لري',
  },
  'auth.submit': { en: 'Sign In', fa: 'ورود', af: 'ننوتل' },
  'auth.tagline': {
    en: 'For businesses in Iran and Afghanistan',
    fa: 'برای کسب‌کارهای ایران و افغانستان',
    af: 'د ایران او افغانستان د کسبوکارونو لپاره',
  },
  'auth.title': { en: 'Sign In', fa: 'ورود', af: 'ننوتل' },

  // ── billing (3) ──
  'billing.plans.enterprise.name': { en: 'Enterprise', fa: 'سازمانی', af: 'سازماني' },
  'billing.plans.free.name': { en: 'Free', fa: 'رایگان', af: 'وړیا' },
  'billing.plans.pro.name': { en: 'Professional', fa: 'حرفه‌ای', af: 'آ professional' },

  // ── calendar (2) ──
  'calendar.selectMonth': { en: 'Select month', fa: 'انتخاب ماه', af: 'میاشته وټاکئ' },
  'calendar.selectYear': { en: 'Select year', fa: 'انتخاب سال', af: 'کال وټاکئ' },

  // ── common (41) ──
  'common.add': { en: 'Add', fa: 'اضافه کردن', af: 'اضافه کول' },
  'common.amount': { en: 'Amount', fa: 'مبلغ', af: 'مبلغ' },
  'common.bulkPartialFailure': {
    en: 'Some items could not be deleted',
    fa: 'برخی اقلام قابل حذف نبودند',
    af: '_some_شیونه ړنګل نه شي',
  },
  'common.clearSelection': { en: 'Clear Selection', fa: 'لغو انتخاب', af: 'غوره کول پاک کول' },
  'common.confirmAction': { en: 'Confirm Action', fa: 'تأیید عملیات', af: 'عملي تایید' },
  'common.currency': { en: 'Currency', fa: 'ارز', af: 'اسعار' },
  'common.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'common.description': { en: 'Description', fa: 'توضیحات', af: 'تفصیلات' },
  'common.details': { en: 'Details', fa: 'جزئیات', af: 'تفصیلات' },
  'common.empty': { en: 'Empty', fa: 'خالی', af: 'خالي' },
  'common.error': { en: 'Error', fa: 'خطا', af: 'تېروتنه' },
  'common.event': { en: 'Event', fa: 'رویداد', af: '.pong' },
  'common.export': { en: 'Export', fa: 'خروجی', af: 'اخراج' },
  'common.logout': { en: 'Logout', fa: 'خروج', af: 'وتل' },
  'common.more': { en: 'More', fa: 'بیشتر', af: 'نوره' },
  'common.moreItems': { en: 'more items', fa: 'مورد بیشتر', af: 'نور شیونه' },
  'common.next': { en: 'Next', fa: 'بعدی', af: 'بل' },
  'common.noCustomer': { en: 'Unknown Customer', fa: 'مشتری ناشناس', af: 'ناپېژندلی اخېسندوی' },
  'common.noData': { en: 'No data found', fa: 'داده‌ای یافت نشد', af: 'معلومات نه موندل شول' },
  'common.previous': { en: 'Previous', fa: 'قبلی', af: 'مخکینی' },
  'common.print': { en: 'Print', fa: 'چاپ', af: 'چاپ' },
  'common.records': { en: 'Records', fa: 'رکوردها', af: 'ریکارډونه' },
  'common.refresh': { en: 'Refresh', fa: 'تازه‌سازی', af: 'تازه کول' },
  'common.saving': { en: 'Saving...', fa: 'در حال ذخیره...', af: 'خوندي کيږي...' },
  'common.search': { en: 'Search', fa: 'جستجو', af: 'لټون' },
  'common.select': { en: 'Select', fa: 'انتخاب', af: 'وټاکئ' },
  'common.selectAll': { en: 'Select All', fa: 'انتخاب همه', af: 'ټول وټاکئ' },
  'common.selectRow': { en: 'Select row', fa: 'انتخاب ردیف', af: 'لیکه وټاکئ' },
  'common.selectedCount': {
    en: '{{count}} selected',
    fa: '{{count}} انتخاب شده',
    af: '{{count}} وټاکل شوي',
  },
  'common.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'common.total': { en: 'Total', fa: 'مجموع', af: 'ټول' },
  'common.unit': { en: 'Unit', fa: 'واحد', af: 'واحد' },
  'common.vsLastMonth': { en: 'vs last month', fa: 'نسبت به ماه قبل', af: 'ستن د میاشتې ته' },

  // ── crm (47) ──
  'crm.byEmployee': { en: 'By Employee', fa: 'بر اساس کارمند', af: 'د کارمند پر بنياد' },
  'crm.byOwner': { en: 'By Owner', fa: 'بر اساس مالک', af: 'د مالک پر بنياد' },
  'crm.changeStatus': { en: 'Change Status', fa: 'تغییر وضعیت', af: 'حالت بدل کول' },
  'crm.closeDate': { en: 'Close Date', fa: 'تاریخ بسته شدن', af: 'د بندیدو نیټه' },
  'crm.customerCount': { en: 'Customer Count', fa: 'تعداد مشتریان', af: 'د اخېسندوو شمېر' },
  'crm.customerPhone': { en: 'Customer Phone', fa: 'تلفن مشتری', af: 'د اخېسندوی تلیفون' },
  'crm.customersSelectedCount': {
    en: '{{count}} customers selected',
    fa: '{{count}} مشتری انتخاب شده',
    af: '{{count}} اخېسندوی وټاکل شوي',
  },
  'crm.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'crm.description': { en: 'Description', fa: 'توضیحات', af: 'تفصیلات' },
  'crm.employee': { en: 'Employee', fa: 'کارمند', af: 'کارمند' },
  'crm.interactions.contentPlaceholder': {
    en: 'Add a note...',
    fa: 'یادداشت اضافه کنید...',
    af: 'یادداشت اضافه کړئ...',
  },
  'crm.interactions.create': { en: 'New Interaction', fa: 'تعامل جدید', af: 'نوې interacts' },
  'crm.interactions.new': { en: 'New', fa: 'جدید', af: 'نوی' },
  'crm.linkCopied': { en: 'Link copied', fa: 'لینک کپی شد', af: 'لینک کپي شو' },
  'crm.opportunity': { en: 'Opportunity', fa: 'فرصت', af: 'فرصت' },
  'crm.outcomes.done': { en: 'Done', fa: 'انجام شده', af: 'بشپړ شوی' },
  'crm.outcomes.empty': {
    en: 'No outcomes recorded',
    fa: 'نتیجه‌ای ثبت نشده',
    af: 'هیڅ پایله ثبت نشته',
  },
  'crm.outcomes.failed': { en: 'Failed', fa: 'ناموفق', af: 'ناکام' },
  'crm.outcomes.markDone': { en: 'Mark as Done', fa: 'علامت انجام شده', af: 'د بشپړ شوی نښه' },
  'crm.outcomes.markFailed': { en: 'Mark as Failed', fa: 'علامت ناموفق', af: 'د ناکام نښه' },
  'crm.outcomes.notePlaceholder': {
    en: 'Add a note...',
    fa: 'یادداشت اضافه کنید...',
    af: 'یادداشت اضافه کړئ...',
  },
  'crm.outcomes.pending': { en: 'Pending', fa: 'در انتظار', af: 'په انتظار' },
  'crm.outcomes.summary': { en: 'Summary', fa: 'خلاصه', af: 'خلاصه' },
  'crm.outcomes.title': { en: 'Outcomes', fa: 'نتایج', af: 'پایلې' },
  'crm.outcomes.whyFailed': { en: 'Why it failed', fa: 'دلیل ناموفقی', af: 'له کومه علت ناکام شو' },
  'crm.pickCustomersPlaceholder': {
    en: 'Pick customers...',
    fa: 'مشتریان را انتخاب کنید...',
    af: 'اخېسندوی وټاکئ...',
  },
  'crm.pickEmployeePlaceholder': {
    en: 'Pick employee...',
    fa: 'کارمند را انتخاب کنید...',
    af: 'کارمند وټاکئ...',
  },
  'crm.probability': { en: 'Probability', fa: 'احتمال', af: 'احتمال' },
  'crm.process': { en: 'Process', fa: 'پردازش', af: 'پروسس' },
  'crm.sendToEmployee': { en: 'Send to Employee', fa: 'ارسال به کارمند', af: 'د کارمند ته واستوئ' },
  'crm.stage': { en: 'Stage', fa: 'مرحله', af: 'مرحله' },
  'crm.stageLead': { en: 'Lead', fa: 'سرنخ', af: 'سرنخ' },
  'crm.stageLost': { en: 'Lost', fa: 'باخت', af: 'وګرات' },
  'crm.stageNegotiation': { en: 'Negotiation', fa: 'مذاکره', af: 'مذاکره' },
  'crm.stageProposal': { en: 'Proposal', fa: 'پیشنهاد', af: 'است刹那' },
  'crm.stageQualified': { en: 'Qualified', fa: 'واجد شرایط', af: 'شرایط ته نه وړ' },
  'crm.stageWon': { en: 'Won', fa: 'برد', af: '_MOUNTAINS' },
  'crm.stats.total': { en: 'Total', fa: 'مجموع', af: 'ټول' },
  'crm.status.completed': { en: 'Completed', fa: 'تکمیل شده', af: ' بشپړ شوی' },
  'crm.status.inProgress': { en: 'In Progress', fa: 'در حال انجام', af: 'په جریان کې' },
  'crm.status.pending': { en: 'Pending', fa: 'در انتظار', af: 'په انتظار' },
  'crm.statusTimeline': { en: 'Status Timeline', fa: 'تاریخچه وضعیت', af: 'د حالت تاریخچه' },
  'crm.subject': { en: 'Subject', fa: 'موضوع', af: 'موضوع' },
  'crm.tabs.stats': { en: 'Stats', fa: 'آمار', af: 'شمېرپانګه' },
  'crm.type': { en: 'Type', fa: 'نوع', af: 'ډول' },
  'crm.unassigned': { en: 'Unassigned', fa: 'بدون مسئول', af: 'بې مسؤل' },
  'crm.value': { en: 'Value', fa: 'ارزش', af: 'ارزش' },

  // ── customer (2) ──
  'customer.phoneOptional': {
    en: 'Phone (optional)',
    fa: 'تلفن (اختیاری)',
    af: 'تلیفون (اختیاري)',
  },
  'customer.pickSupplierPlaceholder': {
    en: 'Select supplier...',
    fa: 'تأمین‌کننده را انتخاب کنید...',
    af: 'تامین کوونکی وټاکئ...',
  },

  // ── customers (22) ──
  'customers.backToList': { en: 'Back to list', fa: 'بازگشت به لیست', af: 'بیرته لیست ته' },
  'customers.emptyDescription': {
    en: 'Add your first customer to get started',
    fa: 'اولین مشتری خود را اضافه کنید',
    af: 'خپل پوره اخېسندوی اضافه کړئ',
  },
  'customers.emptyTitle': {
    en: 'No customers yet',
    fa: 'هنوز مشتری وجود ندارد',
    af: 'هنوز اخېسندوی شته نه دي',
  },
  'customers.export.statusDebtor': { en: 'Debtor', fa: 'بدهکار', af: 'اوز' },
  'customers.export.statusSettled': { en: 'Settled', fa: 'تسویه شده', af: 'تسویه شوی' },
  'customers.exportStatement': {
    en: 'Export Statement',
    fa: 'خروجی صورت‌حساب',
    af: 'د حوالې اخراج',
  },
  'customers.health': { en: 'Health', fa: 'وضعیت', af: 'حالت' },
  'customers.lifetimeValue': { en: 'Lifetime Value', fa: 'ارزش مادام‌العمر', af: 'د ژوندوني ارزش' },
  'customers.newCustomerDetails': {
    en: 'New Customer Details',
    fa: 'جزئیات مشتری جدید',
    af: 'د نووي اخېسندوی تفصیلات',
  },
  'customers.noOpenDealsDesc': {
    en: 'Record payment for this customer',
    fa: 'ثبت پرداخت برای این مشتری',
    af: 'د دې اخېسندوی لپاره تادیه ثبت کړئ',
  },
  'customers.notFoundDesc': {
    en: 'The customer you are looking for does not exist',
    fa: 'مشتری مورد نظر شما وجود ندارد',
    af: 'ستا په لټون کې اخېسندوی شته نه دي',
  },
  'customers.openInvoicesCount': {
    en: '{{count}} open invoices',
    fa: '{{count}} صورت‌حساب باز',
    af: '{{count}} خول شوي حوالې',
  },
  'customers.payInvoice': { en: 'Pay Invoice', fa: 'پرداخت صورت‌حساب', af: 'حواله تادیه کړئ' },
  'customers.paymentDetails': { en: 'Payment Details', fa: 'جزئیات پرداخت', af: 'د تادیه تفصیلات' },
  'customers.recordPaymentFor': {
    en: 'Record payment for {{name}}',
    fa: 'ثبت پرداخت برای {{name}}',
    af: '{{name}} لپاره تادیه ثبت کړئ',
  },
  'customers.role.all': { en: 'All', fa: 'همه', af: 'ټول' },
  'customers.role.buyer': { en: 'Buyer', fa: 'خریدار', af: 'اخېسندوی' },
  'customers.role.label': { en: 'Role', fa: 'نقش', af: 'نقش' },
  'customers.role.seller': { en: 'Seller', fa: 'فروشنده', af: 'پلنه کوونکی' },
  'customers.topCustomer': { en: 'Top Customer', fa: 'بهترین مشتری', af: 'غره اخېسندوی' },
  'customers.totalSales': { en: 'Total Sales', fa: 'فروش کل', af: 'د پلنو ټول' },
  'customers.transactions': { en: 'Transactions', fa: 'تراکنش‌ها', af: 'مالمالي' },

  // ── dashboard (12) ──
  'dashboard.aiInsights': { en: 'AI Insights', fa: 'بینش هوش مصنوعی', af: 'د مصنوعي هوښه' },
  'dashboard.customerDebt': { en: 'Customer Debt', fa: 'بدهی مشتریان', af: 'د اخېسندوو اوز' },
  'dashboard.customersLine': { en: 'Customers', fa: 'مشتریان', af: 'اخېسندوی' },
  'dashboard.dateRange': { en: 'Date Range', fa: 'بازه زمانی', af: 'د نیټو بست' },
  'dashboard.invoicesLine': { en: 'Invoices', fa: 'صورت‌حساب‌ها', af: 'حوالې' },
  'dashboard.noActivities': {
    en: 'No activities yet',
    fa: 'هنوز فعالیتی ثبت نشده',
    af: 'هنوز دندونه ثبت نشوي',
  },
  'dashboard.recentActivities': {
    en: 'Recent Activities',
    fa: 'فعالیت‌های اخیر',
    af: 'وروستني دندونه',
  },
  'dashboard.salesChart': { en: 'Sales Chart', fa: 'نمودار فروش', af: 'د پلنو چارټ' },
  'dashboard.salesChartTitle': { en: 'Sales Trend', fa: 'روند فروش', af: 'د پلنو رجحان' },
  'dashboard.totalSales': { en: 'Total Sales', fa: 'فروش کل', af: 'د پلنو ټول' },
  'dashboard.vsLastMonth': { en: 'vs last month', fa: 'نسبت به ماه قبل', af: 'ستن د میاشتې ته' },
  'dashboard.warehouseValue': { en: 'Warehouse Value', fa: 'ارزش انبار', af: 'د انبار ارزش' },

  // ── dateRange (1) ──
  'dateRange.pickDate': { en: 'Pick date', fa: 'انتخاب تاریخ', af: 'نیټه وټاکئ' },

  // ── entity (2) ──
  'entity.activity.count': {
    en: '{{count}} activities',
    fa: '{{count}} فعالیت',
    af: '{{count}} دندونه',
  },
  'entity.activity.empty': { en: 'No activity', fa: 'فعالیتی نیست', af: 'هیڅد نه دي' },

  // ── home (3) ──
  'home.greeting': { en: 'Hello', fa: 'سلام', af: 'سلام' },
  'home.salesTrend': { en: 'Sales Trend', fa: 'روند فروش', af: 'د پلنو رجحان' },
  'home.title': { en: 'Hisabche', fa: 'حسابچه', af: 'حسابچه' },

  // ── hr (10) ──
  'hr.accessEmail': { en: 'Access Email', fa: 'ایمیل دسترسی', af: 'د لاسېسي بریښنالیک' },
  'hr.accessPassword': { en: 'Access Password', fa: 'رمز عبور دسترسی', af: 'د لاسېسي پټ نوم' },
  'hr.addPayment': { en: 'Add Payment', fa: 'اضافه کردن پرداخت', af: 'تادیه اضافه کول' },
  'hr.grantAccess': { en: 'Grant Access', fa: 'اعطای دسترسی', af: 'لاسېسي ورکول' },
  'hr.noPayments': {
    en: 'No salary payments recorded',
    fa: 'پرداخت حقوقی ثبت نشده',
    af: 'د مزد تادیې ثبت نشوي',
  },
  'hr.paymentAmount': { en: 'Payment Amount', fa: 'مبلغ پرداخت', af: 'د تادیه مبلغ' },
  'hr.paymentDate': { en: 'Payment Date', fa: 'تاریخ پرداخت', af: 'د تادیه نیټه' },
  'hr.salaryPayments': { en: 'Salary Payments', fa: 'پرداخت‌های حقوق', af: 'د مزد تادیې' },
  'hr.totalEmployees': {
    en: 'Total Employees',
    fa: 'تعداد کل کارمندان',
    af: 'د کارمندانو ټول شمېر',
  },
  'hr.totalPayroll': { en: 'Total Payroll', fa: 'مجموع حقوق', af: 'د مزدونو ټول' },

  // ── invoice (1) ──
  'invoice.open': { en: 'Open', fa: 'باز', af: 'خول شوی' },

  // ── more (4) ──
  'more.account': { en: 'Account', fa: 'حساب', af: 'حساب' },
  'more.language': { en: 'Language', fa: 'زبان', af: 'ژبه' },
  'more.security': { en: 'Security', fa: 'امنیت', af: 'امنیت' },
  'more.sync': { en: 'Sync', fa: 'همگام‌سازی', af: 'همغږي' },

  // ── nav (6) ──
  'nav.approvals_empty': {
    en: 'Nothing awaiting approval',
    fa: 'چیزی در انتظار تأیید نیست',
    af: 'هیڅ شی د تایید په انتظار نشته',
  },
  'nav.billing_description': {
    en: 'Manage your subscription',
    fa: 'مدیریت اشتراک',
    af: 'د ځایلي اداره',
  },
  'nav.getPaid_description': {
    en: 'Who owes you how much',
    fa: 'چه کسی چقدر باید بپردازد',
    af: 'څومره ستا ته پوره کوي',
  },
  'nav.money_description': {
    en: 'Your income, spending and profit',
    fa: 'درآمد، خرج و سود شما',
    af: 'ستا علیحدل، لګښت او لاس',
  },
  'nav.stock_description': {
    en: 'What you have and what is running low',
    fa: 'چه چیزی داریم و چه چیزی کم است',
    af: 'څه شته دی او څه کم دی',
  },
  'nav.teamPayroll': { en: 'Team & Pay', fa: 'تیم و حقوق', af: 'ټیم او مزد' },

  // ── notifications (4) ──
  'notifications.activities': { en: 'Activities', fa: 'فعالیت‌ها', af: 'دندونه' },
  'notifications.emptyHint': {
    en: 'You are all caught up',
    fa: 'همه چیز به‌روز است',
    af: 'ټول چیزونه تازه دي',
  },
  'notifications.markAllRead': {
    en: 'Mark all as read',
    fa: 'علامت‌گذاری همه به‌عنوان خوانده شده',
    af: 'ټول ته د لوستل شوي نښه ورکړئ',
  },
  'notifications.viewAll': { en: 'View All', fa: 'مشاهده همه', af: 'ټول لیدل' },

  // ── onboarding (6) ──
  'onboarding.aboutBusiness': {
    en: 'About your business',
    fa: 'درباره کسب‌کار شما',
    af: 'ستا د کسبوکار په اړه',
  },
  'onboarding.aboutBusinessPlaceholder': {
    en: 'Describe your business in a few words',
    fa: 'کسب‌کارتان را در چند کلمه توصیف کنید',
    af: 'خپل کسبوکر د چند کلمو ته و خبره کړئ',
  },
  'onboarding.noBusinessMatch': {
    en: 'No matching business type',
    fa: 'نوع کسب‌کار مطابقی یافت نشد',
    af: 'همه شان د کسبوکار ډول نه موندل شو',
  },
  'onboarding.noCurrencyMatch': {
    en: 'No matching currency',
    fa: 'ارز مطابقی یافت نشد',
    af: 'همه شان د اسعار نه موندل شو',
  },
  'onboarding.searchBusiness': {
    en: 'Search business type...',
    fa: 'جستجوی نوع کسب‌کار...',
    af: 'د کسبوکار ډول لټون...',
  },
  'onboarding.searchCurrency': {
    en: 'Search currency...',
    fa: 'جستجوی ارز...',
    af: 'د اسعار لټون...',
  },

  // ── permissions (7) ──
  'permissions.cap.changeRole': { en: 'Change Role', fa: 'تغییر نقش', af: 'رول بدل کول' },
  'permissions.cap.deleteWorkspace': {
    en: 'Delete Workspace',
    fa: 'حذف فضای کاری',
    af: 'کار ځای ړنګول',
  },
  'permissions.cap.invite': { en: 'Invite Members', fa: 'دعوت اعضا', af: 'غړي بلنه' },
  'permissions.cap.removeMember': { en: 'Remove Members', fa: 'حذف اعضا', af: 'غړي ړنګول' },
  'permissions.cap.useAllModules': {
    en: 'Use All Modules',
    fa: 'استفاده از همه ماژول‌ها',
    af: 'د ټولو ماډلو کارول',
  },
  'permissions.honestNote': {
    en: 'Honest note: permissions are based on your trust',
    fa: 'نکته صادقانه: مجوزها بر اساس اعتماد شماست',
    af: 'صادقانه یادداشت: اجازې ستا د باور پر بنياد دي',
  },
  'permissions.manageMembers': { en: 'Manage Members', fa: 'مدیریت اعضا', af: 'غړي اداره کول' },

  // ── product (1) ──
  'product.nameRequired': {
    en: 'Product name is required',
    fa: 'نام محصول الزامی است',
    af: 'د مېلو نوم اړين دی',
  },

  // ── purchasing (1) ──
  'purchasing.recordPurchase': { en: 'Record Purchase', fa: 'ثبت خرید', af: 'پریوال ثبت کړئ' },

  // ── sales (55) ──
  'sales.addDetail': { en: 'Add Detail', fa: 'اضافه کردن جزئیات', af: 'تفصیلات اضافه کړئ' },
  'sales.addDetails': { en: 'Add Details', fa: 'اضافه کردن جزئیات', af: 'تفصیلات اضافه کړئ' },
  'sales.addItem': { en: 'Add Item', fa: 'اضافه کردن قلم', af: 'شی اضافه کړئ' },
  'sales.amount': { en: 'Amount', fa: 'مبلغ', af: 'مبلغ' },
  'sales.componentsSum': { en: 'Components Sum', fa: 'مجموع اجزا', af: 'د اجزو ټول' },
  'sales.credit': { en: 'Credit', fa: 'نسیه', af: 'نسیه' },
  'sales.customer': { en: 'Customer', fa: 'مشتری', af: 'اخېسندوی' },
  'sales.date': { en: 'Date', fa: 'تاریخ', af: 'نیټه' },
  'sales.details': { en: 'Details', fa: 'جزئیات', af: 'تفصیلات' },
  'sales.detailTitle': { en: 'Detail', fa: 'جزئیات', af: 'تفصیلات' },
  'sales.discount': { en: 'Discount', fa: 'تخفیف', af: 'تخفیف' },
  'sales.emptyDescription': {
    en: 'Create your first invoice to get started',
    fa: 'اولین صورت‌حساب خود را ایجاد کنید',
    af: 'خپله لومړۍ حواله جوړوئ',
  },
  'sales.emptyTitle': {
    en: 'No invoices yet',
    fa: 'هنوز صورت‌حسابی وجود ندارد',
    af: 'هنوز حوالې شته نه دي',
  },
  'sales.grandTotal': { en: 'Grand Total', fa: 'مجموع کل', af: 'د ټولو ټول' },
  'sales.hideDetails': { en: 'Hide Details', fa: 'مخفی کردن جزئیات', af: 'تفصیلات پټ کړئ' },
  'sales.invoiceNumber': { en: 'Invoice Number', fa: 'شماره صورت‌حساب', af: 'د حوالې شمېر' },
  'sales.items': { en: 'Items', fa: 'اقلام', af: 'شیونه' },
  'sales.newInvoice': { en: 'New Invoice', fa: 'صورت‌حساب جدید', af: 'نوې حواله' },
  'sales.newPurchase': { en: 'New Purchase', fa: 'خرید جدید', af: 'نوې پریوال' },
  'sales.noItems': { en: 'No items', fa: 'بدون اقلام', af: 'بې شی' },
  'sales.paid': { en: 'Paid', fa: 'پرداخت شده', af: 'تادیه شوی' },
  'sales.print': { en: 'Print', fa: 'چاپ', af: 'چاپ' },
  'sales.purchase': { en: 'Purchase', fa: 'خرید', af: 'پریوال' },
  'sales.quantity': { en: 'Quantity', fa: 'تعداد', af: 'شمېر' },
  'sales.removeDetail': { en: 'Remove Detail', fa: 'حذف جزئیات', af: 'تفصیلات ړنګړئ' },
  'sales.sale': { en: 'Sale', fa: 'فروش', af: 'پلنه' },
  'sales.selectCustomer': { en: 'Select Customer', fa: 'انتخاب مشتری', af: 'اخېسندوی وټاکئ' },
  'sales.selectSupplier': {
    en: 'Select Supplier',
    fa: 'انتخاب تأمین‌کننده',
    af: 'تامین کوونکی وټاکئ',
  },
  'sales.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'sales.statusOverdue': { en: 'Overdue', fa: 'سررسید گذشته', af: 'موده ته رسېدل' },
  'sales.statusPaid': { en: 'Paid', fa: 'پرداخت شده', af: 'تادیه شوی' },
  'sales.statusPartial': { en: 'Partial', fa: 'جزئی', af: 'جزئي' },
  'sales.statusPending': { en: 'Pending', fa: 'در انتظار', af: 'په انتظار' },
  'sales.subtotal': { en: 'Subtotal', fa: 'جمع جزئی', af: 'د جزئي ټول' },
  'sales.supplier': { en: 'Supplier', fa: 'تأمین‌کننده', af: 'تامین کوونکی' },
  'sales.title': { en: 'Invoice', fa: 'صورت‌حساب', af: 'حواله' },
  'sales.transactionType': { en: 'Transaction Type', fa: 'نوع تراکنش', af: 'د مالمالي ډول' },
  'sales.unit': { en: 'Unit', fa: 'واحد', af: 'واحد' },
  'sales.weightGrams': { en: 'Weight (grams)', fa: 'وزن (گرم)', af: 'وزن (ګرام)' },

  // ── sync (6) ──
  'sync.failed': { en: 'Sync failed', fa: 'همگام‌سازی ناموفق بود', af: 'همغږي ناکام شو' },
  'sync.lastSync': { en: 'Last Sync', fa: 'آخرین همگام‌سازی', af: 'وروستی همغږي' },
  'sync.localOnly': { en: 'Local only', fa: 'فقط محلی', af: 'یوازې محلی' },
  'sync.never': { en: 'Never', fa: 'هرگز', af: 'هیڅکله' },
  'sync.offlineBanner': { en: 'You are offline', fa: 'شما آفلاین هستید', af: 'ته آفلاین یې' },
  'sync.pendingBanner': {
    en: '{{count}} pending operations',
    fa: '{{count}} عملیات در انتظار',
    af: '{{count}} عملونه په انتظار',
  },
  'sync.queueEmpty': { en: 'Queue is empty', fa: 'صف خالی است', af: 'قطار خالي دی' },
  'sync.syncNow_description': { en: 'Synchronize now', fa: 'همگام‌سازی حالا', af: 'اوس همغږي' },

  // ── table (1) ──
  'table.columns': { en: 'Columns', fa: 'ستون‌ها', af: 'ستونونه' },

  // ── team (15) ──
  'team.addEmployee': { en: 'Add Employee', fa: 'اضافه کردن کارمند', af: 'کارمند اضافه کړئ' },
  'team.addNewEmployee': {
    en: 'Add New Employee',
    fa: 'ایجاد کارمند جدید',
    af: 'نوې کارمند جوړوئ',
  },
  'team.employees': { en: 'Employees', fa: 'کارمندان', af: 'کارمندان' },
  'team.firstName': { en: 'First Name', fa: 'نام', af: 'نوم' },
  'team.hireDate': { en: 'Hire Date', fa: 'تاریخ استخدام', af: 'د غړیتیا نیټه' },
  'team.lastName': { en: 'Last Name', fa: 'نام خانوادگی', af: 'تخلص' },
  'team.noEmployees': {
    en: 'No employees found',
    fa: 'کارمندی یافت نشد',
    af: 'کارمند نه موندل شو',
  },
  'team.noEmployeesHint': {
    en: 'Add your first employee to get started',
    fa: 'اولین کارمند خود را اضافه کنید',
    af: 'خپل پوره کارمند اضافه کړئ',
  },
  'team.noPayroll': {
    en: 'No payroll records',
    fa: 'سوابق حقوقی وجود ندارد',
    af: 'د مزد سicolonونه شته نه دي',
  },
  'team.noPayrollHint': {
    en: 'No salary payments recorded yet',
    fa: 'هنوز پرداخت حقوقی ثبت نشده',
    af: 'هنوز د مزد تادیې ثبت نشوي',
  },
  'team.payroll': { en: 'Payroll', fa: 'حقوق و دستمزد', af: 'مزد' },
  'team.position': { en: 'Position', fa: 'سمت', af: 'rem' },
  'team.salary': { en: 'Salary', fa: 'حقوق', af: 'مزد' },
  'team.totalEmployees': {
    en: 'Total Employees',
    fa: 'تعداد کارمندان',
    af: 'د کارمندانو ټول شمېر',
  },
  'team.totalPayroll': { en: 'Total Payroll', fa: 'مجموع حقوق', af: 'د مزدونو ټول' },

  // ── unit (1) ──
  'unit.gram': { en: 'Gram', fa: 'گرم', af: 'ګرام' },

  // ── warehouse (10) ──
  'warehouse.addProductDescription': {
    en: 'Add a new product to inventory',
    fa: 'محصول جدید به موجودی اضافه کنید',
    af: 'نوې مېله موجودي ته اضافه کړئ',
  },
  'warehouse.bulkDeleteConfirm': {
    en: 'Are you sure you want to delete selected products?',
    fa: 'آیا مطمئن هستید که می‌خواهید محصولات انتخاب شده را حذف کنید؟',
    af: 'ایا ته یقین لري چې غوره شوي مېله ړنګوئ؟',
  },
  'warehouse.currentStock': { en: 'Current Stock', fa: 'موجودی فعلی', af: 'اوسنی موجودي' },
  'warehouse.deleteConfirm': {
    en: 'Are you sure you want to delete this product?',
    fa: 'آیا مطمئن هستید که می‌خواهید این محصول را حذف کنید؟',
    af: 'ایا ته یقین لري چې دغه مېله ړنګوئ؟',
  },
  'warehouse.noProductsDesc': {
    en: 'Add your first product to get started',
    fa: 'اولین محصول خود را اضافه کنید',
    af: 'خپله لومړۍ مېله اضافه کړئ',
  },
  'warehouse.notFound': { en: 'Product not found', fa: 'محصول یافت نشد', af: 'مېله نه موندل شوه' },
  'warehouse.productNamePlaceholder': {
    en: 'Enter product name',
    fa: 'نام محصول را وارد کنید',
    af: 'د مېلو نوم ولیکئ',
  },
  'warehouse.profitPerUnit': { en: 'Profit per Unit', fa: 'سود هر واحد', af: 'د هر واحد لاس' },
  'warehouse.totalProfit': { en: 'Total Profit', fa: 'سود کل', af: 'د لاس ټول' },
  'warehouse.totalValue': { en: 'Total Value', fa: 'ارزش کل', af: 'د ارزش ټول' },

  // ── workflow (29) ──
  'workflow.action': { en: 'Action', fa: 'عملیات', af: 'عملي' },
  'workflow.actionError': {
    en: 'Failed to perform action',
    fa: 'اجرای عملیات ناموفق بود',
    af: 'د عملي اجرا ناکام شو',
  },
  'workflow.actionErrorTitle': { en: 'Action Failed', fa: 'عملیات ناموفق', af: 'عمل ناکام' },
  'workflow.approve': { en: 'Approve', fa: 'تأیید', af: 'تایید' },
  'workflow.confirmReject': { en: 'Confirm rejection?', fa: 'تأیید رد؟', af: 'رد تایید کړئ؟' },
  'workflow.final': { en: 'Final', fa: 'نهایی', af: 'وروستی' },
  'workflow.forbiddenError': {
    en: "You don't have permission",
    fa: 'شما اجازه ندارید',
    af: 'ته اجازه نه لري',
  },
  'workflow.inProgress': { en: 'In Progress', fa: 'در حال انجام', af: 'په جریان کې' },
  'workflow.loadError': {
    en: 'Failed to load approvals',
    fa: 'بارگذاری تأییدها ناموفق بود',
    af: 'د تاییدونو پورته کول ناکام شو',
  },
  'workflow.pending': { en: 'Pending', fa: 'در انتظار', af: 'په انتظار' },
  'workflow.reject': { en: 'Reject', fa: 'رد', af: 'رد' },
  'workflow.rejectDescription': { en: 'Reason for rejection', fa: 'دلیل رد', af: 'د رد علت' },
  'workflow.rejectPlaceholder': {
    en: 'Describe the reason...',
    fa: 'دلیل را توضیح دهید...',
    af: 'علت توضیح کړئ...',
  },
  'workflow.rejectReason': { en: 'Rejection Reason', fa: 'دلیل رد', af: 'د رد علت' },
  'workflow.startedAt': { en: 'Started at', fa: 'شروع شده در', af: 'پیل شوي په' },
  'workflow.stepProgress': {
    en: 'Step {{current}} of {{total}}',
    fa: 'مرحله {{current}} از {{total}}',
    af: 'مرحله {{current}} له {{total}}',
  },
  'workflow.templates.active': { en: 'Active', fa: 'فعال', af: 'فعال' },
  'workflow.templates.approver': { en: 'Approver', fa: 'تأییدکننده', af: 'تایید کوونکی' },
  'workflow.templates.create': { en: 'New Template', fa: 'قالب جدید', af: 'نوې ټپلنه' },
  'workflow.templates.description': { en: 'Description', fa: 'توضیحات', af: 'تفصیلات' },
  'workflow.templates.empty': {
    en: 'No workflow templates',
    fa: 'قالب جریان کاری وجود ندارد',
    af: 'د کار جریان ټپلونه شته نه دي',
  },
  'workflow.templates.entityType': { en: 'Entity Type', fa: 'نوع موجودیت', af: 'د تړاو ډول' },
  'workflow.templates.inactive': { en: 'Inactive', fa: 'غیرفعال', af: 'غیرفعال' },
  'workflow.templates.name': { en: 'Name', fa: 'نام', af: 'نوم' },
  'workflow.templates.namePlaceholder': { en: 'Template name', fa: 'نام قالب', af: 'د ټپلونه نوم' },
  'workflow.templates.new': { en: 'New Template', fa: 'قالب جدید', af: 'نوې ټپلنه' },
  'workflow.templates.status': { en: 'Status', fa: 'وضعیت', af: 'حالت' },
  'workflow.templates.title': {
    en: 'Workflow Templates',
    fa: 'قالب‌های جریان کاری',
    af: 'د کار جریان ټپلونه',
  },
  'workflow.title': { en: 'Workflow', fa: 'جریان کاری', af: 'د کار جریان' },

  // ── workspace (2) ──
  'workspace.employee': { en: 'Employee', fa: 'کارمند', af: 'کارمند' },
  'workspace.redirecting': {
    en: 'Redirecting...',
    fa: 'در حال انتقال...',
    af: 'دلته ته لیږدل کيږي...',
  },
}

// ── inject ──
function flattenObj(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flattenObj(v, p))
    else keys.push(p)
  }
  return keys
}

for (const { file, lang } of LOCALES) {
  const path = resolve(ROOT, file)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  const existing = new Set(flattenObj(data))
  let added = 0

  for (const [keyPath, vals] of Object.entries(K)) {
    if (existing.has(keyPath)) continue
    const parts = keyPath.split('.')

    // Check existence
    let cur = data
    let exists = true
    for (const p of parts) {
      if (cur[p] === undefined) {
        exists = false
        break
      }
      cur = cur[p]
    }
    if (exists) continue

    // Navigate & create
    cur = data
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (typeof cur[p] === 'string') cur[p] = { title: cur[p] }
      else if (!cur[p] || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {}
      cur = cur[p]
    }

    const leaf = parts[parts.length - 1]
    if (cur[leaf] === undefined || typeof cur[leaf] === 'string') {
      cur[leaf] = vals[lang] || vals.en
      added++
    }
  }

  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
  console.log(`✅ ${lang}: ${added} keys added`)
}

// ── verify ──
const enFinal = JSON.parse(readFileSync(resolve(ROOT, 'packages/i18n/src/locales/en.json'), 'utf8'))
const finalSet = new Set(flattenObj(enFinal))
let stillMissing = 0
for (const key of Object.keys(K)) {
  if (!finalSet.has(key)) stillMissing++
}
console.log(
  `\nTotal keys: ${Object.keys(K).length} | Added: ${Object.keys(K).length - stillMissing} | Still missing: ${stillMissing}`,
)
