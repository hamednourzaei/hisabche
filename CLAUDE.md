# حسابچه — راهنمای سشن

> این فایل هر سشن **خودکار** بارگذاری می‌شود. عمداً کوتاه است: نقشه است، نه دانشنامه.
> جواب هر سؤالی در فایلی است که این‌جا به آن اشاره شده — قبل از گشتن کدبیس، آن را باز کن.

نرم‌افزار حسابداری و ERP فارسی/دری. monorepo با pnpm + Turbo.

---

## ۰. محدودیت اجرایی — قبل از هر کاری

**هیچ DDL/Migration مستقیم روی دیتابیس زنده‌ی Supabase اجرا نمی‌شود.**
تو فقط دو چیز می‌سازی: (۱) فایل Migration در `docs/` — additive، idempotent، با بلوک
Rollback/Mitigation؛ (۲) Verification Query جدا. **انسان** آن‌ها را در SQL Editor اجرا می‌کند.

تا وقتی نتیجه‌ی واقعی از طرف انسان گزارش نشده، هرگز ننویس «Post-migration Audit: PASS».
بنویس: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

---

## ۱. پنج قانونی که همه‌چیز بر آن‌هاست

1. **`workspace_id` تنها مرز امنیتی است.** `user_id` می‌گوید چه کسی کاری کرد و **هرگز** فیلتر نیست. سرویس‌ها `TenancyContext` می‌گیرند، نه `userId`.
2. **نقش را از `request.tenancy.role` بخوان، نه `request.userRole`.** دومی برای کاربرِ چند-workspace خالی است. نقشی که به مرورگر رسیده، مقداری است که مرورگر می‌تواند عوضش کند — فقط برای نمایش.
3. **پول همیشه در واحد کوچک (integer).** هیچ float ای در مسیر مالی. مبلغ را سرور از خطوط درمی‌آورد، نه کلاینت.
4. **supabase-js تراکنش ندارد** → نوشتن چند-جدولی باید Postgres function باشد و با `.rpc()` صدا زده شود. `DELETE` جبرانی **ممنوع**.
5. **تست سبز اثبات نیست.** اثبات یعنی HTTP واقعی یا دیتابیس واقعی.

---

## ۲. Guardrail ها

- **G1 — بدون UI Theater:** بدون mockup، بدون API جعلی، بدون داده‌ی ساختگی. یا داده‌ی واقعی، یا empty state صریح.
- **G2 — بدون معماری موازی:** موجود را پیدا کن و گسترش بده. هرگز مدل/کامپوننت/استور دومی کنار اولی نساز.
- **G3 — بدون Migration مخرب:** additive، idempotent، قابل اجرای مجدد.
- **G4 — بدون Policy تعریف‌نشده:** هر تنظیمی مقدار پیش‌فرض صریح دارد.
- **§12 — بدون Backfill جعلی:** داده‌ی ناقص قدیمی `Unknown` می‌ماند. حدس‌زدن نقش یا مقدار، ادعای دروغ درباره‌ی یک آدم واقعی است.
- **§13 — بدون تعمیر بی‌صدا:** اول گزارش بده، بعد اصلاح.
- **§14 — بدون کد مرده:** خواسته را اشتباه فهمیدی؟ کد را **دور بینداز**، کنارش نگه ندار.

---

## ۳. ساختار

```
backend/          Fastify + supabase-js + zod + vitest
packages/
  api             هوک‌های React Query  ← asList() این‌جاست
  ui              همه‌ی کامپوننت‌ها (وب + دسکتاپ مشترک)
  ui-contract     قرارداد وضعیت/فهرست/نما/صف کار + DateRange
  validation      اسکیماهای zod + قواعد دامنه
  formatting      پول، تاریخ، ارقام، CSV  ← تنها جای فرمت
  store           zustand  ← setOnUnauthorized این‌جا وصل است
  i18n            messages/{fa,af,en}/common.json
  auth-core       مدل Session و نقش‌ها
apps/
  web             Next.js 16 App Router، پیشوند [lang]
  desktop         Electron + react-router (hash)، shim برای next-*
  mobile          Expo / React Native، Jest  ← نمی‌تواند از packages/ui استفاده کند
  admin           پنل پلتفرم
docs/             فایل‌های SQL + گزارش‌ها. Migration ها این‌جا ساخته می‌شوند.
```

`fa`، `af`، `en` هر سه **فعال**‌اند. هر کلید جدید باید در **هر سه** باشد —
`t()` روی کلید ناموجود **throw** می‌کند و کل صفحه را به error boundary می‌برد.

---

## ۴. دانش پروژه — کجا را باز کنی

| سؤال                                                             | فایل                                                |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| **وبلاگ: نقشه، تله‌ها، تصمیم‌ها (۲۶ سپتامبر)**                   | `.claude/SESSION-CACHE-2026-09-26-BLOG.md`          |
| **Sync باینری، بارکد/چاپ، پرفورمنس DB، Cloudflare (۲۷ سپتامبر)** | `.claude/SESSION-CACHE-2026-09-27.md`               |
| **درس‌ها و باگ‌های سشن اخیر (۱۹ سپتامبر)**                       | `.claude/SESSION-CACHE-2026-09-19.md` — **اول این** |
| درس‌ها و باگ‌های ۱۵–۱۷ سپتامبر                                   | `.claude/SESSION-CACHE-2026-09-17.md`               |
| درس‌ها و باگ‌های اوایل سپتامبر                                   | `.claude/SESSION-CACHE-2026-09.md`                  |
| **فهرست باگ‌ها با ریشه و گارد**                                  | `.claude/BUG-REGISTRY.md`                           |
| **پرفورمنس، PageSpeed، لندینگ موبایل (۱۵ سپتامبر)**              | `.claude/SESSION-CACHE-2026-09-15-PERF.md`          |
| **درخواست‌های باز کاربر — قبل از هر کار**                        | `.claude/USER-REQUESTS.md`                          |
| بودجه/صندوق/حاکمیت/۵۰۰ها (۱۴ سپتامبر)                            | `.claude/SESSION-CACHE-2026-09-14.md`               |
| نقشه‌ی کل دانش                                                   | `.claude/README.md`                                 |
| باگ خوردم / چطور وریفای کنم                                      | `.claude/DEBUG-PLAYBOOK.md`                         |
| تله‌های قدیمی‌تر                                                 | `.claude/SESSION-CACHE.md`                          |
| چرا این‌طوری نوشته شده                                           | `.claude/lessons-learned.md`                        |
| الان چه کار می‌کند و چه نه                                       | `.claude/STATE.md`                                  |
| کد جدید کجا برود                                                 | `.claude/architecture/core-modules.md`              |
| کدام hook به کدام endpoint                                       | `.claude/architecture/api-surface.md`               |
| جدول‌ها و RLS                                                    | `.claude/architecture/data-model.md`                |
| Source of Truth / کدام migration اجرا شده                        | `.claude/SESSION-2026-09-05-CONSOLIDATION.md`       |
| migration/تست/commit چطور                                        | `.claude/WORKFLOW.md`                               |
| مقایسه با ERPNext و Odoo                                         | `.claude/research/`                                 |
| خواسته‌های محصول                                                 | `.claude/detail.md`                                 |

---

## ۵. توانایی‌های آماده

**Skills** (`.claude/skills/`) — `hisabche-` + یکی از:
`architecture` · `auth` · `backend` · `code-review` · `database` · `debugging` ·
`desktop` · `i18n` · `lessons` · `mobile` · `offline` · `testing` · `ui` · `web`

**Commands**: `/verify` · `/review` · `/db-migration` · `/i18n-check` · `/security-audit`

**Agents**: `security-reviewer` · `domain-reviewer` · `parity-reviewer`

کارهای طولانی بیلد/وریفای را به ایجنت جدا بده و خودت موازی ادامه بده.

---

## ۶. وریفای

```bash
cd backend        && npx tsc --noEmit && npx vitest run
cd packages/ui    && npx tsc --noEmit && npx vitest run
cd packages/api   && npx tsc --noEmit
cd apps/web       && npx tsc --noEmit
cd apps/desktop   && npx tsc --noEmit && npx jest
cd apps/admin     && npx tsc --noEmit
```

---

## ۷. پنج الگویی که بارها تکرار شده‌اند

قبل از دیباگ هر چیزی، اول این‌ها را روی کد مشکوک امتحان کن.

1. **«قانون وجود دارد و هیچ‌کس صدایش نمی‌زند.»** انتزاع ساخته شده، درست هم هست، هیچ caller ندارد. وقتی انتزاعی پیدا کردی، اول `grep` کن ببین استفاده می‌شود.
2. **«type annotation یک چک زمان‌اجرا نیست.»** `(x ?? []).map is not a function` دو صفحه را انداخت. هر چیزی که لیست رندر می‌شود از `asList<T>()` در `packages/api/src/lib/as-list.ts` رد شود.
3. **«خطا و خالی‌بودن یک شاخه شده‌اند.»** `if (error || rows.length === 0) return empty` یعنی کوئریِ شکسته به‌صورت «تو داده نداری» با کد ۲۰۰ برمی‌گردد و کش هم می‌شود. همیشه دو شاخه‌ی جدا. خطا هرگز کش نشود.
4. **«عدد بی‌صدا غلط.»** `.limit(N)` روی خواندن مالی، و `count: 'estimated'`، عدد را از یک صفحه یا از تخمین planner می‌سازند. برای عددی که کسی رویش تصمیم می‌گیرد: `count: 'exact', head: true`.
5. **«نبودِ یک نشانه، نشانه نیست.»** پیام را جایی بگذار که تصمیم گرفته می‌شود، نه به‌صورت غیابِ یک آیکون.
6. **«خالی‌بودن با اجازه‌ی اجرا نداشتن یکسان رندر می‌شود.»** کوئریِ `enabled: false`، فیلدی که در پاسخ وجود ندارد، و جدولِ واقعاً خالی روی صفحه یکسان‌اند. وقتی کاربر می‌گوید «کار نمی‌کند» ولی کنسول ساکت است، اول این را بگرد (سشن ۱۹ سپتامبر، BUG-017).

---

## ۸. تله‌های فنی

**تایپ و React**

- `exactOptionalPropertyTypes: true` در کل monorepo. `prop?: string` مقدار `undefined` صریح را **رد** می‌کند؛ بنویس `prop?: string | undefined`.
- React 19: خواندن `document`/`window` هنگام render یعنی hydration mismatch و دور ریختن کل درخت. فقط داخل effect.
- هوک بعد از early return = conditional hook. `conditional-hook-call.test.ts` برای همین هست.
- `ReferenceError: Cannot access 'X' before initialization` = TDZ، و تقریباً همیشه **چرخه‌ی ماژول** (اغلب import از barrel خودِ پکیج). `no-self-barrel-import.test.ts` را ببین.

**استایل**

- ⚠️ Tailwind arbitrary value: تله **فاصله**‌ی escape‌نشده داخل `[...]` است، نه کاما. برای فاصله از `_` استفاده کن.
  **کاما مشکلی ندارد** — با خروجی کامپایل‌شده‌ی همین ریپو تأیید شد: `grid-cols-[minmax(0,1fr)_…]` واقعاً به `grid-template-columns: minmax(0,1fr) …` تبدیل می‌شود و ۶۰ کامای escape‌شده (`\2c`) در CSS دسکتاپ هست.
  نسخه‌ی قبلی این فایل خلافش را می‌گفت و غلط بود؛ بر اساس آن ~۴۰ فراخوان سالم بازنویسی می‌شد.
- Radix `asChild`/`Slot` دقیقاً یک فرزند می‌گیرد؛ یک sibling شرطی همه‌ی dropdown ها را می‌شکند.
- RTL: `ms-`/`me-`، `ps-`/`pe-`، `text-start`/`text-end`، `border-e`. هرگز `left`/`right`.
- ⚠️ **`start-*` منطقی است، `translate-x-*` فیزیکی.** `start-1/2` در فارسی یعنی `right: 50%` ولی `-translate-x-1/2` همیشه به چپ می‌برد؛ ترکیبشان در RTL عنصر را نصفِ عرض خودش کنار می‌اندازد (نشانگر منوی پایین روی تبِ همسایه می‌افتاد). برای وسط‌چین‌کردن، یک ردیف تمام‌عرض با `inset-x-0 flex justify-center` بگذار — بدون transform، پس چیزی برای اختلاف نمی‌ماند. گارد: `bottom-nav-indicator.test.ts`.
- ⚠️ **`router.prefetch` مسیرِ واقعی را می‌خواهد، با پیشوند locale.** prefetch روی `/invoices` در برنامه‌ای که همیشه به `/fa/invoices` می‌رود، هیچ چیزی warm نمی‌کند و بی‌صدا بی‌اثر است. آیکون جهت‌دار را از `getComputedStyle(node).direction` **انتخاب** کن، با `scale-x-[-1]` آینه نکن.
- فقط توکن: `hsl(var(--color-primary))`. هیچ hex و هیچ رنگ پالت Tailwind.

**سریالایز و داده**

- fast-json-stringify فقط چیزی را می‌فرستد که schema نام برده باشد، و `null` را روی `{type:'string'}` به `""` **جایگزین** می‌کند (خطا نمی‌دهد). فیلد nullable باید `['string','null']` باشد.
- embed در PostgREST (`table!left(...)`) فقط روی **foreign key واقعی** resolve می‌شود؛ وگرنه `PGRST200` و کل کوئری شکست. ⚠️ درباره‌ی FK **تعمیم نده**: `invoices→customers` ندارد، ولی `boms`/`bom_items`/`pos_*` دارند (روی دیتابیس زنده تأیید شد). همان جفت را با `pg_constraint` چک کن.
- `toJsonSchema` باید **بازگشتی** باشد؛ یک `z.object()` تودرتو بدون `properties` یعنی کل آبجکت خالی می‌رود.

**تقویم و زبان**

- تقویم از زبان می‌آید: `fa`→`fa-IR` (شهریور)، `af`→`fa-AF` (سنبله)، `en`→`en` (میلادی).
- در کامپوننت `useDateFormat()`، در ماژول پارامتر `lang` **اجباری**.
- ⚠️ هرگز «زبان جاری» در سطح ماژول — وب روی سرور رندر می‌شود و یک پروسه هم‌زمان به فارسی و انگلیسی جواب می‌دهد.
- برچسب locale تقویم را حمل نمی‌کند. برای میلادی صریحاً `{ calendar: 'gregory' }`.
- `toIsoDay` همیشه میلادی است — مقصدش query string و Postgres است.

**دسکتاپ و بیلد**

- رندرر بسته‌بندی‌شده از `file://` بالا می‌آید؛ مسیر مطلق `/x.png` یعنی **ریشه‌ی درایو**. مسیر را با **پروتکل** انتخاب کن نه با پلتفرم.
- `${env.X}` در `electron-builder.yml` زودهنگام expand می‌شود و بیلد را می‌شکند.
- `nsis.packElevateHelper: false` — Defender وسط بسته‌بندی `elevate.exe` را قرنطینه می‌کند. ⚠️ راه‌حل، اضافه‌کردن exclusion به آنتی‌ویروس **نیست**.

**وب، سئو و API (از باگ‌های واقعی سپتامبر)**

- ⚠️ هر هدر جدیدی که `packages/api` می‌فرستد باید **در همان commit** به `allowedHeaders` در `backend/src/index.ts` اضافه شود. `Idempotency-Key` اضافه شد و CORS نه → ثبت فاکتور در وب کامل قطع شد (BUG-006).
- ⚠️ کش سرور کلید `<keyPrefix>:<workspaceId یا userId>:<url>` دارد. هرگز کلید invalidation را دستی حدس نزن — بعد از هر تغییر پول/فاکتور/پرداخت/موجودی `invalidateMoneyCaches(workspaceId)` (`backend/src/utils/money-cache.ts`). کلید دستی `invoice:<ws>:<id>` هیچ‌وقت چیزی پاک نمی‌کرد و بعد از پرداخت، فاکتور ۲ دقیقه «پرداخت‌نشده» می‌ماند (BUG-008).
- خواندنی که **هشدار یا تصمیم** می‌سازد `limit` نمی‌گیرد: هشدار موجودی از `useProducts({ limit: 100 })` کالای ۱۰۱ام را نمی‌دید (BUG-007).
- root layout هرگز `alternates`/canonical پیش‌فرض نمی‌دهد — به همه‌ی صفحات noindex ارث می‌رسد.
- هر مسیر جدید در `(dashboard)` باید در `app/robots.ts` هم disallow شود (گارد: `robots-dashboard-routes.test.ts`).
- لینک داخلی همیشه با پیشوند locale؛ لینک از صفحه‌ی عمومی به صفحه‌ی خصوصی `rel="nofollow"`.
- عنوان صفحه برند نمی‌گیرد؛ template layout `| حسابچه` اضافه می‌کند.
- هر ادعا در لندینگ/FAQ/متا باید در کد وجود داشته باشد (ورود دو مرحله‌ای، بک‌آپ ۳۰ روزه، وب‌هوک و «۳۰ روز آزمایشی» دروغ بودند). گارد: `landing-claims.test.ts`.
- لندینگ: بخش‌های ایستا server component؛ آیکون تزئینی = کاراکتر CSS نه SVG (بودجه‌ی DOM)؛ `prefetch={false}`؛ بدون `Suspense` دور صفحه.

**آمادگی توکن و مسیر (از باگ‌های ۱۹ سپتامبر)**

- ⚠️ **«ثبت getter» با «session آماده است» یکی نیست.** `registerTokenGetter()` در `packages/api/src/lib/tokenProvider.ts` هنگام import صدا زده می‌شود — یعنی قبل از hydrate شدن zustand-persist. اگر همان‌جا `tokenReady` را resolve کند، اولین درخواست‌های هر بارگذاری **بدون هدر Authorization** می‌روند، 401 می‌گیرند و فقط با refresh+retry نجات پیدا می‌کنند (کنسول پر از 401 روی `/notifications`، `/accounting/accounts`، `/invoices`). آمادگی را فقط store اعلام می‌کند، با `markTokenReady()`، بعد از hydration. هر رندرری که `registerTokenGetter` صدا می‌زند **باید** `markTokenReady` هم صدا بزند وگرنه هر درخواست تا سقف ۲ ثانیه منتظر می‌ماند (گارد: `token-ready-waits-for-hydration.test.ts`).
- ⚠️ **ناوبری در UI مشترک فقط با `useLocalePush` / `useLocaleReplace` / `useRouteLang` + `localizePath`** (`packages/ui/src/hooks/use-locale-push.ts`). وب پیشوند `/fa` می‌خواهد و دسکتاپ/موبایل **هیچ** پیشوندی ندارند؛ `params?.lang ?? 'fa'` روی ویندوز به `/fa/…` می‌رود و catch-all کاربر را بی‌صدا به داشبورد برمی‌گرداند (BUG-067). `router.push('/…')` برهنه در `packages/ui` ممنوع است (گارد: `dashboard-page-structure.test.ts`).
- ⚠️ **ساختار صفحه:** `apps/web/app/[lang]/(dashboard)/**/page.tsx` = metadata + `<XContainer />` از `@hisabche/ui` — **تنها `<main>` صفحه مال `dashboard-layout.tsx` است**؛ صفحه `<main>` دوم نمی‌سازد — بدون `'use client'`، بدون `*-client.tsx` یا `skeleton.tsx` محلی، بدون `onNavigate`. تابع UI را در فایل سرور **صدا نزن** (`warehouseSkeleton()`)؛ به‌صورت element رندر کن — وگرنه ۲۰۰ با خطای سرور (BUG-068). مسیر app-shell که دامنه را در URL ندارد باید آن را صریح بدهد (BUG-066).

- ⚠️ **ثابتِ مشترک را از یک سرویس نگیر.** `billing.service` هسته‌ی رفرال را import می‌کند (کمیسیون در یک نقطه)، و هسته برای قیمت پلن `billing.service` را import می‌کرد → چرخه‌ی ماژول → `referralService` برابر `undefined` و ۵۰۰ روی سایت زنده، **با سوئیت کاملاً سبز** (تست‌ها برگ‌ها را import می‌کنند و حلقه را نمی‌بندند). ثابت‌ها در ماژولی که **هیچ چیزی import نمی‌کند** (`services/plan-pricing.ts`). گارد: `no-service-import-cycles.test.ts`.
- ⚠️ **سیگنال آمادگی بدون منبع داده، بدتر از نبودِ سیگنال است.** zustand-persist با استوریج همگام `onRehydrateStorage` را **حین `create()`** اجرا می‌کند، یعنی قبل از `registerTokenGetter` در خط بعد. `markTokenReady()` حالا سیگنال را نگه می‌دارد تا getter برسد (BUG-019).

**برچسب و وضعیت**

- ⚠️ **یک مقدارِ وضعیت که دو معنی دارد، برچسبش دروغ می‌گوید.** `invoices.status = 'pending'` برای هر فاکتور پرداخت‌نشده نوشته می‌شود و `AWAITING_APPROVAL_STATUS` هم همان است؛ ترجمه‌اش «در انتظار» بود و کاربر آن را «در انتظار تأیید» خواند و دنبال دکمه‌ی تأیید گشت. برچسب باید همان چیزی را بگوید که مقدار واقعاً یعنی.
- ⚠️ **صفحه‌ی خالی باید دلیلش را بگوید** (§۷٫۵ در عمل): `/approvals` خالی بود و می‌نوشت «چیزی در انتظار تأیید شما نیست» — در حالی که تا گردش‌کار فعالی تعریف نشده باشد هرگز چیزی آنجا نمی‌آید. «به‌روز هستی» و «این صفحه هیچ‌وقت پر نمی‌شود» دو پیام متفاوت‌اند.
- ⚠️ **نتیجه‌ی ثبت‌شده toggle نیست.** دکمه‌ای که یک واقعه را ثبت می‌کند (تماس گرفتم / نگرفتم) بعد از ثبت باید برود، و سندِ بسته‌شده اصلاً ستون ثبت نداشته باشد.

**خطای رد شده از سرور**

- ⚠️ **`response.data.error` نامِ وضعیت HTTP است، نه دلیل.** Fastify برای بدنه‌ی نامعتبر `{ error: 'Bad Request', message: 'body/email must match format "email"' }` می‌فرستد؛ دلیل در `message` است و در `details[].path` زود. ۹ کانتینر فقط `data.error` را می‌خواندند و کاربر «Bad Request» یا یک «Error» خالی می‌دید. همیشه `apiErrorMessage()` از `@hisabche/api` (گارد: `error-reading-is-shared.test.ts` کل `components/ui` را می‌گردد).
- ⚠️ **اگر سرور اسم فیلد را گفته، کاربر را ببر سر همان فیلد.** `apiErrorFields()` + هوک `useServerFieldErrors()`: پیام زیر همان اینپوت، اسکرول و فوکوس روی آن. هر کنترل باید `name` (یا `data-field` برای کنترل‌های سفارشی) با **همان اسمی که API می‌شناسد** داشته باشد. اگر خطا به فیلدی مربوط نیست، هیچ فیلدی را مقصر نکن — یک پیام کلی بالای فرم.
- ⚠️ **اتریبیوت خط‌دار در JSX از excess-property check معاف است.** `data-field` روی کامپوننتی که آن را فوروارد نمی‌کند بی‌صدا دور ریخته می‌شود و tsc ساکت می‌ماند. هر `data-*` که معنا دارد باید در props اعلام شود.

**قرارداد داده‌ی بین لایه‌ها**

- ⚠️ **`GET /api/employees` ردیف خام دیتابیس را می‌فرستد: `first_name`، `hire_date`، `employee_code`.** یک صفحه آن را camelCase تایپ کرده بود، پس همه‌ی نام‌ها `undefined` شدند و لیست «مدیر شعبه» شد «undefined undefined». تایپ، چکِ زمان اجرا نیست (§۷٫۲) — قبل از تایپ‌کردن یک پاسخ، شکل واقعی‌اش را از سرویس بخوان.
- ⚠️ **سرویس حق ندارد چیزی را که کلاینت صریحاً فرستاده دور بیندازد.** `createPayroll` همیشه `status: 'draft'` می‌نوشت و `payment_date` را اصلاً نمی‌نوشت، پس «ثبت پرداخت» هیچ‌وقت «پرداخت‌شده» نمی‌شد. اگر مقداری نباید از کلاینت پذیرفته شود، از schema حذفش کن؛ بی‌صدا نادیده‌گرفتنش باگی است که تست سبز نشانش نمی‌دهد.
- ⚠️ **فهرست ارز یکی است.** `currencyCodeSchema` (۲۵ کد) تنها فهرست مجاز است؛ فهرست خصوصی چهارتایی حقوق باعث شد نشود حقوق را به یورو یا تومان داد. هر کد جدید باید در `FRACTION_DIGITS` هم بیاید وگرنه `currency-policy.test.ts` قرمز می‌شود — تست را شل نکن.
- ⚠️ **نوتیفیکیشن نباید بتواند نوشتنِ انجام‌شده را برگرداند.** بعد از ذخیره‌ی تغییر، خطای ارسال فقط log می‌شود. و کسی که حساب کاربری ندارد نوتیف نمی‌گیرد — جایگزین حدسی ممنوع (§12).

**ابزار**

- ⚠️ در این محیط `python -`، `cat > file` بدون heredoc، و heredoc پایتون با `</dev/null` **hang می‌کنند** (۴ بار). اسکریپت را با Write بنویس و `python file.py </dev/null` اجرا کن.
- یک formatter بعد از هر ذخیره فایل را بازنویسی می‌کند: replace دقیق بعد از ذخیره شکست می‌خورد → Read + Edit، یا Write کامل.
- `next start` بیلد را فقط هنگام شروع می‌خواند؛ بعد از build سرور preview را restart کن.
- ⚠️ `git checkout -- <file>` کار انجام‌نشده‌ی سشن را نابود می‌کند. قبل از هر بازگردانی diff را ببین.
- `\n` و `\r` داخل رشته‌ی پایتون در heredoc به کاراکتر واقعی تبدیل می‌شوند و فایل را خراب می‌کنند. برای فایل بزرگ از ابزار Write استفاده کن.
- در تست، برای رشته‌های پر از metacharacter از `toContain` استفاده کن نه `toMatch` — الگوی نامعتبر تست را «no tests» می‌کند، نه قرمز.
- Jest ≠ Vitest: `expect(x, 'message')` فقط vitest است.

**هسته‌ها (CRM / Payments)**

- داده‌ی CRM را فقط از `backend/src/services/crm` (index/port) بخوان؛ هیچ سرویس دیگری جدول `interactions`/`opportunities` را مستقیم نمی‌خواند (`crm-core.test.ts` گارد است). در UI برای تصویر CRM یک مشتری `CustomerCrmPanel` را بگذار، دوباره نساز.
- کلیدهای React Query خلاصه/صورت‌حساب/فعالیت مشتری زیر `paymentKeys.all` هستند؛ هر mutation مالی (پرداخت، فاکتور) باید آن را invalidate کند.
- سود هر کالا/فاکتور فقط از `AccountingService.getProfitReport / getProductProfits / getInvoiceMargins` (گارد: `profit-report.test.ts`). موجودی هر انبار از `warehouse-summary.domain.ts`؛ فاکتور `warehouseId` را می‌فرستد، وگرنه با چند انبار هیچ انباری حرکت نمی‌کند.
- سقف اعتبار، مهلت پرداخت، تأمین‌کننده‌ی وصل و مدارک مشتری فقط از `backend/src/services/customer-profile` (گارد: `customer-profile-core.test.ts`). خواندن schema جدید قبل از اجرای migration باید `isMissingSchema` را چک کند و «پیکربندی نشده» برگرداند، نه ۵۰۰.
- سود هر کالا/فاکتور فقط از `AccountingService` (`getProfitReport` / `getProductProfits` / `getInvoiceMargins`، قاعده در `accounting/profit-report.domain.ts`، گارد `profit-report.test.ts`). موجودی هر انبار از `inventory/warehouse-summary.domain.ts`؛ فاکتور باید `warehouseId` بفرستد، وگرنه با چند انبار موجودی هیچ انباری حرکت نمی‌کند.

---

## ۹. تست

- تست‌های source-assertion باید **اول کامنت‌ها را حذف کنند**؛ وگرنه یک `not.toMatch` روی کامنتی که همان باگ را توضیح می‌دهد fail می‌شود. الگو: `packages/ui/src/__tests__/activities-table-columns.test.ts`.
- هر گارد را **injection-test** کن: فیکس را موقتاً برگردان و ببین تست واقعاً قرمز می‌شود.
- هر کلید i18n جدید در هر سه locale، و تست‌اش در همان فایل گارد.

---

## ۱۰. ممنوع

کار ادمین تصادفی · فیچر جدید بدون مقایسه · ادیت فایل بی‌ربط · معماری جدید ·
کپی کد یا متن رقیب · تبدیل پروژه به کلون · `any` و `@ts-ignore` و `eslint-disable` ·
کد مرده و import بلااستفاده · **ادعای PASS بدون خروجی واقعی**.
