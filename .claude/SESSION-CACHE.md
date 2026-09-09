# کش سشن — درس‌ها، تله‌ها، و وضعیت واقعی

> نوشته شد تا سشن بعدی این‌ها را دوباره کشف نکند. هر ادعای اینجا با کد یا با
> اجرای واقعی تأیید شده. چیزی که تأیید نشده صریحاً «تأییدنشده» علامت خورده.
>
> **اول این را بخوان، بعد `grep` بزن، بعد کد بنویس.**

---

## ۰. سه قانونی که بیشترین وقت را گرفتند

### ۰.۱ — `as X[]` یک check نیست

بزرگ‌ترین دستهٔ باگ این سشن. **۲۷ مورد** در `packages/api/src/hooks/`:

```ts
queryFn: async (): Promise<BOM[]> => { … return data }   // annotation
return data as StockBatch[]                               // assertion
return (data as RateQuote[]) ?? []                        // ?? فقط null/undefined
```

هر سه به TypeScript می‌گویند آرایه است. هیچ‌کدام **نمی‌پرسند**. اولین `.map` می‌ترکد:

```
TypeError: (boms ?? []).map is not a function
TypeError: (quotes ?? []) is not iterable
```

و React Router کل صفحه را با error boundary عوض می‌کند.

**رفع:** [`asList`](../packages/api/src/lib/as-list.ts). گارد:
`packages/api/src/__tests__/list-hooks-coerce.test.ts`

⚠️ **درس عمیق‌تر:** یکی از این‌ها را من با رفعِ یک باگ دیگر **آشکار** کردم. تا وقتی
`/currency/rates` مسیرش غلط بود و ۴۰۴ می‌داد، query همیشه خطا می‌داد، `data` می‌شد
`undefined`، و `?? []` پوشش می‌داد. درست‌کردن مسیر برای اولین بار یک پاسخ واقعی را رد
کرد — و همان‌جا فرض غلط تبدیل به کرش شد. **رفع یک باگ می‌تواند باگ بعدی را بیدار کند.**

### ۰.۲ — عددی که از `.limit(N)` می‌آید، عددِ غلطِ بی‌صدا است

`getBalance` مانده‌حساب را از `.limit(10000)` جمع می‌زد. مشتری با تراکنش بیشتر،
مانده‌ای از یک پیشوند دلخواه می‌گرفت. نه خطا، نه علامت.

هرجا پول یا مانده حساب می‌شود: **page تا ته**، با `.order()` (بدون ترتیب، صفحه‌بندی
می‌تواند سطر را دوبار یا هیچ‌بار ببیند).

⚠️ ایجنت‌ها **۲۰+ مورد باقی‌ماندهٔ همین الگو** را در backend پیدا کردند (insights,
forecast, budget, currency, pos, banking, timesheets, traceability, reorder…).
هنوز رفع نشده‌اند. بخش ۶ را ببین.

### ۰.۳ — `count: 'estimated'` نباید تصمیم بگیرد

آمارِ planner است، روی جدول تازه یا ANALYZE-نشده معمولاً `0` برمی‌گرداند.
`customer.delete` با آن تصمیم می‌گرفت → مشتریِ دارای تراکنش قابل حذف بود.

**سؤال «آیا هست؟» با `select('id').limit(1).maybeSingle()` پرسیده می‌شود، نه با count.**

باقی‌مانده: `entitlement.service.ts` (سه سهمیه) و `billing.service.ts:287` هنوز با
estimate تصمیم می‌گیرند.

---

## ۱. تله‌های ابزار و محیط (وقتِ زیادی گرفتند)

| تله                                  | نشانه                                                   | راه درست                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| heredoc در Bash                      | `unexpected EOF while looking for matching '`           | فایل python در scratchpad بنویس و اجرا کن، یا Write tool                                                                    |
| `\r` در رشته‌ی python                | YAML/کد بی‌دلیل خراب                                    | همیشه `chr(92)` یا raw string؛ `\r` تبدیل به carriage return واقعی می‌شود                                                   |
| CRLF                                 | تست‌های مبتنی بر متن بی‌دلیل قرمز                       | `io.open(..., newline='')` در هر خواندن **و** نوشتن                                                                         |
| cwd می‌پرد                           | `cd: packages/ui: No such file or directory`            | همیشه `cd /c/Users/hamed/Desktop/hisabche && …`                                                                             |
| `cp` برای backup موقع injection-test | فایل با نسخه‌ی **قبل از رفع** بازگردانده شد و رفع گم شد | بعد از هر restore، وجود رفع را دوباره چک کن                                                                                 |
| Jest ≠ Vitest                        | `Expect takes at most one argument`                     | دسکتاپ/موبایل Jest‌اند: `expect` پیام دوم نمی‌گیرد → `it.each`                                                              |
| Tailwind v3 JIT                      | کلاس تولید نمی‌شود، بی‌صدا                              | مقدار arbitrary با **کاما** استخراج نمی‌شود: `grid-cols-[15rem_minmax(0,1fr)]` هیچ CSS نمی‌سازد. `var(--x,0px)` هم همین‌طور |
| `exactOptionalPropertyTypes`         | `undefined is not assignable`                           | `prop?: T` با `prop?: T \| undefined` فرق دارد. برای spread: `{...(x ? {v:x} : {})}`                                        |

---

## ۲. تله‌های Next / React / Electron

### `DYNAMIC_SERVER_USAGE` — دوبار اتفاق افتاد

`generateStaticParams` + `getMessages()` روی صفحه‌ی `[lang]` = ۵۰۰ در production،
در حالی که **build موفق و dev درست است**.
گارد: `packages/ui/src/__tests__/next-dynamic-server-usage.test.ts`

### Radix `Slot` دقیقاً یک فرزند می‌خواهد

```jsx
<Portal>
  {cond && <div />}
  <Content />
</Portal> // cond=false ⇒ دو فرزند ⇒ throw
```

`Primitive.div failed to slot onto its children` — هر منوی کشویی برنامه را می‌گرفت.
گارد: `packages/ui/src/components/ui/__tests__/dropdown-menu-portal.test.tsx`

### چرخهٔ barrel = TDZ

`auth-container.tsx` از `@hisabche/ui` (پکیج خودش) import می‌کرد →
`Cannot access 'Q' before initialization`. **تا وقتی لیست export در `index.ts`
عوض نشود پایدار است** — یعنی باگی که ماه‌ها قبل ساخته شده، با یک ویرایش بی‌ربط
ظاهر می‌شود.
گارد: `packages/ui/src/__tests__/no-self-barrel-import.test.ts`

### Provider ها باید بین وب و دسکتاپ یکی باشند

`ToastProvider` در دسکتاپ mount نشده بود → `useToast must be used within
ToastProvider` → صفحهٔ تنظیمات و هر کامپوننت مشترکِ toast-زن کرش می‌کرد.
`React error #300` («hooks کمتر از انتظار») **پیامد** همان throw بود، نه باگ جدا.

### Radix tooltip `side` فیزیکی است

`start`/`end` وجود ندارد. `side="right"` + `avoidCollisions` خودش در RTL flip می‌کند.

### دیدن خطای renderer در Electron

```bash
timeout 25 npx electron . --enable-logging 2>&1 | grep -iE "CONSOLE|error"
```

نویز عادی (نادیده بگیر): `GPU process exited`, `Network service crashed`,
`cache_util`, `disk_cache`, `exit_code=143`, `Security Warning`.

---

## ۳. بیلد ویندوز — همهٔ تله‌ها

```bash
taskkill //IM hisabche.exe //F                       # وگرنه EBUSY
cd apps/desktop && rm -rf dist && npx electron-vite build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --publish never
```

⚠️ `CSC_IDENTITY_AUTO_DISCOVERY=false` **الزامی** — وگرنه signtool با `spawn UNKNOWN`.

| علامت                                | علت واقعی                                                                |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `ENOENT …-x64.nsis.7z`               | Defender وسط کار `elevate.exe` را برمی‌داشت                              |
| `spawn UNKNOWN` از signtool/makensis | همان، یک مرحله جلوتر                                                     |
| `EBUSY rmdir win-unpacked`           | برنامه باز است                                                           |
| `Cannot compute electron version`    | دانلود قطع‌شده لینک را شکسته → `pnpm install --filter @hisabche/desktop` |

**رفع دائمی:** `nsis.packElevateHelper: false` — نصب‌کننده per-user است و به
elevation نیاز ندارد، پس آن فایل اصلاً ساخته نمی‌شود.

⚠️ **درسِ مهم‌تر:** اول فکر کردم Defender دارد `makensis.exe` را قرنطینه می‌کند و
نزدیک بود دستور exclusion بدهم. بررسی کردم: فایل هست، Zone.Identifier ندارد، از
bash اجرا می‌شود، **Node هم آن را spawn می‌کند**. یعنی آنتی‌ویروس را برای هیچ ضعیف
می‌کردیم. **قبل از پیشنهاد تغییر تنظیمات امنیتی، فرضیه را تست کن.**

⚠️ `differentialPackage: false` در config است → `.blockmap` ساخته نمی‌شود → هر
به‌روزرسانی کل ۷۸ مگابایت است، نه delta. برداشتنش یک بار جلوی بیلد را گرفته بود.

---

## ۴. اندروید — مسدود است

- `ANDROID_HOME` تعریف نشده، SDK در مسیر پیش‌فرض نیست، `local.properties` ندارد
- **JDK 25** نصب است؛ React Native 0.74 / Expo 51 با **JDK 17** ساخته می‌شود

پوشهٔ `android/` از prebuild هست ولی هیچ APK/AAB تولید نشده. کدی نیست، محیطی است.

---

## ۵. معماری — چیزهایی که باید بدانی قبل از تغییر

| موضوع                   | حقیقت                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| مرز امنیتی              | فقط `workspace_id`. `user_id` می‌گوید چه کسی، و **هرگز** فیلتر نیست                                                                   |
| نقش                     | از `request.tenancy.role`، نه `request.userRole`                                                                                      |
| پول                     | minor units (عدد صحیح) — ولی ledger هنوز float major units است (بخش ۶)                                                                |
| تراکنش                  | supabase-js ندارد. نوشتن چندجدولی = Postgres function با `.rpc()`                                                                     |
| **DELETE جبرانی ممنوع** | یک write دوم است که خودش می‌تواند شکست بخورد                                                                                          |
| مسیر hookها             | base خودش `/api` دارد؛ prefix ماژول را فراموش نکن (`/finance/…`). گارد: `packages/api/src/__tests__/hook-routes-exist.test.ts`        |
| ناوبری                  | `packages/ui-contract/src/navigation.ts` منبع یکتاست؛ آیکون در `packages/ui/src/lib/menu/nav-items.ts`                                |
| دسکتاپ                  | `DESKTOP_ROUTES` در `apps/desktop/src/components/layout/sidebar.tsx` — allowlist دستی بود با ۱۰ مسیر در حالی که روتر ۵۴ تا سرو می‌کند |
| i18n                    | سه locale **فعال**: `fa`, `af`, `en`. هر کلید در هر سه                                                                                |

### الگوی «قانون هست، صدا زده نمی‌شود»

`scope.service.ts` چهار منبع را guard اعلام می‌کرد؛ `payment` هیچ‌جا صدا زده نمی‌شد،
و همان یکی lgو پرداخت را که سند دفتری را برمی‌گرداند بی‌محافظ گذاشته بود.
**اعلام ≠ اعمال.** گارد: `authorization-scope-applied.test.ts`

---

## ۶. ⚠️ بدهی شناخته‌شده — پیدا شده، رفع نشده

از گزارش دو ایجنت بازرس. هر کدام با file:line تأیید شده.

### پول (بحرانی)

- **PRODUCT** — `PATCH /api/products/:id {quantity}` مستقیم `products.quantity` را
  می‌نویسد و `stock_movements` را دور می‌زند. موجودی عوض می‌شود، هیچ سند و هیچ اثر
  دفتری ندارد، و trigger بعدی بی‌صدا برش می‌گرداند
- **INVOICE `delete()`** — سند پست‌شده را پاک می‌کند بدون برگرداندن stock، بدون
  آزادکردن cost layer، بدون معکوس‌کردن سند دفتری. دفتر درآمدی را نگه می‌دارد که
  فاکتورش وجود ندارد
- **INVOICE `update()`** — state machine ندارد: `cancelled → completed` می‌شود،
  `total` بعد از post شدن قابل ویرایش است بدون اصلاح سند
- **PAYMENT** — سند در DB commit می‌شود، بعد journal entry جدا نوشته می‌شود؛
  دورهٔ قفل‌شده = پرداخت هست، سند نیست
- **cancelPayment** — اگر reversal شکست بخورد فقط `console.error` و لغو موفق می‌ماند
- **ACCOUNTING** — همهٔ مبالغ float در major units به RPC می‌روند، در حالی که
  مقایسه‌ها minor unit صحیح‌اند

### صامت

- ~۲۰ مورد `.limit(N)` روی جمعِ پول (بخش ۰.۲)
- `count: 'estimated'` در سهمیه‌ها و billing
- pagination: cursor یک `id` است ولی با ستون **مرتب‌سازی** مقایسه می‌شود
  (`product.service.ts`, `invoice.service.ts`) — صفحهٔ دوم هرگز درست نیست
- سه تعریف مختلف از «کم‌موجودی» (`<` در stats، `<=` در list، `> 0` در invoice)
- `getCashFlow` جدول `transactions` را می‌خواند که پول دیگر از آن عبور نمی‌کند
- `customers.opening_balance` فقط برای `type='credit'` شمرده می‌شود؛ بقیه هرگز.
  گزارش فقط-خواندنی: `docs/module-customer-opening-balance-report.sql`

### DELETE جبرانی باقی‌مانده

`assets.service.ts:162`, `manufacturing.service.ts:229`, `purchasing.service.ts:108`,
`transfer.service.ts:127`, `cycle-count.service.ts:99`

### body بدون validation

`POST/PATCH /api/customers`, `/api/products`, `/api/invoices`, `/api/transactions`,
`PATCH /api/v1/activities/mark-read` — همه `request.body as T`

---

## ۷. Migration های اجرانشده

| فایل                                            | بدون آن چه می‌شود                                         |
| ----------------------------------------------- | --------------------------------------------------------- |
| `docs/phase-t13-ai-provider-migration.sql`      | صفحهٔ ادمین AI ذخیره نمی‌کند و دکمهٔ چت هرگز ظاهر نمی‌شود |
| `docs/module-auth-session-epoch-migration.sql`  | تغییر رمز، نشست‌های فعال را نمی‌بندد                      |
| `docs/module-desktop-update-feed-migration.sql` | feed خالی است، برنامه می‌گوید «به‌روزرسانی‌ای نیست»       |
| `docs/phase-t2-units-rls-migration.sql`         | RLS روی `units`                                           |
| `docs/phase-t4-manufacturing-fk-migration.sql`  | ⚠️ اول بخش ۱ = گزارش orphan                               |
| `docs/patch-01-currencies-migration.sql`        | جدول `currencies` + ۱۶۲ ارز                               |
| `docs/patch-02-custom-units-migration.sql`      | ⚠️ **پیشنهاد — منتظر تصمیم مالک**                         |
| `docs/patch-03-leaves-gaps-migration.sql`       | سه ستون روی `leaves`                                      |

همه additive و idempotent؛ کد در نبودشان graceful degrade می‌کند، پس ترتیب مهم نیست.

---

## ۸. AI — کجاست

|                        |                                                       |
| ---------------------- | ----------------------------------------------------- |
| تنظیم provider         | اپ **ادمین** (`apps/admin`, پورت ۳۰۴۰) → `/{lang}/ai` |
| چت کاربر — صفحه        | `/{lang}/assistant`                                   |
| چت کاربر — دکمهٔ شناور | داشبورد؛ **تا provider تنظیم نشده رندر نمی‌شود**      |

⚠️ دکمه عمداً پنهان است؛ **صفحه** عمداً پنهان نیست و حالت «تنظیم نشده» را توضیح
می‌دهد — کسی که عمداً به یک URL رفته، صفحهٔ سفید یعنی محصول خراب است.

`backend/src/services/ai/reporting-reader.ts` — مجموعهٔ بستهٔ view ها.
**هیچ view یا function در schema `reporting` نباید پارامتر `workspace_id` بگیرد**؛
workspace باید از `auth_workspace_ids()` بیاید، چون پارامتر همان چیزی است که
prompt injection هدف می‌گیرد.

---

## ۹. روش کار که جواب داد

1. **اول `grep`.** حدود یک‌سوم کارهای «لازم» از قبل وجود داشت — سیستم دعوت کارمند،
   بخش پرداخت فاکتور، `minRoleFor`، `scopes.assertMay`. همه نوشته شده و بدون مصرف‌کننده
2. **تزریق باگ، تنها اثبات گارد است.** هر گارد این سشن با برگرداندن عمدی باگ اصلی
   تست شد. چند بار گارد اصلاً نمی‌گرفت
3. **متن واقعی خطا را بخواه.** حدس‌های من دربارهٔ کرش دسکتاپ سه بار غلط بود؛
   `--enable-logging` در یک قدم به علت رساند
4. **تستی که با رفع می‌شکند، تستِ درستی است.** `tenancy-idor.test.ts` با
   `{ total: 33, items: [] }` فاکتور می‌ساخت — یعنی خودش همان باگ را نشان می‌داد
5. **بیلد را به ایجنت جدا بده.** ۸ تا ۲۵ دقیقه طول می‌کشد و context را می‌خورد
