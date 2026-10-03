# سشن ۱ اکتبر ۲۰۲۶ — Content Intelligence، فاز ۲ تا ۷

> ادامه‌ی `DEBUG-CONTENT-INTELLIGENCE.md` (فاز ۰ و ۱) و `ONE-CLICK-AI-ARTICLE-SCOPE.md`.
> هر دیباگ و تغییر این سشن این‌جا ثبت می‌شود (خواسته‌ی کاربر).

---

## CI-006 — 🔴 `workspace_id` در `blog_sources`: درج روی ستونی که وجود ندارد

**کجا:** `research.service.ts` → `saveResearchRun` (کد commit‌نشده‌ی فاز ۲)

**باگ:** upsert منبع `workspace_id: ctx.workspaceId` می‌فرستاد، ولی migration 01
برای `blog_sources` **هیچ ستون `workspace_id` تعریف نکرده** — طراحی عمدی:
منابع سراسری‌اند و با `url_normalised` یکتا می‌شوند (یک صفحه، یک ردیف، برای
کل محصول).

**اثر اگر migration اجرا می‌شد:** هر درج منبع با 42703 شکست می‌خورد،
`console.error(...); continue` قورتش می‌داد، `blog_sources` خالی می‌ماند —
و بریف همچنان `brief_ready` می‌شد چون handler **لیست درون‌حافظه‌ی Tavily** را
چک می‌کرد نه آنچه persist شده. از دست‌رفتن بی‌صدای داده پشت وضعیت سبز
(§7.3 + §7.5 با هم).

**چرا تست نگرفت:** تست‌های واحد فقط توابع خالص را پوشش می‌دادند
(`mergeSources` و…) و migration هنوز PENDING است — هیچ‌وقت به دیتابیس واقعی
نرسیده بود. باگ یک **توافق بین دو فایل** بود، نه منطق یک فایل.

**فیکس:**

1. `workspace_id` از upsert حذف شد.
2. `saveResearchRun` حالا `failed: number` برمی‌گرداند و منبع‌ها **اول** ذخیره
   می‌شوند، بعد ردیف run با `result_meta: { sourceIds }` — لینک run→sources
   بدون جدول join.
3. Handler وضعیت را از **داده‌ی persist‌شده** می‌گیرد:
   `ready = saved.sourceIds.length > 0 && saved.failed === 0`.
4. `brief_id` واقعاً نوشته می‌شود (قبلاً روی `result` بود و هرگز درج نمی‌شد —
   هر run یتیم می‌ماند).

**گارد:** `brief-service.test.ts` — دو لایه:

- «هیچ جدول content-intelligence ای `workspace_id` ندارد و هیچ سرویسی نمی‌نویسد»
- **پارسر drift عمومی**: ستون‌های تعریف‌شده در migration را از SQL بیرون
  می‌کشد، ستون‌های نوشته‌شده در `.insert/.upsert/.update` هر سرویس را از TS،
  و subset بودن را assert می‌کند — برای هر چهار جدول × هر سه فایل.
- control مثبت (پارسر واقعاً `run_key`/`brief_id`/`result_meta` را می‌بیند) تا
  گارد vacuous سبز نشود.

**Injection-test شد:** باگ برگردانده شد، هر دو گارد قرمز شدند
(`expected [ 'workspace_id' ] to deeply equal []`)، بعد revert شد. ✅

---

## CI-007 — 🟡 `stripComments` تست، `//` را نمی‌شناخت

**علامت:** اولین اجرای `brief-service.test.ts`: دو تست قرمز —
«no workspace_id» (چون **کامنت توضیحی خودم** کلمه را داشت) و «brief_id» دیده
نشد (چون کامنت `//` بین کلیدها پارسر را خراب می‌کرد).

**ریشه:** الگوی کپی‌شده از تست‌های SQL (`--` + `/* */`) برای فایل **TS**
به‌کار رفته بود؛ در TS کامنت خط `//` است.

**فیکس:** stripper پروتکل‌امن: `(^|[^:])\/\/.*$` — یعنی `https://` خورده
نمی‌شود. (درس: stripper کامنت باید به زبان فایل باشد؛ BUG-029 یک بار دیگر.)

---

## CI-008 — 🟡 `brief_ready` روی بریفِ **پر نشده** — دروغ دوم

**باگ:** handler وقتی منبع وجود داشت `brief_ready` می‌زد، بدون اینکه حتی یک
فیلد بریف (intent/sections/keywords) پر شود. «بریف آماده» روی یک ردیف خالی.

**فیکس (فاز ۳):** `brief.service.ts` ساخته شد:

- `generateBrief(briefId, sourceIds)` — مدل از **منابع persist‌شده** نقشه‌ی
  مقاله را می‌سازد؛ خروجی با `briefOutputSchema` (Zod) اعتبارسنجی می‌شود؛
  **بدون provider = throw صریح** (`AI_NOT_CONFIGURED`) نه skip بی‌صدا.
- handler: `if (ready) await generateBrief(...)` **قبل از** update وضعیت —
  اگر تولید شکست بخورد، catch موجود بریف را `failed` می‌کند، نه نیمه‌پر.
- ⚠️ schema عمداً **هیچ فیلد URL ندارد** — zod کلید ناشناخته را دور
  می‌ریزد، پس مدل حتی بخواهد نمی‌تواند citation جعلی persist کند (§13،
  قاعده‌ی ۴). تستش: parse با `url` و `sources` قاچاق‌شده، خروجی پاک است.
- `qualityNotes` اجباری است (آرایه خالی مجاز، نبودِ کلید نه).

---

## فاز ۳ — سرویس بریف + route ها (caller گمشده)

**قبل از این فاز:** handler ‏`CONTENT_RESEARCH` **هیچ caller ای نداشت** —
هیچ route ای job نمی‌ساخت. کل pipeline یتیم بود (§7.1، هفتمین بار در این
ریپو).

**ساخته شد:**

- `POST /api/admin/blog/intelligence/briefs` — بریف + job می‌سازد.
  rate limit: ۱۰/دقیقه (هر POST = ۳ جست‌وجوی Tavily + یک call مدل).
  ⚠️ دابل‌کلیک با **unique index جزئی** در migration مهار می‌شود
  (`blog_content_briefs_one_active_per_topic` روی `(locale, lower(btrim(topic)))`
  WHERE status IN ('none','researching')) — نه با pre-read که race دارد.
  کلیک دوم همان بریف اول را برمی‌گرداند (`existing: true`)، یک بار Tavily.
- `GET /api/admin/blog/intelligence/briefs/:id` — پیشرفت: بریف + همه‌ی run ها
  - منابع واقعی (از `result_meta.sourceIds`، نه از تطبیق موضوع).
- job بعد از commit ردیف بریف enqueue می‌شود (ترتیب برعکس = job یتیم).
- `workspaceId: 'platform'` در payload — بلاگ دارایی پلتفرم است نه یک
  workspace؛ این رشته فقط دامنه‌ی run_key است، هرگز فیلتر tenancy.

**migration 01 ویرایش شد** (هنوز PENDING — انسانی اجرا نشده، پس ویرایشش امن
و درست است): unique index جزئی اضافه شد.

---

## وضعیت فازها

| فاز | کار                     | وضعیت                             |
| --- | ----------------------- | --------------------------------- |
| ۰   | `callProvider` مشترک    | ✅ (سشن قبل)                      |
| ۱   | migration ۴ جدول + گارد | ✅ (سشن قبل) + unique index امروز |
| ۲   | research job (Tavily×3) | ✅ + فیکس‌های CI-006/008 امروز    |
| ۳   | brief + caller routes   | ✅ امروز                          |
| ۴   | draft + version         | 🔜                                |
| ۵   | quality gate            | 🔜                                |
| ۶   | لینک داخلی + orphan     | 🔜                                |
| ۷   | دکمه + جریان ادمین      | 🔜                                |

⚠️ **`TAVILY_API_KEY` هنوز ست نشده** — بدون آن research با وضعیت `failed` و
دلیل صریح برمی‌گردد (درست طبق تصمیم ۵٫۲). تست واقعی HTTP منتظر کلید است.

⚠️ migration 01 **PENDING HUMAN CONFIRMATION** است — هیچ ادعای PASS درباره‌ی
دیتابیس زنده نیست.
