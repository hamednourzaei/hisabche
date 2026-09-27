# سشن ۲۷ سپتامبر ۲۰۲۶ — Sync باینری، بارکد/چاپ، پرفورمنس دیتابیس، Cloudflare

> باگ‌ها با ریشه و گارد: `BUG-REGISTRY.md` → BUG-030 تا BUG-053. این فایل نقشه و تله‌هاست.

## ۱. نقشه‌ی چیزهایی که ساخته شد

| حوزه                        | کجا                                                                                                                   | نکته‌ی کلیدی                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| پروتکل باینری HSB           | `packages/sync/src/wire/*`، `backend/src/routes/sync.routes.ts`                                                       | JSON پیش‌فرض می‌ماند؛ باینری فقط با `Accept`. بعد از فشرده‌سازی فقط ~۱۲٪ کوچک‌تر — ادعای ۶۰–۸۰٪ نکن.                          |
| استریم بیدارباش             | `routes/sync-stream.routes.ts`، `services/sync-stream.ts`                                                             | توکن در subprotocol؛ `authenticate` واقعی؛ یک poller برای هر workspace.                                                       |
| Snapshot                    | `GET /api/sync/snapshot`                                                                                              | keyset روی id، با `version` (BUG-032).                                                                                        |
| بارکد                       | `packages/ui/src/lib/barcode/*`، `GET /api/products/by-barcode/:code`                                                 | سه پاسخ found/ambiguous/unknown؛ تشخیص از `event.code` نه layout.                                                             |
| چاپ رسید                    | `packages/ui/src/lib/print/*`                                                                                         | HTML 58/80mm با درایور ویندوز؛ ESC/POS فقط برای کشو/برش؛ خطای چاپ ≠ خطای فاکتور.                                              |
| context مجوز یک‌رفت‌وبرگشتی | `services/authorization/workspace-access.service.ts` + `docs/workspace-access-rpc-migration.sql`                      | RPC فقط می‌خواند؛ تصمیم با همان توابع مسیر قدیم (`chooseWorkspace`، `parseOverrides`، `parseBlocks`). نبودِ تابع → مسیر قدیم. |
| Cloudflare + failover       | `docs/CLOUDFLARE-EDGE.md`، `packages/api/src/lib/edge-failover.ts`، `utils/trusted-proxies.ts`، `utils/edge-cache.ts` | Worker در مسیر API **نیست** (سقف ۱۰۰k/روز). failover کلاینت فقط چیزی را که دوبار فرستادنش امن است دوباره می‌فرستد.            |
| Realtime                    | `packages/api/src/supabase/realtime.ts`                                                                               | تب پنهان > ۶۰ ثانیه = کانال‌ها بسته، listenerها می‌مانند، برگشت = یک refetch.                                                 |

## ۲. تشخیص پرفورمنس — کجا واقعاً وقت می‌رود

- **Supabase در ap-southeast-2 (سیدنی)، Render در Oregon.** هر رفت‌وبرگشت ~۱۵۰–۳۰۰ms شبکه؛ کوئری ۰٫۱۵ms در
  لاگ ۲۵۰ms است. **تعداد رفت‌وبرگشت ترتیبی** معیار است، نه زمان کوئری. Redis هم دور است (cache hit ≈ ۱۹۵ms)،
  پس کش Redis جای حذف رفت‌وبرگشت را نمی‌گیرد.
- `pg_stat_statements`: ~۴۱٪ `realtime.list_changes` (پولینگ داخلی Realtime به‌خاطر کانال‌های باز)،
  ~۵۰٪ کوئری‌های **داشبورد Supabase** (`pg_proc`، `pg_timezone_names`، extensions) — یعنی خود پنل Studio
  باز در مرورگر. به کوئری‌های داخلی Supabase دست نزن.
- آمار تجمعی است تا `pg_stat_statements_reset()`؛ selectهای `event_log` / `background_jobs` از مسیرهای
  pre-migration بودند که الان اجرا نمی‌شوند. بعد از deploy ریست کن و ۲۴–۴۸ ساعت بعد دوباره بگیر.

## ۳. تله‌های این سشن

- ⚠️ **`String.replace` با `$$`:** در رشته‌ی جایگزین `$$` یعنی `$`. migration بلاگ خراب شد و فقط تست Postgres
  واقعی گرفت (BUG-046). برای SQL از `split(a).join(b)` یا Edit.
- ⚠️ **پل اندروید JSON است** — بایت را base64 کن (BUG-038). هر قابلیت پل را روی هر دو host تست کن.
- ⚠️ **دو لایه‌ی محافظ، injection یکی را نشان نمی‌دهد:** در failover، هم retry صریح و هم interceptor درخواست
  به fallback می‌روند؛ خاموش‌کردن یکی تست را قرمز نکرد. injection را روی لایه‌ای بزن که تنها محافظ یک رفتار است.
- ⚠️ **`must-revalidate` جلوی `stale-if-error` را می‌گیرد.**
- ⚠️ **`count: 'estimated'` یعنی یک EXPLAIN** و عدد planner؛ برای عددی که صفحه‌بندی رویش ساخته می‌شود
  `count: 'exact'` روی **همان** کوئری فیلترشده.
- ⚠️ **Mockهای `supabase` بدون `rpc`:** وقتی middleware مشترک RPC صدا می‌زند، تست‌هایی که `from` را fake
  کرده‌اند ۵۰۰ می‌گیرند — به fake یک `rpc` که PGRST202 می‌دهد اضافه کن تا مسیر fallback را تمرین کنند.
- ⚠️ VERIFY قبل از migration → `42883 function does not exist`. ترتیب: migration، بعد VERIFY.

## ۴. اقدام‌های انسانی باز

1. ✅ `workspace-access-rpc` — migration و VERIFY روی production هر ۷ بررسی `ok` (۲۷ سپتامبر، گزارش انسان).
2. `docs/product-barcode-unique-migration.sql` + VERIFY، `docs/function-search-path-migration.sql`.
3. rotate رمز دیتابیس (BUG-037) و به‌روزکردن Render/Vercel.
4. Cloudflare طبق `docs/CLOUDFLARE-EDGE.md` + `NEXT_PUBLIC_API_FALLBACK_URL`.
5. تصمیم منطقه: Render و Supabase در یک region.
6. Leaked-password protection در Supabase Auth.
7. بعد از deploy: `SELECT pg_stat_statements_reset();` و snapshot دوم.

## ۵. دور دوم (همان روز) — BUG-054 تا BUG-064

| حوزه          | کجا                                               | نکته                                                                                               |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| فاکتور اتمیک  | `invoice_write_document` + `writeInvoiceDocument` | ردیف‌ها در TS ساخته می‌شوند (یک منبع قاعده)؛ SQL فقط با هم می‌نویسد و مالکیت ردیف‌ها را چک می‌کند. |
| ویرایش فاکتور | همان تابع با `p_replace_items`                    | برگشت موجودی = منفیِ خالص حرکت‌های ثبت‌شده؛ `version` اجباری؛ نهایی‌شده = 409.                     |
| امنیت RPC     | `rpc-client-revoke-migration.sql`                 | هر تابعی که بک‌اند صدا می‌زند باید REVOKE داشته باشد — گارد همین را می‌خواهد.                      |
| خواندن کامل   | `selectAllPages`                                  | هیچ `.limit()` بالای ۱۰۰۰ مجاز نیست (گارد).                                                        |
| مراحل outbox  | `outbox-stage.ts`                                 | «ثبت شد» فقط برای این نشست — ردیفِ تحویل‌شده از outbox می‌رود.                                     |
| دوربین        | `barcode.scan` (اختیاری در قرارداد)               | فقط میزبان موبایل دارد؛ دکمه فقط همان‌جا.                                                          |
| برچسب ترازو   | `scale-label.ts`                                  | پیش‌فرض خاموش؛ check digit غلط رد می‌شود؛ مبلغ بدون قیمت واحد = پنجره‌ی مشکل، نه حدس.              |
| چند بارکد     | `product_barcodes`                                | یک کد = یک کالا در هر دو جا (trigger)؛ **فقط آنلاین**.                                             |

### تله‌های دور دوم

- ⚠️ **تابع SECURITY DEFINER بدون REVOKE = API عمومی.** Supabase EXECUTE را به anon می‌دهد؛ anon key عمومی است.
- ⚠️ **`.limit(N)` با N>1000 یک دروغ است** — PostgREST در ۱۰۰۰ می‌بُرد، بی‌صدا.
- ⚠️ **ترجمه‌ی «دری» را با حروف پشتو بسنج** (ږ ښ ې ۍ ټ ډ ړ ڼ ګ) — ۳۶۲ مورد پیدا شد.
- ⚠️ **دو لایه که یکدیگر را می‌پوشانند:** injection روی یکی تست را قرمز نمی‌کند؛ لایه‌ای را بزن که تنها محافظ است.
- ⚠️ **توکن رنگ را grep کن:** `--color-danger` وجود ندارد؛ `--color-destructive` هست. رنگِ ناموجود بی‌صدا هیچ رنگی نمی‌شود.

### ساخته نشد (عمداً، با دلیل)

- **چاپگر بلوتوث موبایل:** ماژول native لازم دارد (نه Expo Go) و بدون دستگاه واقعی قابل وریفای نیست.
- **iOS:** حساب Apple Developer و بیلد EAS لازم است — اقدام انسانی.
- **صفحه‌بندی cursor UI دسته‌ها:** خواندن حالا کامل است؛ صفحه‌بندی UI جداگانه.
- `select('*')` روی `subscriptions` (یک ردیف کوچک) — عمداً دست نخورد.

### migration های جدید برای اجرا (به ترتیب)

1. `rpc-client-revoke-migration.sql` ← **امنیتی، اول**
2. `invoice-write-document-migration.sql`
3. `purchase-order-write-migration.sql` (بعد از ۲)
4. `stock-transfer-idempotency-migration.sql`
5. `product-barcodes-migration.sql` (بعد از product-barcode-unique)
6. VERIFY: `VERIFY-rpc-client-revoke.sql`، `VERIFY-write-functions.sql`
