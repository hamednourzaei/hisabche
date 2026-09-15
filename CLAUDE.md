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

| سؤال                                                | فایل                                             |
| --------------------------------------------------- | ------------------------------------------------ |
| **درس‌ها و باگ‌های سشن اخیر**                       | `.claude/SESSION-CACHE-2026-09.md` — **اول این** |
| **پرفورمنس، PageSpeed، لندینگ موبایل (۱۵ سپتامبر)** | `.claude/SESSION-CACHE-2026-09-15-PERF.md`       |
| **درخواست‌های باز کاربر — قبل از هر کار**           | `.claude/USER-REQUESTS.md`                       |
| بودجه/صندوق/حاکمیت/۵۰۰ها (۱۴ سپتامبر)               | `.claude/SESSION-CACHE-2026-09-14.md`            |
| نقشه‌ی کل دانش                                      | `.claude/README.md`                              |
| باگ خوردم / چطور وریفای کنم                         | `.claude/DEBUG-PLAYBOOK.md`                      |
| تله‌های قدیمی‌تر                                    | `.claude/SESSION-CACHE.md`                       |
| چرا این‌طوری نوشته شده                              | `.claude/lessons-learned.md`                     |
| الان چه کار می‌کند و چه نه                          | `.claude/STATE.md`                               |
| کد جدید کجا برود                                    | `.claude/architecture/core-modules.md`           |
| کدام hook به کدام endpoint                          | `.claude/architecture/api-surface.md`            |
| جدول‌ها و RLS                                       | `.claude/architecture/data-model.md`             |
| Source of Truth / کدام migration اجرا شده           | `.claude/SESSION-2026-09-05-CONSOLIDATION.md`    |
| migration/تست/commit چطور                           | `.claude/WORKFLOW.md`                            |
| مقایسه با ERPNext و Odoo                            | `.claude/research/`                              |
| خواسته‌های محصول                                    | `.claude/detail.md`                              |

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
- RTL: `ms-`/`me-`، `ps-`/`pe-`، `text-start`/`text-end`، `border-e`. هرگز `left`/`right`. آیکون جهت‌دار را از `getComputedStyle(node).direction` **انتخاب** کن، با `scale-x-[-1]` آینه نکن.
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

**ابزار**

- ⚠️ `git checkout -- <file>` کار انجام‌نشده‌ی سشن را نابود می‌کند. قبل از هر بازگردانی diff را ببین.
- `\n` و `\r` داخل رشته‌ی پایتون در heredoc به کاراکتر واقعی تبدیل می‌شوند و فایل را خراب می‌کنند. برای فایل بزرگ از ابزار Write استفاده کن.
- در تست، برای رشته‌های پر از metacharacter از `toContain` استفاده کن نه `toMatch` — الگوی نامعتبر تست را «no tests» می‌کند، نه قرمز.
- Jest ≠ Vitest: `expect(x, 'message')` فقط vitest است.

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
