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

## ۰٫۵. روش کار — خواسته‌های ثابت صاحب پروژه

- **commit و push نکن.** صاحب پروژه خودش انجام می‌دهد.
- **subagent نساز.** کار را خودت انجام بده.
- **تا همه‌ی کار تمام نشده بیلد نگیر**، و وسط کار نپرس «کدام فاز».
- **بک‌اند، وب، ویندوز، موبایل و اسکریپت Supabase با هم تمام می‌شوند.**
- ترتیب پایان هر دور: وریفای کامل → eslint روی فایل‌های تغییرکرده (از پوشه‌ی همان پکیج) → بیلدها →
  درس‌ها در `.claude/` و همین فایل → گزارش فارسی با جدول و عددهای واقعی.
- وضعیت‌های مجاز گزارش: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` ·
  `BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED`.
  بدون HTTP یا دیتابیس واقعی، هیچ چیز `VERIFIED_COMPLETE` نیست.

جزئیات: `.claude/skills/hisabche-session-rules/SKILL.md`.

---

## ۰٫۶. یک UX — هاب‌ها (مقایسه‌ی «قبل / بعد» ۵ اکتبر تمام شد)

صاحب پروژه «بعد» را انتخاب کرد. «قبل»، سوییچ، `useUxVersion`، `visibleInUx` و فیلد `ux:` **حذف شدند**
— دوباره نسازشان (گارد: `packages/ui/src/__tests__/one-ux.test.ts`).

- **هر صفحه یک هاب است:** تب‌ها بالا (`HubTabs`/`PageHub`)، زیرشان فقط **یک** سوییچ (`SegmentedControl`)،
  یک بخش روی صفحه. تب در `?tab=` و بخش در `?view=` است.
- **route ای که با صفحه‌ای داده‌ی مشترک دارد، تب یا بخشِ همان صفحه می‌شود** — نه route تازه، نه مورد منو.
- **نشانی قدیمی نمی‌میرد:** صفحه‌ای که بخش شد، یک جفت در `moved` (`apps/web/next.config.js`) و همان
  جفت به‌صورت `<Navigate>` در `packages/app-shell/src/app/app.tsx` می‌گیرد. دو فهرست باید یکی باشند
  (گارد: `route-parity.test.ts`). ۲۵ جفت داریم؛ ۱۸ پوشه‌ی صفحه‌ی وب حذف شد.
- **قفل بخش = قفل صفحه‌ی قدیمی‌اش.** کلیدهایی مثل `/bank` و `/expiry` در `NAV_MODULE` می‌مانند با اینکه
  دیگر در منو نیستند — `isNavLocked(source)` بخش را با همان‌ها پنهان می‌کند. حذفشان = نمایش بخش به کسی که
  ماژولش قفل است. فهرست بسته در `nav-module-locks.test.ts`.
- **لینک به بخش، با نشانیِ هاب:** `/accounting?tab=treasury`، نه `/bank` (صف کار، راهنما، `entity-route`).
  کلید query‌دار در `ROUTE_DOCS_MAP` فقط برای «باز کردن در برنامه» است و هرگز با pathname جور نمی‌شود.
- ⚠️ `/sync-center` عمداً صفحه مانده: در ویندوز صفحه‌ی صف خروجیِ خودِ دستگاه است (`features/sync/sync-page.tsx`)،
  نه همان کانتینر مشترک.

جزئیات: `.claude/SESSION-CACHE-2026-10-05-UX.md` · مهارت `hisabche-ux-consolidation`.

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

| سؤال                                                                  | فایل                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **وبلاگ: نقشه، تله‌ها، تصمیم‌ها (۲۶ سپتامبر)**                        | `.claude/SESSION-CACHE-2026-09-26-BLOG.md`                                  |
| **Sync باینری، بارکد/چاپ، پرفورمنس DB، Cloudflare (۲۷ سپتامبر)**      | `.claude/SESSION-CACHE-2026-09-27.md`                                       |
| **Business OS ۱۵۰ قابلیت: نقشه، فازبندی، درس‌ها (۳۰ سپتامبر)**        | `.claude/BUSINESS-OS-SPEC.md` · `BUSINESS-OS-EXECUTION.md`                  |
| **درس‌های فازهای ۰–۴ Business OS (۳۰ سپتامبر)**                       | `.claude/SESSION-CACHE-2026-09-30-BUSINESS-OS.md`                           |
| **🔴 مسائل باز امروز — این را اول بخوان**                             | `.claude/SESSION-CACHE-2026-09-30-FINDINGS.md`                              |
| **کیف پول، عکس کالا، بازار کالا، refresh token، دری (۳ اکتبر)**       | `.claude/SESSION-CACHE-2026-10-03.md`                                       |
| **Business OS: کدام موتور واقعاً وصل است؛ فاکتور تکراری (۴ اکتبر)**   | `.claude/SESSION-CACHE-2026-10-04-BUSINESS-OS-WIRING.md`                    |
| **صفحه‌ی تحلیل، آنچه از ۱۵۰ قابلیت وصل نشد و چرا (۴ اکتبر)**          | `.claude/SESSION-CACHE-2026-10-04-BUSINESS-OS-WIRING.md` — «دور دوم»        |
| **ساخت و تولید: مدل، نقشه، آنچه ساخته نشد (۴ اکتبر)**                 | `.claude/SESSION-CACHE-2026-10-04-MANUFACTURING.md`                         |
| **Gap Closure: فهرست قیمت، جریمه، OCR، ترجمه، شیفت، داشبورد، مقایسه** | `.claude/SESSION-CACHE-2026-10-04-BUSINESS-OS-WIRING.md` — «دور پنجم»       |
| **بازبینی UX: هر صفحه یک فایل، پیشنهاد ادغام و فازها (۴ اکتبر)**      | `.claude/ux-audit/README.md` · `00-PROPOSAL.md` — **منتظر تأیید**           |
| **هاب‌ها، خط‌های تب←سوییچ، حقوق/مرخصی، sandbox 403 (۵ اکتبر)**        | `.claude/SESSION-CACHE-2026-10-05-UX.md` · BUG-097…099 در `BUG-REGISTRY.md` |
| **همه‌ی درس‌ها با شماره (۱–۱۱۴)**                                     | `.claude/lessons-learned.md`                                                |
| **واژه‌نامه‌ی دری (af) — برای هر کلید تازه**                          | `.claude/DARI-GLOSSARY.md`                                                  |
| **کوئری‌های تشخیصی دیتابیس زنده**                                     | `docs/FINDING-*.sql` · `docs/TEST-A-BEFORE.sql`                             |
| **باگ‌های Business OS (BOS-01 تا BOS-15)**                            | `.claude/BUG-REGISTRY.md` — بخش انتهایی                                     |
| **کلید API، وب‌هوک، ورود صورتحساب بانک، مقایسه‌ی اکوسیستم**           | `.claude/research/ecosystem-gap-analysis.md`                                |
| **درس‌ها و باگ‌های سشن اخیر (۱۹ سپتامبر)**                            | `.claude/SESSION-CACHE-2026-09-19.md` — **اول این**                         |
| درس‌ها و باگ‌های ۱۵–۱۷ سپتامبر                                        | `.claude/SESSION-CACHE-2026-09-17.md`                                       |
| درس‌ها و باگ‌های اوایل سپتامبر                                        | `.claude/SESSION-CACHE-2026-09.md`                                          |
| **فهرست باگ‌ها با ریشه و گارد**                                       | `.claude/BUG-REGISTRY.md`                                                   |
| **پرفورمنس، PageSpeed، لندینگ موبایل (۱۵ سپتامبر)**                   | `.claude/SESSION-CACHE-2026-09-15-PERF.md`                                  |
| **درخواست‌های باز کاربر — قبل از هر کار**                             | `.claude/USER-REQUESTS.md`                                                  |
| بودجه/صندوق/حاکمیت/۵۰۰ها (۱۴ سپتامبر)                                 | `.claude/SESSION-CACHE-2026-09-14.md`                                       |
| نقشه‌ی کل دانش                                                        | `.claude/README.md`                                                         |
| باگ خوردم / چطور وریفای کنم                                           | `.claude/DEBUG-PLAYBOOK.md`                                                 |
| تله‌های قدیمی‌تر                                                      | `.claude/SESSION-CACHE.md`                                                  |
| چرا این‌طوری نوشته شده                                                | `.claude/lessons-learned.md`                                                |
| الان چه کار می‌کند و چه نه                                            | `.claude/STATE.md`                                                          |
| کد جدید کجا برود                                                      | `.claude/architecture/core-modules.md`                                      |
| کدام hook به کدام endpoint                                            | `.claude/architecture/api-surface.md`                                       |
| جدول‌ها و RLS                                                         | `.claude/architecture/data-model.md`                                        |
| Source of Truth / کدام migration اجرا شده                             | `.claude/SESSION-2026-09-05-CONSOLIDATION.md`                               |
| migration/تست/commit چطور                                             | `.claude/WORKFLOW.md`                                                       |
| مقایسه با ERPNext و Odoo                                              | `.claude/research/`                                                         |
| خواسته‌های محصول                                                      | `.claude/detail.md`                                                         |

---

## ۵. توانایی‌های آماده

**Skills** (`.claude/skills/`) — `hisabche-` + یکی از:
`architecture` · `auth` · `backend` · `code-review` · `database` · `debugging` ·
`desktop` · `i18n` · `lessons` · `mobile` · `offline` · `testing` · `ui` · `web`

و شش مهارتِ «چطور کار را جلو ببرم» (۴ اکتبر) — **`session-rules` را هر سشن اول بخوان**:

| مهارت                          | کِی                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `hisabche-session-rules`       | شروع هر سشن و قبل از پایان هر نوبت: ممنوع‌ها، ترتیب کار، شکل گزارش           |
| `hisabche-feature-delivery`    | هر «اضافه کن / وصل کن / بساز»: از دیتابیس تا سه پلتفرم                       |
| `hisabche-migrations`          | قبل از هر `docs/*-migration.sql`                                             |
| `hisabche-scripted-edits`      | قبل از هر ویرایش چندفایلی، کلید i18n، یا متن با بک‌اسلش/بک‌تیک               |
| `hisabche-release-build`       | فقط وقتی همه‌ی کار تمام شد: وریفای، lint، بیلدها                             |
| `hisabche-ai-and-integrations` | AI، ایمیل، MCP، خواندن سند، اتصال بیرونی                                     |
| `hisabche-ux-consolidation`    | قبل از تحلیل یک صفحه، پیشنهاد UX، افزودن route یا مورد منو، یا ادغام صفحه‌ها |

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
- ⚠️ **`vi.mock` نسبت به فایل تست resolve می‌شود، نه ماژول.** در `src/__tests__/` مسیر `../services/x` است، نه `../x`. نسخه‌ی اول `repost-service.test.ts` سرویس واقعی را بار کرد و به یک `supabase` واقعی رسید — با خطایی که ربطی به mock نداشت.
- ⚠️ **تاریخ را در fixture بساز، رشونه نکن.** `` `2026-09-${1+days}` `` با `days=30` می‌شود `2026-09-31` و JS **بی‌صدا** به ۱ اکتبر تبدیلش می‌کند. درست: `new Date(Date.UTC(2026, 8, 1+days)).toISOString().slice(0,10)`.
- ⚠️ **قبل از fixture، یک مقدار واقعی بخوان.** `OpenInvoice.total` **major** است؛ با `100_000` فکر می‌کردم minor است یعنی ۱۰۰ میلیون، و دو تست آستانه بی‌صدا `remind` برگرداندند.

**موتورهای تجاری (Business OS)**

- ⚠️ **«وصل است» یعنی از یک route / job / worker به آن می‌رسی — نه اینکه جایی اسمش آمده.** دفتر `unwired-capability` با تعریف «یک mention بیرون از فایل» #۶۸ را WIRED می‌دانست، چون یک سرویسِ خودش‌بی‌مصرف آن را import می‌کرد؛ و سقف «حداکثر ۲ ردیف» ۲۱ موتور Business OS را بیرون دفتر نگه داشته بود. حالا گراف import از entry point ها پیموده می‌شود و هر `*.domain.ts`/`*.service.ts` دسترس‌ناپذیر **باید** در دفتر باشد. قبل از گفتنِ «فاز X انجام شد» همین تست را بخوان.
- ⚠️ **«قابلیت هست» یعنی یک caller در کلاینت دارد.** #۶۵ موتور و route کامل داشت و صفر مصرف‌کننده — الگوی §۷٫۱. گارد `unwired-capability.test.ts` دفتر صریح نگه می‌دارد و **برای سبزشدن باید ردیف حذف شود**.
- ⚠️ **یک job runtime، نه یکی به‌ازای قابلیت.** مالک: `distributed-work.ts` + `email-outbox.ts`. `queue.ts` و `queue/pdf-queue.ts` حذف شدند (صفر caller). guard: `job-authority-guard.test.ts`.
- ⚠️ **مقدارِ «صفر» گاهی باید `null` باشد و آن‌وقت باید صریح باشد.** `if (score < minScore)` با `minScore: 0` هرگز برقرار نمی‌شود — «خاموش با آستانه‌ی صفر» در عمل «روشن» بود. حالت غیرفعال، **شرط جداگانه** است.
- ⚠️ **صفر باورپذیرترین و فاجعه‌بارترین عددی است که یک موتور قیمت می‌سازد.** خطِ بدون quote باید `null` برگردد، نه `0` — وگرنه کالا رایگان با فاکتوری که درست جمع می‌شد.
- ⚠️ **دو ثابتِ یک مقیاس را کنار هم بنویس.** وزن ریسک تأمین‌کننده `(days/14)×100` بود و آستانه‌ی باند ۴۵، پس تأمین‌کننده‌ای که همیشه یک هفته دیر می‌رسید «پایین» گزارش می‌شد.
- ⚠️ **دقیقاً روی آستانه یعنی ریسک.** `<` نه `<=` — مرزی که تعریف خودش را استثنا کند، مرزی نیست که بشود درباره‌اش فکر کرد.
- ⚠️ **دو تابع هم‌نام با واحد متفاوت را یکی نکن.** `accounting.sumMinorUnits` (minor) و `money.sumRounded` (major) هر دو درست‌اند. اسم گمراه‌کننده را عوض کن، رفتار را نه.
- ⚠️ **محدودیت تخفیف روی مشتری، فروش نقدی را هم شامل می‌شود مگر صریح نگیری.** نبودِ `customerId` **هیچ** شرطی را برآورده نمی‌کند — عضویت نیست.
- `zodToJsonSchema` با `exactOptionalPropertyTypes` در `TS2589` می‌افتد (استک ۱٫۵ گیگ). body را `z.any()` بگذار و در handler با `schema.parse()` اعتبارسنجی کن.
- ⚠️ **در این پوسته heredoc و `node -e` با backtick/`$`/بک‌اسلش خراب می‌شوند** (۶+ بار در یک سشن). اسکریپت را با Write بنویس و `node file.js` اجرا کن؛ برای یک خط، Edit.
- ⚠️ **migration با اجرا اثبات می‌شود، نه با خواندن.** `content-intelligence-01` خطای نحوی داشت و تست‌های source-assertion سبز بودند (BUG-090). هر `docs/*-migration.sql` یک `*.pg.test.ts` می‌خواهد که آن را **دو بار** روی Postgres واقعی اجرا کند.
- ⚠️ **حذف‌کننده‌ی کامنت بلوکی، رشته‌ی اسلش‌ستاره را کامنت می‌بیند** و کد بین دو رشته را می‌خورد (`robots.ts`). برای چنین فایلی فقط کامنت ابتدای خط.
- **تست رقابتی پیام خطا را هم بسنجد**، نه فقط تعداد موفق‌ها — وگرنه بدون قفل هم سبز می‌ماند.
- گارد با **فهرست بسته** باید به‌ازای هر عضو جدید ویرایش شود — و آن لحظه‌ای است که کسی «تست را شل می‌کند» به‌جای «قاعده را درست می‌کند». شکل را تطبیق بده (`/await run\w+Tick\(\)/g`)، نه اسم را.

**تحلیل کسب‌وکار (۴ اکتبر)**

- **یک سرویس خواندنی:** `backend/src/services/analysis/analysis.service.ts` هیچ چیزی حساب نمی‌کند؛ ردیف می‌خواند و به دامنه می‌دهد. صفحه `/analysis` و `CustomerRiskNote` (داخل `CustomerCrmPanel`) تنها مصرف‌کننده‌اند — صفحه‌ی تحلیل دوم نساز.
- ⚠️ **جمع پول بدون ارز، بی‌صدا غلط است.** `invoice_outstanding` ستون `currency` دارد؛ هر جمعی روی آن یا به تفکیک ارز است یا با فیلتر یک ارز. fixture مالی حداقل **دو ارز** داشته باشد — با یک ارز این باگ سبز می‌ماند.
- ⚠️ **ورودیِ نداشته را صفر نده؛ خروجی‌اش را حذف کن.** «موجودی نقد» یک عدد قابل‌خواندن نیست، پس نسبت آنی در پاسخ سرمایه در گردش **وجود ندارد**.
- ⚠️ **سری ماهانه ماه‌های خالی را صفر دارد**، وگرنه مشتری‌ای که دیگر نمی‌خرد «ثابت» خوانده می‌شود.
- موتور «خودکار» بانک (`decideAutoMatches`) فقط **یادداشت** می‌گذارد (`review`)؛ تطبیق همچنان فقط با کلیک است.

**اقساط، حضور و غیاب، تخفیف (۴ اکتبر)**

- **قسط برنامه‌ی زمانی است، نه پرداخت.** «پرداخت‌شده»‌ی هر قسط از مانده‌ی فاکتور مشتق می‌شود (`commerce/installment.service.ts`)؛ نوشتن فقط با `installments_save`. جریمه‌ی دیرکرد عمداً وصل نیست.
- **یک `quotePrice`** در `packages/validation/src/schemas/pricing.ts` برای سرور و فاکتورساز (`usePromotionPricer`). تخفیف **بازنشسته** می‌شود؛ ویرایش و حذف ندارد. مبلغ ثابت همیشه ارز دارد و روی ارز دیگر اعمال نمی‌شود.
- **برگه‌ی حضور و غیاب** فقط از `payroll/attendance.service.ts` (`/api/attendance-sheet`). «ثبت‌نشده» ≠ غایب؛ روز باز ساعت ندارد. به حقوق وصل نیست.
- ⚠️ **مسیر قدیمی‌ای که «وجود دارد» را قبل از تکیه‌کردن بخوان:** `GET /api/attendance/:id?month=` با `${month}-31` برای ماه کوتاه ۵۰۰ می‌دهد و مالکیت کارمند را چک نمی‌کند.
- ⚠️ **`postgres.js`: `${json}::jsonb` رشته را دوباره encode می‌کند** → `::text::jsonb`. تست رقابتی باید نتیجه‌ی **موفق** را هم بسنجد (هر دو درخواست می‌توانند با یک fixture خراب شکست بخورند و تست سبز بماند).
- ⚠️ **`<select>` خام ممنوع** — `SelectField` (گارد `select-consistency.test.ts`).
- ⚠️ **بیلد ویندوز پشت پروکسی:** `electron-builder --win -c.electronDist=node_modules/electron/dist` — `@electron/get` برای checksum به npmmirror می‌رود و قطع می‌شود.

**دروازه‌ی MCP و دسترسی‌های Supabase (۴ اکتبر)**

- **MCP یک آداپتور است، نه بک‌اند دوم.** `POST /mcp` (`routes/mcp.routes.ts`) هر ابزار را با `fastify.inject` و **همان کلید API** به مسیر Public API خودش می‌فرستد. هر ابزار = یک کلید از `API_ROUTE_SCOPES`؛ پوشه‌ی `services/mcp` فقط جدول `ai_action_requests` را می‌خواند و ابزار SQL وجود ندارد (گارد: `mcp-gateway.test.ts`). ابزار تازه = اول مسیرش را به allowlist کلیدها اضافه کن.
- **تأیید با سرور و با آدم است.** ابزار `financial`/`destructive` اجرا نمی‌شود؛ درخواست می‌شود و مدیر در «توسعه‌دهندگان» تأییدش می‌کند. اجرا با session همان شخص و `Idempotency-Key = mcp-<id>`. هیچ `confirmed: true` ای در هیچ قراردادی نیست.
- ⚠️ **مسیری که خودش احراز می‌کند باید در `exactPublicPaths` (`index.ts`) باشد.** hook سراسری کلید API را به allowlist محدود می‌کند؛ `/mcp` با همه‌ی تست‌های سبز روی سرور واقعی ۴۰۳ می‌داد، چون تست روی سرور خالی سوار بود.
- ⚠️ **در Supabase هر جدول تازه با ALL برای `service_role`، `anon` و `authenticated` به دنیا می‌آید.** `GRANT SELECT, INSERT` روی آن چیزی را کم نمی‌کند — اول `REVOKE ALL … FROM service_role`. سه migration همین را داشتند و VERIFY کاربر `ok: false` داد، در حالی که تست محلی سبز بود. هر `*.pg.test.ts` باید `ALTER DEFAULT PRIVILEGES … GRANT ALL` را در setup داشته باشد.
- ⚠️ **backtick در کامنت SQL داخل template literal فایل تست را می‌شکند** و pre-commit را قرمز می‌کند.
- ⚠️ **عدد انتظار تست را با دست حساب کن** (BUG-096: بهره‌ی وام ~۱۰۰٪ اصل، و تست همان را قفل کرده بود). کنار عدد دقیق یک assert مقیاسی بگذار.
- جدول «فقط افزودن» را با **trigger** ببند (`entity_notes`، `data_snapshots`؛ forward-only برای `ai_action_requests`)، نه فقط با نبودِ route.
- بیلد اندروید روی این دستگاه گاهی در `createBundleReleaseJsAndAssets` یا `packageRelease` می‌افتد و با اجرای دوباره رد می‌شود (قفل فایل). پیش از دیباگ، یک بار دیگر اجرا کن.

**قیمت، جریمه، سند و مقایسه (۴ اکتبر، Gap Closure)**

- **فهرست قیمت زیر تخفیف‌هاست** (`/promotions`) و یک قاعده دارد: `priceListPricing` در `pricing.ts` — سرور (`promotion.service.quote`) و فاکتورساز (`usePromotionPricer`) هر دو همان را صدا می‌زنند. کالای بیرون از فهرست قیمت خودش را دارد؛ فهرستِ ارز دیگر کنار گذاشته می‌شود، تبدیل نمی‌شود.
- **جریمه‌ی دیرکرد = یک فاکتور فروش معمولی** از `InvoiceService.create`؛ قاعده فقط `overdueInstallments`. اول ردیف `late_fee_assessments` (unique روی فاکتور/قسط/دوره)، بعد فاکتور با کلید قطعی. هیچ job ای جریمه نمی‌زند و جریمه روی فاکتورِ جریمه حساب نمی‌شود.
- **ترجمه و خواندن سند provider تازه ندارند:** همان AI تنظیم‌شده و همان `callProvider` (ورودی `image`). متن و عکس در `ai_query_log` ذخیره نمی‌شود. `read` چیزی نمی‌نویسد؛ `confirm` فقط عددهای آدم را می‌گیرد.
- ⚠️ **`\d` رقم فارسی را نمی‌بیند و نقطه‌ی برهنه در رشته‌ی regex هر کاراکتری است.** هر الگویی که عدد سند را می‌گیرد باید `[0-9۰-۹٠-٩]` و `[.٫]` صریح داشته باشد (`translate.domain`، `printedAmountToMinor`).
- ⚠️ **`\uXXXX` که با Write نوشته شود کاراکتر واقعی می‌شود.** NBSP نامرئی در یک کلاس regex با «تمیزکردن» بی‌صدا رفتار را عوض کرد. escape را با `String.fromCharCode(92)` در فایل بساز و تستش را از کد کاراکتر.
- ⚠️ **بعد از هر دور، eslint را روی فایل‌های تغییرکرده از پوشه‌ی همان پکیج اجرا کن** — pre-commit فایل ویرایش‌شده را با خطاهای قدیمی‌اش هم می‌سنجد.
- **برنامه‌ی شیفت حضور نیست** («حضور ثبت نشده» ≠ غایب). **داشبورد عددی نمی‌سازد** — هر خانه یک گزارش ذخیره‌شده با همان `ReportRunView`. **مقایسه** فقط «فاکتور فروش در روز» است و زیر ۱۰ هم‌تراز چیزی منتشر نمی‌کند؛ خروجی rpc را هم با `selectAllPages` بخوان.
- ⚠️ **بیلد اندروید = اول shell، بعد Gradle** (`pnpm run android:release`). `gradle.mjs assembleRelease` به‌تنهایی با `BUILD SUCCESSFUL` و همه‌ی taskها `UP-TO-DATE` تمام می‌شود و APK قدیمی را دست‌نخورده می‌گذارد — تاریخ فایل APK را نگاه کن، نه پیام Gradle را.
- ⚠️ **route تازه آخرین گزینه است.** ۵۷ route و ۳۶ مورد منو داریم؛ هدف ۲۴ و ۱۱ است (`.claude/ux-audit/00-PROPOSAL.md`). قابلیت تازه تب یا پنلِ یک هاب موجود می‌شود؛ ساختن، ویرایش و ثبت در همان صفحه باز می‌شود (express). صفحه‌ای که فقط لینک می‌دهد و `page.tsx` که فقط redirect می‌کند نساز.
- ⚠️ **«X is not a function» در dev بعد از یک خطای کامپایل = کش مرورگر، نه کد.** `next.config.js` روی `/_next/static` هدر `immutable` می‌گذارد، پس مرورگر تکه‌کد خرابِ قبلی را نگه می‌دارد و ری‌استارت سرور و پاک‌کردن `.next/dev` هیچ کمکی نمی‌کند. Ctrl+Shift+R بزن (یا همان فایل‌ها را با `fetch(url, { cache: 'reload' })` تازه کن).
- ⚠️ **یک UI، چند بار استفاده — دومی نکش** (خواسته‌ی صریح، ۴ اکتبر). تب‌های هاب = `HubTabs` + `useHubTab`؛ «این بخش را نشان بده» = `SegmentedControl`؛ **هر فهرستی** = `DataTable`؛ فیلتر جدول = `TableFilterSelect` در `actions` همان جدول؛ dropdown = `SelectField`. تب‌ها کم (دو تا)، وسط‌چین، هم‌عرض آیتم‌ها و با گوشه‌ی مربعِ ملایم. دو فهرست زیر هم در یک صفحه نگذار — سوییچ بگذار و یکی را نشان بده. سلیقه‌ی کامل: مهارت `hisabche-ux-consolidation` بخش «The owner's taste».
- ⚠️ **«دو خط موازی» ممنوع.** پیش از تکیه بر یک صفحه‌ی فهرست بپرس: چیزی در محصول می‌تواند به آن اضافه کند؟ `/purchasing` سفارش خریدی را فهرست می‌کرد که هیچ UI ای نمی‌ساخت، کنار فاکتور خرید در `/invoices`؛ حذف شد و نشانی‌اش به `/invoices?type=purchase` می‌رود. خرید = فاکتور خرید، در همان یک جدول.
- ⚠️ **هدر `immutable` روی `/_next/static` فقط در production.** در dev اسم تکه‌کد هش محتوا ندارد؛ مرورگر تکه‌ی حذف‌شده را نگه می‌داشت و هر صفحه با «module factory is not available» می‌افتاد (`next.config.js`).
- **گراف کد (Graphify)** در `graphify-out/` هست (۴ اکتبر؛ فقط کد: ۲٬۳۹۶ فایل، ~۱۶٬۶۰۰ گره؛ مستندات و عکس‌ها وارد نشده‌اند). **پیش از grep گسترده یا خواندن فایل کامل، از گراف بپرس:** `explain "<نام نماد>"` برای «این چیست و به چه وصل است»، `path "<A>" "<B>"` برای «چطور به هم می‌رسند»، `query "<واژه‌ها>" --budget 800` برای جستجوی باز (جواب پرسش زبان طبیعی پرنویز است؛ نام نماد بهتر جواب می‌دهد). بعد از تغییر کد: `/graphify . --update`. ⚠️ **همیشه با مسیر کامل اجرا کن:** `C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe` — `graphify` برهنه در PATH هنوز به نسخه‌ی آلوده‌ی قدیمی می‌رسد.
- ⚠️ **select یک dropdown است، نه دیالوگ.** Radix هنگام باز بودن select روی <body> قفل اسکرول می‌گذارد (overflow hidden + position relative)؛ صفحه فریز می‌شد و هدر sticky داشبورد در صفحه‌ی اسکرول‌شده ناپدید. ریشه‌ی `Select` در `select.tsx` حالا <html data-select-open> را علامت می‌زند، `globals.css` قفل را فقط زیر همان علامت برمی‌دارد، و اولین wheel/touchmove بیرون از فهرست آن را می‌بندد. `SelectPrimitive.Root` را مستقیم استفاده نکن (گارد: `select-does-not-lock-the-page.test.ts`).
- ⚠️ **نگاشت دستیِ بدنه در route هر فیلدی را که نام نبرده دور می‌ریزد.** `POST /api/invoices` بدنه را فیلد به فیلد می‌سازد؛ `warehouseId` در فرم، schema و سرویس بود و در نگاشت نبود — انبارِ انتخاب‌شده هیچ‌وقت اعمال نشد و همه‌ی تست‌ها سبز بودند. فیلد تازه‌ی فاکتور = فرم + schema + **همین نگاشت** + سرویس (گارد: `branch-and-warehouse-places.test.ts`).
- **شعبه و انبار روی فاکتور:** شعبه در بدنه (`branchId`) می‌رود و سرور با `branches.resolveActive` می‌سنجد (درخواست است، نه مجوز). فهرست فاکتورها `branchId`/`warehouseId` را سمت سرور فیلتر می‌کند. بخش داخل یک تب هاب در `?view=` است (`useHubSection`).
- ⚠️ **ستونِ اختیاری را جدا بخوان، نه در فهرست ستون‌های اصلی.** نام صندوق (`pos_sessions.label`) در `SESSION_COLUMNS` نیست؛ یک خواندن جدا دارد که روی `42703`/`PGRST204` «فعال نیست» برمی‌گرداند. اگر در فهرست اصلی بود، دیتابیسِ بدون migration کل صفحه‌ی صندوق را ۵۰۰ می‌کرد. هر route نوشتنی تازه در `pos.routes.ts` باید در `concurrency-safety-map.ts` هم بیاید. **صندوق حذف نمی‌شود** — بسته می‌شود.
- **خودکارِ ساعت‌دار:** cadence ماهانه می‌تواند `atMinute` + `timeZone` داشته باشد. `runDue(day, { timed })` دو مجموعه‌ی **جدا** را می‌بیند: گذر روزانه (بی‌ساعت‌ها) و `runTimedAutomationTick` هر پنج دقیقه (ساعت‌دارها). «امروزِ» یک خودکار ساعت‌دار روز محلی خودش است و تا دقیقه‌اش نرسیده «دیروز» حساب می‌شود (`evaluationDay`)؛ `last_checked_on` هرگز عقب نمی‌رود. ⚠️ دوره‌ی بستن ماه = ماهِ **قبل از ماهِ اسلات**، نه «ماهِ روزِ قبل از اسلات».
- **هاب تازه = `PageHub`** (`packages/ui/src/components/ui/page-hub.tsx`): تب‌ها بالا، یک سوییچ زیرش، هر بخش با `source` (قفل ماژول) و `render` (کانتینر خودش، lazy). نوار تب یا سوییچ دستی نکش. `SegmentedFilter` حذف شد — فقط `SegmentedControl`. ⚠️ در heredoc، `
` داخل رشته‌ی تست به خط‌شکستهٔ واقعی تبدیل می‌شود و فایل تست را می‌شکند (سه بار در یک سشن)؛ assert چندخطی ننویس یا فایل را با Write بساز.
- ⚠️ **وضعیتی که هیچ دکمه‌ای عوضش نمی‌کند، بن‌بست است.** `PATCH /api/payrolls/:id` و `PATCH /api/leaves/:id` سال‌ها بی‌caller بودند: هر حقوق «پیش‌نویس» و هر مرخصی «در انتظار» می‌ماند. بعد از هر route نوشتنیِ تازه `node scripts/audit-unwired-routes.mjs` را اجرا کن. حقوق: فقط `PayrollOutcome` + `useSettlePayroll`؛ «پرداخت‌شده» نهایی است (`isPayrollFinal`، رد در شرط WHERE)، «پرداخت نشد» دلیل می‌خواهد. دو راهِ رسیدن به یک وضعیت باید همان اثر جانبی را داشته باشند (حقوقی که از اول `paid` ثبت می‌شد سند دفتر نمی‌زد).
- ⚠️ **گاردِ `toContain` روی یک خط بلند با formatter قرمز می‌شود** — منبع را اول تخت کن (`.split(/\s+/).join(' ')`).
- **خط‌های تب ← سوییچ:** `HubTabs` خودش نوار خط و slot را زیر نوارش می‌کشد (`HubBranchStrip` در `hub-branch.tsx`)؛ سوییچِ همان تب فقط `branch` می‌گیرد (`<SegmentedControl branch />`) و با portal وسط صفحه، زیر تب‌ها می‌نشیند. خط، slot یا wrapper دستی نکش. **هر تب فقط یک سوییچِ `branch`** — سوییچ داخلیِ صفحه‌ی زیرِ تبِ سوییچ‌دار سر جایش می‌ماند. روی همه‌ی هاب‌ها فعال است. ⚠️ گزینه‌ی سوییچ و تب هرگز wrap نمی‌شود — `whitespace-nowrap` + `clamp()`، نه `flex-wrap`. ⚠️ `useCallback` ای که `ref.current` می‌خواند را React Compiler رد می‌کند؛ تابع سطح ماژول + effect.
- ⚠️ **کلاینت روی هر درخواست می‌گوید کدام کسب‌وکار: هدر `x-workspace-id`** (`packages/api/src/lib/client.ts` از `getActiveWorkspaceId()`). سرور بدون آن، برای کسی که بیش از یک workspace دارد **هر درخواست را ۴۰۳ می‌کند** (`chooseWorkspace`). هیچ کلاینتی نمی‌فرستاد و sandbox — دومین workspace همان آدم — کل حساب را روی سایت زنده قفل کرد (BUG-099). هدر باید در `allowedHeaders` بک‌اند هم باشد و **بک‌اند قبل از وب منتشر شود**. گارد: `active-workspace-travels.test.ts`.
- ⚠️ **قابلیتی که تعداد چیزی را از ۱ به ۲ می‌برد (workspace، شعبه، انبار، ارز)، حالتِ «دو تا» را با HTTP واقعی امتحان کن.** fixture تک‌تایی این دسته باگ را سبز نگه می‌دارد.
- ⚠️ **دو پاسخ سرور درباره‌ی یک چیز، یک قاعده:** `GET /workspaces` همان `has_access = true AND suspended_at IS NULL` مسیر مجوز را می‌سنجد؛ وگرنه کلاینت workspace ای را نگه می‌دارد که سرور رد می‌کند. خطای خواندن throw می‌شود، «هیچ نداری» نیست.
- ⚠️ **کش `scope: 'user'` روی routeِ `requireWorkspaceContext` ممنوع** — داده‌ی یک workspace را در دیگریِ همان آدم نشان می‌دهد. `scope: 'member'` یا `'workspace'`.
- ⚠️ **عضویت را با `has_access` صریح بساز** (کد و تابع SQL)؛ به default ستون تکیه نکن (`docs/FIX-403.sql`).
- ⚠️ **اول FINDING، بعد migration.** حدس درباره‌ی دیتابیس زنده را با یک کوئری خواندنی بسنج؛ کدِ ۴۰۳ را از **بدنه‌ی پاسخ** بخوان (`code`)، نه از عدد.
- ⚠️ **راه خروج را پشت همان درخواستی نگذار که ممکن است رد شود** (`SandboxNotice`).
- ⚠️ **`authenticate` یعنی «حساب دارد»، نه «اجازه دارد».** route ای که نه `requireWorkspaceContext` دارد نه `platformAdminGuard`، فقط حق دارد داده‌ی خودِ همان کاربر را بخواند/بنویسد. ده route نقش سراسری و لاگ رویداد همین‌طور باز بودند (BUG-101).
- ⚠️ **سرور وقتی خودش را صدا می‌زند (`fastify.inject`) هم باید workspace را بگوید** — نشست آدم workspace ندارد (BUG-100، تأیید MCP).
- ⚠️ **route بی‌caller را قبل از تکیه‌کردن اجرا کن — ممکن است هرگز کار نکرده باشد.** انتقال بین انبارها: schema می‌گفت `fromGodamId` و سرویس `fromWarehouseId` می‌خواند (پارامتر `any`)، پس هر انتقال «همان انبار» رد می‌شد (BUG-102). پارامتر سرویس را `any` نگذار.
- ⚠️ **هر `.eq('id', …)` روی جدول tenant، `.eq('workspace_id', …)` هم می‌خواهد** — چک نقش در workspace خودت، مجوزِ دست‌زدن به ردیفِ workspace دیگر نیست (لغو دعوت، BUG-103).
- ⚠️ **لندینگ، راهنما و وبلاگ ایستا/ISR هستند؛ Streaming SSR (`<Suspense>`) رویشان نگذار.** روی لندینگ اندازه‌گیری شده: LCP را ۲ ثانیه عقب انداخت و CLS ساخت؛ روی وبلاگ صفحه را dynamic می‌کند. Streaming فقط برای صفحه‌ای است که **در هر درخواست** منتظر داده‌ی کند می‌ماند.
- **چارچوب اتصال‌ها ساخته نشده** (۱۵ تعریف، صفر adapter، صفر اعتبارنامه) — صفحه‌ای برایش نساز.

**هسته‌ها (CRM / Payments)**

- داده‌ی CRM را فقط از `backend/src/services/crm` (index/port) بخوان؛ هیچ سرویس دیگری جدول `interactions`/`opportunities` را مستقیم نمی‌خواند (`crm-core.test.ts` گارد است). در UI برای تصویر CRM یک مشتری `CustomerCrmPanel` را بگذار، دوباره نساز.
- کلیدهای React Query خلاصه/صورت‌حساب/فعالیت مشتری زیر `paymentKeys.all` هستند؛ هر mutation مالی (پرداخت، فاکتور) باید آن را invalidate کند.
- سود هر کالا/فاکتور فقط از `AccountingService.getProfitReport / getProductProfits / getInvoiceMargins` (گارد: `profit-report.test.ts`). موجودی هر انبار از `warehouse-summary.domain.ts`؛ فاکتور `warehouseId` را می‌فرستد، وگرنه با چند انبار هیچ انباری حرکت نمی‌کند.
- ⚠️ **هر تغییر موجودی باید انبارش را بگوید** (وقتی کسب‌وکار انبار دارد): حرکتِ بی‌انبار به «بدون انبار» می‌رود و فروش از انبار کم می‌کند ⇒ کالا ۲۰ و انبار −۱۰ (BUG-080). قاعده فقط `stockEditWarehouse` (`inventory/warehouse-summary.domain.ts`)؛ صفحه‌ی کالا جمع را با اجزایش نشان می‌دهد.
- سقف اعتبار، مهلت پرداخت، تأمین‌کننده‌ی وصل و مدارک مشتری فقط از `backend/src/services/customer-profile` (گارد: `customer-profile-core.test.ts`). خواندن schema جدید قبل از اجرای migration باید `isMissingSchema` را چک کند و «پیکربندی نشده» برگرداند، نه ۵۰۰.
- سود هر کالا/فاکتور فقط از `AccountingService` (`getProfitReport` / `getProductProfits` / `getInvoiceMargins`، قاعده در `accounting/profit-report.domain.ts`، گارد `profit-report.test.ts`). موجودی هر انبار از `inventory/warehouse-summary.domain.ts`؛ فاکتور باید `warehouseId` بفرستد، وگرنه با چند انبار موجودی هیچ انباری حرکت نمی‌کند.

**ساخت و تولید (۴ اکتبر)**

- **یک هسته:** بها فقط `computeProductionCost` (`packages/validation/src/schemas/manufacturing-cost.ts`)؛ ذخیره‌ی فرمول و ثبت تولید فقط با `manufacturing_save_bom` / `manufacturing_complete` (`.rpc()`). صفحه‌ی تولید، صفحه‌ی کالا، گزارش و داشبورد همه از همان هوک‌ها و همان `ProductionEditor` می‌خوانند — محاسبه‌ی دوم نساز (گارد: `manufacturing-screen.test.ts`).
- ⚠️ **گردکردن قیمت ≠ گردکردن بها.** فاکتور بهای واحد را به اعشار ارز گرد می‌کند؛ بهای تولید ۴ رقم اعشار می‌گیرد (`productionMoneyContext`)، وگرنه با ارز بدون اعشار هر گرم ۰٫۰۶ صفر می‌شود (BUG-094).
- ⚠️ **فرمولِ استفاده‌شده ویرایش نمی‌شود، بازنگری می‌شود** (ردیف تازه، `version+1`). تاریخچه و گزارش فقط `work_order_lines` (snapshot) را می‌خوانند، هرگز BOM فعلی یا قیمت امروز کالا.
- ⚠️ **«تکمیل» یعنی تولید.** `status: 'completed'` از PATCH رد می‌شود؛ تنها راه `POST /api/manufacturing/produce` است (BUG-092).
- ⚠️ **پیام سرور کلید ترجمه نیست مگر در فهرست بسته باشد** (`manufacturing-errors.ts`)؛ `t()` روی پیام ناشناخته صفحه را می‌اندازد.
- تولید **ONLINE_ONLY** است و **سند دفتر کل نمی‌زند** (WIP/سربار تصمیم صاحب کار است) — ادعای خلافش نکن.

**زمان‌بندی و فاکتور تکراری (۴ اکتبر)**

- **یک اجراکننده:** `automation.service` از `runAutomationTick` (`scheduler/index.ts`) — کِی و آیا را `schedule.domain` می‌گوید، خودِ کار را سرویس همان دامنه انجام می‌دهد (فاکتور تکراری = `InvoiceService.create`). اجراکننده هیچ فاکتور، حرکت انبار یا سند دفتری از خودش نمی‌نویسد.
- ⚠️ **اکشن تازه = عضو تازه در `EXECUTABLE_ACTIONS` + شاخه‌ی اجرا + تست.** نام در union کافی نیست: اجرای اکشنِ بدون شاخه `AUTOMATION_ACTION_NOT_SUPPORTED` ثبت می‌کند، بی‌صدا رد نمی‌شود.
- ⚠️ **`isoDateSchema` instant است** (`…T00:00:00.000Z`)، نه `YYYY-MM-DD`. بدنه‌ای که برای schema فاکتور می‌سازی را با خودِ schema تست کن.
- هر صفحه یا قابلیت تازه: راهنمای عمومی در `DOCS_ARTICLES` (خودکار در سایت‌مپ) + لینک از یک مقاله‌ی مرتبط + `ROUTE_DOCS_MAP`.

**پلتفرم توسعه‌دهنده (کلید API / وب‌هوک)**

- ⚠️ **کلید API فقط route های `API_ROUTE_SCOPES` را باز می‌کند و این تصمیم داخل `authenticate` است**، نه بعدتر: ۳۲ فایل route فقط عضویت را چک می‌کنند و بعضی فقط `authenticate` دارند. route تازه‌ای که کلید باید برسد را **صریحاً** به allowlist اضافه کن — و باید `requireWorkspaceContext` داشته باشد (گارد: `developer-platform.test.ts`).
- رویداد وب‌هوک از سه جا می‌آید و فقط از این سه: (۱) `logBusinessEvent` → `developerService.emitEvent` برای فاکتور، مشتری، کالا و پرداخت؛ (۲) تریگر `products_stock_webhook_trg` روی projection موجودی برای `inventory.low_stock` / `inventory.restocked` — فقط روی **عبور** از `min_stock_level`، و خطایش هرگز فروش را متوقف نمی‌کند؛ (۳) `order.*` فقط از `transition_sales_order` / `create_sales_order` (هر گذار = یک رویداد). رویداد جدید = نگاشت + `WEBHOOK_EVENTS` + برچسب در هر سه زبان (`developers-screen.test.ts`). رویدادی که گیرنده scope خواندنش را ندارد منتشر نمی‌شود. **هیچ `order.*` ای بیرون از state machine سفارش منتشر نمی‌شود.**
- ⚠️ route با prefix (`/api/payments`) در Fastify دو الگوی جدا دارد: `/api/payments` و `/api/payments/`. allowlist فقط اولی را باز می‌کند؛ دومی بسته می‌ماند.
- ⚠️ **توکن برنامه‌ی OAuth خودش یک ردیف `api_keys` با `app_id` است** — سیستم توکن دوم نساز. حذف نصب = باطل‌کردن همان کلید (تریگر `api_keys_end_app_installation_trg` نصب را می‌بندد و endpoint را برمی‌دارد، از هر مسیری). نصب/به‌روزرسانی/ارسال و انتشار نسخه فقط با تابع‌های migration 07. هر نسخه snapshot پیش‌نویس است؛ کسب‌وکار ناشر پیش‌نویس را آزمایش می‌کند و بقیه فقط نسخه‌ی منتشرشده را می‌گیرند (`liveConfig`). بعد از تغییر scope کلید، `developerService.forgetKeys` — کلید کش را حدس نزن. grant هنگام exchange دوباره با دسترسیِ **فعلی** نصب‌کننده حساب می‌شود. تا سرور `redirect_uri` را تأیید نکرده، به هیچ‌جا redirect نکن (open redirect).
- **Sandbox یک workspace است** (`is_sandbox`/`sandbox_of`، migration 06)، نه لایه‌ی تازه — ایزوله‌بودنش از همان `workspace_id` می‌آید. فقط با `create_sandbox_workspace` ساخته می‌شود؛ ورود/خروج فقط با `enterWorkspace` (`packages/ui/src/lib/enter-workspace.ts`)؛ نشانش `<SandboxNotice />` در هر دو shell است.
- ⚠️ **صفحه‌ی وب بیرون از `(dashboard)` فقط namespace هایی را دارد که layoutش می‌دهد** (root فقط CORE). container مشترکی که آن‌جا رندر می‌شود باید layout با `ScopedMessages` و namespace های خودش داشته باشد، وگرنه اولین `t()` صفحه را می‌اندازد (BUG-079، گارد `public-page-namespaces.test.ts`).

**وب عمومی، robots و سه پلتفرم (از باگ‌های ۳ اکتبر)**

- ⚠️ **ستاره در robots.txt اسلش را هم می‌پذیرد.** قانونِ «ستاره، اسلش، invoices» یعنی «هر چیزی، بعد `/invoices`» و `/fa/docs/invoices` و `/fa/blog/accounting-…` را هم می‌بندد (BUG-085: ۲۱ صفحه‌ی راهنما در سایت‌مپ و بسته در robots). `robots.ts` هر قانون زبان‌دار را لنگرشده بیرون می‌دهد (`/fa/invoices`). گارد خروجی واقعی: `robots-does-not-block-public.test.ts`.
- ⚠️ **سایت‌مپ نشانی noindex یا ۴۰۴ نمی‌دهد.** نشانی‌ای که وجودش به داده بسته است (هاب وبلاگ بدون مقاله، بازارِ خاموش) در سایت‌مپ هم با همان داده شرطی می‌شود (BUG-086).
- ⚠️ **بعد از هر تغییر در robots / sitemap / metadata، بازرسی HTTP واقعی** روی `web-prod` (پورت ۳۱۱۱): سایت‌مپ → هر صفحه (کد، robots، canonical، hreflang، title، h1، JSON-LD، لینک‌ها) و هر مسیر خصوصی (noindex). با سوئیت کاملاً سبز ۲۴ مشکل پیدا کرد.
- ⚠️ **ماژولی که barrel `@hisabche/ui` صادر می‌کند و `@hisabche/api` را import می‌کند باید `'use client'` باشد** — وگرنه `next build` می‌افتد و tsc/تست سبز می‌مانند (BUG-082، گارد `index-exports-server-safe.test.ts`). تابع چنین ماژولی را از server component هم نمی‌شود صدا زد.
- ⚠️ **قابلیتی که منبع بیرونی می‌خواهد (عکس https، دوربین) را در سه جا چک کن:** هدرهای `apps/web/next.config.js` (`Permissions-Policy`)، CSP در `apps/desktop/electron/main/index.ts` (`img-src`)، و host موبایل. عکس کالا در ویندوز بلاک بود و دوربین در وب (BUG-089).
- ⚠️ **سه پلتفرم با هم:** هر صفحه‌ی `(dashboard)` وب باید در `packages/app-shell/src/app/app.tsx` هم route داشته باشد (ویندوز و موبایل همان بسته را نشان می‌دهند) و در `DESKTOP_ROUTES` + `navigation.ts`. «اسکریپت Supabase» جزو تعریفِ تمام‌شدن است.

**دیتابیس (از باگ‌های ۳ اکتبر)**

- ⚠️ **`.eq('col', null)` هرگز** — PostgREST آن را `= NULL` می‌فرستد و صفر ردیف برمی‌گرداند؛ mock سبز می‌ماند. `.is('col', null)` (بار سوم؛ گارد `no-eq-null-filter.test.ts`).
- ⚠️ **نام ستون را از فایل migration بخوان.** `started_at` به‌جای `starts_at` ⇒ ۴۲۷۰۳ بلعیده‌شده ⇒ هر کارمند «بدون شعبه» (BUG-088). `node scripts/check-schema-drift.mjs`؛ خروجی‌اش را با grep در `docs/*.sql` تأیید کن.
- ⚠️ **«امروز» = نیمه‌شب محلی، نه UTC.** `backend/src/utils/local-day.ts`؛ منطقه از دستگاه، اعتبارسنجی‌شده، پیش‌فرض صریح، و جزو کلید کش (BUG-087).
- ⚠️ **sandbox یک workspace است و در هر شمارشی می‌آید.** کسب‌وکارها را فقط با `services/workspace-counts.ts` بشمار. ستونِ یک migration اختیاری fallback می‌خواهد (۴۲۷۰۳ → بدون فیلتر)، نه صفر.
- ⚠️ **تابعی که هم ابطال می‌کند هم باید خطا بدهد، نتیجه را برمی‌گرداند** — `RAISE` ابطال را rollback می‌کند (`rotate_oauth_refresh_token` → `reused`).
- ⚠️ **ریست/خالی‌کردن = بازنشسته‌کردن و ساختن دوباره، نه DELETE** از جدول‌های tenant (`reset_sandbox_workspace`).
- **پول بازار و کیف پول:** قیمت را فروشنده صریح می‌دهد (`price_minor`)، قیمت پلن فقط از `plan-pricing.ts`؛ ستون بها/خرید در هیچ خواندن عمومی نیست (`PUBLIC_LISTING_SELECT` فهرست بسته است).

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
