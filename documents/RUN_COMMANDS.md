# دستورات اجرا — Web / Desktop / Mobile

راهنمای اجرای هر سه اپلیکیشن و بک‌اند.

> **pnpm فقط.** این ریپو با `npm` کار نمی‌کند — `packageManager` روی
> `pnpm@11.9.0` قفل است و CI هم فقط pnpm نصب می‌کند.
> Node مورد نیاز: **>= 22.13.0**

---

## ۱. نصب اولیه (یک‌بار)

```bash
pnpm install
```

بک‌اند یک workspace جداست و باید جداگانه نصب شود:

```bash
cd backend && pnpm install
```

سپس فایل env را بسازید:

```bash
cp env.example .env
```

کلیدهایی که باید پر شوند: `SUPABASE_URL`، `SUPABASE_ANON_KEY`،
`SUPABASE_SERVICE_KEY`، `DATABASE_URL`.

---

## ۲. اجرای همه با هم

```bash
pnpm dev
```

`turbo run dev` را اجرا می‌کند و هر workspace ای که اسکریپت `dev` دارد بالا
می‌آید. برای کار روی یک پلتفرم خاص، دستورهای زیر را ببینید.

---

## ۳. Web (Next.js)

```bash
pnpm --filter @hisabche/web dev
```

روی **http://localhost:3039** بالا می‌آید (پورت در اسکریپت ثابت شده است).

| کار                  | دستور                                    |
| -------------------- | ---------------------------------------- |
| Dev                  | `pnpm --filter @hisabche/web dev`        |
| Build                | `pnpm --filter @hisabche/web build`      |
| اجرای نسخه build شده | `pnpm --filter @hisabche/web start`      |
| Type-check           | `pnpm --filter @hisabche/web type-check` |
| تست E2E (Playwright) | `pnpm --filter @hisabche/web test:e2e`   |

مسیرها زیر `apps/web/app/[lang]/` هستند، پس آدرس‌ها locale دارند —
مثلاً `http://localhost:3039/fa/invoices`.

---

## ۴. Desktop (Electron)

```bash
pnpm --filter @hisabche/desktop dev
```

| کار                    | دستور                                        |
| ---------------------- | -------------------------------------------- |
| Dev                    | `pnpm --filter @hisabche/desktop dev`        |
| Build                  | `pnpm --filter @hisabche/desktop build`      |
| Preview نسخه build شده | `pnpm --filter @hisabche/desktop start`      |
| Type-check             | `pnpm --filter @hisabche/desktop type-check` |
| تست                    | `pnpm --filter @hisabche/desktop test`       |
| تست E2E                | `pnpm --filter @hisabche/desktop e2e`        |

خروجی نصبی:

```bash
pnpm --filter @hisabche/desktop package:win
```

برای mac و linux هم `package:mac` و `package:linux` وجود دارد.

اگر ماژول native خطا داد:

```bash
pnpm --filter @hisabche/desktop rebuild:native
```

---

## ۵. Mobile (Expo / React Native)

```bash
pnpm --filter @hisabche/mobile dev
```

`expo start` را اجرا می‌کند؛ QR را با Expo Go اسکن کنید یا از منوی ترمینال
شبیه‌ساز را انتخاب کنید.

| کار             | دستور                                       |
| --------------- | ------------------------------------------- |
| Dev (Metro)     | `pnpm --filter @hisabche/mobile dev`        |
| Android         | `pnpm --filter @hisabche/mobile android`    |
| iOS (فقط macOS) | `pnpm --filter @hisabche/mobile ios`        |
| Type-check      | `pnpm --filter @hisabche/mobile type-check` |
| تست             | `pnpm --filter @hisabche/mobile test`       |
| تست E2E (Detox) | `e2e:android` یا `e2e:ios`                  |

**موبایل build وب‌مانند ندارد** — خروجی نهایی با EAS ساخته می‌شود
(`apps/mobile/eas.json`). در CI فقط `type-check` و `test` اجرا می‌شود.

پیکربندی آدرس‌ها در `apps/mobile/app.json` → `extra`:

- `apiUrl` — آدرس API
- `webUrl` — آدرس سایت، برای ساختن لینک اشتراک فاکتور

هر دو با متغیرهای محیطی `EXPO_PUBLIC_API_URL` و `EXPO_PUBLIC_WEB_URL` قابل
override هستند.

---

## ۶. Backend (Fastify)

workspace جداست؛ دستورها از داخل `backend/` اجرا می‌شوند:

```bash
cd backend && pnpm dev
```

| کار                | دستور (داخل `backend/`) |
| ------------------ | ----------------------- |
| Dev (watch)        | `pnpm dev`              |
| اجرا               | `pnpm start`            |
| Type-check / build | `pnpm type-check`       |
| تست                | `pnpm test`             |

> `build` در بک‌اند فقط `tsc --noEmit` است — یعنی بررسی تایپ، نه تولید خروجی.
> اجرا مستقیماً با `tsx` روی سورس انجام می‌شود.

---

## ۷. دستورهای کل ریپو

```bash
pnpm test
```

```bash
pnpm type-check
```

```bash
pnpm build
```

```bash
pnpm format
```

> `pnpm lint` در حال حاضر عملاً کاری نمی‌کند — اسکریپت `lint` هر اپ روی
> `echo ok` است. ESLint واقعی از ریشه پیکربندی شده و روی فایل‌های staged
> در pre-commit اجرا می‌شود.

---

## ۸. مهاجرت‌های دیتابیس (دستی)

این‌ها در Drizzle نیستند و باید دستی روی دیتابیس اجرا شوند:

```bash
psql "$DATABASE_URL" -f docs/unified-sale-purchase-migration.sql
```

```bash
psql "$DATABASE_URL" -f docs/workspace-stamp-migration.sql
```

اولی ستون‌های `unit` / `unit_label` / `weight_grams` و جدول
`invoice_item_details` را اضافه می‌کند؛ دومی ستون `stamp_url` را برای مهر و
امضا. تا وقتی اجرا نشوند، جزئیات ردیف‌های فاکتور و آپلود مهر کار نمی‌کنند.

هر دو additive هستند (`IF NOT EXISTS`) و بلوک rollback دارند.

---

## ۹. پیش‌نمایش داخل ادیتور

`.claude/launch.json` برای Web و Desktop تعریف شده است، پس ابزار preview
می‌تواند هرکدام را مستقیم بالا بیاورد:

| نام       | پورت |
| --------- | ---- |
| `web`     | 3039 |
| `desktop` | 5174 |
