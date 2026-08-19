# پرامپت سشن بعدی — Hisabche

این فایل را کامل کپی کن و در سشن جدید بفرست.

---

## HISABCHE — ادامه‌ی کار، بخش‌های ۱۸، ۱۹، ۱۷، ۱۳، ۱

من روی مونوریپو Hisabche کار می‌کنم. کارهای قبلی انجام و verify شده‌اند —
**دوباره انجامشان نده**. مستقیم برو سراغ کد. مستندسازی جدید نساز.

### وضعیت تأییدشده

- **۸۵۳ تست پاس**، `pnpm type-check` روی ۱۶/۱۶ workspace پاس، بیلد web/desktop/admin/backend سالم.
- `packages/ui` تنها منبع UI است. web، desktop و admin هر سه از آن مصرف می‌کنند
  (هیچ‌کدام کپی ندارند — fork ادمین حذف شد).
- Desktop از `@hisabche/ui/screens` استفاده می‌کند و مسیرهایش با web یکسان است.
  یک shim برای `next-intl` و `next/navigation` در `apps/desktop/src/shims/` دارد.
- رشته‌های i18n در `packages/i18n/messages/{fa,af,en}/common.json` — یک کاتالوگ
  مشترک برای همه‌ی پلتفرم‌ها. تستِ برابری locale در `packages/i18n` هر کلید
  گمشده را fail می‌کند.
- `DataTable` مشترک در `packages/ui/src/components/ui/data-table/` — انتخاب ردیف،
  `useRowSelection`، `useBulkAction` و `BulkActionBar` دارد. **هر جدول جدید باید
  از همین استفاده کند.**
- `useIntlLocale()` در `packages/ui/src/hooks/use-intl-locale.ts` — برای اعداد و
  تاریخ‌های وابسته به زبان. locale هاردکد (`'fa-AF'`) ننویس.
- خروجی CSV: `exportToCSV` در `packages/ui/src/lib/export.ts`. برای صورتحساب
  مشتری: `packages/ui/src/lib/customers/customer-export.ts`.

### کارهای مانده

**بخش ۱۸ — جدول activities**
صفحه‌ی `/activities` باید داده‌ها و سابقه‌ی تغییرات را در همان `DataTable`
مشترک نشان دهد (نه کارت‌های فعلی). ستون «چه کسی تغییر داد» با نقشش اضافه شود:
مالک / مدیر / کارمند / بیننده. فعلاً `ActivityGroupCard` استفاده می‌شود.

**بخش ۱۹ — همگام‌سازی + سایز کش**
صفحه‌ی `/sync-center` کامل i18n شود و UI‌اش با کامپوننت‌های آماده‌ی
`packages/ui` بازنویسی شود. و در `/settings` قسمت آخر «کش برنامه» یک عدد
جعلی ۲۴ مگ نشان می‌دهد — سایز واقعی را حساب کن یا اگر قابل‌محاسبه نیست
حذفش کن (عدد جعلی بدتر از نبودن است).

**بخش ۱۷ — permissions**
در `/permissions` چهار کارت دسترسی وجود دارد که قابل کلیک نیستند. مالک باید
بتواند برای هر بخش دسترسی‌ها را کم و زیاد کند. hookهای موجود:
`useRoles`, `usePermissions`, `useCreateRole`, `useDeleteRole` از
`@hisabche/api`. اگر endpoint لازم نبود، اضافه‌اش کن — ولی API جعلی نساز.

**بخش ۱۳ — accounting → accounts + PDF اختصاصی**
در تب `accounts` صفحه‌ی `/accounting` یک جدول (همان `DataTable`) بساز که
بتوانم هر خریدار یا فروشنده را انتخاب کنم و **تمام** خرید و فروش‌های انجام‌شده
با او را PDF بگیرم. خروجی کل جدول هم باید ممکن باشد.
`buildCustomerExportRows` از قبل ردیف‌ها را می‌سازد (خرید و فروش را قاطی
نمی‌کند، واحد و وزن و جزئیات تودرتو را نگه می‌دارد) — از همان استفاده کن.
تولید PDF: `backend/src/routes/invoice-pdf.routes.ts` و
`backend/src/queue/pdf-queue.ts` وجود دارند؛ اول ببین قابل استفاده‌اند یا نه.
هر بخشی از این صفحه که به بک‌اند sync نیست را حذف کن.

**بخش ۱ — کش آفلاین محلی (بزرگ‌ترین)**
وقتی کاربر برنامه را روی گوشی یا لپ‌تاپ نصب می‌کند، کنار نصب یک محل داده‌ی
محلی ساخته شود تا اگر دیتابیس ما مشکل داشت، کاربر بتواند **بدون هیچ اختلالی**
سفارش ثبت کند؛ و بعد از رفع مشکل آن داده با دیتابیس آشتی داده شود.
زیرساخت موجود: `packages/offline`، `apps/mobile/src/features/offline/use-outbox.ts`،
و desktop یک لایه SQLite/IPC دارد. اول این‌ها را بخوان — ممکن است بخشی از کار
انجام شده باشد. لازم است: صف نوشتن محلی، آشتی‌دادن، و حل تعارض.
معماری offline-first موجود نباید بشکند.

### قواعد

- تست رگرسیون برای هر باگ واقعی که پیدا می‌کنی اضافه کن. تست‌ها را ضعیف نکن،
  skip نکن، `any` استفاده نکن.
- اگر schema عوض می‌شود، migration در `docs/` بساز — خودم روی Supabase اجرا
  می‌کنم. کد باید قبل از اجرای migration هم graceful fallback داشته باشد
  (الگوی `42703` که در پروژه هست).
- هر رشته‌ی جدید باید در fa، af و en باشد.
- بعد از هر بخش: `pnpm type-check` و `pnpm test`. آخر کار بیلدها.
- بین بخش‌ها از من سؤال نکن، ادامه بده.

### تله‌هایی که قبلاً خوردم — تکرارش نکن

1. **کلاینت Supabase مشترک**: هرگز `signInWithPassword` یا `setSession` روی
   `supabase` ماژول‌سطح صدا نزن. توکن کاربر در حافظه می‌چسبد و کل پروسه از
   `service_role` به آن کاربر تبدیل می‌شود (علت `42501` روی
   `workspace_members` بود). از `createAuthClient()` در `backend/src/db.ts`
   استفاده کن. تست نگهبان: `backend/src/__tests__/shared-client-isolation.test.ts`.
2. **کلیدهای i18n**: خیلی از کامپوننت‌ها `t('key', 'فارسی')` دارند ولی کلید در
   کاتالوگ **نیست** و همیشه fallback فارسی نشان داده می‌شود. قبل از تغییر کد،
   اول چک کن کلید در `common.json` هست یا نه.
3. **zod**: روی schema‌ای که `.refine()` دارد `.omit()` کار نمی‌کند. schema بدنه
   را جدا تعریف کن (`createMemberDirectBodySchema` را ببین).
4. **ویرایش دسته‌ای i18n**: با اسکریپت Node انجام بده. `sed` و heredoc با متن
   فارسی نامطمئن است و بی‌صدا fail می‌کند.
5. **خطاهای route**: بلعیدن پیام با `{ error: 'Failed' }` باعث شد چند باگ
   ساعت‌ها پنهان بمانند. الگوی `if (e instanceof BaseError && e.isOperational)`
   را استفاده کن.
6. **کش `.next`**: بعد از حذف route، `apps/web/.next/types` را پاک کن وگرنه
   type-check با خطای فایل ناموجود fail می‌شود.

### migration‌های اجرانشده

اینها ساخته شده‌اند و من هنوز روی Supabase اجرا نکرده‌ام:

- `docs/task-customer-outcomes-migration.sql`
- `docs/workspace-member-fields-migration.sql`
- `docs/onboarding-server-state-migration.sql`

`docs/workspace-members-rls-migration.sql` را **اجرا نکن** — علت `42501` در کد
بود نه دیتابیس، و دیتابیس سالم است.

از بخش ۱۸ شروع کن.
