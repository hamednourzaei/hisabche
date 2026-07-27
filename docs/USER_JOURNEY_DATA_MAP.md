# نقشه‌ی سفر کاربر در حسابچه — همه‌چیز از دید یک کاربر واقعی

> این فایل مسیر واقعی یک کاربر را از ورود تا هر تب، به‌ترتیب، نشان می‌دهد: هر صفحه چه داده‌ای نشان می‌دهد، آن داده از کدام Hook و کدام Route بک‌اند و کدام جدول واقعی می‌آید، و مهم‌تر از همه — **کدام‌ها واقعی و زنده‌اند، کدام‌ها ساختگی (fake) هستند، و کدام‌ها اصلاً وجود ندارند و باید ساخته شوند.**
>
> علامت‌ها:
> - ✅ **واقعی** — داده از دیتابیس واقعی می‌آید، endpoint واقعی دارد.
> - ⚠️ **ناقص/نیم‌بند** — endpoint واقعی هست ولی چیزی کم دارد (مثلاً realtime ندارد، یا enforcement ندارد).
> - ❌ **ساختگی (fake)** — در UI هست ولی به هیچ سروری وصل نیست؛ فقط local state/localStorage است.
> - 🚧 **باید ساخته شود** — چیزی که منطقاً باید باشد ولی اصلاً وجود ندارد.

```
Hisabche
│
├── 1) ورود به سایت
│   │
│   ├── صفحه‌ی لندینگ  →  /
│   │   └── ✅ محتوای بازاریابی، بدون داده‌ی کاربر (ISR، ۱ ساعت کش)
│   │
│   ├── ثبت‌نام  →  /signup
│   │   └── فرم submit
│   │       └── ✅ useAuthStore.signup() → fetch به POST /api/auth/signup
│   │           → backend: supabase.auth.admin.createUser + جدول profiles
│   │       └── ⚠️ نکته فنی: این صفحه از هوک آماده‌ی useSignUp (در packages/api)
│   │           استفاده نمی‌کند — مسیر ورود واقعی، fetch مستقیم داخل Zustand store
│   │           است. کار می‌کند، ولی دو مسیر موازی برای همین کار در کد وجود دارد.
│   │
│   └── ورود  →  /login
│       └── فرم submit یا دکمه‌ی "Demo Login"
│           └── ✅ useAuthStore.login() → POST /api/auth/login
│               → backend: supabase.auth.signInWithPassword
│           └── ℹ️ دکمه‌ی Demo Login با ایمیل/پسورد hardcoded (demo@hisabche.com) وارد می‌شود — عمدی است، برای تست/دمو.
│
├── 2) اولین بار (کاربر تازه) → راه‌اندازی  →  /onboarding
│   │   └── ✅ چند قدم (نوع کسب‌وکار، اندازه، ارز پیش‌فرض، زبان)
│   │       ذخیره در useOnboardingStore → فقط localStorage (hisabche-onboarding)
│   │   └── ⚠️ هیچ تماسی با بک‌اند برای ذخیره‌ی این انتخاب‌ها زده نمی‌شود —
│   │       یعنی این تنظیمات فقط روی همین مرورگر می‌مانند، نه روی حساب کاربر
│   │       در سرور (اگر کاربر از موبایل دیگری وارد شود، دوباره باید طی شود).
│   │
│   └── بعد از تکمیل → ریدایرکت خودکار به Today
│
├── 3) Today  →  /dashboard   («امروز چه خبر است»)
│   │
│   ├── سلام صبح‌بخیر (بدون داده)
│   │
│   ├── AI Insight banner
│   │   └── ✅ useAIInsights() → GET /api/ai/insights
│   │       → backend: ai.service.ts (موتور کلیدواژه، نه LLM واقعی) روی
│   │       جدول‌های invoices / products / ledger_entries
│   │
│   ├── کارت وضعیت کسب‌وکار (فروش امروز، تعداد فاکتور، رشد ماهانه)
│   │   └── ✅ useDashboardKPIs() → GET /api/analytics/dashboard
│   │       → جدول‌های invoices, products, customers (تجمیعی)
│   │
│   ├── نمودار فروش هفته
│   │   └── ✅ useDashboardSales() → GET /api/analytics/sales → invoices
│   │
│   ├── آخرین فاکتورها
│   │   └── ✅ useInvoices() (محدود به چند مورد آخر) → GET /api/invoices → invoices
│   │
│   ├── بخش «نیاز به توجه» (پرداخت‌های معوق + موجودی کم)
│   │   └── ✅ همان kpis بالا، فیلترشده
│   │
│   ├── اقدامات سریع (۴ دکمه)
│   │   ├── «فروش» → می‌رود به /quick-invoice
│   │   ├── «پرداخت‌ها» → می‌رود به /invoices?filter=pending
│   │   ├── «موجودی» → می‌رود به /warehouse
│   │   └── «خرید جنس» → می‌رود به /purchasing   (این دکمه را همین جلسه اضافه کردیم)
│   │
│   └── 🔄 Realtime: روی جدول invoices — فاکتور جدید همکار دیگر، بدون رفرش دستی دیده می‌شود.
│
├── 4) Sell  →  /quick-invoice   («یک فروش تازه ثبت کنید»)
│   │
│   ├── قدم ۱: انتخاب محصول
│   │   └── ✅ ProductPicker → useProducts() → GET /api/products → products
│   │
│   ├── قدم ۲: انتخاب مشتری (اختیاری)
│   │   └── ✅ CustomerPicker → useCustomers() → GET /api/customers → customers
│   │
│   ├── قدم ۳: قیمت، تعداد، نقد/نسیه
│   │   └── (فقط محاسبه‌ی محلی، بدون تماس با سرور تا لحظه‌ی ثبت)
│   │
│   └── قدم ۴: ثبت
│       └── ✅ useCreateInvoice() → POST /api/invoices
│           → backend: invoice.service.ts → درج در invoices + invoice_items
│           → 🔔 اگر مشتری نسیه بخرد، خودش در accounting هم اثر می‌گذارد
│           (یک ledger_entry ساخته می‌شود؟ — این ارتباط خودکار در کد سرویس
│           فاکتور دیده نشد؛ یعنی «صورت‌حساب» و «دفتر حساب‌ها» دو تا سیستم
│           جدا هستند که با هم sync نمی‌شوند مگر کاربر دستی وارد accounting
│           کند و سند بسازد.)
│
├── 5) Get Paid  →  /invoices ،  /invoices/[id]   («چه کسی چقدر باید بپردازد»)
│   │
│   ├── لیست فاکتورها (با جست‌وجو و صفحه‌بندی)
│   │   └── ✅ useInvoices() → GET /api/invoices → invoices
│   │
│   ├── کلیک روی یک فاکتور → جزئیات
│   │   └── ✅ useInvoice(id) → GET /api/invoices/:id → invoices + invoice_items
│   │   └── ✅ دانلود PDF → GET /api/invoices/:id/pdf
│   │       → backend: صف BullMQ (pdf-generation) → رندر با @react-pdf/renderer
│   │       → آپلود در Supabase Storage (باکت خصوصی pdf-cache) → لینک امضاشده
│   │
│   └── 🔄 Realtime: روی جدول invoices
│
├── 6) Stock  →  /warehouse ،  /warehouse/[id]   («چه چیزی داریم و چه چیزی کم است»)
│   │
│   ├── لیست محصولات + موجودی
│   │   └── ✅ useProducts() → GET /api/products → products
│   │
│   ├── جزئیات یک محصول
│   │   └── ✅ useProduct(id) → GET /api/products/:id → products
│   │
│   └── 🔄 Realtime: روی جدول products
│
├── 7) Buy  →  /purchasing   («سفارش جنس از فروشنده»)
│   │
│   ├── لیست سفارش‌های خرید (تأمین‌کننده، تاریخ، وضعیت)
│   │   └── ✅ usePurchaseOrders() → GET /api/purchase-orders
│   │       → purchase_orders + purchase_order_items
│   │
│   ├── دکمه‌ی «دریافت کالا»
│   │   └── ✅ useReceiveGoods() → POST /api/purchase-orders/:id/receive
│   │       → به‌روزرسانی purchase_orders + احتمالاً warehouse_stock
│   │
│   └── ⚠️ برخلاف بقیه‌ی صفحات تجاری (accounting/crm/manufacturing)، این صفحه
│       useRealtime ندارد — یعنی اگر همکار دیگری سفارش خرید ثبت کند، باید
│       صفحه دستی رفرش شود.
│
├── 8) Money  →  /accounting   («درآمد، خرج و سود شما»)
│   │
│   ├── تب حساب‌ها
│   │   └── ✅ useAccounts() → GET /api/accounting/accounts → accounts
│   │
│   ├── تب دفتر روزنامه (اسناد حسابداری)
│   │   └── ✅ useJournalEntries() → GET /api/accounting/journal
│   │       → journal_entries + journal_lines
│   │
│   ├── تب تراز آزمایشی
│   │   └── ✅ useTrialBalance() → GET /api/accounting/trial-balance
│   │       → محاسبه از journal_lines
│   │
│   ├── تب ترازنامه
│   │   └── ✅ useBalanceSheet() → GET /api/accounting/balance-sheet
│   │       → accounts + journal_lines
│   │
│   └── تب سود و زیان
│       └── ✅ useIncomeStatement() → GET /api/accounting/income-statement
│           → accounts + journal_lines
│       └── 🔄 Realtime: روی accounts, journal_entries, journal_lines
│
├── 9) «بیشتر» (پنل کنار — کارهای کم‌تکرار)
│   │
│   ├── ── مردم ──
│   │   │
│   │   ├── Buyers  →  /customers   («مشتری‌ها و باقی‌داری‌شان»)
│   │   │   └── ✅ useCustomers() → GET /api/customers → customers
│   │   │   └── ✅ افزودن مشتری → POST /api/customers
│   │   │   └── 🔄 Realtime روی customers
│   │   │
│   │   ├── Follow Up  →  /crm   («گفت‌وگوها و فروش‌های احتمالی»)
│   │   │   ├── تب تعاملات → ✅ useInteractions() → GET /api/interactions → interactions
│   │   │   └── تب فرصت‌های فروش → ✅ useOpportunities() → GET /api/opportunities → opportunities
│   │   │   └── 🔄 Realtime روی هر دو جدول
│   │   │
│   │   ├── Team  →  /human-resources ،  /human-resources/[id]   («کارمندان، حضور، حقوق»)
│   │   │   └── ✅ useEmployees() → GET /api/employees → employees
│   │   │   └── ✅ جزئیات کارمند + تاریخچه‌ی استخدام/مرخصی/حقوق (نمایشی، از فیلدهای
│   │   │       همان رکورد ساخته می‌شود، نه از یک "activity log" جدا)
│   │   │   └── داده‌های پشت‌صحنه: departments, attendance, payrolls, leaves
│   │   │       (endpoint دارند ولی هنوز در UI به‌طور کامل به این صفحه وصل نشدند
│   │   │       — یعنی route های /api/attendance، /api/payrolls، /api/leaves
│   │   │       در بک‌اند آماده‌اند ولی تب مجزا برایشان در این صفحه دیده نشد)
│   │   │   └── ❌ Realtime ندارد
│   │   │
│   │   └── Coworkers  →  /workspace   («کسانی که با شما کار می‌کنند»)
│   │       └── ✅ useWorkspaces() / useWorkspaceMembers() → GET /api/workspaces
│   │           → workspaces + workspace_members
│   │       └── ✅ دعوت عضو جدید → POST /api/workspaces/:id/invites → workspace_invites
│   │       └── 🔄 Realtime روی workspace_members
│   │
│   ├── ── کارها ──
│   │   │
│   │   ├── Projects  →  /projects ،  /projects/[id]
│   │   │   └── ✅ useProjects() → GET /api/projects → projects
│   │   │   └── ✅ تسک‌ها → useProjectTasks() → project_tasks
│   │   │   └── 🔄 Realtime روی projects, project_tasks
│   │   │
│   │   └── Production  →  /manufacturing   («دستور ساخت و مواد لازم»)
│   │       ├── تب فرمول‌های ساخت → ✅ useBOMs() → GET /api/boms → boms + bom_items
│   │       └── تب دستورهای تولید → ✅ useWorkOrders() → GET /api/work-orders → work_orders
│   │       └── ✅ دکمه‌ی «تکمیل» → POST /api/work-orders/:id/complete
│   │       └── 🔄 Realtime روی boms, work_orders
│   │
│   └── ── تنظیمات و امنیت ──
│       │
│       ├── Access  →  /permissions   («چه کسی به چه چیزی دسترسی دارد»)
│       │   └── ✅ useRoles() / usePermissions() → GET /api/roles ، GET /api/permissions
│       │       → roles, permissions, role_permissions, user_roles
│       │   └── ⚠️ **نکته‌ی مهم**: این صفحه فقط برای *مدیریت* نقش‌ها و دسترسی‌هاست.
│       │       خودِ بک‌اند، هنگام پردازش یک درخواست واقعی (مثلاً حذف یک فاکتور)،
│       │       این جدول‌ها را چک نمی‌کند — فقط عضویت در workspace را می‌بیند،
│       │       نه نقش دقیق کاربر. یعنی این صفحه یک UI مدیریتی درست است ولی
│       │       پشت صحنه enforcement واقعی رویش سوار نشده.
│       │
│       ├── History  →  /audit   («چه کسی چه چیزی را تغییر داد»)
│       │   └── ✅ useAuditLogs() → GET /api/audit/logs → audit_logs
│       │   └── ✅ خروجی Excel/CSV → GET /api/audit/export
│       │   └── ❌ Realtime ندارد (صفحه‌ای که کمتر لازم است لحظه‌ای باشد)
│       │
│       ├── Events  →  /activities   («آخرین اتفاق‌های کسب‌وکار»)
│       │   └── ✅ useInfiniteActivities() → GET /api/v1/activities (صفحه‌بندی بی‌نهایت)
│       │       → جدول activities
│       │   └── ✅ علامت‌گذاری خوانده‌شده → PATCH /api/v1/activities/mark-read
│       │   └── 🔄 Realtime — فقط رویداد INSERT (فعالیت تازه فوری اضافه می‌شود،
│       │       بدون رفچ کامل لیست)
│       │
│       ├── Sync  →  /sync-center   («وضعیت اتصال و پشتیبان‌گیری»)
│       │   └── ❌ **کاملاً ساختگی.** هیچ API واقعی صدا زده نمی‌شود:
│       │       • دکمه‌ی «همگام‌سازی الان» → فقط `setLastSynced(Date.now())`
│       │         (یک عدد ساعت محلی، بدون تماس شبکه)
│       │       • دکمه‌ی «پشتیبان‌گیری دستی» → یک حجم فایل با
│       │         `Math.floor(Math.random() * 500 + 100)` **ساخته می‌شود**
│       │         (حجم واقعی نیست، تصادفی است) و در localStorage ذخیره می‌شود
│       │       • عدد «فضای مصرفی» یک رشته‌ی hardcoded «۲۴ مگابایت» است
│       │       • هیچ صف/تعارض/آپلود سروری پشت این صفحه نیست
│       │   └── 🚧 **باید ساخته شود**: یک endpoint واقعی بک‌اند برای
│       │       backup/sync (یا حداقل حذف این صفحه از UI تا زمانی که واقعی شود،
│       │       چون الان به کاربر قول امنیتی می‌دهد که وجود ندارد)
│       │
│       └── Settings  →  /settings
│           ├── بخش حساب کاربری → ✅ از useAuthStore (اطلاعات لاگین‌شده)
│           ├── بخش پشتیبان‌گیری → ❌ همان backup ساختگی بالا (useBackupStore، فقط localStorage)
│           ├── بخش عملکرد/کارایی → ✅ واقعی، فقط تنظیم محلی دستگاه (useDeviceStore)
│           ├── بخش «پلن و اشتراک» (همین جلسه اضافه شد) → لینک به Billing
│           │   └── /billing → ✅ useSubscription() / usePlans() / useUsage()
│           │       → GET /api/billing/subscription، /api/billing/plans، /api/billing/usage
│           │       → subscriptions, billing_events
│           │   └── ✅ دکمه‌ی ارتقا → POST /api/billing/upgrade
│           │       (پرداخت واقعی از طریق checkout.service.ts)
│           └── دکمه‌ی خروج → ✅ useAuthStore.logout() → POST /api/auth/logout
```

---

## جمع‌بندی برای تصمیم‌گیری سریع

| وضعیت | تعداد صفحه | لیست |
|---|---|---|
| ✅ کاملاً واقعی و زنده | ۱۴ | Today, Sell, Get Paid, Stock, Money, Buyers, Follow Up, Coworkers, Projects, Production, Access (فقط UI مدیریتی)، History, Events, Billing |
| ⚠️ واقعی ولی ناقص | ۳ | Buy (بدون Realtime)، Team (attendance/payroll/leave در UI کامل وصل نشده)، Access (enforcement واقعی ندارد) |
| ❌ کاملاً ساختگی | ۱ | **Sync Center** — همه‌چیزش local/fake است |
| 🚧 باید از صفر ساخته شود | ۱ | Backend واقعی برای Sync (اگر قرار است این قابلیت واقعی شود) |

**اگر بخواهی بعدی رو انتخاب کنی**: منطقی‌ترین گزینه یا (الف) ساختن واقعیِ Sync Center، یا (ب) اضافه کردن Realtime به Purchasing، یا (ج) وصل کردن enforcement واقعی permissions به route های حساس است.
