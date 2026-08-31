# کارهای تکراری — دستور دقیق

> هر بخش یک کار است. اگر دستور اینجاست، حدس نزن.

---

## وریفای کامل (قبل از اعلام «تمام شد»)

```bash
npx turbo run type-check                                    # ۱۷ پکیج
cd backend && npx vitest run                                # ۱۱۱۴ تست
cd packages/ui-contract && npx vitest run                   # ۲۲۵ تست
npx turbo run build --filter=@hisabche/web --filter=@hisabche/desktop
node scripts/check-schema-drift.mjs                          # بدون DB
```

⚠️ «تست دامنه پاس شد» چیزی درباره‌ی محصول نمی‌گوید. اگر تغییر روی HTTP دیده
می‌شود، `http-*.test.ts` را هم اجرا کن.

---

## commit — چرا رد می‌شود و چطور درست می‌شود

hook فقط **eslint errors** را مسدود می‌کند. warningها (۳۴۸ تای `any` قدیمی)
مانع نیستند.

```bash
git add -A
git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' > /tmp/s.txt
split -l 50 /tmp/s.txt /tmp/c_
for c in /tmp/c_*; do xargs -a "$c" npx eslint; done
```

⚠️ lint-staged فایل‌ها را تکه‌تکه می‌دهد و **بعد از شکست تکه‌ی اول بقیه را
skip می‌کند** — پس ممکن است خطاهای بیشتری پشت اولی پنهان باشند. تکه‌تکه
خودت اجرا کن تا همه را یک‌جا ببینی.

**تله‌های شناخته‌شده:**

- BOM لفظی در سورس → `no-irregular-whitespace`. با
  `text.charCodeAt(0) === 0xfeff` چک کن، نه با کاراکتر در regex.
- `catch (e)` بدون استفاده → `catch { }`.
- کلید تکراری در object literal.

---

## migration زدن

### چرا اسکریپت مستقیم کار نمی‌کند (پلن رایگان)

هاست مستقیم Supabase **فقط IPv6** دارد؛ pooler هم روی پورت ۵۴۳۲ توسط ISP بسته
است. `$env:ALL_PROXY` **بی‌اثر است** — `node-postgres` سوکت خام باز می‌کند.

### راه درست

```bash
node scripts/bundle-migrations.mjs      # docs/_bundle.sql می‌سازد
```

بعد `docs/_bundle.sql` را در **SQL Editor** پیست کن (مرورگر از HTTPS/443
می‌رود، پس مسئله‌ی شبکه اصلاً وجود ندارد). قبلش **بکاپ**.

بعد از اجرا:

```sql
-- docs/_verify-after.sql   → ۸ بررسی، هرکدام با حکم خودش
-- docs/_verify-rls.sql     → RLS واقعی با نقش authenticated
```

### اگر اتصال مستقیم روزی کار کرد

`.env.migrate` در ریشه (gitignored):

```
DATABASE_URL=postgresql://postgres.<ref>:PASS@aws-0-<region>.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=...
```

⚠️ **Session pooler، پورت ۵۴۳۲** — نه ۶۵۴۳. حالت transaction اتصال را بین
statementها پس می‌دهد و DDL را نیمه‌کاره رها می‌کند.

```bash
node scripts/run-migrations.mjs           # dry-run
node scripts/run-migrations.mjs --apply
```

### نوشتن migration جدید

1. فایل در `docs/<name>-migration.sql` (بدون `_` در ابتدا)
2. **idempotent**: `IF NOT EXISTS`، `DROP POLICY IF EXISTS` قبل از `CREATE POLICY`
3. به آرایه‌ی `ORDER` در `scripts/run-migrations.mjs` اضافه کن
4. ستون و backfill را در **یک تراکنش** بگذار — وگرنه کوئری‌ای که امروز با
   خطای واضح می‌افتد، فردا **موفق** می‌شود و **هیچ** برمی‌گرداند
5. `node scripts/bundle-migrations.mjs`

---

## افزودن یک قابلیت جدید (هفت لایه)

```
1. backend/src/services/<x>/<x>.domain.ts     قوانین خالص + تست
2. backend/src/services/<x>/<x>.service.ts    TenancyContext می‌گیرد
3. backend/src/routes/<x>.routes.ts           گاردها به ترتیب
   └─ در backend/src/index.ts با prefix register کن
4. docs/<x>-migration.sql                     جدول + RLS + policy
5. packages/api/src/hooks/<x>.ts              + export در index.ts و hooks/index.ts
6. packages/ui/src/components/ui/<x>/         view + containers/
   └─ export در packages/ui/src/index.ts و screens.ts
7. صفحه در هر سه اپ:
   apps/web/app/[lang]/(dashboard)/<x>/page.tsx    نازک، فقط metadata
   apps/desktop/src/features/.../                  از @hisabche/ui/screens
   apps/mobile/app/<x>.tsx + src/features/<x>/screens/
```

اگر مقصد ناوبری است: `NavId` و ورودی در `packages/ui-contract/src/navigation.ts`،
آیکون در `packages/ui/src/lib/menu/nav-items.ts` و
`apps/mobile/src/shared/navigation/nav.ts`، و id در `IMPLEMENTED` موبایل —
**فقط وقتی صفحه واقعاً وجود دارد**.

کلیدهای i18n در هر سه `packages/i18n/messages/{fa,af,en}/common.json`.

---

## نوشتن تست HTTP واقعی

```ts
vi.mock('../db', async () => (globalThis as any).__myFakeDb)
// در beforeAll:
;(globalThis as any).__myFakeDb = createFakeDb(db, users)
const { buildServer } = await import('../index')
app = await buildServer()
```

الگوی کامل در `backend/src/__tests__/http-integration-finance.test.ts`.

⚠️ `fakeId()` باید **uuid معتبر** بسازد، وگرنه zod در مرز روت رد می‌کند و
شبیه باگ سرویس به نظر می‌رسد.

⚠️ هارنس **RLS، کلید خارجی و تراکنش را اثبات نمی‌کند**. آن‌ها فقط روی دیتابیس
واقعی با `docs/_verify-rls.sql`.

⚠️ خواندن با embed پستگرست (`lines:journal_lines(...)`) را fake حل نمی‌کند —
در handler مربوطه، بچه‌ها را روی خود ردیف والد هم بگذار.

---

## کار روی UI

**فقط از `packages/ui` استفاده کن**: `Card` `Button` `Badge` `Input` `Select`
`Table` `Skeleton` `EmptyState`. `capability-kit` یک آداپتور نازک روی همین‌هاست.

⚠️ **کلاس arbitrary مثل `max-h-[60vh]` در `packages/ui` تولید نمی‌شود** —
Tailwind سورس اپ وب را اسکن می‌کند و این پکیج در content glob نیست. کلاس در
markup می‌آید و هیچ قاعده‌ای برایش وجود ندارد. **inline style بزن.**

⚠️ **radix `SelectItem` مقدار خالی را رد می‌کند.** `<option value="">` یا
placeholder می‌شود یا sentinel (`__all` → `undefined`).

⚠️ **پنل داخل سلول جدول clip می‌شود** — `absolute` داخل `overflow-x-auto`
بریده می‌شود و z-index کمکی نمی‌کند. `createPortal` به `document.body` با
`position: fixed`.

⚠️ `Intl.DateTimeFormat().format()` روی تاریخ نامعتبر **پرتاب می‌کند**. همیشه
`Number.isNaN(d.getTime())` را اول چک کن.

### دیدن رندر واقعی

```
preview_start { name: "web" }      → http://localhost:3039
```

ورود با دکمه‌ی **«ورود نمایشی»**.

⚠️ dev server وب `packages/ui` را همیشه rebuild نمی‌کند. اگر تغییر دیده نشد،
**اول سرور را restart کن** قبل از اینکه دنبال باگ بگردی.

---

## تله‌های ابزاری

⚠️ **`python - <<'PY'` در این محیط escapeها را خراب می‌کند.** برای هر فایلی که
regex دارد از ابزار **Write** استفاده کن.

⚠️ **`cd` بین فراخوانی‌های Bash پایدار نیست** — همیشه از ریشه‌ی مطلق شروع کن.

⚠️ **regex روی JSX:** `[^>]*` برای attribute کار نمی‌کند — `=>` یک `>` دارد و
تگ را زودتر می‌بندد. `(?<!=)>` یا `[\s\S]*?`.

⚠️ **گاردی که سورس می‌خواند باید اول کامنت‌ها را حذف کند**، وگرنه کامنتِ
توضیحِ یک رفع، همان رفع را قرمز می‌کند.
