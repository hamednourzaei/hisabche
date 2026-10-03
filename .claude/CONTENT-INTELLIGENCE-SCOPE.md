# CONTENT INTELLIGENCE LAYER — اسکوپ‌بندی و فازبندی

> تاریخ: ۳۰ سپتامبر ۲۰۲۶ · مبنا: ممیزی واقعی ریپو (۶۰+ فایل خوانده شد)
> قانون: `.claude/BUSINESS-OS-EXECUTION.md` — **یک بلاگ، یک CMS، یک صف، یک provider، یک audit، یک SEO**

---

## ۱. چیزی که **هست** و دست نمی‌خورد

| چیز                | مسیر                                                                                      | چرا دست نمی‌خورد                            |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| ۹ route عمومی بلاگ | `apps/web/app/[lang]/blog/**`                                                             | کار می‌کند                                  |
| ۱۵ endpoint        | `backend/src/routes/blog.routes.ts`                                                       | کار می‌کند                                  |
| ۷ فایل Core        | `backend/src/services/blog/`                                                              | domain · repository · sanitize · revalidate |
| ادمین بلاگ         | `apps/admin/components/blog/`                                                             | editor · Tiptap · **SEO panel**             |
| ۷ جدول             | `blog_posts` · `categories` · `tags` · `post_tags` · `comments` · `reactions` · `ratings` | با قیدهای قوی                               |
| AI provider        | `ai-settings.service`                                                                     | انتزاع موجود                                |
| Job                | `distributed-work.ts`                                                                     | claim اتمیک دارد                            |
| Audit              | `AuditService`                                                                            | موجود                                       |
| SEO                | `sitemap.ts` · `robots.ts` · metadata                                                     | یکپارچه                                     |

---

## ۲. شش قرارداد دقیق (خواسته‌ی پرامپت)

### ۱. جدول‌های بلاگ — **کامل‌تر از آنچه پرامپت می‌خواست**

```
blog_posts(id, locale, slug, title, excerpt, content_json, content_html,
           faq, cover_url, cover_alt, meta_title, meta_description,
           focus_keyword, keywords[], canonical_url, og_image_url,
           noindex, status, published_at, author_id, reading_minutes,
           category_id, translation_group_id, created_at, updated_at)

قیدهای موجود که پرامپت نخواسته بود:
  CHECK (slug ~ '^[^[:space:]/?#%]+$' AND length <= 120)
  UNIQUE (locale, slug)
  UNIQUE (translation_group_id, locale)
  CHECK (cover_url IS NULL OR cover_alt IS NOT NULL)      ← کاور بدون alt رد می‌شود
  CHECK (status = 'draft' OR published_at IS NOT NULL)
```

⚠️ **`status` سه‌مقداری است: `draft | scheduled | published`.**
⚠️ **مهاجرت آن ممنوع** — ۳۶ مقاله دارد و این یک قرارداد واقعی است.

### ۲. Entry pointهای repository/service

```
service: list, getBySlug, getById, create, update, publish, unpublish,
         saveProfile, listProfiles, me, comments, reactions, ratings,
         addReaction, setRating, incrementViews, listRelated
route:   GET    /api/blog/posts · /:id · /:id/comments · /:id/me · /sitemap
         POST   /api/admin/blog/:kind · /posts · /images
         PUT    /api/admin/blog/:kind/:id · /posts/:id
         PATCH  /api/admin/blog/comments/:id
         DELETE /api/admin/blog/posts/:id · /:kind/:id
```

### ۳. ⚠️ قرارداد job — **دو مسیر، یکی غلط**

| مسیر                         | claim اتمیک؟                                 | استفاده برای هوش محتوا |
| ---------------------------- | -------------------------------------------- | ---------------------- |
| `distributed-work.claimJobs` | ✅ `FOR UPDATE SKIP LOCKED` + lease ۱۵ دقیقه | **✅ همین**            |
| `job.service.fetchPending`   | ❌ فقط `SELECT` + cache                      | ⛔ استفاده نشود        |

⚠️ **`fetchPending` بدون claim است** — دو instance هر دو یک job را برمی‌دارند.
برای کار AI که دقیقه‌ها طول می‌کشد، این یعنی **دو بار تحقیق** و **دو سطر داده**.

### ۴. قرارداد AI

```ts
AiProvider = 'anthropic' | 'openai'
providerEndpoint(provider, baseUrl)     // '/messages' | '/chat/completions'
AiProviderConfig { provider, baseUrl, model, apiKey, systemPrompt, isEnabled }
AiProviderStatus  → hasApiKey: boolean  (نه خودِ کلید)
```

⚠️ **`ai-chat.service.ts` دو مسیر `fetch` را درون خودش دارد** (خطوط ۲۸۹ و ۳۱۶).
برای pipeline باید **یک بار** refactor شود به یک `callProvider(config, messages)` — وگرنه
مسیر تحقیق و مسیر گفت‌وگو دو پیاده‌سازی از یک چیز می‌شوند.

### ۵. ⚠️ قرارداد مجوز — **فقط یک سطح، بدون نقش سردبیر**

```ts
const admin = { preHandler: [authenticate, platformAdminGuard] }
```

⚠️ یعنی الان فقط **platform admin** می‌تواند منتشر کند.
پرامپت درباره‌ی «editor» و «reviewer» و «author» جدا حرف می‌زند — **هیچ‌کدام وجود ندارند.**

| چیز                                  | وضعیت         |
| ------------------------------------ | ------------- |
| `blog_posts.author_id`               | ✅ هست (uuid) |
| `reviewer_id`                        | ❌            |
| نقش `editor` / `reviewer`            | ❌            |
| جداسازی «می‌نویسد» از «منتشر می‌کند» | ❌            |

⚠️ **این یک تصمیم محصولی است، نه پیاده‌سازی.**

### ۶. ⚠️ فایل‌هایی که باید تغییر کنند — و یک شکاف

| فایل                                         | چه                                               |
| -------------------------------------------- | ------------------------------------------------ |
| `services/ai/ai-chat.service.ts`             | استخراج `callProvider`                           |
| `services/ai/reporting-reader.ts`            | ⚠️ **نه** — آن ۴ view بستهٔ AI است، دست نمی‌خورد |
| `routes/blog.routes.ts`                      | endpointهای `/api/admin/blog/intelligence/*`     |
| `services/blog/blog.service.ts`              | اتصال brief به post                              |
| `apps/admin/components/blog/blog-editor.tsx` | پنل Intelligence                                 |
| `apps/admin/app/[lang]/(admin)/blog/[id]/`   | صفحه‌ی تازه                                      |
| `scheduler/index.ts`                         | ثبت job تحقیق                                    |

⚠️ **شکافی که باید پر شود:** `AUTO_PUBLISH` هرگز. یعنی job هیچ‌وقت `publish` صدا نمی‌زند.

---

## ۳. جدول‌های تازه — **۷ جدول، همه `blog_`-prefixed**

| جدول                    | چرا                            | ستون‌های کلیدی                                                                                                                             |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `blog_content_briefs`   | brief ساخت��افته‌ی قابل ویرایش | topic · locale · search_intent · audience · problem · keywords · article_type · sections · gaps · original_value · **intelligence_status** |
| `blog_research_runs`    | هر تحقیق قابل تکرار و حسابرسی  | brief_id · provider · model · status · started/completed · error                                                                           |
| `blog_sources`          | منابع، بدون تکرار              | url(unique) · domain · source_type · authority · retrieved_at                                                                              |
| `blog_article_sources`  | اتصال مقاله به منبع            | article_id · source_id · claim                                                                                                             |
| `blog_article_versions` | بازگشت‌پذیری                   | article_id · version · content_json · changed_by · generation_meta · **immutable**                                                         |
| `blog_quality_reports`  | نتیجه‌ی validation             | article_id · seo · originality · sources · links · localization · **diagnostics jsonb**                                                    |
| `blog_internal_links`   | پیشنهاد لینک                   | source_article_id · target_type · target_id · anchor · reason · confidence · status                                                        |

⚠️ **`intelligence_status` جدا از `status` است** و هرگز جایگزینش نمی‌شود:

```
none · researching · brief_ready · draft_ready · validation_ready
· review_ready · failed
```

---

## ۴. فازبندی

| فاز   | کار                         | جدول | مهاجرت |
| ----- | --------------------------- | ---- | ------ |
| **۰** | `callProvider` مشترک        | —    | —      |
| **۱** | schema + RLS + research job | ۳    | ۱      |
| **۲** | brief + endpoint ادمین      | —    | —      |
| **۳** | outline + draft + version   | ۱    | ۲      |
| **۴** | quality gate                | ۱    | ۳      |
| **۵** | internal-link + orphan      | ۱    | ۴      |
| **۶** | پنل Intelligence در ادمین   | —    | —      |

⚠️ **هر فاز یک PR و یک مهاجرت.** فاز بعدی تا سبزنشدنی قبلی شروع نمی‌شود.

---

## ۵. تصمیم‌های گرفته‌شده (۳۰ سپتامبر)

### ۵.۱ مجوز — فقط `platformAdminGuard`

⚠️ **بدون جدول نقش تازه.** `blog_posts.author_id` می‌ماند و منتشر کردن همچنان فقط
platform admin است.

پیامد صریح: **یک نفر هم می‌نویسد هم منتشر می‌کند.** این برای یک کسب‌وکار تازه
درست است. اگر روزی نویسنده اضافه شد، این تصمیم باید بررسی شود — و آن‌وقت
کل زنجیره‌ی مجوز عوض می‌شود، نه فقط یک guard.

### ۵.۲ منبع وب — Tavily، جست‌وجوی زنده

⚠️ **کلید `TAVILY_API_KEY` لازم است.** بدون آن research job باید **با وضعیت
`failed` برگردد** — نه اینکه بدون منبع ادامه دهد.

**سه قانون که در کد enforce می‌شوند، نه فقط در پرامپت:**

| قانون                                                    | دلیل                   |
| -------------------------------------------------------- | ---------------------- |
| فقط **خلاصه‌ی** صفحه، نه متن کامل                        | scraping متن = کپی     |
| `source_type` دارد: `primary \| secondary \| competitor` | بند ۸ پرامپت           |
| URL هرگز از مدل ساخته نمی‌شود، **فقط از پاسخ Tavily**    | «sources must be real» |

⚠️ و یک قاعده که از دیباگ‌های امروز می‌آید: اگر provider پیکربندی نشده،
`callProvider` باید **خطای صریح** بدهد. نه warning، نه fallback خالی.

### ۵.۳ زبان — هر سه موازی، جمع‌آوری بدون تکرار

**تصمیم:** تحقیق برای `fa` · `af` · `en` **موازی** اجرا می‌شود، نتایج **دسته‌بندی**
می‌شوند، و منابع **یک‌بار** جمع می‌شوند.

```
        ┌─ fa ─┐
topic ─┼─ af ─┼─▶ Tavily × 3 ─▶ دسته‌بندی ─▶ منابع یکتا ─▶ brief
        └─ en ─┘                              (بدون تکرار)
```

**سه نکته‌ی اجرایی:**

| نکته                                                     | چرا                                                    |
| -------------------------------------------------------- | ------------------------------------------------------ |
| **موازی، نه پشت‌سرهم**                                   | ۳ رفت‌وبرگشتِ ۲۰۰ms پشت‌سرهم = ۶۰۰ms بی‌دلیل           |
| **تکرار بر اساس URL نرمال‌شده**                          | یک منبع می‌تواند در هر سه جست‌وجو بیاید                |
| **`translation_group_id` همان «یک مقاله، چند زبان» است** | قید `UNIQUE (translation_group_id, locale)` از قبل هست |

⚠️ **خطری که باید ثبت شود:** `af` و `fa` نزدیک‌اند و نتایج یکسان می‌دهند. بدون
تکرارزدایی، brief سه برابر بزرگ‌تر و سه برابر گران‌تر می‌شود. `originalValue`
هم نباید سه بار تولید شود — **یک بار فارسی، و `en`/`af` از ترجمه‌ی همان، نه از
تحقیق جدا.**

### ۵.۴ آنچه این تصمیم‌ها **نمی‌گویند**

⚠️ **`af` = دری است، نه فارسی.** `CLAUDE.md` §۲ می‌گوید ترجمه‌ی ماشینی فارسی،
«دری‌زبان فارسی» بدتر از نداشتن است (در `BUG-063` ۳۶۲ رشته‌ی فارسی در `af`
پیدا شد). پس: **تحقیق سه‌زبانه بله، تولید محتوا فقط `fa`** — و `en`/`af` بعد از تأیید
سردبیر، با واژه‌نامه‌ی خودشان.
